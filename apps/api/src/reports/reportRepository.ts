import {
  ReportStatus,
  type AdverseEventReportDraft,
  type CreatedReport,
  type NotifierStats,
  type ReportDetail,
  type ReportDraftDetail,
  type ReportDraftSummary,
  type ReportHistoryItem,
  type ReviewSummary,
  type SubmitAdverseEventReport,
  type SubmittedReportStatus,
} from "@canmedseg/shared";
import type { Pool, PoolClient } from "pg";

import { draftRetentionMs } from "../config";

type ReportRow = {
  id: string;
  status: SubmittedReportStatus;
  form_data: AdverseEventReportDraft;
  created_at: Date;
  submitted_at: Date;
};

type DraftRow = {
  id: string;
  form_data: AdverseEventReportDraft;
  current_step: number;
  updated_at: Date;
  draft_expires_at: Date;
};

type HistoryRow = {
  id: string;
  status: SubmittedReportStatus;
  submitted_at: Date;
  patient_initials: string | null;
  patient_national_id: string | null;
  adverse_event_description: string | null;
};

/** Vista de quien consulta un reporte: dueño o revisor (investigador / MSP). */
export type ReportViewer = {
  userId: string | null;
  canReview: boolean;
};

function metadata(row: ReportRow): CreatedReport {
  return {
    id: row.id,
    status: ReportStatus.EnRevision,
    createdAt: row.created_at.toISOString(),
    submittedAt: row.submitted_at.toISOString(),
  };
}

/**
 * Columnas desnormalizadas del reporte enviado. `form_data` guarda el borrador
 * completo; estas columnas son las que consultan los listados y el dashboard.
 */
const SUBMITTED_COLUMNS = [
  "patient_initials",
  "patient_national_id",
  "patient_sex",
  "patient_weight_kg",
  "patient_height_m",
  "patient_birth_date",
  "patient_age_at_event_start",
  "patient_country_of_event_start",
  "adverse_event_description",
  "severity_grade",
  "previous_diseases",
  "has_concomitant_treatments",
  "additional_comments",
  "contact_reporting_area",
  "contact_reporting_area_other",
  "contact_profession",
  "contact_first_name",
  "contact_last_name",
  "contact_health_facility",
  "contact_email",
  "contact_phone",
  "send_email_receipt",
  "form_data",
] as const;

function submittedValues(report: SubmitAdverseEventReport): unknown[] {
  return [
    report.patient.initials,
    report.patient.nationalId || null,
    report.patient.sex,
    report.patient.weightKg ?? null,
    report.patient.heightM ?? null,
    report.patient.birthDate,
    report.patient.ageAtEventStart,
    report.patient.countryOfEventStart,
    report.adverseEventDescription,
    report.severityGrade ?? null,
    report.previousDiseases || null,
    report.hasConcomitantTreatments ?? null,
    report.additionalComments || null,
    report.contact.reportingArea || null,
    report.contact.reportingAreaOther || null,
    report.contact.profession,
    report.contact.firstName || null,
    report.contact.lastName || null,
    report.contact.healthFacility || null,
    report.contact.email,
    report.contact.phone,
    report.contact.sendEmailReceipt,
    JSON.stringify(report),
  ];
}

async function insertEvents(
  client: PoolClient,
  reportId: string,
  report: SubmitAdverseEventReport,
): Promise<void> {
  for (const [position, event] of report.events.entries()) {
    await client.query(
      `INSERT INTO report_adverse_events (
        report_id, position, meddra_term, start_date, end_date, duration_days,
        outcome, is_serious, seriousness_criterion
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        reportId,
        position,
        event.meddraTerm,
        event.startDate,
        event.endDate || null,
        event.durationDays ?? null,
        event.outcome ?? null,
        event.isSerious,
        event.seriousnessCriterion ?? null,
      ],
    );
  }
}

async function insertMedicines(
  client: PoolClient,
  reportId: string,
  report: SubmitAdverseEventReport,
): Promise<void> {
  for (const [position, medicine] of report.medicines.entries()) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO report_medicines (
        report_id, position, name, company, batch_number, access_form, presentation,
        dose, composition_unit, thc_percent, cbd_percent, other_percent, doses_per_day, amount_per_dose,
        administration_route, administration_start_date, administration_end_date,
        administration_duration_days, recent_product_change, recent_product_change_detail,
        indication_text, indication_category, action_taken
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
      ) RETURNING id`,
      [
        reportId, position, medicine.name, medicine.company || null,
        medicine.batchNumber || null, medicine.accessForm ?? null,
        medicine.presentation ?? null, medicine.dose || null, medicine.compositionUnit,
        medicine.thcPercent ?? null, medicine.cbdPercent ?? null,
        medicine.otherPercent ?? null, medicine.dosesPerDay ?? null,
        medicine.amountPerDose ?? null, medicine.administrationRoute ?? null,
        medicine.administrationStartDate, medicine.administrationEndDate || null,
        medicine.administrationDurationDays ?? null, medicine.recentProductChange ?? null,
        medicine.recentProductChangeDetail || null, medicine.indicationText || null,
        medicine.indicationCategory ?? null, medicine.actionTaken ?? null,
      ],
    );

    if (medicine.packageImageName) {
      await client.query(
        `INSERT INTO report_images (report_id, medicine_id, original_name)
         VALUES ($1, $2, $3)`,
        [reportId, inserted.rows[0]?.id, medicine.packageImageName],
      );
    }
  }
}

async function insertConcomitants(
  client: PoolClient,
  reportId: string,
  report: SubmitAdverseEventReport,
): Promise<void> {
  for (const [position, treatment] of report.concomitantTreatments.entries()) {
    await client.query(
      `INSERT INTO report_concomitants (
        report_id, position, name, mg_per_dose, doses_per_day, start_date, end_date, duration_days
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        reportId, position, treatment.name, treatment.mgPerDose ?? null,
        treatment.dosesPerDay ?? null, treatment.startDate, treatment.endDate || null,
        treatment.durationDays ?? null,
      ],
    );
  }
}

async function replaceNestedRows(
  client: PoolClient,
  reportId: string,
  report: SubmitAdverseEventReport,
): Promise<void> {
  await client.query("DELETE FROM report_images WHERE report_id = $1", [reportId]);
  await client.query("DELETE FROM report_adverse_events WHERE report_id = $1", [reportId]);
  await client.query("DELETE FROM report_medicines WHERE report_id = $1", [reportId]);
  await client.query("DELETE FROM report_concomitants WHERE report_id = $1", [reportId]);
  await insertEvents(client, reportId, report);
  await insertMedicines(client, reportId, report);
  await insertConcomitants(client, reportId, report);
}

export class DraftNotFoundError extends Error {
  constructor() {
    super("El borrador no existe o no le pertenece");
    this.name = "DraftNotFoundError";
  }
}

/**
 * Envío del reporte (RF-3, RF-5.1). Si viene de un borrador propio, se
 * transiciona esa misma fila `en_progreso → en_revision` en vez de duplicarla,
 * de modo que el id que vio el notificador sigue siendo el del reporte.
 */
export async function createReport(
  pool: Pool,
  input: SubmitAdverseEventReport,
  /** Sesión del notificador; `null` para el camino anónimo (RF-1.2). */
  notifierUserId: string | null = null,
  /** Borrador del que proviene; solo válido para el dueño de la sesión. */
  draftId: string | null = null,
): Promise<CreatedReport> {
  const client = await pool.connect();
  const report = { ...input, status: ReportStatus.EnRevision, currentStep: 5 };
  const values = submittedValues(report);

  try {
    await client.query("BEGIN");

    let row: ReportRow | undefined;

    if (draftId && notifierUserId) {
      const assignments = SUBMITTED_COLUMNS.map(
        (column, index) => `${column} = $${index + 3}`,
      ).join(", ");
      const updated = await client.query<ReportRow>(
        `UPDATE reports
            SET status = 'en_revision',
                submitted_at = now(),
                updated_at = now(),
                current_step = 5,
                draft_expires_at = NULL,
                ${assignments}
          WHERE id = $1 AND notifier_user_id = $2 AND status = 'en_progreso'
        RETURNING id, status, form_data, created_at, submitted_at`,
        [draftId, notifierUserId, ...values],
      );
      row = updated.rows[0];
      if (!row) throw new DraftNotFoundError();
    } else {
      const placeholders = SUBMITTED_COLUMNS.map((_, index) => `$${index + 2}`).join(",");
      const inserted = await client.query<ReportRow>(
        `INSERT INTO reports (
          status, submitted_at, current_step, notifier_user_id, ${SUBMITTED_COLUMNS.join(", ")}
        ) VALUES (
          'en_revision', now(), 5, $1, ${placeholders}
        ) RETURNING id, status, form_data, created_at, submitted_at`,
        [notifierUserId, ...values],
      );
      row = inserted.rows[0];
      if (!row) throw new Error("PostgreSQL no devolvió el reporte creado");
    }

    await replaceNestedRows(client, row.id, report);
    await client.query("COMMIT");
    return metadata(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Detalle de un reporte enviado. Solo lo ve su notificador o quien tenga permiso
 * de revisión (RNF-1.2): el resto recibe un 404 sin filtrar la existencia.
 */
export async function getReport(
  pool: Pool,
  id: string,
  viewer: ReportViewer,
): Promise<ReportDetail | null> {
  const result = await pool.query<ReportRow>(
    `SELECT id, status, form_data, created_at, submitted_at
       FROM reports
      WHERE id = $1
        AND status <> 'en_progreso'
        AND ($2::boolean OR ($3::uuid IS NOT NULL AND notifier_user_id = $3::uuid))`,
    [id, viewer.canReview, viewer.userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    submittedAt: row.submitted_at.toISOString(),
    report: row.form_data,
  };
}

/* ------------------------------------------------------------------ *
 * Borradores (RF-4) — siempre acotados al usuario de la sesión.
 * ------------------------------------------------------------------ */

function toDraftSummary(row: DraftRow): ReportDraftSummary {
  return {
    id: row.id,
    patientInitials: row.form_data.patient.initials ?? "",
    patientNationalId: row.form_data.patient.nationalId ?? "",
    currentStep: row.current_step,
    updatedAt: row.updated_at.toISOString(),
    expiresAt: row.draft_expires_at.toISOString(),
  };
}

async function purgeExpiredDrafts(pool: Pool, userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM reports
      WHERE notifier_user_id = $1 AND status = 'en_progreso' AND draft_expires_at <= now()`,
    [userId],
  );
}

export async function listDrafts(pool: Pool, userId: string): Promise<ReportDraftSummary[]> {
  await purgeExpiredDrafts(pool, userId);
  const result = await pool.query<DraftRow>(
    `SELECT id, form_data, current_step, updated_at, draft_expires_at
       FROM reports
      WHERE notifier_user_id = $1 AND status = 'en_progreso'
      ORDER BY updated_at DESC`,
    [userId],
  );
  return result.rows.map(toDraftSummary);
}

export async function getDraft(
  pool: Pool,
  id: string,
  userId: string,
): Promise<ReportDraftDetail | null> {
  const result = await pool.query<DraftRow>(
    `SELECT id, form_data, current_step, updated_at, draft_expires_at
       FROM reports
      WHERE id = $1 AND notifier_user_id = $2 AND status = 'en_progreso'
        AND draft_expires_at > now()`,
    [id, userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { ...toDraftSummary(row), report: row.form_data };
}

/** Columnas cortas que alimentan el listado sin abrir el `form_data`. */
function draftDisplayValues(report: AdverseEventReportDraft) {
  return {
    initials: (report.patient.initials ?? "").trim().slice(0, 4) || null,
    nationalId: (report.patient.nationalId ?? "").trim().slice(0, 32) || null,
    currentStep: Math.min(5, Math.max(1, report.currentStep)),
  };
}

/** Autoguardado al pasar de sección (RF-4.2). Crea el borrador la primera vez. */
export async function createDraft(
  pool: Pool,
  userId: string,
  report: AdverseEventReportDraft,
): Promise<ReportDraftSummary> {
  const display = draftDisplayValues(report);
  const result = await pool.query<DraftRow>(
    `INSERT INTO reports (
       status, notifier_user_id, current_step, patient_initials, patient_national_id,
       form_data, draft_expires_at, submitted_at
     ) VALUES (
       'en_progreso', $1, $2, $3, $4, $5, now() + ($6 || ' milliseconds')::interval, NULL
     ) RETURNING id, form_data, current_step, updated_at, draft_expires_at`,
    [
      userId,
      display.currentStep,
      display.initials,
      display.nationalId,
      JSON.stringify({ ...report, status: ReportStatus.EnProgreso }),
      String(draftRetentionMs),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("PostgreSQL no devolvió el borrador creado");
  return toDraftSummary(row);
}

export async function updateDraft(
  pool: Pool,
  id: string,
  userId: string,
  report: AdverseEventReportDraft,
): Promise<ReportDraftSummary> {
  const display = draftDisplayValues(report);
  const result = await pool.query<DraftRow>(
    `UPDATE reports
        SET current_step = $3,
            patient_initials = $4,
            patient_national_id = $5,
            form_data = $6,
            updated_at = now(),
            draft_expires_at = now() + ($7 || ' milliseconds')::interval
      WHERE id = $1 AND notifier_user_id = $2 AND status = 'en_progreso'
    RETURNING id, form_data, current_step, updated_at, draft_expires_at`,
    [
      id,
      userId,
      display.currentStep,
      display.initials,
      display.nationalId,
      JSON.stringify({ ...report, status: ReportStatus.EnProgreso }),
      String(draftRetentionMs),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new DraftNotFoundError();
  return toDraftSummary(row);
}

export async function deleteDraft(pool: Pool, id: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM reports
      WHERE id = $1 AND notifier_user_id = $2 AND status = 'en_progreso'`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

/* ------------------------------------------------------------------ *
 * Historial propio (RF-6).
 * ------------------------------------------------------------------ */

export async function listOwnReports(pool: Pool, userId: string): Promise<ReportHistoryItem[]> {
  const result = await pool.query<HistoryRow>(
    `SELECT id, status, submitted_at, patient_initials, patient_national_id,
            adverse_event_description
       FROM reports
      WHERE notifier_user_id = $1 AND status <> 'en_progreso'
      ORDER BY submitted_at DESC`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    submittedAt: row.submitted_at.toISOString(),
    patientInitials: row.patient_initials ?? "",
    patientNationalId: row.patient_national_id ?? "",
    adverseEventDescription: row.adverse_event_description ?? "",
  }));
}

export async function getNotifierStats(pool: Pool, userId: string): Promise<NotifierStats> {
  const result = await pool.query<{ own: string; total: string }>(
    `SELECT count(*) FILTER (WHERE notifier_user_id = $1) AS own,
            count(*) AS total
       FROM reports
      WHERE status <> 'en_progreso'`,
    [userId],
  );
  const row = result.rows[0];
  return {
    ownSubmitted: Number(row?.own ?? 0),
    totalSubmitted: Number(row?.total ?? 0),
  };
}

/** Carga de trabajo del investigador sobre todos los reportes (RF-5). */
export async function getReviewSummary(pool: Pool): Promise<ReviewSummary> {
  const result = await pool.query<{
    en_revision: string;
    aprobados: string;
    envio_msp_pendiente: string;
  }>(
    `SELECT count(*) FILTER (WHERE status = 'en_revision') AS en_revision,
            count(*) FILTER (WHERE status IN ('aprobado_local', 'enviado_msp')) AS aprobados,
            count(*) FILTER (WHERE status = 'aprobado_msp') AS envio_msp_pendiente
       FROM reports`,
  );
  const row = result.rows[0];
  return {
    enRevision: Number(row?.en_revision ?? 0),
    aprobados: Number(row?.aprobados ?? 0),
    envioMspPendiente: Number(row?.envio_msp_pendiente ?? 0),
  };
}
