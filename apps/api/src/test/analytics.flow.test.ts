import { Role } from "@canmedseg/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeTestApp,
  createTestApp,
  loginAs,
  minimalSubmitReport,
  prepareTestDatabase,
  resetDatabase,
  seedUser,
} from "./helpers";

const PASSWORD = "TestPass123!";

describe("analytics flow", () => {
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

  it("dashboard vacío sin reportes aprobados", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "inv@test.local", PASSWORD);

    const dashboard = await app.inject({
      method: "GET",
      url: "/api/analytics/dashboard",
      headers: { cookie },
    });
    expect(dashboard.statusCode).toBe(200);
  });

  it("export preview refleja reportes aprobado_local", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "inv@test.local", PASSWORD);

    const submit = await app.inject({
      method: "POST",
      url: "/api/reports",
      headers: { cookie, "content-type": "application/json" },
      payload: minimalSubmitReport(),
    });
    const reportId = submit.json().id as string;

    await app.inject({
      method: "POST",
      url: `/api/reports/review/${reportId}/classify`,
      headers: { cookie, "content-type": "application/json" },
      payload: { decision: "aprobado_local", causality: "posible" },
    });

    const preview = await app.inject({
      method: "GET",
      url: "/api/analytics/export/preview",
      headers: { cookie },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().total).toBeGreaterThanOrEqual(1);
  });

  it("admin no tiene dashboard:read", async () => {
    await seedUser({
      email: "admin@test.local",
      password: PASSWORD,
      roles: [Role.Admin],
    });
    const cookie = await loginAs(app, "admin@test.local", PASSWORD);

    const dashboard = await app.inject({
      method: "GET",
      url: "/api/analytics/dashboard",
      headers: { cookie },
    });
    expect(dashboard.statusCode).toBe(403);
  });
});
