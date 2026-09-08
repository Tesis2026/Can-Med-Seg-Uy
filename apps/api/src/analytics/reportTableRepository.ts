import {
  PROFESSION_LABELS,
  labelFor,
  type ReportTablePage,
  type ReportTableQuery,
  type ReportTableRow,
  type SubmittedReportStatus,
} from "@canmedseg/shared";
import type { Pool } from "pg";

import { buildReportFilter } from "./analyticsFilters";

type TableRow = {
  id: string;
  submitted_at: Date;
  status: SubmittedReportStatus;
  serious: boolean;
  contact_profession: string | null;
  patient_initials: string | null;
  patient_national_id: string | null;
  adverse_event_description: string | null;
  medicine_summary: string | null;
};

/** Columnas ordenables de RF-7.4, mapeadas a expresiones seguras. */
const SORT_COLUMNS: Record<ReportTableQuery["sort"], string> = {
  submittedAt: "r.submitted_at",
  status: "r.status",
  serious: "serious",
  profession: "r.contact_profession",
  patient: "r.patient_initials",
};

function patientLabel(row: TableRow): string {
  const parts = [row.patient_initials, row.patient_national_id].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return parts.length > 0 ? parts.join(" - ") : "Sin datos del paciente";
}

/**
 * Tabla del dashboard: mismos filtros que los gráficos, más búsqueda libre,
 * orden por cualquier columna y paginación (RF-7.4 / RF-7.14).
 */
export async function getReportTable(
  pool: Pool,
  query: ReportTableQuery,
): Promise<ReportTablePage> {
  const { where, params } = buildReportFilter(query);
  const values = [...params];
  let conditions = where;

  const search = query.search?.trim();
  if (search) {
    values.push(`%${search}%`);
    const needle = `$${values.length}`;
    conditions += `
     AND (r.patient_initials ILIKE ${needle}
          OR r.patient_national_id ILIKE ${needle}
          OR r.adverse_event_description ILIKE ${needle}
          OR EXISTS (SELECT 1 FROM report_medicines m
                      WHERE m.report_id = r.id AND m.name ILIKE ${needle})
          OR EXISTS (SELECT 1 FROM report_adverse_events e
                      WHERE e.report_id = r.id AND e.meddra_term ILIKE ${needle}))`;
  }

  const total = await pool.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM reports r WHERE ${conditions}`,
    values,
  );

  const orderBy = SORT_COLUMNS[query.sort];
  const direction = query.direction === "asc" ? "ASC" : "DESC";
  const offset = (query.page - 1) * query.pageSize;

  values.push(query.pageSize);
  const limitParam = `$${values.length}`;
  values.push(offset);
  const offsetParam = `$${values.length}`;

  const rows = await pool.query<TableRow>(
    `SELECT r.id,
            r.submitted_at,
            r.status,
            EXISTS (SELECT 1 FROM report_adverse_events e
                     WHERE e.report_id = r.id AND e.is_serious) AS serious,
            r.contact_profession,
            r.patient_initials,
            r.patient_national_id,
            r.adverse_event_description,
            (SELECT string_agg(m.name, ', ' ORDER BY m.position)
               FROM report_medicines m WHERE m.report_id = r.id) AS medicine_summary
       FROM reports r
      WHERE ${conditions}
      ORDER BY ${orderBy} ${direction}, r.id
      LIMIT ${limitParam} OFFSET ${offsetParam}`,
    values,
  );

  const mapped: ReportTableRow[] = rows.rows.map((row) => ({
    id: row.id,
    submittedAt: row.submitted_at.toISOString(),
    status: row.status,
    serious: row.serious,
    professionLabel: labelFor(PROFESSION_LABELS, row.contact_profession),
    patientLabel: patientLabel(row),
    eventSummary: row.adverse_event_description ?? "",
    medicineSummary: row.medicine_summary ?? "",
  }));

  return {
    rows: mapped,
    total: Number(total.rows[0]?.total ?? 0),
    page: query.page,
    pageSize: query.pageSize,
  };
}

/** Cantidad de reportes que entran en una exportación con los filtros dados. */
export async function countReports(
  pool: Pool,
  query: ReportTableQuery,
): Promise<number> {
  const page = await getReportTable(pool, { ...query, page: 1, pageSize: 1 });
  return page.total;
}
