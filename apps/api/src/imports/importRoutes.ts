import { createHash } from 'node:crypto';
import { Permission, type ReportImportResult } from '@canmedseg/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requirePermission } from '../auth/guards';
import { pool } from '../database/pool';
import { replaceNestedRows, submittedValues, SUBMITTED_COLUMNS } from '../reports/reportRepository';
import { ImportFileError, parseVigiFlow } from './vigiflow';

const inputSchema = z.object({ filename: z.string().min(1).max(255).regex(/\.xlsx$/i), data: z.string().min(1).max(7_000_000) });

export const importRoutes: FastifyPluginAsync = async app => {
  for (const action of ['preview', 'confirm'] as const) {
    app.post(`/imports/vigiflow/${action}`, {
      preHandler: requirePermission(Permission.ReportImport), bodyLimit: 7_100_000,
    }, async (request, reply) => {
      const { filename, data } = inputSchema.parse(request.body);
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return reply.code(400).send({ message: 'El archivo no tiene una codificación válida.' });
      const buffer = Buffer.from(data, 'base64');
      if (buffer.length > 5 * 1024 * 1024) return reply.code(413).send({ message: 'El archivo supera los 5 MB.' });
      let rows;
      try { rows = await parseVigiFlow(buffer); }
      catch (error) {
        if (error instanceof ImportFileError) return reply.code(400).send({ message: error.message });
        throw error;
      }
      const existing = await pool.query<{ external_report_id: string }>(
        "SELECT external_report_id FROM reports WHERE import_source = 'vigiflow' AND external_report_id = ANY($1::text[])",
        [rows.map(row => row.externalId)],
      );
      const known = new Set(existing.rows.map(row => row.external_report_id));
      for (const row of rows) row.duplicate = known.has(row.externalId);
      if (action === 'preview') return { filename, rows: rows.map(({ sourceData: _source, ...row }) => row) };

      const client = await pool.connect();
      const result: ReportImportResult = { imported: 0, skipped: 0, ids: [] };
      try {
        await client.query('BEGIN');
        for (const row of rows) {
          if (row.errors.length || row.duplicate) { result.skipped++; continue; }
          const values = [request.auth.user!.id, row.externalId, row.submittedAt, ...submittedValues(row.report)];
          const inserted = await client.query<{ id: string }>(
            `INSERT INTO reports (status, import_source, notifier_user_id, external_report_id, submitted_at, current_step, ${SUBMITTED_COLUMNS.join(', ')})
             VALUES ('aprobado_local', 'vigiflow', $1, $2, $3, 5, ${SUBMITTED_COLUMNS.map((_, i) => `$${i + 4}`).join(', ')})
             ON CONFLICT (import_source, external_report_id) DO NOTHING RETURNING id`, values,
          );
          const id = inserted.rows[0]?.id;
          if (!id) { result.skipped++; continue; }
          await replaceNestedRows(client, id, row.report);
          await client.query(
            `INSERT INTO report_import_details (report_id, imported_by, filename, file_sha256, source_data, warnings)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, request.auth.user!.id, filename, createHash('sha256').update(buffer).digest('hex'), JSON.stringify(row.sourceData), JSON.stringify(row.warnings)],
          );
          result.ids.push(id);
          result.imported++;
        }
        await client.query('COMMIT');
        return reply.code(201).send(result);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    });
  }
};
