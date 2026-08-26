import {
  classifiedReportSchema,
  createdReportSchema,
  mspPendingListSchema,
  notifierStatsSchema,
  reportDetailSchema,
  reportDraftDetailSchema,
  reportDraftSummaryListSchema,
  reportDraftSummarySchema,
  reportHistoryListSchema,
  reviewQueueListSchema,
  reviewReportDetailSchema,
  reviewSummarySchema,
  type AdverseEventReportDraft,
  type ClassifyReportInput,
  type CreatedReport,
  type NotifierStats,
  type ReviewSummary,
  type ReportDetail,
  type ReportDraftDetail,
  type ReportDraftSummary,
  type ReportHistoryItem,
  type ReviewCorrectionInput,
  type ReviewQueueItem,
  type MspPendingItem,
  type ReviewReportDetail,
} from "@canmedseg/shared";
import { apiFetch } from "../../lib/api";

export type SubmitReportOptions = {
  /** Borrador del que proviene el envío; se transiciona en vez de duplicarse. */
  draftId?: string | null;
  /** Comprobante del CAPTCHA; obligatorio solo sin sesión (RF-3.6). */
  captchaToken?: string | null;
};

export async function submitReport(
  report: AdverseEventReportDraft,
  options: SubmitReportOptions = {},
): Promise<CreatedReport> {
  return createdReportSchema.parse(
    await apiFetch("/api/reports", {
      method: "POST",
      body: {
        report,
        ...(options.draftId ? { draftId: options.draftId } : {}),
        ...(options.captchaToken ? { captchaToken: options.captchaToken } : {}),
      },
      fallbackMessage: "No se pudo registrar el reporte. Intente nuevamente.",
    }),
  );
}

export async function fetchReport(id: string): Promise<ReportDetail> {
  return reportDetailSchema.parse(
    await apiFetch(`/api/reports/${id}`, {
      fallbackMessage: "No se pudo abrir el reporte.",
    }),
  );
}

/* ------------------------------------------------------------------ *
 * Borradores (RF-4) y historial (RF-6) — solo con sesión iniciada.
 * ------------------------------------------------------------------ */

export async function listDrafts(): Promise<ReportDraftSummary[]> {
  return reportDraftSummaryListSchema.parse(
    await apiFetch("/api/reports/drafts", {
      fallbackMessage: "No se pudieron cargar los formularios en progreso.",
    }),
  );
}

export async function fetchDraft(id: string): Promise<ReportDraftDetail> {
  return reportDraftDetailSchema.parse(
    await apiFetch(`/api/reports/drafts/${id}`, {
      fallbackMessage: "No se pudo abrir el borrador.",
    }),
  );
}

export async function createDraft(
  report: AdverseEventReportDraft,
  options: { keepalive?: boolean } = {},
): Promise<ReportDraftSummary> {
  return reportDraftSummarySchema.parse(
    await apiFetch("/api/reports/drafts", {
      method: "POST",
      body: { report },
      keepalive: options.keepalive,
      fallbackMessage: "No se pudo guardar el borrador.",
    }),
  );
}

export async function updateDraft(
  id: string,
  report: AdverseEventReportDraft,
  options: { keepalive?: boolean } = {},
): Promise<ReportDraftSummary> {
  return reportDraftSummarySchema.parse(
    await apiFetch(`/api/reports/drafts/${id}`, {
      method: "PUT",
      body: { report },
      keepalive: options.keepalive,
      fallbackMessage: "No se pudo guardar el borrador.",
    }),
  );
}

export async function deleteDraft(id: string): Promise<void> {
  await apiFetch(`/api/reports/drafts/${id}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar el borrador.",
  });
}

export async function listOwnReports(): Promise<ReportHistoryItem[]> {
  return reportHistoryListSchema.parse(
    await apiFetch("/api/reports/history", {
      fallbackMessage: "No se pudo cargar el historial.",
    }),
  );
}

export async function fetchNotifierStats(): Promise<NotifierStats> {
  return notifierStatsSchema.parse(
    await apiFetch("/api/reports/stats", {
      fallbackMessage: "No se pudieron cargar las estadísticas.",
    }),
  );
}

export async function fetchReviewSummary(): Promise<ReviewSummary> {
  return reviewSummarySchema.parse(
    await apiFetch("/api/reports/review-summary", {
      fallbackMessage: "No se pudo cargar el resumen de revisión.",
    }),
  );
}

export async function listReviewQueue(): Promise<ReviewQueueItem[]> {
  return reviewQueueListSchema.parse(
    await apiFetch("/api/reports/review-queue", {
      fallbackMessage: "No se pudo cargar la bandeja de revisión.",
    }),
  );
}

export async function listMspPending(): Promise<MspPendingItem[]> {
  return mspPendingListSchema.parse(
    await apiFetch("/api/reports/msp-pending", {
      fallbackMessage: "No se pudo cargar la cola de envíos al MSP.",
    }),
  );
}

export async function fetchReviewReport(id: string): Promise<ReviewReportDetail> {
  return reviewReportDetailSchema.parse(
    await apiFetch(`/api/reports/review/${id}`, {
      fallbackMessage: "No se pudo abrir el reporte para revisión.",
    }),
  );
}

export async function saveReviewCorrections(
  id: string,
  input: ReviewCorrectionInput,
): Promise<ReviewReportDetail> {
  return reviewReportDetailSchema.parse(
    await apiFetch(`/api/reports/review/${id}`, {
      method: "PATCH",
      body: input,
      fallbackMessage: "No se pudieron guardar las correcciones.",
    }),
  );
}

export async function classifyReport(id: string, input: ClassifyReportInput) {
  return classifiedReportSchema.parse(
    await apiFetch(`/api/reports/review/${id}/classify`, {
      method: "POST",
      body: input,
      fallbackMessage: "No se pudo clasificar el reporte.",
    }),
  );
}
