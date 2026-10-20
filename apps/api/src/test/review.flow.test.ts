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

async function submitReport(app: FastifyInstance, cookie: string): Promise<string> {
  const submit = await app.inject({
    method: "POST",
    url: "/api/reports",
    headers: { cookie, "content-type": "application/json" },
    payload: minimalSubmitReport(),
  });
  expect(submit.statusCode).toBe(201);
  return submit.json().id as string;
}

describe("review flow", () => {
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

  it("clasifica a aprobado_local", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "inv@test.local", PASSWORD);
    const reportId = await submitReport(app, cookie);

    const classify = await app.inject({
      method: "POST",
      url: `/api/reports/review/${reportId}/classify`,
      headers: { cookie, "content-type": "application/json" },
      payload: { decision: "aprobado_local", causality: "probable" },
    });
    expect(classify.statusCode).toBe(200);
    expect(classify.json().status).toBe("aprobado_local");
  });

  it("clasifica a rechazado", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "inv@test.local", PASSWORD);
    const reportId = await submitReport(app, cookie);

    const classify = await app.inject({
      method: "POST",
      url: `/api/reports/review/${reportId}/classify`,
      headers: { cookie, "content-type": "application/json" },
      payload: { decision: "rechazado", causality: "improbable" },
    });
    expect(classify.statusCode).toBe(200);
    expect(classify.json().status).toBe("rechazado");
  });

  it("rechaza enviar_msp", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "inv@test.local", PASSWORD);
    const reportId = await submitReport(app, cookie);

    const classify = await app.inject({
      method: "POST",
      url: `/api/reports/review/${reportId}/classify`,
      headers: { cookie, "content-type": "application/json" },
      payload: { decision: "enviar_msp", causality: "posible" },
    });
    expect(classify.statusCode).toBe(400);
  });

  it("msp-pending responde 410", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "inv@test.local", PASSWORD);

    const pending = await app.inject({
      method: "GET",
      url: "/api/reports/msp-pending",
      headers: { cookie },
    });
    expect(pending.statusCode).toBe(410);
  });

  it("no reclasifica un reporte terminal", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "inv@test.local", PASSWORD);
    const reportId = await submitReport(app, cookie);

    await app.inject({
      method: "POST",
      url: `/api/reports/review/${reportId}/classify`,
      headers: { cookie, "content-type": "application/json" },
      payload: { decision: "aprobado_local", causality: "cierta" },
    });

    const again = await app.inject({
      method: "POST",
      url: `/api/reports/review/${reportId}/classify`,
      headers: { cookie, "content-type": "application/json" },
      payload: { decision: "rechazado", causality: "posible" },
    });
    expect(again.statusCode).toBe(409);
  });
});
