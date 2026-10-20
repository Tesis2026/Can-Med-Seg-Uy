import { CONSENT_VERSION, Role } from "@canmedseg/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeTestApp,
  cookieFromResponse,
  createTestApp,
  loginAs,
  prepareTestDatabase,
  resetDatabase,
  seedUser,
  pool,
} from "./helpers";

const PASSWORD = "TestPass123!";

describe("auth flow", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await prepareTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("inicia sesión y expone roles en /auth/session", async () => {
    await seedUser({
      email: "admin@test.local",
      password: PASSWORD,
      roles: [Role.Admin],
    });

    const cookie = await loginAs(app, "admin@test.local", PASSWORD);
    const session = await app.inject({
      method: "GET",
      url: "/api/auth/session",
      headers: { cookie },
    });

    expect(session.statusCode).toBe(200);
    const body = session.json();
    expect(body.authenticated).toBe(true);
    expect(body.roles).toContain("admin");
    expect(body.permissions).toContain("users:manage");
  });

  it("rechaza credenciales inválidas", async () => {
    await seedUser({
      email: "admin@test.local",
      password: PASSWORD,
      roles: [Role.Admin],
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { "content-type": "application/json" },
      payload: { email: "admin@test.local", password: "wrong-password" },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("cierra sesión", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    let cookie = await loginAs(app, "inv@test.local", PASSWORD);

    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie, host: "localhost:5173", "content-type": "application/json" },
      payload: {},
    });
    if (logout.statusCode !== 200) {
      expect.fail(`logout: ${logout.statusCode} ${logout.body}`);
    }
    cookie = cookieFromResponse(logout, cookie);

    const session = await app.inject({
      method: "GET",
      url: "/api/auth/session",
      headers: { cookie },
    });
    expect(session.json().authenticated).toBe(false);
  });

  it("usuario desactivado no obtiene sesión usable", async () => {
    const user = await seedUser({
      email: "banned@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    await pool.query(
      `UPDATE users SET disabled_at = now(), banned = true, ban_reason = 'test' WHERE id = $1`,
      [user.id],
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { "content-type": "application/json" },
      payload: { email: "banned@test.local", password: PASSWORD },
    });
    // better-auth puede rechazar el sign-in o la sesión queda sin usuario activo
    if (response.statusCode < 400) {
      const cookie = cookieFromResponse(response);
      const session = await app.inject({
        method: "GET",
        url: "/api/auth/session",
        headers: { cookie },
      });
      expect(session.json().authenticated).toBe(false);
    } else {
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    }
  });

  it("acepta consentimiento informado", async () => {
    await seedUser({
      email: "consent@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "consent@test.local", PASSWORD);

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/consent",
      headers: { cookie, "content-type": "application/json" },
      payload: { version: CONSENT_VERSION },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.consentVersion).toBe(CONSENT_VERSION);
  });

  it("solicita recuperación de contraseña sin filtrar existencia", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/request-password-reset",
      headers: { "content-type": "application/json" },
      payload: { email: "nobody@test.local", redirectTo: "http://localhost:5173/restablecer-contrasena" },
    });
    expect(response.statusCode).toBeLessThan(500);
  });
});
