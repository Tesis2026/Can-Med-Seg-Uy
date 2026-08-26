import {
  ReportStatus,
  type AdverseEventReportDraft,
  type ClassifiedReport,
  type ClassifyReportInput,
  type MspPendingItem,
  type ReviewCorrectionInput,
  type ReviewQueueItem,
  type ReviewReportDetail,
  type SubmittedReportStatus,
} from "@canmedseg/shared";
import type { Pool, PoolClient } from "pg";

import { enqueueMspDelivery } from "../msp/mspOutbox";

type ReportRow = {
  id: string;
  status: SubmittedReportStatus;
  form_data: AdverseEventReportDraft;
  created_at: Date;
  submitted_at: Date;
  reviewed_at: Date | null;
  review_notes: string | null;
};

type QueueRow = {
  id: string;
  submitted_at: Date;
  patient_initials: string | null;
  patient_national_id: string | null;
  adverse_event_description: string | null;
  has_serious_event: boolean;
};

type MspPendingRow = QueueRow & {
  outbox_attempts: number;
  last_error: string | null;
};

export class ReportNotReviewableError extends Error {
  constructor(message = "El reporte ya no está en revisión.") {
    super(message);
    this.name = "ReportNotReviewableError";
  }
}

export class ReportReviewNotFoundError extends Error {
  constructor() {
    super("Reporte no encontrado");
    this.name = "ReportReviewNotFoundError";
  }
}

const TERMINAL_STATUSES = new Set<SubmittedReportStatus>([
  ReportStatus.AprobadoLocal,
  ReportStatus.AprobadoMsp,
  ReportStatus.EnviadoMsp,
  ReportStatus.Rechazado,
]);

function toQueueItem(row: QueueRow): ReviewQueueItem {
  return {
    id: row.id,
    submittedAt: row.submitted_at.toISOString(),
    patientInitials: row.patient_initials ?? "",
    patientNationalId: row.patient_national_id ?? "",
    adverseEventDescription: row.adverse_event_description ?? "",
    hasSeriousEvent: row.has_serious_event,
  };
}

async function loadReviewableReport(
  client: PoolClient,
  reportId: string,
): Promise<ReportRow> {
  const result = await client.query<ReportRow>(
    `SELECT id, status, form_data, created_at, submitted_at, reviewed_at, review_notes
       FROM reports
      WHERE id = $1 AND status = 'en_revision'`,
    [reportId],
  );
  const row = result.rows[0];
  if (!row) throw new ReportReviewNotFoundError();
  return row;
}

async function insertReviewEvent(
  client: PoolClient,
  input: {
    reportId: string;
    reviewerUserId: string;
    action: "correccion" | "clasificacion";
    previousStatus: SubmittedReportStatus;
    newStatus: SubmittedReportStatus;
    previousSnapshot: AdverseEventReportDraft;
    newSnapshot: AdverseEventReportDraft;
    notes?: string | null;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO report_review_events (
       report_id, reviewer_user_id, action,
       previous_status, new_status,
       previous_snapshot, new_snapshot, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      input.reportId,
      input.reviewerUserId,
      input.action,
      input.previousStatus,
      input.newStatus,
      JSON.stringify(input.previousSnapshot),
      JSON.stringify(input.newSnapshot),
      input.notes ?? null,
    ],
  );
}

function applyCorrections(
  report: AdverseEventReportDraft,
  input: Pick<ReviewCorrectionInput, "causality" | "severityGrade">,
): AdverseEventReportDraft {
  return {
    ...report,
    ...(input.causality !== undefined ? { causality: input.causality } : {}),
    ...(input.severityGrade !== undefined ? { severityGrade: input.severityGrade } : {}),
  };
}

function syncSubmittedColumns(report: AdverseEventReportDraft) {
  return {
    severityGrade: report.severityGrade ?? null,
    investigatorCausalRelation: report.causality ?? null,
    adverseEventDescription: report.adverseEventDescription,
  };
}

/** Bandeja de reportes en `en_revision` (RF-5.2). Sin asignación 1-a-1. */
export async function listReviewQueue(pool: Pool): Promise<ReviewQueueItem[]> {
  const result = await pool.query<QueueRow>(
    `SELECT r.id, r.submitted_at, r.patient_initials, r.patient_national_id,
            r.adverse_event_description,
            EXISTS (
              SELECT 1 FROM report_adverse_events e
               WHERE e.report_id = r.id AND e.is_serious = true
            ) AS has_serious_event
       FROM reports r
      WHERE r.status = 'en_revision'
      ORDER BY r.submitted_at ASC`,
  );
  return result.rows.map(toQueueItem);
}

/** Envíos al MSP con reintento pendiente (RF-5.7 — vista parcial). */
export async function listMspPending(pool: Pool): Promise<MspPendingItem[]> {
  const result = await pool.query<MspPendingRow>(
    `SELECT r.id, r.submitted_at, r.patient_initials, r.patient_national_id,
            r.adverse_event_description,
            EXISTS (
              SELECT 1 FROM report_adverse_events e
               WHERE e.report_id = r.id AND e.is_serious = true
            ) AS has_serious_event,
            o.attempts AS outbox_attempts,
            o.last_error
       FROM reports r
       JOIN msp_outbox o ON o.report_id = r.id
      WHERE r.status = 'aprobado_msp' AND o.status = 'pendiente'
      ORDER BY r.submitted_at ASC`,
  );
  return result.rows.map((row) => ({
    ...toQueueItem(row),
    outboxAttempts: row.outbox_attempts,
    lastError: row.last_error,
  }));
}

export async function getReviewReport(
  pool: Pool,
  reportId: string,
): Promise<ReviewReportDetail | null> {
  const result = await pool.query<ReportRow>(
    `SELECT id, status, form_data, created_at, submitted_at, reviewed_at, review_notes
       FROM reports
      WHERE id = $1 AND status <> 'en_progreso'`,
    [reportId],
  );
  const row = result.rows[0];
  if (!row || row.status !== ReportStatus.EnRevision) return null;
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    submittedAt: row.submitted_at.toISOString(),
    report: row.form_data,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    reviewNotes: row.review_notes,
  };
}

/** Correcciones limitadas mientras el reporte sigue en revisión. */
export async function applyReviewCorrections(
  pool: Pool,
  reportId: string,
  reviewerUserId: string,
  input: ReviewCorrectionInput,
): Promise<ReviewReportDetail> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await loadReviewableReport(client, reportId);
    const previous = structuredClone(row.form_data);
    const updated = applyCorrections(previous, input);
    const columns = syncSubmittedColumns(updated);

    await client.query(
      `UPDATE reports
          SET form_data = $2,
              severity_grade = $3,
              investigator_causal_relation = $4,
              adverse_event_description = $5,
              review_notes = COALESCE($6, review_notes),
              updated_at = now()
        WHERE id = $1 AND status = 'en_revision'`,
      [
        reportId,
        JSON.stringify(updated),
        columns.severityGrade,
        columns.investigatorCausalRelation,
        columns.adverseEventDescription,
        input.reviewNotes ?? null,
      ],
    );

    await insertReviewEvent(client, {
      reportId,
      reviewerUserId,
      action: "correccion",
      previousStatus: row.status,
      newStatus: row.status,
      previousSnapshot: previous,
      newSnapshot: updated,
      notes: input.reviewNotes ?? null,
    });

    await client.query("COMMIT");
    const detail = await getReviewReport(pool, reportId);
    if (!detail) throw new ReportReviewNotFoundError();
    return detail;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Clasifica un reporte (RF-5.3). Estados terminales no admiten nueva transición
 * (RF-5.6). El envío MSP queda en outbox stub → `aprobado_msp`.
 */
export async function classifyReport(
  pool: Pool,
  reportId: string,
  reviewerUserId: string,
  input: ClassifyReportInput,
): Promise<ClassifiedReport> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await loadReviewableReport(client, reportId);
    const previous = structuredClone(row.form_data);
    const updated = applyCorrections(
      { ...previous, causality: input.causality },
      input,
    );
    const columns = syncSubmittedColumns(updated);

    let newStatus: SubmittedReportStatus;
    switch (input.decision) {
      case "aprobado_local":
        newStatus = ReportStatus.AprobadoLocal;
        break;
      case "rechazado":
        newStatus = ReportStatus.Rechazado;
        break;
      case "enviar_msp":
        newStatus = ReportStatus.AprobadoMsp;
        break;
    }

    if (TERMINAL_STATUSES.has(row.status) && row.status !== ReportStatus.EnRevision) {
      throw new ReportNotReviewableError();
    }

    const updatedRow = await client.query<{ status: SubmittedReportStatus; reviewed_at: Date }>(
      `UPDATE reports
          SET status = $2,
              form_data = $3,
              severity_grade = $4,
              investigator_causal_relation = $5,
              adverse_event_description = $6,
              review_notes = COALESCE($7, review_notes),
              reviewed_by = $8,
              reviewed_at = now(),
              updated_at = now()
        WHERE id = $1 AND status = 'en_revision'
        RETURNING status, reviewed_at`,
      [
        reportId,
        newStatus,
        JSON.stringify(updated),
        columns.severityGrade,
        columns.investigatorCausalRelation,
        columns.adverseEventDescription,
        input.reviewNotes ?? null,
        reviewerUserId,
      ],
    );

    if (!updatedRow.rows[0]) throw new ReportNotReviewableError();

    if (input.decision === "enviar_msp") {
      await enqueueMspDelivery(client, reportId, updated);
    }

    await insertReviewEvent(client, {
      reportId,
      reviewerUserId,
      action: "clasificacion",
      previousStatus: row.status,
      newStatus,
      previousSnapshot: previous,
      newSnapshot: updated,
      notes: input.reviewNotes ?? null,
    });

    await client.query("COMMIT");
    return {
      id: reportId,
      status: updatedRow.rows[0].status,
      reviewedAt: updatedRow.rows[0].reviewed_at.toISOString(),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
