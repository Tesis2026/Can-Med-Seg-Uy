import {
  analyticsDashboardSchema,
  exportPreviewSchema,
  periodicPreferencesSchema,
  reportTablePageSchema,
  type AnalyticsDashboard,
  type AnalyticsFilters,
  type ExportFormat,
  type ExportPreview,
  type PeriodicPreferences,
  type ReportTablePage,
  type ReportTableQuery,
  type SavePeriodicPreferences,
} from "@canmedseg/shared";

import { apiFetch, apiUrl } from "../../lib/api";

/** Los filtros viajan en la query string, así la vista filtrada es compartible. */
export function filtersToParams(filters: AnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.dateField && filters.dateField !== "notificacion") {
    params.set("dateField", filters.dateField);
  }
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.statuses && filters.statuses.length > 0) {
    params.set("statuses", filters.statuses.join(","));
  }
  if (filters.profession) params.set("profession", filters.profession);
  if (filters.administrationRoute) {
    params.set("administrationRoute", filters.administrationRoute);
  }
  if (filters.serious !== undefined) params.set("serious", String(filters.serious));
  return params;
}

export async function fetchDashboard(
  filters: AnalyticsFilters,
): Promise<AnalyticsDashboard> {
  const params = filtersToParams(filters);
  return analyticsDashboardSchema.parse(
    await apiFetch(`/api/analytics/dashboard?${params.toString()}`, {
      fallbackMessage: "No se pudo cargar el dashboard.",
    }),
  );
}

export async function fetchReportTable(
  query: ReportTableQuery,
): Promise<ReportTablePage> {
  const params = filtersToParams(query);
  if (query.search) params.set("search", query.search);
  params.set("sort", query.sort);
  params.set("direction", query.direction);
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));

  return reportTablePageSchema.parse(
    await apiFetch(`/api/analytics/reports?${params.toString()}`, {
      fallbackMessage: "No se pudo cargar la tabla de reportes.",
    }),
  );
}

export async function fetchExportPreview(
  filters: AnalyticsFilters,
): Promise<ExportPreview> {
  const params = filtersToParams(filters);
  return exportPreviewSchema.parse(
    await apiFetch(`/api/analytics/export/preview?${params.toString()}`, {
      fallbackMessage: "No se pudo calcular la exportación.",
    }),
  );
}

/** Dirección de descarga; la navegación la resuelve el navegador. */
export function exportUrl(filters: AnalyticsFilters, format: ExportFormat): string {
  const params = filtersToParams(filters);
  params.set("format", format);
  return apiUrl(`/api/analytics/export?${params.toString()}`);
}

export async function fetchPeriodicPreferences(): Promise<PeriodicPreferences> {
  return periodicPreferencesSchema.parse(
    await apiFetch("/api/analytics/periodic-preferences", {
      fallbackMessage: "No se pudieron cargar las preferencias.",
    }),
  );
}

export async function savePeriodicPreferences(
  input: SavePeriodicPreferences,
): Promise<PeriodicPreferences> {
  return periodicPreferencesSchema.parse(
    await apiFetch("/api/analytics/periodic-preferences", {
      method: "PUT",
      body: input,
      fallbackMessage: "No se pudieron guardar las preferencias.",
    }),
  );
}
