import { z } from "zod";

import {
  ANALYTICS_CHARTS,
  ANALYTICS_UNIT_LABELS,
  PERIODIC_FREQUENCIES,
  type AnalyticsChart as AnalyticsChartType,
  type AnalyticsUnit as AnalyticsUnitType,
  type PeriodicFrequency as PeriodicFrequencyType,
} from "../enums/analytics-chart";
import {
  AGE_GROUPS,
  COMPOSITION_BUCKET_KEYS,
  type AgeGroup as AgeGroupType,
  type CompositionBucket as CompositionBucketType,
} from "../enums/analytics-filters";
import { SUBMITTED_REPORT_STATUSES } from "../enums/report-status";
import type { SubmittedReportStatus as SubmittedReportStatusType } from "../enums/report-status";
import { UY_REGIONS, type UyRegion as UyRegionType } from "../enums/uy-department";

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

const compositionBucketSchema = z.enum(
  COMPOSITION_BUCKET_KEYS as unknown as [CompositionBucketType, ...CompositionBucketType[]],
);

/** Filtros globales del dashboard (RF-7.3). Todos son opcionales. */
export const analyticsFiltersSchema = z.object({
  dateField: dateFieldSchema.default("notificacion"),
  from: isoDate.optional(),
  to: isoDate.optional(),
  ageGroup: z.enum(AGE_GROUPS as unknown as [AgeGroupType, ...AgeGroupType[]]).optional(),
  region: z.enum(UY_REGIONS as unknown as [UyRegionType, ...UyRegionType[]]).optional(),
  /** `true` limita a eventos graves, `false` a no graves (RF-7.3). */
  serious: z.boolean().optional(),
  product: z.string().trim().min(1).optional(),
  thc: compositionBucketSchema.optional(),
  cbd: compositionBucketSchema.optional(),
  meddra: z.string().trim().min(1).optional(),
  reportingArea: z.string().trim().min(1).optional(),
});

export type AnalyticsFilters = z.infer<typeof analyticsFiltersSchema>;

const TEXT_FILTERS = ["from", "to", "ageGroup", "region", "product", "thc", "cbd", "meddra", "reportingArea"] as const;

/**
 * Lee los filtros desde la query string (web y API usan la misma función, así
 * una URL compartida da siempre el mismo resultado). Valores inválidos o de
 * filtros que ya no existen se ignoran.
 */
export function analyticsFiltersFromQuery(
  get: (key: string) => string | null | undefined,
): AnalyticsFilters {
  const raw: Record<string, unknown> = {
    dateField: get("dateField") === "evento" ? "evento" : "notificacion",
  };
  for (const key of TEXT_FILTERS) {
    const value = get(key)?.trim();
    if (value) raw[key] = value;
  }
  const serious = get("serious");
  if (serious === "true" || serious === "false") raw.serious = serious === "true";

  const parsed = analyticsFiltersSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const invalid = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
  for (const key of invalid) delete raw[key];
  return analyticsFiltersSchema.parse(raw);
}

export function analyticsFiltersToQuery(filters: AnalyticsFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.dateField === "evento") query.dateField = "evento";
  for (const key of TEXT_FILTERS) {
    const value = filters[key];
    if (value) query[key] = value;
  }
  if (filters.serious !== undefined) query.serious = String(filters.serious);
  return query;
}

/** Valores posibles de los filtros de texto libre, tomados de los reportes aprobados. */
export const analyticsFilterOptionsSchema = z.object({
  products: z.array(z.string()),
  meddraTerms: z.array(z.string()),
});

export type AnalyticsFilterOptions = z.infer<typeof analyticsFilterOptionsSchema>;

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
  serious: z.boolean().nullable(),
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
