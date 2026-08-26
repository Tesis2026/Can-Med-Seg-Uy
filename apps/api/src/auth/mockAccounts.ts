import {
  HealthProfessionSubtype,
  Role,
  type AssignableRole,
  type HealthProfessionSubtypeValue,
} from "@canmedseg/shared";

export type MockAccountRole = {
  role: AssignableRole;
  healthProfessionSubtype: HealthProfessionSubtypeValue | null;
};

export type MockAccount = {
  id: string;
  /** Se usa como `sub` del IdP mock. */
  subject: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  documentNumber: string;
  description: string;
  roles: MockAccountRole[];
};

const notifier = (): MockAccountRole => ({ role: Role.Comun, healthProfessionSubtype: null });

const healthPro = (subtype: HealthProfessionSubtypeValue): MockAccountRole => ({
  role: Role.ProfesionalSalud,
  healthProfessionSubtype: subtype,
});

/**
 * Cuentas del simulador de identidad digital gub.uy (solo dev).
 * Los nombres siguen las pantallas de `documentacion/Pantallas/TesisPantallas.pen`.
 */
export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    id: "comun",
    subject: "uy-mock-comun-0001",
    fullName: "María González",
    firstName: "María",
    lastName: "González",
    email: "maria.gonzalez@example.uy",
    documentNumber: "41234567",
    description: "Puede reportar, guardar borradores y ver su historial.",
    roles: [notifier()],
  },
  {
    id: "profesional-salud",
    subject: "uy-mock-pro-medico-0002",
    fullName: "Diego Pereira",
    firstName: "Diego",
    lastName: "Pereira",
    email: "diego.pereira@example.uy",
    documentNumber: "32145678",
    description: "Profesional de la salud.",
    roles: [notifier(), healthPro(HealthProfessionSubtype.Medico)],
  },
  {
    id: "investigador",
    subject: "uy-mock-investigador-0004",
    fullName: "Carlos Méndez",
    firstName: "Carlos",
    lastName: "Méndez",
    email: "carlos.mendez@example.uy",
    documentNumber: "29876543",
    description: "Revisa y clasifica reportes; accede al panel y a las exportaciones.",
    roles: [notifier(), { role: Role.Investigador, healthProfessionSubtype: null }],
  },
  {
    id: "admin",
    subject: "uy-mock-admin-0007",
    fullName: "Ana Rodríguez",
    firstName: "Ana",
    lastName: "Rodríguez",
    email: "ana.rodriguez@example.uy",
    documentNumber: "24567890",
    description: "Gestiona solicitudes de rol, usuarios y opciones del formulario.",
    roles: [notifier(), { role: Role.Admin, healthProfessionSubtype: null }],
  },
];

export function findMockAccount(id: string): MockAccount | undefined {
  return MOCK_ACCOUNTS.find((account) => account.id === id);
}
