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

describe("reports flow", () => {
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

  it("rechaza envío anónimo", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/reports",
      headers: { "content-type": "application/json" },
      payload: minimalSubmitReport(),
    });
    expect(response.statusCode).toBe(401);
  });

  it("guarda borrador, envía y aparece en historial", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "inv@test.local", PASSWORD);

    const draft = await app.inject({
      method: "POST",
      url: "/api/reports/drafts",
      headers: { cookie, "content-type": "application/json" },
      payload: { report: minimalSubmitReport().report },
    });
    expect(draft.statusCode).toBe(201);
    const draftId = draft.json().id as string;

    const submit = await app.inject({
      method: "POST",
      url: "/api/reports",
      headers: { cookie, "content-type": "application/json" },
      payload: { ...minimalSubmitReport(), draftId },
    });
    expect(submit.statusCode).toBe(201);
    expect(submit.json().status).toBe("en_revision");

    const history = await app.inject({
      method: "GET",
      url: "/api/reports/history",
      headers: { cookie },
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().length).toBeGreaterThanOrEqual(1);
  });
});
