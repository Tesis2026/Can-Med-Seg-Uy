/**
 * Etiquetas de UI de los campos del formulario, en una única fuente.
 *
 * Las usan el dashboard, la exportación y el detalle del reporte; el asistente
 * arma sus desplegables a partir de estos mismos diccionarios.
 */

export const SEX_LABELS: Record<string, string> = {
  "femenino": "Femenino",
  "masculino": "Masculino",
  "otro": "Otro",
  "prefiere_no_responder": "Prefiere no responder",
};

export const EVENT_OUTCOME_LABELS: Record<string, string> = {
  "recuperada_resuelta": "Recuperada/ Resuelta",
  "en_recuperacion": "En recuperación/En resolución",
  "no_recuperada": "No recuperada/No resuelta",
  "recuperada_con_secuelas": "Recuperada con secuelas",
  "mortal": "Mortal",
  "desconocido": "Desconocido",
};

export const SERIOUSNESS_LABELS: Record<string, string> = {
  "muerte": "Causó muerte",
  "amenaza_vida": "Amenaza de la vida",
  "discapacidad": "Causó discapacidad",
  "hospitalizacion": "Causó/prolongó hospitalización",
  "malformacion_congenita": "Causó malformación congénita",
  "otra_condicion_medica": "Causó otra condición médica importante",
};

export const SEVERITY_GRADE_LABELS: Record<string, string> = {
  "leve": "Leve",
  "moderado": "Moderado",
  "severo": "Severo",
};

export const CAUSALITY_LABELS: Record<string, string> = {
  "cierta": "Cierta",
  "probable": "Probable",
  "posible": "Posible",
  "improbable": "Improbable",
  "condicional": "Condicional",
  "no_evaluable": "No evaluable",
};

export const ACCESS_FORM_LABELS: Record<string, string> = {
  "farmacia_comunitaria": "Farmacia comunitaria",
  "farmacia_institucional": "Farmacia institucional",
  "uso_compasivo": "Acceso por uso compasivo",
  "otra": "Otra forma de acceso",
};

export const PRESENTATION_LABELS: Record<string, string> = {
  "solucion_oral": "Solución oral",
  "aceite": "Aceite",
  "sustancia_vegetal": "Sustancia vegetal",
  "uso_topico": "Uso tópico",
};

export const ADMINISTRATION_ROUTE_LABELS: Record<string, string> = {
  "topico": "Tópico/ Cutáneo",
  "oral": "Oral",
  "respiratoria": "Respiratoria (inhalación)",
  "desconocido": "Desconocido",
  "intramuscular": "Intramuscular (inyección en el músculo)",
  "intravenosa": "Intravenosa (no especificada)",
  "nasal": "Nasal",
  "oftalmica": "Oftálmica",
  "otros": "Otros",
  "rectal": "Rectal",
  "subcutanea": "Subcutánea (inyección bajo la piel)",
  "vaginal": "Vaginal",
};

export const INDICATION_LABELS: Record<string, string> = {
  "epilepsia_refractaria": "Epilepsia refractaria",
  "dolor_oncologico": "Dolor oncológico",
  "dolor_neuropatico": "Dolor no oncológico: Neuropático",
  "dolor_musculo_esqueletico": "Dolor no oncológico: Músculo-esquelético",
  "nauseas_vomitos": "Náuseas y/o vómitos",
  "espasticidad": "Espasticidad",
  "estres_postraumatico": "Síndrome de estrés postraumático",
  "ansiedad_depresion": "Ansiedad y/o Depresión",
  "anorexia_caquexia": "Anorexia y/o Caquexia",
};

export const ACTION_TAKEN_LABELS: Record<string, string> = {
  "retirado": "Medicamento retirado",
  "dosis_reducida": "Dosis reducida",
  "dosis_aumentada": "Dosis aumentada",
  "dosis_no_modificada": "Dosis no modificada",
  "cambio_producto": "Cambio de producto (marca, dosis y/o composición)",
  "desconocida": "Desconocida",
  "no_aplica": "No aplica",
};

export const PROFESSION_LABELS: Record<string, string> = {
  "medico": "Médico",
  "farmaceutico": "Farmacéutico",
  "otro_profesional_salud": "Otro profesional de la Salud",
  "paciente": "Paciente / Usuario",
  "asociacion_cannabis": "Miembro de asociación de usuarios de cannabis terapéutico",
  "otro_no_sanitario": "Otro profesional no sanitario",
};

export const REPORTING_AREA_LABELS: Record<string, string> = {
  "salud_publica": "Institución de salud pública",
  "salud_privada": "Institución de salud privada",
  "farmacia": "Farmacia",
  "organizacion": "Asociación u organización",
  "otro": "Otro",
};

/** Devuelve la etiqueta del valor, o el valor crudo si no está en el diccionario. */
export function labelFor(dictionary: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "";
  return dictionary[value] ?? value;
}
