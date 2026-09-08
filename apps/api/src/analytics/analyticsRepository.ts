import {
  ADMINISTRATION_ROUTE_LABELS,
  ANALYTICS_CHART_LABELS,
  ANALYTICS_CHART_UNITS,
  AnalyticsChart,
  PRESENTATION_LABELS,
  PROFESSION_LABELS,
  SEX_LABELS,
  SIN_DATO,
  SIN_DATO_LABEL,
  UY_REGION_LABELS,
  UY_REGIONS,
  isUyDepartment,
  labelFor,
  regionOfDepartment,
  type AnalyticsDashboard,
  type AnalyticsFilters,
  type AnalyticsSeries,
  type AnalyticsSlice,
} from "@canmedseg/shared";
import type { Pool } from "pg";

import { buildReportFilter } from "./analyticsFilters";

type CountRow = { key: string | null; total: string };

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Oct",
  "Nov",
  "Dic",
];

/** Tramos etarios fijos de RF-7.8. */
const AGE_BUCKETS = [
  { key: "0_11", label: "0 a 11 años", min: 0, max: 11 },
  { key: "12_17", label: "12 a 17 años", min: 12, max: 17 },
  { key: "18_44", label: "18 a 44 años", min: 18, max: 44 },
  { key: "45_64", label: "45 a 64 años", min: 45, max: 64 },
  { key: "65_mas", label: "65 años o más", min: 65, max: 200 },
];

/** Tramos de composición declarada, en porcentaje (RF-7.9). */
const COMPOSITION_BUCKETS = [
  { key: "0_5", label: "0 a 5 %", min: 0, max: 5 },
  { key: "5_10", label: "5 a 10 %", min: 5, max: 10 },
  { key: "10_20", label: "10 a 20 %", min: 10, max: 20 },
  { key: "20_50", label: "20 a 50 %", min: 20, max: 50 },
  { key: "50_100", label: "50 a 100 %", min: 50, max: 100 },
];

function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

/**
 * Arma la serie a partir de los conteos crudos. Las categorías conocidas se
 * emiten en orden fijo aunque estén en cero, y «Sin dato» va siempre al final
 * para que se lea como resto y no como una categoría más (RF-7.11).
 */
function toSeries(
  chart: AnalyticsChart,
  rows: CountRow[],
  order: { key: string; label: string }[],
  options: { excluded?: number } = {},
): AnalyticsSeries {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.key ?? SIN_DATO;
    counts.set(key, (counts.get(key) ?? 0) + Number(row.total));
  }

  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const slices: AnalyticsSlice[] = order.map((entry) => {
    const value = counts.get(entry.key) ?? 0;
    return {
      key: entry.key,
      label: entry.label,
      value,
      percentage: percentage(value, total),
    };
  });

  // En listas largas se ocultan las categorías sin casos: aportan ruido y
  // empujan el resto del gráfico fuera de la vista.
  const visible = order.length > 6 ? slices.filter((slice) => slice.value > 0) : slices;

  const known = new Set(order.map((entry) => entry.key));
  const unknown = [...counts.entries()]
    .filter(([key]) => !known.has(key))
    .reduce((sum, [, value]) => sum + value, 0);

  if (unknown > 0) {
    visible.push({
      key: SIN_DATO,
      label: SIN_DATO_LABEL,
      value: unknown,
      percentage: percentage(unknown, total),
    });
  }

  return {
    chart,
    label: ANALYTICS_CHART_LABELS[chart],
    unit: ANALYTICS_CHART_UNITS[chart],
    total,
    slices: visible,
    excluded: options.excluded ?? 0,
  };
}

function orderFromLabels(dictionary: Record<string, string>) {
  return Object.entries(dictionary).map(([key, label]) => ({ key, label }));
}

/** Consulta que agrupa reportes por una expresión sobre `reports`. */
async function countReportsBy(
  pool: Pool,
  filters: AnalyticsFilters,
  expression: string,
): Promise<CountRow[]> {
  const { where, params } = buildReportFilter(filters);
  const result = await pool.query<CountRow>(
    `SELECT ${expression} AS key, count(*)::text AS total
       FROM reports r
      WHERE ${where}
      GROUP BY 1`,
    params,
  );
  return result.rows;
}

/** Consulta que agrupa filas de una tabla anidada (eventos o medicamentos). */
async function countChildrenBy(
  pool: Pool,
  filters: AnalyticsFilters,
  table: "report_adverse_events" | "report_medicines",
  expression: string,
  extraCondition = "",
): Promise<CountRow[]> {
  const { where, params } = buildReportFilter(filters);
  const result = await pool.query<CountRow>(
    `SELECT ${expression} AS key, count(*)::text AS total
       FROM ${table} c
       JOIN reports r ON r.id = c.report_id
      WHERE ${where}
        ${extraCondition}
      GROUP BY 1`,
    params,
  );
  return result.rows;
}

function bucketExpression(
  column: string,
  buckets: { key: string; min: number; max: number }[],
): string {
  const cases = buckets
    .map(
      (bucket) =>
        `WHEN ${column} >= ${bucket.min} AND ${column} <= ${bucket.max} THEN '${bucket.key}'`,
    )
    .join(" ");
  return `CASE ${cases} ELSE '${SIN_DATO}' END`;
}

async function compositionSeries(
  pool: Pool,
  filters: AnalyticsFilters,
  chart: AnalyticsChart,
  column: "thc_percent" | "cbd_percent" | "other_percent",
): Promise<AnalyticsSeries> {
  const rows = await countChildrenBy(
    pool,
    filters,
    "report_medicines",
    bucketExpression(`c.${column}`, COMPOSITION_BUCKETS),
    `AND c.composition_unit = 'percent' AND c.${column} IS NOT NULL`,
  );

  // Los cargados en mililitros no entran al gráfico; se informan aparte (RF-7.9).
  const { where, params } = buildReportFilter(filters);
  const excluded = await pool.query<{ total: string }>(
    `SELECT count(*)::text AS total
       FROM report_medicines c
       JOIN reports r ON r.id = c.report_id
      WHERE ${where}
        AND c.composition_unit = 'ml'
        AND c.${column} IS NOT NULL`,
    params,
  );

  return toSeries(chart, rows, COMPOSITION_BUCKETS, {
    excluded: Number(excluded.rows[0]?.total ?? 0),
  });
}

/** Todos los gráficos del MVP (RF-7.2) con los filtros aplicados. */
export async function getDashboard(
  pool: Pool,
  filters: AnalyticsFilters,
): Promise<AnalyticsDashboard> {
  const [
    ageRows,
    sexRows,
    seriousRows,
    monthRows,
    departmentRows,
    routeRows,
    professionRows,
    presentationRows,
  ] = await Promise.all([
    countReportsBy(
      pool,
      filters,
      bucketExpression("r.patient_age_at_event_start", AGE_BUCKETS),
    ),
    countReportsBy(pool, filters, "r.patient_sex"),
    countChildrenBy(
      pool,
      filters,
      "report_adverse_events",
      "CASE WHEN c.is_serious THEN 'grave' ELSE 'no_grave' END",
    ),
    countReportsBy(pool, filters, "to_char(r.submitted_at, 'YYYY-MM')"),
    countReportsBy(pool, filters, "r.patient_department"),
    countChildrenBy(pool, filters, "report_medicines", "c.administration_route"),
    countReportsBy(pool, filters, "r.contact_profession"),
    countChildrenBy(pool, filters, "report_medicines", "c.presentation"),
  ]);

  const [thc, cbd, otros] = await Promise.all([
    compositionSeries(pool, filters, AnalyticsChart.Thc, "thc_percent"),
    compositionSeries(pool, filters, AnalyticsChart.Cbd, "cbd_percent"),
    compositionSeries(pool, filters, AnalyticsChart.Otros, "other_percent"),
  ]);

  // El departamento se agrupa en regiones para el gráfico (RF-7.10).
  const regionRows: CountRow[] = departmentRows.map((row) => ({
    key: isUyDepartment(row.key) ? regionOfDepartment(row.key) : SIN_DATO,
    total: row.total,
  }));

  // La serie temporal se emite en orden cronológico. Con más de año y medio de
  // datos se agrupa por año: cuarenta barras mensuales no se leen.
  const months = [...new Set(monthRows.map((row) => row.key).filter(Boolean))].sort() as string[];
  const groupByYear = months.length > 18;

  const temporalRows = groupByYear
    ? monthRows.map((row) => ({ key: row.key?.slice(0, 4) ?? null, total: row.total }))
    : monthRows;

  const temporalOrder = groupByYear
    ? [...new Set(months.map((month) => month.slice(0, 4)))]
        .sort()
        .map((year) => ({ key: year, label: year }))
    : months.map((month) => {
        const [year, index] = month.split("-");
        return { key: month, label: `${MONTH_LABELS[Number(index) - 1]} ${year}` };
      });

  const series: AnalyticsSeries[] = [
    toSeries(AnalyticsChart.GrupoEtario, ageRows, AGE_BUCKETS),
    toSeries(AnalyticsChart.Sexo, sexRows, orderFromLabels(SEX_LABELS)),
    toSeries(AnalyticsChart.Gravedad, seriousRows, [
      { key: "grave", label: "Grave" },
      { key: "no_grave", label: "No grave" },
    ]),
    toSeries(AnalyticsChart.SerieTemporal, temporalRows, temporalOrder),
    toSeries(
      AnalyticsChart.Region,
      regionRows,
      UY_REGIONS.map((region) => ({ key: region, label: UY_REGION_LABELS[region] })),
    ),
    toSeries(
      AnalyticsChart.ViaAdministracion,
      routeRows,
      orderFromLabels(ADMINISTRATION_ROUTE_LABELS),
    ),
    toSeries(AnalyticsChart.TipoNotificador, professionRows, orderFromLabels(PROFESSION_LABELS)),
    toSeries(AnalyticsChart.TipoPresentacion, presentationRows, orderFromLabels(PRESENTATION_LABELS)),
    thc,
    cbd,
    otros,
  ];

  const byChart = new Map(series.map((entry) => [entry.chart, entry]));
  const totalReports = byChart.get(AnalyticsChart.Sexo)?.total ?? 0;
  const gravedad = byChart.get(AnalyticsChart.Gravedad);
  const via = byChart.get(AnalyticsChart.ViaAdministracion);
  const temporal = byChart.get(AnalyticsChart.SerieTemporal);

  const topRoute = via?.slices
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value)[0];
  const peakMonth = temporal?.slices
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value)[0];

  return {
    headline: {
      totalReports,
      seriousPercentage:
        gravedad?.slices.find((slice) => slice.key === "grave")?.percentage ?? 0,
      topRouteLabel: topRoute?.label ?? SIN_DATO_LABEL,
      topRoutePercentage: topRoute?.percentage ?? 0,
      peakMonthLabel: peakMonth?.label ?? SIN_DATO_LABEL,
    },
    series,
    generatedAt: new Date().toISOString(),
  };
}

export function professionLabel(value: string): string {
  return labelFor(PROFESSION_LABELS, value);
}

export function routeLabel(value: string): string {
  return labelFor(ADMINISTRATION_ROUTE_LABELS, value);
}
