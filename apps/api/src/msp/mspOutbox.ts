import type { Pool, PoolClient } from "pg";

/**
 * Stub del canal MSP (Semana 5). La generación E2B y el envío real van en Semana 8.
 * Por ahora encola el reporte y deja el estado `aprobado_msp` (RF-5.4 / RF-5.7).
 */
export async function enqueueMspDelivery(
  client: PoolClient,
  reportId: string,
  payload: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO msp_outbox (report_id, payload, status, attempts, last_error)
     VALUES ($1, $2, 'pendiente', 0, 'Envío E2B pendiente (Semana 8)')
     ON CONFLICT (report_id) DO UPDATE
       SET payload = EXCLUDED.payload,
           status = 'pendiente',
           updated_at = now()`,
    [reportId, JSON.stringify(payload)],
  );
}

/** Intento simulado: no envía; deja la fila en pendiente para la cola de reintento. */
export async function attemptMspDeliveryStub(_pool: Pool, reportId: string): Promise<"pendiente"> {
  // Semana 8 reemplazará esto por generación E2B + canal configurable.
  return "pendiente";
}

export async function countPendingMspOutbox(pool: Pool): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT count(*) AS count FROM msp_outbox WHERE status = 'pendiente'`,
  );
  return Number(result.rows[0]?.count ?? 0);
}
