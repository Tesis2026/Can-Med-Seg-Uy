import { z } from "zod";

import {
  ANALYTICS_CHARTS,
  ANALYTICS_UNIT_LABELS,
  PERIODIC_FREQUENCIES,
  type AnalyticsChart as AnalyticsChartType,
  type AnalyticsUnit as AnalyticsUnitType,
  type PeriodicFrequency as PeriodicFrequencyType,
} from "../enums/analytics-chart";
import { SUBMITTED_REPORT_STATUSES } from "../enums/report-status";
import type { SubmittedReportStatus as SubmittedReportStatusType } from "../enums/report-status";

/**
 * Dashboard del investigador (RF-7) y exportaciones (RF-8).
 *
 * Los mismos filtros alimentan los gráficos, la tabla y la exportación, así que
 * lo que se descarga coincide siempre con lo que se está viendo (RF-8.5).
 */

export const analyticsChartSchema = z.enum(
  ANALYTICS_CHARTS as unknown as [AnalyticsChartType, ...AnalyticsChartType[]],
);

export const analyticsUnitSchema = z.enum(
  Object.keys(ANALYTICS_UNIT_LABELS) as unknown as [
    AnalyticsUnitType,
    ...AnalyticsUnitType[],
  ],
);

export const periodicFrequencySchema = z.enum(
  PERIODIC_FREQUENCIES as unknown as [PeriodicFrequencyType, ...PeriodicFrequencyType[]],
);

const submittedStatus = z.enum(
  SUBMITTED_REPORT_STATUSES as unknown as [
    SubmittedReportStatusType,
    ...SubmittedReportStatusType[],
  ],
);

/** Fecha en formato ISO `aaaa-mm-dd`; el rango es inclusivo en ambos extremos. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

/** Sobre qué fecha se aplica el rango (RF-7.3). */
export const dateFieldSchema = z.enum(["notificacion", "evento"]);

export type DateField = z.infer<typeof dateFieldSchema>;

/** Filtros globales del dashboard (RF-7.3). Todos son opcionales. */
export const analyticsFiltersSchema = z.object({
  dateField: dateFieldSchema.default("notificacion"),
  from: isoDate.optional(),
  to: isoDate.optional(),
  /** Subconjunto de estados dentro del conjunto base aprobado (RF-7.5). */
  statuses: z.array(submittedStatus).optional(),
  profession: z.string().optional(),
  administrationRoute: z.string().optional(),
  /** `true` limita a eventos graves, `false` a no graves (RF-7.3). */
  serious: z.boolean().optional(),
});

export type AnalyticsFilters = z.infer<typeof analyticsFiltersSchema>;

/** Una categoría dentro de un gráfico. */
export const analyticsSliceSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number().int().nonnegative(),
  /** Porcentaje sobre el total del gráfico, redondeado a un decimal. */
  percentage: z.number().min(0).max(100),
});

export type AnalyticsSlice = z.infer<typeof analyticsSliceSchema>;

export const analyticsSeriesSchema = z.object({
  chart: analyticsChartSchema,
  label: z.string(),
  unit: analyticsUnitSchema,
  total: z.number().int().nonnegative(),
  slices: z.array(analyticsSliceSchema),
  /**
   * Medicamentos dejados fuera del gráfico por estar cargados en mililitros
   * en vez de porcentaje (RF-7.9). Solo aplica a THC, CBD y Otros.
   */
  excluded: z.number().int().nonnegative().default(0),
});

export type AnalyticsSeries = z.infer<typeof analyticsSeriesSchema>;

/** Indicadores del encabezado del dashboard. */
export const analyticsHeadlineSchema = z.object({
  totalReports: z.number().int().nonnegative(),
  seriousPercentage: z.number().min(0).max(100),
  topRouteLabel: z.string(),
  topRoutePercentage: z.number().min(0).max(100),
  peakMonthLabel: z.string(),
});

export type AnalyticsHeadline = z.infer<typeof analyticsHeadlineSchema>;

export const analyticsDashboardSchema = z.object({
  headline: analyticsHeadlineSchema,
  series: z.array(analyticsSeriesSchema),
  generatedAt: z.string().datetime(),
});

export type AnalyticsDashboard = z.infer<typeof analyticsDashboardSchema>;

/* ------------------------------------------------------------------ *
 * Tabla de reportes del dashboard (RF-7.4 / RF-7.14).
 * ------------------------------------------------------------------ */

export const reportTableSortSchema = z.enum([
  "submittedAt",
  "status",
  "serious",
  "profession",
  "patient",
]);

export type ReportTableSort = z.infer<typeof reportTableSortSchema>;

export const reportTableQuerySchema = analyticsFiltersSchema.extend({
  search: z.string().optional(),
  sort: reportTableSortSchema.default("submittedAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(25),
});

export type ReportTableQuery = z.infer<typeof reportTableQuerySchema>;

export const reportTableRowSchema = z.object({
  id: z.string().uuid(),
  submittedAt: z.string().datetime(),
  status: submittedStatus,
  serious: z.boolean(),
  professionLabel: z.string(),
  patientLabel: z.string(),
  eventSummary: z.string(),
  medicineSummary: z.string(),
});

export type ReportTableRow = z.infer<typeof reportTableRowSchema>;

export const reportTablePageSchema = z.object({
  rows: z.array(reportTableRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type ReportTablePage = z.infer<typeof reportTablePageSchema>;

/* ------------------------------------------------------------------ *
 * Exportación (RF-8.1 a RF-8.10).
 * ------------------------------------------------------------------ */

export const exportFormatSchema = z.enum(["xlsx", "csv"]);

export type ExportFormat = z.infer<typeof exportFormatSchema>;

/** Cuántos reportes entran en la descarga con los filtros actuales. */
export const exportPreviewSchema = z.object({
  total: z.number().int().nonnegative(),
  filtersSummary: z.string(),
});

export type ExportPreview = z.infer<typeof exportPreviewSchema>;

/* ------------------------------------------------------------------ *
 * Reportes periódicos (RF-8.3, RF-8.4, RF-8.11 a RF-8.14).
 * ------------------------------------------------------------------ */

export const periodicPreferencesSchema = z.object({
  frequency: periodicFrequencySchema,
  charts: z.array(analyticsChartSchema),
  /** El investigador puede darse de baja de los envíos (RF-8.11). */
  enabled: z.boolean(),
  lastSentAt: z.string().datetime().nullable(),
  nextRunOn: z.string().nullable(),
});

export type PeriodicPreferences = z.infer<typeof periodicPreferencesSchema>;

export const savePeriodicPreferencesSchema = z.object({
  frequency: periodicFrequencySchema,
  charts: z.array(analyticsChartSchema),
  enabled: z.boolean().default(true),
});

export type SavePeriodicPreferences = z.infer<typeof savePeriodicPreferencesSchema>;
