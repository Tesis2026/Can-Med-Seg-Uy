import type { PendingInvitation } from "@canmedseg/shared";
import type { Pool } from "pg";

type PendingInvitationRow = {
  id: string;
  email: string;
  inviter_name: string | null;
  created_at: Date;
  expires_at: Date;
};

function toPendingInvitation(row: PendingInvitationRow): PendingInvitation {
  return {
    id: row.id,
    email: row.email,
    inviterName: row.inviter_name,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    expired: row.expires_at.getTime() < Date.now(),
  };
}

/**
 * Invitaciones sin aceptar de todos los administradores (el listado del plugin solo
 * devuelve las propias). Al aceptarse una, el plugin marca como `expired` las demás
 * del mismo email: por eso se excluyen los emails que ya tienen cuenta.
 */
const SELECT_OPEN_INVITATIONS = `
  SELECT i.id, i.email, u.display_name AS inviter_name, i.created_at, i.expires_at
    FROM app_invitations i
    LEFT JOIN users u ON u.id = i.inviter_id
   WHERE i.status IN ('pending', 'expired')
     AND i.email IS NOT NULL
     AND i.expires_at IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM users existing WHERE lower(existing.email) = lower(i.email))`;

export async function listOpenInvitations(pool: Pool): Promise<PendingInvitation[]> {
  const result = await pool.query<PendingInvitationRow>(
    `${SELECT_OPEN_INVITATIONS}
     ORDER BY i.created_at DESC`,
  );
  return result.rows.map(toPendingInvitation);
}

export async function findOpenInvitation(
  pool: Pool,
  invitationId: string,
): Promise<PendingInvitation | null> {
  const result = await pool.query<PendingInvitationRow>(
    `${SELECT_OPEN_INVITATIONS}
       AND i.id = $1`,
    [invitationId],
  );
  const row = result.rows[0];
  return row ? toPendingInvitation(row) : null;
}

/** Reenviar: la invitación vuelve a quedar vigente con un plazo nuevo y el mismo enlace. */
export async function renewInvitation(pool: Pool, invitationId: string, ttlMs: number): Promise<void> {
  await pool.query(
    `UPDATE app_invitations
        SET status = 'pending',
            expires_at = now() + ($2::bigint * interval '1 millisecond')
      WHERE id = $1`,
    [invitationId, ttlMs],
  );
}
