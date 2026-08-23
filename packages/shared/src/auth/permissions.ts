import { Role } from "../enums/role";

/**
 * Permisos derivados de la matriz de documentacion/diagramas.md §4.2.
 * Los guards de la API y las rutas de la web consultan esta única fuente.
 */
export const Permission = {
  /** Llenar y enviar un reporte (también anónimo, con CAPTCHA + email). */
  ReportSubmit: "report:submit",
  /** Guardar borradores (RF-4) — solo usuarios logueados. */
  ReportDraftWrite: "report:draft:write",
  /** Ver historial propio (RF-6). */
  ReportHistoryRead: "report:history:read",
  /** Mini-dashboard de incentivo del profesional de la salud (notas de cliente). */
  IncentiveStatsRead: "stats:incentive:read",
  /** Validar/clasificar reportes (RF-5). */
  ReportReview: "report:review",
  /** Dashboard y gráficos (RF-7). */
  DashboardRead: "dashboard:read",
  /** Exportar a Excel/CSV (RF-8.1). */
  ExportRead: "export:read",
  /** Recibir reportes periódicos por mail (RF-8.3). */
  PeriodicReportsReceive: "periodic-reports:receive",
  /** Configurar opciones del formulario (RF-10). */
  FormOptionsManage: "form-options:manage",
  /** Aprobar solicitudes de rol (RF-2.3/2.4). */
  RoleRequestsReview: "role-requests:review",
  /** Gestionar usuarios (RF-11). */
  UsersManage: "users:manage",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const PERMISSIONS = Object.values(Permission);

const NOTIFIER_PERMISSIONS: readonly Permission[] = [
  Permission.ReportSubmit,
  Permission.ReportDraftWrite,
  Permission.ReportHistoryRead,
];

/**
 * MSP (validador) tiene la misma superficie que Investigador por ahora
 * (rol separado para la transferencia institucional — plan-arquitectura.md).
 */
const REVIEWER_PERMISSIONS: readonly Permission[] = [
  ...NOTIFIER_PERMISSIONS,
  Permission.ReportReview,
  Permission.DashboardRead,
  Permission.ExportRead,
  Permission.PeriodicReportsReceive,
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.Anonimo]: [Permission.ReportSubmit],
  [Role.Comun]: NOTIFIER_PERMISSIONS,
  [Role.ProfesionalSalud]: [...NOTIFIER_PERMISSIONS, Permission.IncentiveStatsRead],
  [Role.Investigador]: REVIEWER_PERMISSIONS,
  [Role.Msp]: REVIEWER_PERMISSIONS,
  [Role.Admin]: [
    ...NOTIFIER_PERMISSIONS,
    Permission.FormOptionsManage,
    Permission.RoleRequestsReview,
    Permission.UsersManage,
  ],
};

/** Los permisos de un usuario son la unión de los permisos de todos sus roles. */
export function permissionsForRoles(roles: readonly Role[]): Permission[] {
  const granted = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) granted.add(permission);
  }
  return PERMISSIONS.filter((permission) => granted.has(permission));
}

export function hasPermission(
  permissions: readonly Permission[],
  permission: Permission,
): boolean {
  return permissions.includes(permission);
}
