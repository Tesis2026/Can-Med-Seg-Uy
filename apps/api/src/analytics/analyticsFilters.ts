import { ReportStatus, type AnalyticsFilters } from "@canmedseg/shared";

/**
 * Traducción de los filtros del dashboard (RF-7.3) a SQL.
 *
 * El conjunto base son los reportes aprobados (RF-7.5); los filtros solo pueden
 * recortarlo. Cuando el filtro apunta a un módulo repetible, alcanza con que
 * **uno** de sus eventos o medicamentos cumpla la condición (RF-7.7).
 */

/** Estados que entran en cualquier agregación o exportación. */
export const BASE_STATUSES = [ReportStatus.AprobadoLocal, ReportStatus.EnviadoMsp];

/** Las fechas de evento se guardan como texto `dd/mm/aaaa`. */
const EVENT_DATE = `CASE WHEN e.start_date ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
       THEN to_date(e.start_date, 'DD/MM/YYYY') END`;

export type SqlFilter = {
  /** Cláusula que se concatena tras `WHERE`, siempre con al menos una condición. */
  where: string;
  params: unknown[];
};

class ParamList {
  readonly values: unknown[] = [];

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

export function buildReportFilter(filters: AnalyticsFilters): SqlFilter {
  const params = new ParamList();
  const conditions: string[] = [];

  const statuses =
    filters.statuses && filters.statuses.length > 0
      ? filters.statuses.filter((status) =>
          (BASE_STATUSES as readonly string[]).includes(status),
        )
      : BASE_STATUSES;

  // Un filtro de estado fuera del conjunto base no puede ampliar el alcance.
  conditions.push(`r.status = ANY(${params.add(statuses)}::report_status[])`);

  if (filters.profession) {
    conditions.push(`r.contact_profession = ${params.add(filters.profession)}`);
  }

  if (filters.administrationRoute) {
    conditions.push(`EXISTS (
      SELECT 1 FROM report_medicines m
       WHERE m.report_id = r.id
         AND m.administration_route = ${params.add(filters.administrationRoute)})`);
  }

  if (filters.serious !== undefined) {
    conditions.push(`EXISTS (
      SELECT 1 FROM report_adverse_events e
       WHERE e.report_id = r.id
         AND e.is_serious = ${params.add(filters.serious)})`);
  }

  if (filters.from || filters.to) {
    if (filters.dateField === "evento") {
      const bounds: string[] = [];
      if (filters.from) bounds.push(`${EVENT_DATE} >= ${params.add(filters.from)}::date`);
      if (filters.to) bounds.push(`${EVENT_DATE} <= ${params.add(filters.to)}::date`);
      conditions.push(`EXISTS (
        SELECT 1 FROM report_adverse_events e
         WHERE e.report_id = r.id AND ${bounds.join(" AND ")})`);
    } else {
      if (filters.from) {
        conditions.push(`r.submitted_at >= ${params.add(filters.from)}::date`);
      }
      if (filters.to) {
        // El extremo superior es inclusivo: cubre todo el día indicado.
        conditions.push(`r.submitted_at < (${params.add(filters.to)}::date + 1)`);
      }
    }
  }

  return { where: conditions.join("\n     AND "), params: params.values };
}

/** Texto de los filtros aplicados, para la portada del export (RF-8.10). */
export function describeFilters(
  filters: AnalyticsFilters,
  labels: {
    profession: (value: string) => string;
    route: (value: string) => string;
    status: (value: string) => string;
  },
): string {
  const parts: string[] = [];

  parts.push(
    filters.statuses && filters.statuses.length > 0
      ? `Estado: ${filters.statuses.map(labels.status).join(", ")}`
      : "Estado: aprobados",
  );

  if (filters.from || filters.to) {
    const campo = filters.dateField === "evento" ? "del evento" : "de notificación";
    const desde = filters.from ?? "inicio";
    const hasta = filters.to ?? "hoy";
    parts.push(`Fecha ${campo}: ${desde} a ${hasta}`);
  } else {
    parts.push("Período: sin límite");
  }

  parts.push(
    filters.serious === undefined
      ? "Gravedad: todas"
      : `Gravedad: ${filters.serious ? "graves" : "no graves"}`,
  );

  if (filters.profession) {
    parts.push(`Tipo de notificador: ${labels.profession(filters.profession)}`);
  }
  if (filters.administrationRoute) {
    parts.push(`Vía de administración: ${labels.route(filters.administrationRoute)}`);
  }

  return parts.join(" · ");
}
