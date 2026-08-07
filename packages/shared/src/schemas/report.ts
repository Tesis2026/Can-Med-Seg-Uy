import { z } from "zod";

import { REPORT_STATUSES, ReportStatus } from "../enums/report-status";
import type { ReportStatus as ReportStatusType } from "../enums/report-status";

const reportStatusEnum = z.enum(
  REPORT_STATUSES as [ReportStatusType, ...ReportStatusType[]],
);

/** Sección 1 — Datos del paciente (estado de formulario cliente). */
export const patientSchema = z.object({
  initials: z.string().default(""),
  nationalId: z.string().optional().default(""),
  sex: z.enum(["femenino", "masculino", "otro", "prefiere_no_responder"]).optional(),
  weightKg: z.number().positive().optional(),
  heightM: z.number().positive().optional(),
  /** Fecha de nacimiento como dd/mm/aaaa (texto de formulario). */
  birthDate: z.string().default(""),
  ageAtEventStart: z.number().int().nonnegative().optional(),
  countryOfEventStart: z.string().default("Uruguay"),
});

export type Patient = z.infer<typeof patientSchema>;

export const seriousnessCriterionSchema = z.enum([
  "amenaza_vida",
  "muerte",
  "hospitalizacion",
  "discapacidad",
  "malformacion_congenita",
  "otra_condicion_medica",
]);

export type SeriousnessCriterion = z.infer<typeof seriousnessCriterionSchema>;

/** Sección 2 — Evento adverso (módulo repetible). */
export const adverseEventSchema = z.object({
  /** Término MedDRA (búsqueda UI; mock en demo). */
  meddraTerm: z.string().optional().default(""),
  description: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().optional().default(""),
  durationDays: z.number().nonnegative().optional(),
  outcome: z
    .enum([
      "recuperada_resuelta",
      "en_recuperacion",
      "no_recuperada",
      "recuperada_con_secuelas",
      "mortal",
      "desconocido",
    ])
    .optional(),
  isSerious: z.boolean().optional(),
  seriousnessCriteria: z.array(seriousnessCriterionSchema).default([]),
  otherSeriousCondition: z.string().optional().default(""),
  /** Clasificación OMS: leve / moderado / grave. */
  severityGrade: z.enum(["leve", "moderado", "grave"]).optional(),
  /** Escala de causalidad OMS-UMC. */
  causality: z
    .enum([
      "cierta",
      "probable",
      "posible",
      "improbable",
      "condicional",
      "no_clasificable",
      "no_evaluable",
    ])
    .optional(),
});

export type AdverseEvent = z.infer<typeof adverseEventSchema>;

/** Sección 3 — Medicamento implicado (módulo repetible). */
export const medicineSchema = z.object({
  name: z.string().default(""),
  company: z.string().optional().default(""),
  batchNumber: z.string().optional().default(""),
  accessForm: z
    .enum([
      "farmacia_comunitaria",
      "farmacia_institucional",
      "uso_compasivo",
      "otra",
    ])
    .optional(),
  presentation: z.enum(["solucion_oral", "aceite", "sustancia_vegetal"]).optional(),
  thcMg: z.number().nonnegative().optional(),
  cbdMg: z.number().nonnegative().optional(),
  otherCompositionMg: z.number().nonnegative().optional(),
  /** Nombre de archivo local (demo; sin upload real). */
  packageImageName: z.string().optional().default(""),
  dropsPerDose: z.number().nonnegative().optional(),
  dosesPerDay: z.number().nonnegative().optional(),
  administrationRoute: z
    .enum([
      "oral",
      "sublingual",
      "topico",
      "respiratoria",
      "fumada",
      "otra",
      "desconocida",
    ])
    .optional(),
  administrationStartDate: z.string().default(""),
  administrationEndDate: z.string().optional().default(""),
  administrationDurationDays: z.number().nonnegative().optional(),
  recentProductChange: z.boolean().optional(),
  recentProductChangeDetail: z.string().optional().default(""),
  mainIndication: z
    .enum([
      "epilepsia_refractaria",
      "dolor_oncologico",
      "dolor_neuropatico",
      "dolor_musculo_esqueletico",
      "nauseas_vomitos",
      "espasticidad",
      "estres_postraumatico",
      "ansiedad_depresion",
      "anorexia_caquexia",
    ])
    .optional(),
  actionTaken: z
    .enum([
      "retirado",
      "dosis_reducida",
      "dosis_aumentada",
      "dosis_no_modificada",
      "cambio_producto",
      "desconocida",
      "no_aplica",
    ])
    .optional(),
});

export type Medicine = z.infer<typeof medicineSchema>;

/** Sección 4 — Tratamiento concomitante (módulo repetible). */
export const concomitantTreatmentSchema = z.object({
  name: z.string().default(""),
  mgPerDose: z.number().nonnegative().optional(),
  dosesPerDay: z.number().nonnegative().optional(),
  startDate: z.string().default(""),
  endDate: z.string().optional().default(""),
  durationDays: z.number().nonnegative().optional(),
});

export type ConcomitantTreatment = z.infer<typeof concomitantTreatmentSchema>;

/** Sección 5 — Contacto del notificador. */
export const contactSchema = z.object({
  reportingArea: z.string().optional().default(""),
  profession: z
    .enum([
      "medico",
      "farmaceutico",
      "otro_profesional_salud",
      "paciente",
      "asociacion_cannabis",
      "otro_no_sanitario",
    ])
    .optional(),
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
  healthFacility: z.string().optional().default(""),
  email: z.string().email().or(z.literal("")).default(""),
  phone: z.string().default(""),
  sendEmailReceipt: z.boolean().default(false),
});

export type Contact = z.infer<typeof contactSchema>;

/** Borrador / estado del wizard multi-paso (cliente). */
export const adverseEventReportDraftSchema = z.object({
  status: reportStatusEnum.default(ReportStatus.EnProgreso),
  currentStep: z.number().int().min(1).max(5).default(1),
  patient: patientSchema.default({}),
  events: z.array(adverseEventSchema).default([{}]),
  medicines: z.array(medicineSchema).default([{}]),
  diseases: z.array(z.string()).default([]),
  concomitantTreatments: z.array(concomitantTreatmentSchema).default([]),
  contact: contactSchema.default({}),
  additionalComments: z.string().optional().default(""),
});

export type AdverseEventReportDraft = z.infer<typeof adverseEventReportDraftSchema>;

export function createEmptyReportDraft(): AdverseEventReportDraft {
  return adverseEventReportDraftSchema.parse({});
}

export function createEmptyAdverseEvent(): AdverseEvent {
  return adverseEventSchema.parse({});
}

export function createEmptyMedicine(): Medicine {
  return medicineSchema.parse({});
}

export function createEmptyConcomitantTreatment(): ConcomitantTreatment {
  return concomitantTreatmentSchema.parse({});
}
