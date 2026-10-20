import { Role, type AssignableRole, type UserRole } from "@canmedseg/shared";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";

import { assignInitialRoles } from "../admin/userAdminRepository";
import { buildApp } from "../app";
import { auth } from "../auth/betterAuth";
import { runMigrations } from "../database/migrate";
import { pool } from "../database/pool";

export { pool };

const TABLES_TO_TRUNCATE = [
  "msp_outbox",
  "report_review_events",
  "export_logs",
  "periodic_report_deliveries",
  "periodic_report_preferences",
  "person_pseudonyms",
  "report_adverse_events",
  "report_medicines",
  "report_concomitants",
  "report_images",
  "reports",
  "captcha_challenges",
  "auth_verifications",
  "auth_sessions",
  "auth_accounts",
  "sessions",
  "auth_login_states",
  "auth_mock_authorization_codes",
  "role_requests",
  "user_roles",
  "users",
] as const;

export async function prepareTestDatabase(): Promise<void> {
  await runMigrations(pool);
}

export async function resetDatabase(): Promise<void> {
  const existing = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const names = existing.rows.map((row) => row.tablename);
  const toTruncate = TABLES_TO_TRUNCATE.filter((name) => names.includes(name));
  if (toTruncate.length === 0) return;
  await pool.query(`TRUNCATE ${toTruncate.map((name) => `"${name}"`).join(", ")} CASCADE`);
}

export async function createTestApp(): Promise<FastifyInstance> {
  return buildApp();
}

export async function closeTestApp(app: FastifyInstance): Promise<void> {
  await app.close();
}

export function mergeCookies(
  existing: string | undefined,
  setCookie: string | string[] | undefined,
): string {
  const jar = new Map<string, string>();
  if (existing) {
    for (const part of existing.split("; ")) {
      const eq = part.indexOf("=");
      if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
    }
  }
  const headers = setCookie === undefined ? [] : Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const raw of headers) {
    const first = raw.split(";")[0] ?? "";
    const eq = first.indexOf("=");
    if (eq > 0) jar.set(first.slice(0, eq), first.slice(eq + 1));
  }
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

export function cookieFromResponse(
  response: LightMyRequestResponse,
  previous?: string,
): string {
  return mergeCookies(previous, response.headers["set-cookie"]);
}

export type SeedUserInput = {
  email: string;
  password: string;
  name?: string;
  roles: AssignableRole[];
  /** better-auth role string */
  betterAuthRole?: "admin" | "user";
};

export async function seedUser(input: SeedUserInput): Promise<{ id: string; email: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name ?? email.split("@")[0] ?? "Usuario";
  const betterAuthRole =
    input.betterAuthRole ?? (input.roles.includes(Role.Admin) ? "admin" : "user");

  const created = await auth.api.createUser({
    body: { email, password: input.password, name, role: betterAuthRole },
  });

  const roles: UserRole[] = input.roles.map((role) => ({
    role,
    healthProfessionSubtype: null,
  }));
  await assignInitialRoles(pool, created.user.id, roles, null);

  return { id: created.user.id, email };
}

export async function loginAs(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    headers: { "content-type": "application/json" },
    payload: { email, password },
  });
  if (response.statusCode >= 400) {
    throw new Error(`Login falló (${response.statusCode}): ${response.body}`);
  }
  return cookieFromResponse(response);
}

/** Payload mínimo válido para POST /api/reports. */
export function minimalSubmitReport(overrides: Record<string, unknown> = {}) {
  return {
    report: {
      patient: {
        initials: "AB",
        sex: "femenino",
        birthDate: "01/01/1990",
        ageAtEventStart: 34,
        countryOfEventStart: "Uruguay",
        nationalId: "12345678",
      },
      adverseEventDescription: "Cefalea leve tras dosis de prueba",
      events: [
        {
          meddraTerm: "Cefalea",
          startDate: "01/02/2024",
          isSerious: false,
        },
      ],
      medicines: [
        {
          name: "Aceite CBD 5%",
          administrationStartDate: "15/01/2024",
        },
      ],
      contact: {
        profession: "medico",
        email: "notificador@example.com",
        phone: "099123456",
      },
      ...overrides,
    },
  };
}
