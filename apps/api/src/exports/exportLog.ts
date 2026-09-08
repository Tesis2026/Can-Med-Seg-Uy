import type { AnalyticsFilters, ExportFormat } from "@canmedseg/shared";
import type { Pool } from "pg";

/** Registro de exportaciones para auditoría (RF-8.9). */
export async function logExport(
  pool: Pool,
  entry: {
    userId: string;
    format: ExportFormat;
    filters: AnalyticsFilters;
    reportCount: number;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO export_logs (requested_by, format, filters, report_count)
          VALUES ($1, $2, $3::jsonb, $4)`,
    [entry.userId, entry.format, JSON.stringify(entry.filters), entry.reportCount],
  );
}
