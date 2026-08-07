/** Opciones de listas desplegables del wizard (español). */

export const SEX_OPTIONS = [
  { value: "femenino", label: "Femenino" },
  { value: "masculino", label: "Masculino" },
  { value: "otro", label: "Otro" },
  { value: "prefiere_no_responder", label: "Prefiere no responder" },
] as const;

export const COUNTRY_OPTIONS = [
  "Uruguay",
  "Argentina",
  "Brasil",
  "Chile",
  "Paraguay",
  "Bolivia",
  "Perú",
  "Colombia",
  "España",
  "Otro",
] as const;

export const EVENT_OUTCOME_OPTIONS = [
  { value: "recuperada_resuelta", label: "Recuperada / Resuelta" },
  { value: "en_recuperacion", label: "En recuperación / En resolución" },
  { value: "no_recuperada", label: "No recuperada / No resuelta" },
  { value: "recuperada_con_secuelas", label: "Recuperada con secuelas" },
  { value: "mortal", label: "Mortal" },
  { value: "desconocido", label: "Desconocido" },
] as const;

export const SERIOUSNESS_OPTIONS = [
  { value: "amenaza_vida", label: "Amenaza de la vida" },
  { value: "muerte", label: "Causó muerte" },
  {
    value: "hospitalizacion",
    label: "Causó/prolongó hospitalización",
  },
  { value: "discapacidad", label: "Causó discapacidad" },
  {
    value: "malformacion_congenita",
    label: "Causó malformación congénita",
  },
  {
    value: "otra_condicion_medica",
    label: "Causó otra condición médica importante",
  },
] as const;

export const SEVERITY_GRADE_OPTIONS = [
  { value: "leve", label: "Leve" },
  { value: "moderado", label: "Moderado" },
  { value: "grave", label: "Grave" },
] as const;

export const CAUSALITY_OPTIONS = [
  { value: "cierta", label: "Cierta" },
  { value: "probable", label: "Probable" },
  { value: "posible", label: "Posible" },
  { value: "improbable", label: "Improbable" },
  { value: "condicional", label: "Condicional / No clasificada" },
  { value: "no_clasificable", label: "No clasificable" },
  { value: "no_evaluable", label: "No evaluable / No evaluada" },
] as const;

/** Términos MedDRA de ejemplo (demo). */
export const MEDDRA_DEMO_OPTIONS = [
  "Cefalea",
  "Náuseas",
  "Vómitos",
  "Somnolencia",
  "Mareo",
  "Ansiedad",
  "Insomnio",
  "Diarrea",
  "Sequedad de boca",
  "Taquicardia",
  "Erupción cutánea",
  "Confusión",
] as const;

export const ACCESS_FORM_OPTIONS = [
  { value: "farmacia_comunitaria", label: "Farmacia comunitaria" },
  { value: "farmacia_institucional", label: "Farmacia institucional" },
  { value: "uso_compasivo", label: "Acceso por uso compasivo" },
  { value: "otra", label: "Otra forma de acceso" },
] as const;

export const PRESENTATION_OPTIONS = [
  { value: "solucion_oral", label: "Solución oral" },
  { value: "aceite", label: "Aceite" },
  { value: "sustancia_vegetal", label: "Sustancia vegetal" },
] as const;

export const ROUTE_OPTIONS = [
  { value: "oral", label: "Oral" },
  { value: "sublingual", label: "Sublingual" },
  { value: "topico", label: "Tópico / Cutáneo" },
  { value: "respiratoria", label: "Respiratoria (inhalación)" },
  { value: "fumada", label: "Fumada" },
  { value: "otra", label: "Otra" },
  { value: "desconocida", label: "Desconocida" },
] as const;

export const INDICATION_OPTIONS = [
  { value: "epilepsia_refractaria", label: "Epilepsia refractaria" },
  { value: "dolor_oncologico", label: "Dolor oncológico" },
  { value: "dolor_neuropatico", label: "Dolor no oncológico neuropático" },
  {
    value: "dolor_musculo_esqueletico",
    label: "Dolor no oncológico músculo-esquelético",
  },
  { value: "nauseas_vomitos", label: "Náuseas y/o vómitos" },
  { value: "espasticidad", label: "Espasticidad" },
  {
    value: "estres_postraumatico",
    label: "Síndrome de estrés postraumático",
  },
  { value: "ansiedad_depresion", label: "Ansiedad y/o Depresión" },
  { value: "anorexia_caquexia", label: "Anorexia y/o Caquexia" },
] as const;

export const ACTION_TAKEN_OPTIONS = [
  { value: "retirado", label: "Medicamento retirado" },
  { value: "dosis_reducida", label: "Dosis reducida" },
  { value: "dosis_aumentada", label: "Dosis aumentada" },
  { value: "dosis_no_modificada", label: "Dosis no modificada" },
  { value: "cambio_producto", label: "Cambio de producto" },
  { value: "desconocida", label: "Desconocida" },
  { value: "no_aplica", label: "No aplica" },
] as const;

export const PROFESSION_OPTIONS = [
  { value: "medico", label: "Médico" },
  { value: "farmaceutico", label: "Farmacéutico" },
  {
    value: "otro_profesional_salud",
    label:
      "Otro profesional de la Salud (enfermería, licenciados de enfermería, obstetras-parteras, odontólogos)",
  },
  { value: "paciente", label: "Paciente" },
  {
    value: "asociacion_cannabis",
    label: "Miembro de asociación de usuarios de cannabis terapéutico",
  },
  { value: "otro_no_sanitario", label: "Otro profesional no sanitario" },
] as const;

/** Códigos CIE-10 de ejemplo (demo). */
export const CIE10_DEMO_OPTIONS = [
  "G40 — Epilepsia",
  "G35 — Esclerosis múltiple",
  "C50 — Tumor maligno de mama",
  "M79.2 — Neuralgia y neuritis",
  "F41 — Otros trastornos de ansiedad",
  "F32 — Episodio depresivo",
  "R11 — Náuseas y vómitos",
  "G80 — Parálisis cerebral",
  "M54 — Dorsalgia",
  "E66 — Obesidad",
] as const;

export const STEP_TITLES = [
  "Datos del/la paciente",
  "Descripción del o de los eventos adversos",
  "Medicamento implicado",
  "Información adicional",
  "Información de contacto",
] as const;

export const DRAFT_STORAGE_KEY = "canmedseg_reporte_draft";
