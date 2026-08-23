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
    description: "Usuario común: reportar, borradores e historial propio.",
    roles: [notifier()],
  },
  {
    id: "profesional-medico",
    subject: "uy-mock-pro-medico-0002",
    fullName: "Diego Pereira",
    firstName: "Diego",
    lastName: "Pereira",
    email: "diego.pereira@example.uy",
    documentNumber: "32145678",
    description: "Profesional de la salud (médico) — subtipo del rol verificado.",
    roles: [notifier(), healthPro(HealthProfessionSubtype.Medico)],
  },
  {
    id: "profesional-quimico",
    subject: "uy-mock-pro-quimico-0003",
    fullName: "Laura Silva",
    firstName: "Laura",
    lastName: "Silva",
    email: "laura.silva@example.uy",
    documentNumber: "38765432",
    description: "Profesional de la salud (químico/a farmacéutico/a).",
    roles: [notifier(), healthPro(HealthProfessionSubtype.QuimicoFarmaceutico)],
  },
  {
    id: "investigador",
    subject: "uy-mock-investigador-0004",
    fullName: "Carlos Méndez",
    firstName: "Carlos",
    lastName: "Méndez",
    email: "carlos.mendez@example.uy",
    documentNumber: "29876543",
    description: "Investigador: revisión, dashboard y exportaciones.",
    roles: [notifier(), { role: Role.Investigador, healthProfessionSubtype: null }],
  },
  {
    id: "msp",
    subject: "uy-mock-msp-0005",
    fullName: "Valeria Techera",
    firstName: "Valeria",
    lastName: "Techera",
    email: "valeria.techera@msp.example.uy",
    documentNumber: "27654321",
    description: "Validador MSP: mismos permisos que investigador por ahora.",
    roles: [notifier(), { role: Role.Msp, healthProfessionSubtype: null }],
  },
  {
    id: "multirol",
    subject: "uy-mock-multirol-0006",
    fullName: "Sofía Barrios",
    firstName: "Sofía",
    lastName: "Barrios",
    email: "sofia.barrios@example.uy",
    documentNumber: "35678901",
    description: "Multi-rol: profesional de la salud (médica) + investigadora.",
    roles: [
      notifier(),
      healthPro(HealthProfessionSubtype.Medico),
      { role: Role.Investigador, healthProfessionSubtype: null },
    ],
  },
  {
    id: "admin",
    subject: "uy-mock-admin-0007",
    fullName: "Ana Rodríguez",
    firstName: "Ana",
    lastName: "Rodríguez",
    email: "ana.rodriguez@example.uy",
    documentNumber: "24567890",
    description: "Administrador: solicitudes de rol, usuarios y catálogos.",
    roles: [notifier(), { role: Role.Admin, healthProfessionSubtype: null }],
  },
];

export function findMockAccount(id: string): MockAccount | undefined {
  return MOCK_ACCOUNTS.find((account) => account.id === id);
}
