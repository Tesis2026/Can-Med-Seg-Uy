import { describe, expect, it } from "vitest";

import {
  ACTIVE_REPORT_STATUSES,
  ACTIVE_ROLES,
  Permission,
  ReportStatus,
  Role,
  classifyReportInputSchema,
  isActiveRole,
  permissionsForRoles,
} from "../src/index";

describe("roles activos", () => {
  it("solo Investigador y Admin están activos", () => {
    expect(ACTIVE_ROLES).toEqual([Role.Investigador, Role.Admin]);
    expect(isActiveRole(Role.Anonimo)).toBe(false);
    expect(isActiveRole(Role.Msp)).toBe(false);
  });

  it("anónimo no otorga permisos (reporte anónimo off)", () => {
    expect(permissionsForRoles([Role.Anonimo])).toEqual([]);
  });

  it("investigador puede revisar y ver dashboard; admin gestiona usuarios", () => {
    const investigador = permissionsForRoles([Role.Investigador]);
    expect(investigador).toContain(Permission.ReportReview);
    expect(investigador).toContain(Permission.DashboardRead);
    expect(investigador).toContain(Permission.ExportRead);

    const admin = permissionsForRoles([Role.Admin]);
    expect(admin).toContain(Permission.UsersManage);
    expect(admin).not.toContain(Permission.ReportReview);
  });
});

describe("estados de reporte activos", () => {
  it("no incluye estados de envío MSP como activos de UI", () => {
    expect(ACTIVE_REPORT_STATUSES).toContain(ReportStatus.EnProgreso);
    expect(ACTIVE_REPORT_STATUSES).toContain(ReportStatus.EnRevision);
    expect(ACTIVE_REPORT_STATUSES).toContain(ReportStatus.AprobadoLocal);
    expect(ACTIVE_REPORT_STATUSES).not.toContain(ReportStatus.AprobadoMsp);
    expect(ACTIVE_REPORT_STATUSES).not.toContain(ReportStatus.EnviadoMsp);
  });
});

describe("classifyReportInputSchema", () => {
  it("rechaza enviar_msp", () => {
    const result = classifyReportInputSchema.safeParse({
      decision: "enviar_msp",
      causality: "posible",
    });
    expect(result.success).toBe(false);
  });

  it("acepta aprobado_local y rechazado", () => {
    expect(
      classifyReportInputSchema.safeParse({
        decision: "aprobado_local",
        causality: "probable",
      }).success,
    ).toBe(true);
    expect(
      classifyReportInputSchema.safeParse({
        decision: "rechazado",
        causality: "improbable",
      }).success,
    ).toBe(true);
  });
});
