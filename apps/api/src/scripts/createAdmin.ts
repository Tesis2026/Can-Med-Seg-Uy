import { parseArgs } from "node:util";

import { PASSWORD_MIN_LENGTH, Role } from "@canmedseg/shared";

import { assignInitialRoles } from "../admin/userAdminRepository";
import { auth } from "../auth/betterAuth";
import { runMigrations } from "../database/migrate";
import { pool } from "../database/pool";

/**
 * Crea (o promueve) un administrador con email + contraseña. Es la única forma de
 * tener el primer admin: el registro público está deshabilitado.
 *
 *   npm run admin:create -- --email admin@ejemplo.uy --name "Admin" --password "********"
 *
 * Si el email ya existe, le agrega el rol admin, lo reactiva y le fija la contraseña.
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      password: { type: "string" },
    },
  });

  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim() || "Administrador";
  const password = values.password;
  if (!email || !password) {
    throw new Error('Uso: npm run admin:create -- --email <email> --password <contraseña> [--name "<nombre>"]');
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }

  await runMigrations();
  const context = await auth.$context;
  const existing = await context.internalAdapter.findUserByEmail(email);

  let userId: string;
  if (existing) {
    userId = existing.user.id;
    const hash = await context.password.hash(password);
    const hasCredential = existing.accounts.some((account) => account.providerId === "credential");
    if (hasCredential) {
      await context.internalAdapter.updatePassword(userId, hash);
    } else {
      await context.internalAdapter.linkAccount({
        userId,
        providerId: "credential",
        accountId: userId,
        password: hash,
      });
    }
    await pool.query(
      `UPDATE users
          SET banned = false, ban_reason = NULL, ban_expires = NULL, disabled_at = NULL
        WHERE id = $1`,
      [userId],
    );
    console.info(`Usuario existente: ${email}. Se le asigna el rol administrador.`);
  } else {
    // Del lado servidor y sin headers, better-auth permite el alta sin sesión.
    const created = await auth.api.createUser({
      body: { email, password, name, role: "admin" },
    });
    userId = created.user.id;
    console.info(`Administrador creado: ${email}`);
  }

  await assignInitialRoles(
    pool,
    userId,
    [{ role: Role.Admin, healthProfessionSubtype: null }],
    null,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
