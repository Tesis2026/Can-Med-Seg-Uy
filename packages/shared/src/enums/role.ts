/**
 * Roles del sistema — modelo objetivo de documentacion/diagramas.md §4.
 *
 * `anonimo` no se persiste: es el rol implícito de una petición sin sesión.
 * Un usuario logueado siempre tiene al menos `comun` y puede acumular varios roles.
 */
export const Role = {
  Anonimo: "anonimo",
  Comun: "comun",
  ProfesionalSalud: "profesional_salud",
  Investigador: "investigador",
  Msp: "msp",
  Admin: "admin",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLES = Object.values(Role);

/** Roles que se pueden guardar en `user_roles` (excluye el rol implícito anónimo). */
export const ASSIGNABLE_ROLES = [
  Role.Comun,
  Role.ProfesionalSalud,
  Role.Investigador,
  Role.Msp,
  Role.Admin,
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Etiquetas de UI (español). */
export const ROLE_LABELS: Record<Role, string> = {
  [Role.Anonimo]: "Visitante",
  [Role.Comun]: "Usuario común",
  [Role.ProfesionalSalud]: "Profesional de la salud",
  [Role.Investigador]: "Investigador",
  [Role.Msp]: "Validador MSP",
  [Role.Admin]: "Administrador",
};

export function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

/**
 * Roles que se muestran en la interfaz. `comun` y `anonimo` quedan fuera: son la
 * base que tiene cualquiera y nombrarlos no le dice nada al usuario.
 */
export function visibleRoles(roles: readonly Role[]): Role[] {
  return roles.filter((role) => role !== Role.Comun && role !== Role.Anonimo);
}
