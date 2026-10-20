import { Role } from "@canmedseg/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeTestApp,
  createTestApp,
  loginAs,
  prepareTestDatabase,
  resetDatabase,
  seedUser,
} from "./helpers";

const PASSWORD = "TestPass123!";

describe("admin users flow", () => {
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

  it("admin crea usuario investigador", async () => {
    await seedUser({
      email: "admin@test.local",
      password: PASSWORD,
      roles: [Role.Admin],
    });
    const cookie = await loginAs(app, "admin@test.local", PASSWORD);

    const create = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers: { cookie, "content-type": "application/json" },
      payload: {
        email: "nuevo@test.local",
        password: PASSWORD,
        displayName: "Nuevo Inv",
        roles: [{ role: "investigador", healthProfessionSubtype: null }],
      },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().some((u: { email: string }) => u.email === "nuevo@test.local")).toBe(true);
  });

  it("investigador no puede gestionar usuarios", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "inv@test.local", PASSWORD);

    const list = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      headers: { cookie },
    });
    expect(list.statusCode).toBe(403);
  });
});
