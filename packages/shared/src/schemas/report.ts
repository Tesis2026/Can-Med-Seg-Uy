import { z } from "zod";

import {
  REPORT_STATUSES,
  ReportStatus,
  SUBMITTED_REPORT_STATUSES,
} from "../enums/report-status";
import type {
  ReportStatus as ReportStatusType,
  SubmittedReportStatus as SubmittedReportStatusType,
} from "../enums/report-status";

/**
 * Esquema del formulario de notificación alineado a:
 * documentacion/v2_Diccionario de variables-revisado.xlsx
 *
 * Los nombres de UI deben coincidir con la columna «Nombre» del diccionario
 * (sin el marcador (*) de obligatoriedad ni notas (??)).
 */

const reportStatusEnum = z.enum(
  REPORT_STATUSES as [ReportStatusType, ...ReportStatusType[]],
);

/** Estados posibles de un reporte ya enviado (todo menos `en_progreso`). */
export const submittedReportStatusSchema = z.enum(
  SUBMITTED_REPORT_STATUSES as unknown as [
    SubmittedReportStatusType,
    ...SubmittedReportStatusType[],
  ],
);

/** Sección — Información general del paciente (vars. 1–9). */
export const patientSchema = z.object({
  /** 1.0 Iniciales(*) — máx. 4 caracteres. */
  initials: z.string().default(""),
  /** 2.0 Número de cédula. */
  nationalId: z.string().optional().default(""),
  /** 3.0 Sexo(*). */
  sex: z.enum(["femenino", "masculino", "otro", "prefiere_no_responder"]).optional(),
  /** 4.0 Peso (kg). */
  weightKg: z.number().positive().optional(),
  /** 5.0 Talla (m). */
  heightM: z.number().positive().optional(),
  /** 7.0 Fecha de nacimiento(*) — dd/mm/aaaa. */
  birthDate: z.string().default(""),
  /** 8.0 Edad al comienzo del evento adverso (años). */
  ageAtEventStart: z.number().int().nonnegative().optional(),
  /** 9.0 País en donde comenzó el evento adverso(*). */
  countryOfEventStart: z.string().default("Uruguay"),
});

export type Patient = z.infer<typeof patientSchema>;

/** 17.0 Indicador de gravedad (criterio único). */
export const seriousnessCriterionSchema = z.enum([
  "muerte",
  "amenaza_vida",
  "discapacidad",
  "hospitalizacion",
  "malformacion_congenita",
  "otra_condicion_medica",
]);

export type SeriousnessCriterion = z.infer<typeof seriousnessCriterionSchema>;

/**
 * Módulo repetible vars. 11–17 (Reacción/Síntoma … Indicador de gravedad).
 * La var. 10 (Evento adverso) y 18–19 viven a nivel de borrador.
 */
export const adverseEventSchema = z.object({
  /** 11.0 Reacción/Síntoma(*) — término MedDRA. */
  meddraTerm: z.string().default(""),
  /** 12.0 Fecha de inicio del evento adverso(*). */
  startDate: z.string().default(""),
  /** 13.0 Fecha de finalización del evento adverso. */
  endDate: z.string().optional().default(""),
  /** 14.0 Duración — operacionalización (días); se calcula desde inicio/fin. */
  durationDays: z.number().int().nonnegative().optional(),
  /** 15.0 Estado actual del evento adverso. */
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
  /** 16.0 ¿El evento adverso fue grave?(*). */
  isSerious: z.boolean().optional(),
  /** 17.0 Indicador de gravedad. */
  seriousnessCriterion: seriousnessCriterionSchema.optional(),
});

export type AdverseEvent = z.infer<typeof adverseEventSchema>;

/** 18.0 Clasificación de gravedad (OMS). */
export const severityGradeSchema = z.enum(["leve", "moderado", "severo"]);
export type SeverityGrade = z.infer<typeof severityGradeSchema>;

/** 19.0 Relación causal (OMS-UMC). */
export const causalitySchema = z.enum([
  "cierta",
  "probable",
  "posible",
  "improbable",
  "condicional",
  "no_evaluable",
]);
export type Causality = z.infer<typeof causalitySchema>;

/** Sección — Medicamento implicado (vars. 20–41). */
export const medicineSchema = z.object({
  /** 20.0 Nombre del medicamento(*). */
  name: z.string().default(""),
  /** 21.0 Compañía farmacéutica productora/distribuidora del medicamento. */
  company: z.string().optional().default(""),
  /** 22.0 Número de lote. */
  batchNumber: z.string().optional().default(""),
  /** 23.0 Forma de acceso. */
  accessForm: z
    .enum([
      "farmacia_comunitaria",
      "farmacia_institucional",
      "uso_compasivo",
      "otra",
    ])
    .optional(),
  /** 24.0 Tipo de presentación. */
  presentation: z
    .enum(["solucion_oral", "aceite", "sustancia_vegetal", "uso_topico"])
    .optional(),
  /** 25.0 Dosis — texto libre. */
  dose: z.string().optional().default(""),
  /** Unidad informada para dosis/presentación. */
  compositionUnit: z.enum(["percent", "ml"]).default("percent"),
  /** 26.0 Imagen del envase — nombre de archivo (demo). */
  packageImageName: z.string().optional().default(""),
  /** 27.0 Dosis/presentación (THC) — %. */
  thcPercent: z.number().min(0).optional(),
  /** 28.0 Dosis/presentación (CBD) — %. */
  cbdPercent: z.number().min(0).optional(),
  /** 29.0 Dosis/presentación (Otro) — %. */
  otherPercent: z.number().min(0).optional(),
  /** 30.0 Posología (veces al día). */
  dosesPerDay: z.number().int().positive().optional(),
  /** 31.0 Posología (cantidad por cada vez) — gotas. */
  amountPerDose: z.number().positive().optional(),
  /**
   * 32–33.0 Vía de administración.
   * Se usa la lista completa (var. 33); una sola vía en el formulario.
   */
  administrationRoute: z
    .enum([
      "topico",
      "oral",
      "respiratoria",
      "sublingual",
      "desconocido",
      "intramuscular",
      "intravenosa",
      "nasal",
      "oftalmica",
      "otros",
      "rectal",
      "subcutanea",
      "vaginal",
    ])
    .optional(),
  /** 34.0 Fecha de inicio de la administración del medicamento. */
  administrationStartDate: z.string().optional().default(""),
  /** 35.0 Fecha de fin de la administración del medicamento. */
  administrationEndDate: z.string().optional().default(""),
  /** 36.0 Duración de la administración — operacionalización (días). */
  administrationDurationDays: z.number().int().nonnegative().optional(),
  /** 37.0 Cambio reciente de producto. */
  recentProductChange: z.boolean().optional(),
  /** 38.0 Cambio reciente de producto-Especificar — máx. 100. */
  recentProductChangeDetail: z.string().optional().default(""),
  /** 39.0 Indicación … (texto libre). */
  indicationText: z.string().optional().default(""),
  /** 40.0 Indicación … (lista). */
  indicationCategory: z
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
  /** 41.0 Acción tomada con el medicamento. */
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

/** Módulo repetible vars. 44–49 (cuando 43 = Sí). */
export const concomitantTreatmentSchema = z.object({
  /** 44.0 Nombre del medicamento (Módulo repetible). */
  name: z.string().default(""),
  /** 45.0 Posología (milígramos/toma). */
  mgPerDose: z.number().positive().optional(),
  /** 46.0 Posología (tomas/día). */
  dosesPerDay: z.number().int().positive().optional(),
  /** 47.0 Fecha de inicio de la administración del medicamento(*). */
  startDate: z.string().default(""),
  /** 48.0 Fecha de fin de la administración del medicamento. */
  endDate: z.string().optional().default(""),
  /** 49.0 Duración del uso del medicamento concomitante. */
  durationDays: z.number().int().positive().optional(),
});

export type ConcomitantTreatment = z.infer<typeof concomitantTreatmentSchema>;

/** Sección — Información de contacto (vars. 1–7 del bloque contacto). */
export const contactSchema = z.object({
  /** 1.0 Área Reportante — máx. 500. */
  reportingArea: z.string().optional().default(""),
  /** Institución especificada cuando el área reportante es "otro". */
  reportingAreaOther: z.string().optional().default(""),
  /** 2.0 Profesión(*). */
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
  /** 3.0 Nombre(s) — máx. 50. */
  firstName: z.string().optional().default(""),
  /** 4.0 Apellidos(s) — máx. 50. */
  lastName: z.string().optional().default(""),
  /** 5.0 Establecimiento de Salud — máx. 100. */
  healthFacility: z.string().optional().default(""),
  /** 6.0 Correo electrónico(*). */
  email: z.string().email().or(z.literal("")).default(""),
  /** 7.0 Teléfono(*). */
  phone: z.string().default(""),
  /** Preferencia UI de envío de acuse (no es variable del diccionario). */
  sendEmailReceipt: z.boolean().default(false),
});

export type Contact = z.infer<typeof contactSchema>;

/** Borrador / estado del wizard multi-paso (cliente). */
export const adverseEventReportDraftSchema = z.object({
  status: reportStatusEnum.default(ReportStatus.EnProgreso),
  currentStep: z.number().int().min(1).max(5).default(1),
  patient: patientSchema.default({}),
  /** 10.0 Evento adverso(*) — descripción general (máx. 500). */
  adverseEventDescription: z.string().default(""),
  /** Módulo repetible 11–17. */
  events: z.array(adverseEventSchema).default([{}]),
  /** 18.0 Clasificación de gravedad. */
  severityGrade: severityGradeSchema.optional(),
  /** 19.0 Relación causal. */
  causality: causalitySchema.optional(),
  medicines: z.array(medicineSchema).default([{}]),
  /** 42.0 Enfermedades previas o actuales — texto libre (máx. 500). */
  previousDiseases: z.string().optional().default(""),
  /** 43.0 Tratamientos farmacológicos concomitantes (Sí/No). */
  hasConcomitantTreatments: z.boolean().optional(),
  concomitantTreatments: z.array(concomitantTreatmentSchema).default([]),
  /** 50.0 Comentarios adicionales — máx. 500. */
  additionalComments: z.string().optional().default(""),
  contact: contactSchema.default({}),
});

export type AdverseEventReportDraft = z.infer<typeof adverseEventReportDraftSchema>;

/** Contrato del POST: el borrador es permisivo; al enviar se exige RF-3. */
export const submitAdverseEventReportSchema = adverseEventReportDraftSchema.superRefine(
  (report, context) => {
    const required = (path: (string | number)[], message = "Campo obligatorio") =>
      context.addIssue({ code: z.ZodIssueCode.custom, path, message });

    if (!report.patient.initials.trim()) required(["patient", "initials"]);
    if (!report.patient.sex) required(["patient", "sex"]);
    if (!report.patient.birthDate.trim()) required(["patient", "birthDate"]);
    if (report.patient.ageAtEventStart === undefined) required(["patient", "ageAtEventStart"]);
    if (!report.patient.countryOfEventStart.trim()) required(["patient", "countryOfEventStart"]);
    if (!report.adverseEventDescription.trim()) required(["adverseEventDescription"]);
    if (report.events.length === 0) required(["events"], "Agregue al menos un evento adverso");
    report.events.forEach((event, index) => {
      if (!event.meddraTerm.trim()) required(["events", index, "meddraTerm"]);
      if (!event.startDate.trim()) required(["events", index, "startDate"]);
      if (event.isSerious === undefined) required(["events", index, "isSerious"]);
      if (event.isSerious && !event.seriousnessCriterion) {
        required(["events", index, "seriousnessCriterion"]);
      }
    });
    if (report.medicines.length === 0) required(["medicines"], "Agregue al menos un medicamento");
    report.medicines.forEach((medicine, index) => {
      if (!medicine.name.trim()) required(["medicines", index, "name"]);
      if (!medicine.administrationStartDate?.trim()) {
        required(["medicines", index, "administrationStartDate"]);
      }
      for (const field of ["thcPercent", "cbdPercent", "otherPercent"] as const) {
        const value = medicine[field];
        if (medicine.compositionUnit === "percent" && value !== undefined && value > 100) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["medicines", index, field],
            message: "Porcentaje inválido",
          });
        }
      }
    });
    if (report.contact.reportingArea === "otro" && !report.contact.reportingAreaOther?.trim()) {
      required(["contact", "reportingAreaOther"], "Especifique la institución");
    }
    if (!report.contact.profession) required(["contact", "profession"]);
    if (!report.contact.email.trim()) required(["contact", "email"]);
    if (!report.contact.phone.trim()) required(["contact", "phone"]);
  },
);

export type SubmitAdverseEventReport = z.infer<typeof submitAdverseEventReportSchema>;

export const createdReportSchema = z.object({
  id: z.string().uuid(),
  status: z.literal(ReportStatus.EnRevision),
  createdAt: z.string().datetime(),
  submittedAt: z.string().datetime(),
});

export type CreatedReport = z.infer<typeof createdReportSchema>;

export const reportDetailSchema = z.object({
  id: z.string().uuid(),
  status: submittedReportStatusSchema,
  createdAt: z.string().datetime(),
  submittedAt: z.string().datetime(),
  report: adverseEventReportDraftSchema,
});

export type ReportDetail = z.infer<typeof reportDetailSchema>;

/**
 * Cuerpo del POST de envío. El reporte va anidado para poder acompañarlo de la
 * verificación del CAPTCHA (RF-3.6, obligatoria solo sin sesión) y del borrador
 * que se está enviando (RF-4: se convierte en el reporte, no se duplica).
 */
export const submitReportRequestSchema = z.object({
  report: submitAdverseEventReportSchema,
  /** Borrador `en_progreso` del que proviene el envío (solo usuarios logueados). */
  draftId: z.string().uuid().optional(),
  /** Token devuelto por `POST /api/captcha/verify`; exigido a los visitantes. */
  captchaToken: z.string().min(1).optional(),
});

export type SubmitReportRequest = z.infer<typeof submitReportRequestSchema>;

/* ------------------------------------------------------------------ *
 * Borradores (RF-4) — solo usuarios logueados.
 * ------------------------------------------------------------------ */

/** Autoguardado al pasar de sección (RF-4.2): el contenido es permisivo. */
export const saveReportDraftInputSchema = z.object({
  report: adverseEventReportDraftSchema,
});

export type SaveReportDraftInput = z.infer<typeof saveReportDraftInputSchema>;

/** Fila de la vista «Formularios en progreso» (RF-4.5). */
export const reportDraftSummarySchema = z.object({
  id: z.string().uuid(),
  /** Iniciales del paciente ya cargadas; vacío si el borrador aún no llegó ahí. */
  patientInitials: z.string(),
  patientNationalId: z.string(),
  currentStep: z.number().int().min(1).max(5),
  updatedAt: z.string().datetime(),
  /** Caducidad por inactividad (plan-arquitectura.md: 90 días). */
  expiresAt: z.string().datetime(),
});

export type ReportDraftSummary = z.infer<typeof reportDraftSummarySchema>;

export const reportDraftDetailSchema = reportDraftSummarySchema.extend({
  report: adverseEventReportDraftSchema,
});

export type ReportDraftDetail = z.infer<typeof reportDraftDetailSchema>;

export const reportDraftSummaryListSchema = z.array(reportDraftSummarySchema);

/* ------------------------------------------------------------------ *
 * Historial propio (RF-6).
 * ------------------------------------------------------------------ */

export const reportHistoryItemSchema = z.object({
  id: z.string().uuid(),
  status: submittedReportStatusSchema,
  submittedAt: z.string().datetime(),
  patientInitials: z.string(),
  patientNationalId: z.string(),
  adverseEventDescription: z.string(),
});

export type ReportHistoryItem = z.infer<typeof reportHistoryItemSchema>;

export const reportHistoryListSchema = z.array(reportHistoryItemSchema);

/**
 * Contadores de la home del notificador (pantalla «Home usuario común»):
 * los propios y el total nacional de reportes enviados.
 */
export const notifierStatsSchema = z.object({
  ownSubmitted: z.number().int().nonnegative(),
  totalSubmitted: z.number().int().nonnegative(),
});

export type NotifierStats = z.infer<typeof notifierStatsSchema>;

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
