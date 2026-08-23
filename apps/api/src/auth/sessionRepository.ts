import type { Pool } from "pg";

import { sessionTtlMs } from "../config";
import { randomToken, sha256Hex } from "./crypto";

export type IssuedSession = {
  token: string;
  id: string;
  expiresAt: Date;
};

export type ActiveSession = {
  id: string;
  userId: string;
  expiresAt: Date;
};

export async function createSession(
  pool: Pool,
  userId: string,
  context: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<IssuedSession> {
  const token = randomToken();
  const result = await pool.query<{ id: string; expires_at: Date }>(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_address)
          VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval, $4, $5)
       RETURNING id, expires_at`,
    [userId, sha256Hex(token), String(sessionTtlMs), context.userAgent ?? null, context.ipAddress ?? null],
  );
  const row = result.rows[0];
  if (!row) throw new Error("PostgreSQL no devolvió la sesión creada");
  return { token, id: row.id, expiresAt: row.expires_at };
}

/** Busca la sesión vigente y refresca `last_seen_at` en la misma consulta. */
export async function touchSession(pool: Pool, token: string): Promise<ActiveSession | null> {
  const result = await pool.query<{ id: string; user_id: string; expires_at: Date }>(
    `UPDATE sessions
        SET last_seen_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
      RETURNING id, user_id, expires_at`,
    [sha256Hex(token)],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, userId: row.user_id, expiresAt: row.expires_at };
}

export async function revokeSession(pool: Pool, token: string): Promise<void> {
  await pool.query(
    `UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [sha256Hex(token)],
  );
}
