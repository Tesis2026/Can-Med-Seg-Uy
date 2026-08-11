/** Opciones de listas desplegables — valores del diccionario de variables. */

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

/** 15.0 Estado actual del evento adverso. */
export const EVENT_OUTCOME_OPTIONS = [
  { value: "recuperada_resuelta", label: "Recuperada/ Resuelta" },
  { value: "en_recuperacion", label: "En recuperación/En resolución" },
  { value: "no_recuperada", label: "No recuperada/No resuelta" },
  { value: "recuperada_con_secuelas", label: "Recuperada con secuelas" },
  { value: "mortal", label: "Mortal" },
  { value: "desconocido", label: "Desconocido" },
] as const;

/** 17.0 Indicador de gravedad. */
export const SERIOUSNESS_OPTIONS = [
  { value: "muerte", label: "Causó muerte" },
  { value: "amenaza_vida", label: "Amenaza de la vida" },
  { value: "discapacidad", label: "Causó discapacidad" },
  {
    value: "hospitalizacion",
    label: "Causó/prolongó hospitalización",
  },
  {
    value: "malformacion_congenita",
    label: "Causó malformación congénita",
  },
  {
    value: "otra_condicion_medica",
    label: "Causó otra condición médica importante",
  },
] as const;

/** 18.0 Clasificación de gravedad (OMS). */
export const SEVERITY_GRADE_OPTIONS = [
  { value: "leve", label: "Leve" },
  { value: "moderado", label: "Moderado" },
  { value: "severo", label: "Severo" },
] as const;

/** 19.0 Relación causal (OMS-UMC). */
export const CAUSALITY_OPTIONS = [
  { value: "cierta", label: "Cierta" },
  { value: "probable", label: "Probable" },
  { value: "posible", label: "Posible" },
  { value: "improbable", label: "Improbable" },
  { value: "condicional", label: "Condicional" },
  { value: "no_evaluable", label: "No evaluable" },
] as const;

/** 11.0 Reacción/Síntoma — términos MedDRA de ejemplo (demo). */
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

/** 23.0 Forma de acceso. */
export const ACCESS_FORM_OPTIONS = [
  { value: "farmacia_comunitaria", label: "Farmacia comunitaria" },
  { value: "farmacia_institucional", label: "Farmacia institucional" },
  { value: "uso_compasivo", label: "Acceso por uso compasivo" },
  { value: "otra", label: "Otra forma de acceso" },
] as const;

/** 24.0 Tipo de presentación. */
export const PRESENTATION_OPTIONS = [
  { value: "solucion_oral", label: "Solución oral" },
  { value: "aceite", label: "Aceite" },
  { value: "sustancia_vegetal", label: "Sustancia vegetal" },
  { value: "uso_topico", label: "Uso tópico" },
] as const;

/** 33.0 Vía de administración (lista completa). */
export const ROUTE_OPTIONS = [
  { value: "topico", label: "Tópico/ Cutáneo" },
  { value: "oral", label: "Oral" },
  { value: "respiratoria", label: "Respiratoria (inhalación)" },
  {
    value: "sublingual",
    label: 'Sublingual (esta vía de administración debería enviarse al MSP a la categoría "Otros")',
  },
  { value: "desconocido", label: "Desconocido" },
  { value: "intramuscular", label: "Intramuscular (inyección en el músculo)" },
  { value: "intravenosa", label: "Intravenosa (no especificada)" },
  { value: "nasal", label: "Nasal" },
  { value: "oftalmica", label: "Oftálmica" },
  { value: "otros", label: "Otros" },
  { value: "rectal", label: "Rectal" },
  { value: "subcutanea", label: "Subcutánea (inyección bajo la piel)" },
  { value: "vaginal", label: "Vaginal" },
] as const;

/** 40.0 Indicación de la administración del medicamento (lista). */
export const INDICATION_OPTIONS = [
  { value: "epilepsia_refractaria", label: "Epilepsia refractaria" },
  { value: "dolor_oncologico", label: "Dolor oncológico" },
  {
    value: "dolor_neuropatico",
    label: "Dolor no oncológico: Neuropático",
  },
  {
    value: "dolor_musculo_esqueletico",
    label: "Dolor no oncológico: Músculo-esquelético",
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

/** 41.0 Acción tomada con el medicamento. */
export const ACTION_TAKEN_OPTIONS = [
  { value: "retirado", label: "Medicamento retirado" },
  { value: "dosis_reducida", label: "Dosis reducida" },
  { value: "dosis_aumentada", label: "Dosis aumentada" },
  { value: "dosis_no_modificada", label: "Dosis no modificada" },
  {
    value: "cambio_producto",
    label:
      "Cambio de producto (marca, dosis y/o composición) (NO SE ENVÍA AL MSP)",
  },
  { value: "desconocida", label: "Desconocida" },
  { value: "no_aplica", label: "No aplica" },
] as const;

/** 2.0 Profesión(*) — bloque contacto. */
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

export const YES_NO_OPTIONS = [
  { value: "si", label: "Si" },
  { value: "no", label: "No" },
] as const;

export const STEP_TITLES = [
  "Información general del paciente",
  "Descripción del o de los eventos adversos sucedido/s",
  "Medicamento implicado",
  "Información adicional",
  "Información de contacto",
] as const;

export const DRAFT_STORAGE_KEY = "canmedseg_reporte_draft";
