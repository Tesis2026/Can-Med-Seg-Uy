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
