import {
  Role,
  isAssignableRole,
  isHealthProfessionSubtype,
  permissionsForRoles,
  type AssignableRole,
  type HealthProfessionSubtypeValue,
  type SessionUser,
  type UserRole,
} from "@canmedseg/shared";
import type { Pool, PoolClient } from "pg";

import type { ExternalIdentity } from "./oidcClient";

type UserRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  document_number: string | null;
  consent_accepted_at: Date | null;
  consent_version: string | null;
  first_login_at: Date | null;
  disabled_at: Date | null;
};

type UserRoleRow = {
  role: AssignableRole;
  health_profession_subtype: string | null;
};

export class DisabledUserError extends Error {
  constructor(readonly userId: string) {
    super("La cuenta está deshabilitada");
    this.name = "DisabledUserError";
  }
}

function toUserRole(row: UserRoleRow): UserRole {
  const subtype = row.health_profession_subtype;
  return {
    role: row.role,
    healthProfessionSubtype: isHealthProfessionSubtype(subtype) ? subtype : null,
  };
}

function toSessionUser(user: UserRow, roles: UserRole[]): SessionUser {
  return {
    id: user.id,
    displayName: user.display_name ?? user.email ?? "Usuario gub.uy",
    email: user.email,
    documentNumber: user.document_number,
    roles,
    permissions: permissionsForRoles(roles.map((entry) => entry.role)),
    consentAcceptedAt: user.consent_accepted_at?.toISOString() ?? null,
    consentVersion: user.consent_version,
    firstLoginAt: user.first_login_at?.toISOString() ?? null,
  };
}

async function readRoles(client: Pool | PoolClient, userId: string): Promise<UserRole[]> {
  const result = await client.query<UserRoleRow>(
    `SELECT role, health_profession_subtype FROM user_roles WHERE user_id = $1 ORDER BY role`,
    [userId],
  );
  return result.rows.map(toUserRole);
}

/** Roles sugeridos por el IdP mock, filtrados contra los enums de shared. */
function sanitizeSeedRoles(identity: ExternalIdentity): UserRole[] {
  const roles = new Map<AssignableRole, HealthProfessionSubtypeValue | null>();
  roles.set(Role.Comun, null);

  for (const entry of identity.mockRoles) {
    if (!isAssignableRole(entry.role)) continue;
    const subtype =
      entry.role === Role.ProfesionalSalud && isHealthProfessionSubtype(entry.healthProfessionSubtype)
        ? entry.healthProfessionSubtype
        : null;
    roles.set(entry.role, subtype);
  }

  return [...roles].map(([role, healthProfessionSubtype]) => ({ role, healthProfessionSubtype }));
}

/**
 * Alta o actualización del usuario a partir de la identidad del IdP.
 * `seedRoles` solo aplica en el primer ingreso y solo con el IdP mock (dev):
 * en producción los roles los otorga el administrador (RF-2.4).
 */
export async function upsertUserFromIdentity(
  pool: Pool,
  identity: ExternalIdentity,
  options: { provider: string; seedRoles: boolean },
): Promise<SessionUser> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const upserted = await client.query<UserRow & { was_new: boolean }>(
      `INSERT INTO users (gub_sub, identity_provider, email, display_name, document_number,
                          first_login_at, last_login_at)
            VALUES ($1, $2, $3, $4, $5, now(), now())
       ON CONFLICT (identity_provider, gub_sub) DO UPDATE
             SET email = COALESCE(EXCLUDED.email, users.email),
                 display_name = COALESCE(EXCLUDED.display_name, users.display_name),
                 document_number = COALESCE(EXCLUDED.document_number, users.document_number),
                 last_login_at = now(),
                 updated_at = now()
         RETURNING id, display_name, email, document_number, consent_accepted_at,
                   consent_version, first_login_at, disabled_at,
                   (xmax = 0) AS was_new`,
      [
        identity.subject,
        options.provider,
        identity.email,
        identity.displayName,
        identity.documentNumber,
      ],
    );

    const user = upserted.rows[0];
    if (!user) throw new Error("PostgreSQL no devolvió el usuario del login");
    if (user.disabled_at) throw new DisabledUserError(user.id);

    if (user.was_new) {
      const seed = options.seedRoles
        ? sanitizeSeedRoles(identity)
        : [{ role: Role.Comun, healthProfessionSubtype: null } satisfies UserRole];

      for (const entry of seed) {
        await client.query(
          `INSERT INTO user_roles (user_id, role, health_profession_subtype)
                VALUES ($1, $2, $3)
           ON CONFLICT (user_id, role) DO NOTHING`,
          [user.id, entry.role, entry.healthProfessionSubtype],
        );
      }
    }

    const roles = await readRoles(client, user.id);
    await client.query("COMMIT");
    return toSessionUser(user, roles);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findSessionUser(pool: Pool, userId: string): Promise<SessionUser | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, display_name, email, document_number, consent_accepted_at,
            consent_version, first_login_at, disabled_at
       FROM users WHERE id = $1`,
    [userId],
  );
  const user = result.rows[0];
  if (!user || user.disabled_at) return null;
  return toSessionUser(user, await readRoles(pool, userId));
}

/** Consentimiento informado del primer login (Ley 18.331). */
export async function acceptConsent(
  pool: Pool,
  userId: string,
  version: string,
): Promise<SessionUser | null> {
  await pool.query(
    `UPDATE users
        SET consent_accepted_at = now(),
            consent_version = $2,
            updated_at = now()
      WHERE id = $1 AND disabled_at IS NULL`,
    [userId, version],
  );
  return findSessionUser(pool, userId);
}
