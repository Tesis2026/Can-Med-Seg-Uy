import type { CaptchaChallenge, CaptchaVerification } from "@canmedseg/shared";
import type { Pool } from "pg";

import { captchaChallengeTtlMs, captchaTokenTtlMs, config } from "../config";
import { randomToken, sha256Hex } from "../auth/crypto";
import { CAPTCHA_LENGTH, generateCaptchaText, renderCaptchaImage } from "./captchaImage";

export type CaptchaFailure = "invalido" | "expirado" | "agotado";

export class CaptchaError extends Error {
  constructor(readonly reason: CaptchaFailure, message: string) {
    super(message);
    this.name = "CaptchaError";
  }
}

export async function createChallenge(
  pool: Pool,
  context: { ipAddress?: string | null } = {},
): Promise<CaptchaChallenge> {
  const answer = generateCaptchaText(CAPTCHA_LENGTH);
  const result = await pool.query<{ id: string; expires_at: Date }>(
    `INSERT INTO captcha_challenges (answer, expires_at, ip_address)
          VALUES ($1, now() + ($2 || ' milliseconds')::interval, $3)
       RETURNING id, expires_at`,
    [answer, String(captchaChallengeTtlMs), context.ipAddress ?? null],
  );
  const row = result.rows[0];
  if (!row) throw new Error("PostgreSQL no devolvió el desafío de CAPTCHA creado");

  return {
    id: row.id,
    imageDataUrl: renderCaptchaImage(answer),
    length: CAPTCHA_LENGTH,
    expiresAt: row.expires_at.toISOString(),
  };
}

/**
 * Compara la respuesta y, si coincide, emite un token de un solo uso.
 * Cada desafío admite un número acotado de intentos: agotarlos lo invalida.
 */
export async function solveChallenge(
  pool: Pool,
  challengeId: string,
  answer: string,
): Promise<CaptchaVerification> {
  const attempt = await pool.query<{ answer: string; attempts: number }>(
    `UPDATE captcha_challenges
        SET attempts = attempts + 1
      WHERE id = $1
        AND solved_at IS NULL
        AND expires_at > now()
        AND attempts < $2
      RETURNING answer, attempts`,
    [challengeId, config.CAPTCHA_MAX_ATTEMPTS],
  );

  const row = attempt.rows[0];
  if (!row) {
    throw new CaptchaError(
      "expirado",
      "El código de seguridad expiró o ya fue utilizado. Genere uno nuevo.",
    );
  }

  if (row.answer !== answer.trim().toUpperCase()) {
    const remaining = config.CAPTCHA_MAX_ATTEMPTS - row.attempts;
    throw new CaptchaError(
      remaining > 0 ? "invalido" : "agotado",
      remaining > 0
        ? "El código ingresado no coincide con la imagen."
        : "Se agotaron los intentos. Genere un código nuevo.",
    );
  }

  const token = randomToken();
  const issued = await pool.query<{ expires_at: Date }>(
    `UPDATE captcha_challenges
        SET solved_at = now(),
            token_hash = $2,
            expires_at = now() + ($3 || ' milliseconds')::interval
      WHERE id = $1 AND solved_at IS NULL
      RETURNING expires_at`,
    [challengeId, sha256Hex(token), String(captchaTokenTtlMs)],
  );
  const issuedRow = issued.rows[0];
  if (!issuedRow) {
    throw new CaptchaError("expirado", "El código de seguridad ya fue utilizado.");
  }

  return { token, expiresAt: issuedRow.expires_at.toISOString() };
}

/**
 * Consume el token al enviar el reporte. Es de un solo uso: un mismo CAPTCHA no
 * habilita dos envíos.
 */
export async function consumeVerificationToken(pool: Pool, token: string): Promise<void> {
  const result = await pool.query<{ id: string }>(
    `UPDATE captcha_challenges
        SET consumed_at = now()
      WHERE token_hash = $1
        AND solved_at IS NOT NULL
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING id`,
    [sha256Hex(token)],
  );
  if (!result.rows[0]) {
    throw new CaptchaError(
      "expirado",
      "La verificación de seguridad expiró. Vuelva a resolver el código e intente de nuevo.",
    );
  }
}

export async function purgeExpiredChallenges(pool: Pool): Promise<void> {
  await pool.query(`DELETE FROM captcha_challenges WHERE expires_at < now() - interval '1 day'`);
}
