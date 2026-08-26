export const ReportStatus = {
  EnProgreso: "en_progreso",
  EnRevision: "en_revision",
  AprobadoLocal: "aprobado_local",
  AprobadoMsp: "aprobado_msp",
  EnviadoMsp: "enviado_msp",
  Rechazado: "rechazado",
} as const;

export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const REPORT_STATUSES = Object.values(ReportStatus);

/**
 * Estados de un reporte ya enviado. `en_progreso` queda fuera: es el borrador,
 * que vive en la vista «Formularios en progreso» y no en el historial (RF-4.5 / RF-6.1).
 */
export const SUBMITTED_REPORT_STATUSES = [
  ReportStatus.EnRevision,
  ReportStatus.AprobadoLocal,
  ReportStatus.AprobadoMsp,
  ReportStatus.EnviadoMsp,
  ReportStatus.Rechazado,
] as const;

export type SubmittedReportStatus = (typeof SUBMITTED_REPORT_STATUSES)[number];

/** Etiquetas de UI (español) — RF-5.5. */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  [ReportStatus.EnProgreso]: "En progreso",
  [ReportStatus.EnRevision]: "En revisión",
  [ReportStatus.AprobadoLocal]: "Aprobado para análisis",
  [ReportStatus.AprobadoMsp]: "Aprobado, con envío al MSP pendiente",
  [ReportStatus.EnviadoMsp]: "Enviado al MSP",
  [ReportStatus.Rechazado]: "Rechazado",
};

/** Texto de apoyo para el notificador (no para el investigador). */
export const REPORT_STATUS_DESCRIPTIONS: Record<SubmittedReportStatus, string> = {
  [ReportStatus.EnRevision]: "Recibido. Un investigador debe validarlo.",
  [ReportStatus.AprobadoLocal]: "Validado y conservado para el análisis nacional.",
  [ReportStatus.AprobadoMsp]: "Validado; la remisión al MSP está pendiente.",
  [ReportStatus.EnviadoMsp]: "Validado y remitido al Ministerio de Salud Pública.",
  [ReportStatus.Rechazado]: "Se consideró no relacionado con la farmacovigilancia de cannabis.",
};

export function isSubmittedReportStatus(value: unknown): value is SubmittedReportStatus {
  return (
    typeof value === "string" && (SUBMITTED_REPORT_STATUSES as readonly string[]).includes(value)
  );
}
