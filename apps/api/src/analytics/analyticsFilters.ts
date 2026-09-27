import {
  ADULT_AGE,
  AGE_GROUP_LABELS,
  AgeGroup,
  COMPOSITION_BUCKETS,
  REPORTING_AREA_LABELS,
  ReportStatus,
  UY_DEPARTMENTS,
  UY_REGION_LABELS,
  compositionBucketLabel,
  labelFor,
  regionOfDepartment,
  type AnalyticsFilters,
} from "@canmedseg/shared";

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

function compositionCondition(
  params: ParamList,
  column: "thc_percent" | "cbd_percent",
  key: string,
): string {
  const index = COMPOSITION_BUCKETS.findIndex((bucket) => bucket.key === key);
  const bucket = COMPOSITION_BUCKETS[index];
  if (!bucket) return "TRUE";
  // Mismos bordes que el gráfico: un valor en el límite pertenece al primer tramo.
  const lower = index === 0 ? ">=" : ">";
  return `EXISTS (
      SELECT 1 FROM report_medicines m
       WHERE m.report_id = r.id
         AND m.composition_unit = 'percent'
         AND m.${column} ${lower} ${params.add(bucket.min)}
         AND m.${column} <= ${params.add(bucket.max)})`;
}

export function buildReportFilter(filters: AnalyticsFilters): SqlFilter {
  const params = new ParamList();
  const conditions: string[] = [];

  conditions.push(`r.status = ANY(${params.add(BASE_STATUSES)}::report_status[])`);

  if (filters.ageGroup === AgeGroup.Menores) {
    conditions.push(`r.patient_age_at_event_start < ${params.add(ADULT_AGE)}`);
  } else if (filters.ageGroup === AgeGroup.Mayores) {
    conditions.push(`r.patient_age_at_event_start >= ${params.add(ADULT_AGE)}`);
  }

  if (filters.region) {
    const departments = UY_DEPARTMENTS.filter(
      (department) => regionOfDepartment(department) === filters.region,
    );
    conditions.push(`r.patient_department = ANY(${params.add(departments)}::text[])`);
  }

  if (filters.serious !== undefined) {
    conditions.push(`EXISTS (
      SELECT 1 FROM report_adverse_events e
       WHERE e.report_id = r.id
         AND e.is_serious = ${params.add(filters.serious)})`);
  }

  if (filters.product) {
    conditions.push(`EXISTS (
      SELECT 1 FROM report_medicines m
       WHERE m.report_id = r.id
         AND lower(btrim(m.name)) = lower(btrim(${params.add(filters.product)})))`);
  }

  if (filters.thc) conditions.push(compositionCondition(params, "thc_percent", filters.thc));
  if (filters.cbd) conditions.push(compositionCondition(params, "cbd_percent", filters.cbd));

  if (filters.meddra) {
    conditions.push(`EXISTS (
      SELECT 1 FROM report_adverse_events e
       WHERE e.report_id = r.id
         AND lower(btrim(e.meddra_term)) = lower(btrim(${params.add(filters.meddra)})))`);
  }

  if (filters.reportingArea) {
    conditions.push(`r.contact_reporting_area = ${params.add(filters.reportingArea)}`);
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
export function describeFilters(filters: AnalyticsFilters): string {
  const parts: string[] = ["Estado: aprobados"];

  if (filters.from || filters.to) {
    const campo = filters.dateField === "evento" ? "del evento" : "de notificación";
    const desde = filters.from ?? "inicio";
    const hasta = filters.to ?? "hoy";
    parts.push(`Fecha ${campo}: ${desde} a ${hasta}`);
  } else {
    parts.push("Período: sin límite");
  }

  if (filters.ageGroup) parts.push(`Edad: ${AGE_GROUP_LABELS[filters.ageGroup]}`);
  if (filters.region) parts.push(`Región: ${UY_REGION_LABELS[filters.region]}`);
  if (filters.serious !== undefined) {
    parts.push(`Gravedad: ${filters.serious ? "graves" : "no graves"}`);
  }
  if (filters.product) parts.push(`Producto: ${filters.product}`);
  if (filters.thc) parts.push(`THC: ${compositionBucketLabel(filters.thc)}`);
  if (filters.cbd) parts.push(`CBD: ${compositionBucketLabel(filters.cbd)}`);
  if (filters.meddra) parts.push(`MedDRA: ${filters.meddra}`);
  if (filters.reportingArea) {
    parts.push(`Área reportante: ${labelFor(REPORTING_AREA_LABELS, filters.reportingArea)}`);
  }

  return parts.join(" · ");
}
