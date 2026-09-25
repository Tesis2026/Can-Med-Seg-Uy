import {
  Role,
  isHealthProfessionSubtype,
  type AdminUser,
  type AssignableRole,
  type UserRole,
} from "@canmedseg/shared";
import type { Pool } from "pg";

type AdminUserRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  identity_provider: string;
  disabled_at: Date | null;
  created_at: Date;
  last_login_at: Date | null;
  roles: { role: AssignableRole; health_profession_subtype: string | null }[];
};

function toAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    displayName: row.display_name ?? row.email ?? "Sin nombre",
    email: row.email,
    roles: row.roles.map((entry) => ({
      role: entry.role,
      healthProfessionSubtype: isHealthProfessionSubtype(entry.health_profession_subtype)
        ? entry.health_profession_subtype
        : null,
    })),
    active: row.disabled_at === null,
    identityProvider: row.identity_provider,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
  };
}

const SELECT_ADMIN_USERS = `
  SELECT u.id, u.display_name, u.email, u.identity_provider, u.disabled_at,
         u.created_at, u.last_login_at,
         COALESCE(
           json_agg(json_build_object('role', r.role,
                                      'health_profession_subtype', r.health_profession_subtype)
                    ORDER BY r.role)
             FILTER (WHERE r.role IS NOT NULL),
           '[]'
         ) AS roles
    FROM users u
    LEFT JOIN user_roles r ON r.user_id = u.id`;

export async function listAdminUsers(pool: Pool): Promise<AdminUser[]> {
  const result = await pool.query<AdminUserRow>(
    `${SELECT_ADMIN_USERS}
     GROUP BY u.id
     ORDER BY u.disabled_at IS NOT NULL, lower(COALESCE(u.display_name, u.email, ''))`,
  );
  return result.rows.map(toAdminUser);
}

export async function findAdminUser(pool: Pool, userId: string): Promise<AdminUser | null> {
  const result = await pool.query<AdminUserRow>(
    `${SELECT_ADMIN_USERS}
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId],
  );
  const row = result.rows[0];
  return row ? toAdminUser(row) : null;
}

export async function assignInitialRoles(
  pool: Pool,
  userId: string,
  roles: UserRole[],
  grantedBy: string | null,
): Promise<void> {
  const withBase = new Map(roles.map((entry) => [entry.role, entry.healthProfessionSubtype]));
  if (!withBase.has(Role.Comun)) withBase.set(Role.Comun, null);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [role, subtype] of withBase) {
      await client.query(
        `INSERT INTO user_roles (user_id, role, health_profession_subtype, granted_by)
              VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, role) DO UPDATE
               SET health_profession_subtype = EXCLUDED.health_profession_subtype`,
        [userId, role, role === Role.ProfesionalSalud ? subtype : null, grantedBy],
      );
    }
    await client.query(
      `UPDATE users
          -- Una cuenta que vino de GUB UY (deprecado) conserva su proveedor.
          SET identity_provider = CASE WHEN gub_sub IS NULL THEN 'local' ELSE identity_provider END,
              role = $2,
              updated_at = now()
        WHERE id = $1`,
      [userId, withBase.has(Role.Admin) ? "admin" : "user"],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Mantiene `disabled_at` alineado con el ban de better-auth (lo leen authContext y GUB UY). */
export async function setUserDisabled(pool: Pool, userId: string, disabled: boolean): Promise<void> {
  await pool.query(
    `UPDATE users
        SET disabled_at = CASE WHEN $2 THEN COALESCE(disabled_at, now()) ELSE NULL END,
            updated_at = now()
      WHERE id = $1`,
    [userId, disabled],
  );
}

export async function countOtherActiveAdmins(pool: Pool, userId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT count(*) AS count
       FROM users u
       JOIN user_roles r ON r.user_id = u.id AND r.role = 'admin'
      WHERE u.id <> $1 AND u.disabled_at IS NULL`,
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function isUserActive(pool: Pool, userId: string): Promise<boolean> {
  const result = await pool.query<{ active: boolean }>(
    `SELECT disabled_at IS NULL AND NOT banned AS active FROM users WHERE id = $1`,
    [userId],
  );
  return result.rows[0]?.active ?? false;
}

export async function recordLogin(pool: Pool, userId: string): Promise<void> {
  await pool.query(
    `UPDATE users
        SET last_login_at = now(),
            first_login_at = COALESCE(first_login_at, now())
      WHERE id = $1`,
    [userId],
  );
}
