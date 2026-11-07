import { Role } from "@canmedseg/shared";
import ExcelJS from "exceljs";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  closeTestApp,
  createTestApp,
  loginAs,
  minimalSubmitReport,
  pool,
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

  it("filtra por texto de la descripción del evento adverso", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "inv@test.local", PASSWORD);

    for (const adverseEventDescription of ["Cefalea intensa", "Náuseas al 100% de la dosis"]) {
      const submit = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { cookie, "content-type": "application/json" },
        payload: minimalSubmitReport({ adverseEventDescription }),
      });
      expect(submit.statusCode).toBe(201);
    }

    const totalFor = async (adverseEvent: string) => {
      const preview = await app.inject({
        method: "GET",
        url: `/api/analytics/export/preview?adverseEvent=${encodeURIComponent(adverseEvent)}`,
        headers: { cookie },
      });
      expect(preview.statusCode).toBe(200);
      return preview.json() as { total: number; filtersSummary: string };
    };

    expect((await totalFor("CEFALEA")).total).toBe(1);
    expect((await totalFor("100%")).total).toBe(1);
    // Los comodines de LIKE se buscan como texto literal.
    expect((await totalFor("%")).total).toBe(1);
    expect((await totalFor("_")).total).toBe(0);
    expect((await totalFor("cefalea")).filtersSummary).toContain("Evento adverso: contiene «cefalea»");
  });

  it("el filtro de edad usa los mismos tramos que el gráfico", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "inv@test.local", PASSWORD);

    // 250 queda fuera de todos los tramos, así que cuenta como «Sin dato».
    for (const age of [1, 2, 7, 45, 250]) {
      const base = minimalSubmitReport();
      const submit = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { cookie, "content-type": "application/json" },
        payload: { report: { ...base.report, patient: { ...base.report.patient, ageAtEventStart: age } } },
      });
      expect(submit.statusCode).toBe(201);
    }

    const dashboard = await app.inject({
      method: "GET",
      url: "/api/analytics/dashboard",
      headers: { cookie },
    });
    const ageSeries = (
      dashboard.json() as { series: { chart: string; slices: { key: string; value: number }[] }[] }
    ).series.find((series) => series.chart === "grupo_etario");
    expect(ageSeries?.slices.map((slice) => [slice.key, slice.value])).toEqual([
      ["0_2", 2],
      ["3_6", 0],
      ["7_11", 1],
      ["12_17", 0],
      ["18_44", 0],
      ["45_mas", 1],
      ["sin_dato", 1],
    ]);

    for (const slice of ageSeries?.slices ?? []) {
      const preview = await app.inject({
        method: "GET",
        url: `/api/analytics/export/preview?ageGroup=${slice.key}`,
        headers: { cookie },
      });
      expect(preview.json().total, slice.key).toBe(slice.value);
    }
  });

  it("un lactante importado de VigiFlow (edad 0) entra en el tramo 0 a 2 años", async () => {
    await seedUser({
      email: "inv@test.local",
      password: PASSWORD,
      roles: [Role.Investigador],
    });
    const cookie = await loginAs(app, "inv@test.local", PASSWORD);

    // MESES: «2 Mes» declarado. NACIM: sin edad, nació el 01/08/2026 y la
    // reacción empezó el 01/10/2026 (2 meses). ADULTO: control fuera del tramo.
    const book = new ExcelJS.Workbook();
    book.addWorksheet("Reportes").addRows([
      ["Número de identificación único mundial", "Iniciales", "Sexo", "Caso narrativo", "Fecha de recepción inicial", "Edad al comienzo de la reacción", "Fecha de nacimiento"],
      ["MESES", "AA", "Femenino", "Lactante con edad declarada", 20261005, "2 Mes", ""],
      ["NACIM", "BB", "Masculino", "Lactante con fecha de nacimiento", 20261005, "", 20260801],
      ["ADULTO", "CC", "Femenino", "Adulto", 20261005, "31 Año", ""],
    ]);
    book.addWorksheet("Medicamentos").addRows([
      ["Número de identificación único mundial", "Rol del medicamento", "Nombre del medicamento (patente-WHODrug)"],
      ["MESES", "Sospechoso", "Aceite CBD"],
      ["NACIM", "Sospechoso", "Aceite CBD"],
      ["ADULTO", "Sospechoso", "Aceite CBD"],
    ]);
    book.addWorksheet("Reacciones").addRows([
      ["Número de identificación único mundial", "Reacción / evento (MedDRA) LLT", "Grave", "Fecha de comienzo / Horario"],
      ["MESES", "Somnolencia", "No", 20261001],
      ["NACIM", "Somnolencia", "No", 20261001],
      ["ADULTO", "Somnolencia", "No", 20261001],
    ]);
    const confirm = await app.inject({
      method: "POST",
      url: "/api/imports/vigiflow/confirm",
      headers: { cookie },
      payload: { filename: "lactantes.xlsx", data: Buffer.from(await book.xlsx.writeBuffer()).toString("base64") },
    });
    expect(confirm.statusCode, confirm.body).toBe(201);

    const stored = await pool.query<{ external_report_id: string; patient_age_at_event_start: number | null }>(
      "SELECT external_report_id, patient_age_at_event_start FROM reports ORDER BY external_report_id",
    );
    expect(stored.rows.map((row) => [row.external_report_id, row.patient_age_at_event_start])).toEqual([
      ["ADULTO", 31],
      ["MESES", 0],
      ["NACIM", 0],
    ]);

    const preview = await app.inject({
      method: "GET",
      url: "/api/analytics/export/preview?ageGroup=0_2",
      headers: { cookie },
    });
    expect(preview.json().total).toBe(2);

    const dashboard = await app.inject({
      method: "GET",
      url: "/api/analytics/dashboard",
      headers: { cookie },
    });
    const ageSeries = (
      dashboard.json() as { series: { chart: string; slices: { key: string; value: number }[] }[] }
    ).series.find((series) => series.chart === "grupo_etario");
    expect(ageSeries?.slices.find((slice) => slice.key === "0_2")?.value).toBe(2);
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
