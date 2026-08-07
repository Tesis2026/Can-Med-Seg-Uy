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
