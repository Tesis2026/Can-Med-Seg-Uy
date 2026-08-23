import type { Pool } from "pg";

import { loginStateTtlMs } from "../config";

export type LoginState = {
  nonce: string;
  codeVerifier: string;
  returnTo: string | null;
};

export async function saveLoginState(
  pool: Pool,
  input: { state: string; nonce: string; codeVerifier: string; returnTo: string | null },
): Promise<void> {
  await pool.query(
    `INSERT INTO auth_login_states (state, nonce, code_verifier, return_to, expires_at)
          VALUES ($1, $2, $3, $4, now() + ($5 || ' milliseconds')::interval)`,
    [input.state, input.nonce, input.codeVerifier, input.returnTo, String(loginStateTtlMs)],
  );
}

/** Consume el state una sola vez (protección CSRF del callback). */
export async function consumeLoginState(pool: Pool, state: string): Promise<LoginState | null> {
  const result = await pool.query<{
    nonce: string;
    code_verifier: string;
    return_to: string | null;
  }>(
    `UPDATE auth_login_states
        SET consumed_at = now()
      WHERE state = $1 AND consumed_at IS NULL AND expires_at > now()
      RETURNING nonce, code_verifier, return_to`,
    [state],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { nonce: row.nonce, codeVerifier: row.code_verifier, returnTo: row.return_to };
}
