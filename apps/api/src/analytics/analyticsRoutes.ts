import {
  Permission,
  analyticsDashboardSchema,
  analyticsFilterOptionsSchema,
  analyticsFiltersFromQuery,
  exportFormatSchema,
  periodicPreferencesSchema,
  reportTablePageSchema,
  reportTableQuerySchema,
  savePeriodicPreferencesSchema,
} from "@canmedseg/shared";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import { requirePermission } from "../auth/guards";
import { pool } from "../database/pool";
import {
  buildExportBundle,
  exportFileName,
  toCsv,
  toXlsx,
} from "../exports/exportBuilder";
import { logExport } from "../exports/exportLog";
import {
  getPreferences,
  savePreferences,
} from "../periodic/periodicRepository";
import { describeFilters } from "./analyticsFilters";
import { getDashboard, getFilterOptions } from "./analyticsRepository";
import { getReportTable } from "./reportTableRepository";

/**
 * Dashboard analítico, tabla, exportación y reportes periódicos.
 * Todo el módulo exige permisos de investigador o MSP (RF-7.16 / RF-8.15).
 */

function queryGetter(query: unknown): (key: string) => string | undefined {
  const record = (query ?? {}) as Record<string, unknown>;
  return (key) => (typeof record[key] === "string" ? (record[key] as string) : undefined);
}

/** Los filtros viajan en la query string para que la vista sea compartible (RF-7.12). */
function filtersFromRequest(request: FastifyRequest) {
  return analyticsFiltersFromQuery(queryGetter(request.query));
}

const tablePagingSchema = z.object({
  search: z.string().optional(),
  sort: z.string().optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

function tableQueryFromRequest(request: FastifyRequest) {
  const paging = tablePagingSchema.parse(request.query);
  return reportTableQuerySchema.parse({
    ...filtersFromRequest(request),
    search: paging.search || undefined,
    sort: paging.sort ?? "submittedAt",
    direction: paging.direction ?? "desc",
    page: paging.page ?? 1,
    pageSize: paging.pageSize ?? 25,
  });
}

function sessionUserId(request: FastifyRequest): string {
  const userId = request.auth.user?.id;
  if (!userId) throw new Error("La ruta requiere sesión y el guard no la resolvió");
  return userId;
}

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  /** Todos los gráficos del MVP con los filtros aplicados (RF-7.1, RF-7.2). */
  app.get(
    "/analytics/dashboard",
    { preHandler: requirePermission(Permission.DashboardRead) },
    async (request, reply) => {
      const filters = filtersFromRequest(request);
      const dashboard = await getDashboard(pool, filters);
      return reply.send(analyticsDashboardSchema.parse(dashboard));
    },
  );

  /** Opciones de los filtros de producto y MedDRA, según los reportes aprobados. */
  app.get(
    "/analytics/filter-options",
    { preHandler: requirePermission(Permission.DashboardRead) },
    async (_request, reply) =>
      reply.send(analyticsFilterOptionsSchema.parse(await getFilterOptions(pool))),
  );

  /** Tabla de reportes con orden, búsqueda y paginación (RF-7.4, RF-7.14). */
  app.get(
    "/analytics/reports",
    { preHandler: requirePermission(Permission.DashboardRead) },
    async (request, reply) => {
      const query = tableQueryFromRequest(request);
      const page = await getReportTable(pool, query);
      return reply.send(reportTablePageSchema.parse(page));
    },
  );

  /** Cuántos reportes entran en la descarga con los filtros actuales. */
  app.get(
    "/analytics/export/preview",
    { preHandler: requirePermission(Permission.ExportRead) },
    async (request, reply) => {
      const filters = filtersFromRequest(request);
      const page = await getReportTable(pool, {
        ...filters,
        sort: "submittedAt",
        direction: "desc",
        page: 1,
        pageSize: 1,
      });
      return reply.send({
        total: page.total,
        filtersSummary: describeFilters(filters),
      });
    },
  );

  /** Descarga seudonimizada en XLSX o CSV (RF-8.1, RF-8.2, RF-8.5 a RF-8.10). */
  app.get(
    "/analytics/export",
    { preHandler: requirePermission(Permission.ExportRead) },
    async (request, reply) => {
      const filters = filtersFromRequest(request);
      const format = exportFormatSchema.parse(
        (request.query as { format?: string }).format ?? "xlsx",
      );

      const summary = describeFilters(filters);
      const bundle = await buildExportBundle(pool, filters, summary);

      await logExport(pool, {
        userId: sessionUserId(request),
        format,
        filters,
        reportCount: bundle.reportCount,
      });

      const fileName = exportFileName(format, bundle.generatedAt);
      const body = format === "csv" ? toCsv(bundle) : await toXlsx(bundle);

      return reply
        .header(
          "content-type",
          format === "csv"
            ? "text/csv; charset=utf-8"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .header("content-disposition", `attachment; filename="${fileName}"`)
        .send(body);
    },
  );

  /** Preferencias del reporte periódico del investigador (RF-8.4). */
  app.get(
    "/analytics/periodic-preferences",
    { preHandler: requirePermission(Permission.PeriodicReportsReceive) },
    async (request, reply) => {
      const preferences = await getPreferences(pool, sessionUserId(request));
      return reply.send(periodicPreferencesSchema.parse(preferences));
    },
  );

  app.put(
    "/analytics/periodic-preferences",
    { preHandler: requirePermission(Permission.PeriodicReportsReceive) },
    async (request, reply) => {
      const input = savePeriodicPreferencesSchema.parse(request.body);
      const preferences = await savePreferences(pool, sessionUserId(request), input);
      return reply.send(periodicPreferencesSchema.parse(preferences));
    },
  );
};
