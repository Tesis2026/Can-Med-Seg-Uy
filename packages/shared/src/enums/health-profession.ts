/**
 * Subtipos del rol «Profesional de la salud» (reemplaza al rol «Médico» de la v1.1
 * de requerimientos — ver notas de cliente en requirements/requirements.md).
 */
export const HealthProfessionSubtype = {
  Medico: "medico",
  QuimicoFarmaceutico: "quimico_farmaceutico",
  Enfermero: "enfermero",
  LicenciadoEnfermeria: "licenciado_enfermeria",
  ObstetraPartera: "obstetra_partera",
  Odontologo: "odontologo",
  Laboratorista: "laboratorista",
  Otro: "otro",
} as const;

export type HealthProfessionSubtype =
  (typeof HealthProfessionSubtype)[keyof typeof HealthProfessionSubtype];

export const HEALTH_PROFESSION_SUBTYPES = Object.values(HealthProfessionSubtype);

/** Etiquetas de UI (español) — únicas en shared para no duplicarlas entre web y api. */
export const HEALTH_PROFESSION_SUBTYPE_LABELS: Record<HealthProfessionSubtype, string> = {
  [HealthProfessionSubtype.Medico]: "Médico/a",
  [HealthProfessionSubtype.QuimicoFarmaceutico]: "Químico/a farmacéutico/a",
  [HealthProfessionSubtype.Enfermero]: "Enfermero/a",
  [HealthProfessionSubtype.LicenciadoEnfermeria]: "Licenciado/a en enfermería",
  [HealthProfessionSubtype.ObstetraPartera]: "Obstetra / partera",
  [HealthProfessionSubtype.Odontologo]: "Odontólogo/a",
  [HealthProfessionSubtype.Laboratorista]: "Laboratorista",
  [HealthProfessionSubtype.Otro]: "Otro/a profesional de la salud",
};

export function isHealthProfessionSubtype(value: unknown): value is HealthProfessionSubtype {
  return (
    typeof value === "string" &&
    (HEALTH_PROFESSION_SUBTYPES as string[]).includes(value)
  );
}
