/**
 * Catálogo de gráficos del dashboard (RF-7.2).
 *
 * Los identificadores son estables: se guardan en las preferencias de reportes
 * periódicos de cada investigador (RF-8.4), así que renombrarlos invalidaría
 * configuraciones ya guardadas.
 */
export const AnalyticsChart = {
  GrupoEtario: "grupo_etario",
  Sexo: "sexo",
  Gravedad: "gravedad",
  SerieTemporal: "serie_temporal",
  Region: "region",
  ViaAdministracion: "via_administracion",
  TipoNotificador: "tipo_notificador",
  TipoPresentacion: "tipo_presentacion",
  Thc: "thc",
  Cbd: "cbd",
  Otros: "otros",
} as const;

export type AnalyticsChart = (typeof AnalyticsChart)[keyof typeof AnalyticsChart];

export const ANALYTICS_CHARTS = Object.values(AnalyticsChart);

export const ANALYTICS_CHART_LABELS: Record<AnalyticsChart, string> = {
  [AnalyticsChart.GrupoEtario]: "Distribución por grupo etario",
  [AnalyticsChart.Sexo]: "Distribución por sexo",
  [AnalyticsChart.Gravedad]: "Distribución por gravedad",
  [AnalyticsChart.SerieTemporal]: "Notificaciones por mes",
  [AnalyticsChart.Region]: "Distribución por región",
  [AnalyticsChart.ViaAdministracion]: "Distribución por vía de administración",
  [AnalyticsChart.TipoNotificador]: "Distribución por tipo de notificador",
  [AnalyticsChart.TipoPresentacion]: "Distribución por tipo de presentación",
  [AnalyticsChart.Thc]: "Composición declarada de THC",
  [AnalyticsChart.Cbd]: "Composición declarada de CBD",
  [AnalyticsChart.Otros]: "Composición declarada de Otros",
};

/**
 * Unidad de conteo de cada gráfico (RF-7.6). Se muestra junto al total para que
 * quede claro que los porcentajes de medicamentos no suman sobre reportes.
 */
export const AnalyticsUnit = {
  Reportes: "reportes",
  Eventos: "eventos",
  Medicamentos: "medicamentos",
} as const;

export type AnalyticsUnit = (typeof AnalyticsUnit)[keyof typeof AnalyticsUnit];

export const ANALYTICS_UNIT_LABELS: Record<AnalyticsUnit, string> = {
  [AnalyticsUnit.Reportes]: "reportes",
  [AnalyticsUnit.Eventos]: "eventos adversos",
  [AnalyticsUnit.Medicamentos]: "medicamentos",
};

export const ANALYTICS_CHART_UNITS: Record<AnalyticsChart, AnalyticsUnit> = {
  [AnalyticsChart.GrupoEtario]: AnalyticsUnit.Reportes,
  [AnalyticsChart.Sexo]: AnalyticsUnit.Reportes,
  [AnalyticsChart.SerieTemporal]: AnalyticsUnit.Reportes,
  [AnalyticsChart.Region]: AnalyticsUnit.Reportes,
  [AnalyticsChart.TipoNotificador]: AnalyticsUnit.Reportes,
  [AnalyticsChart.Gravedad]: AnalyticsUnit.Eventos,
  [AnalyticsChart.ViaAdministracion]: AnalyticsUnit.Medicamentos,
  [AnalyticsChart.TipoPresentacion]: AnalyticsUnit.Medicamentos,
  [AnalyticsChart.Thc]: AnalyticsUnit.Medicamentos,
  [AnalyticsChart.Cbd]: AnalyticsUnit.Medicamentos,
  [AnalyticsChart.Otros]: AnalyticsUnit.Medicamentos,
};

/** Categoría para los valores no informados (RF-7.11). */
export const SIN_DATO = "sin_dato";

export const SIN_DATO_LABEL = "Sin dato";

/** Frecuencias de los reportes periódicos (RF-8.3). */
export const PeriodicFrequency = {
  Mensual: "mensual",
  Trimestral: "trimestral",
  Semestral: "semestral",
} as const;

export type PeriodicFrequency =
  (typeof PeriodicFrequency)[keyof typeof PeriodicFrequency];

export const PERIODIC_FREQUENCIES = Object.values(PeriodicFrequency);

export const PERIODIC_FREQUENCY_LABELS: Record<PeriodicFrequency, string> = {
  [PeriodicFrequency.Mensual]: "Mensual",
  [PeriodicFrequency.Trimestral]: "Trimestral",
  [PeriodicFrequency.Semestral]: "Semestral",
};

/** Meses que cubre cada frecuencia; lo usa el planificador de envíos. */
export const PERIODIC_FREQUENCY_MONTHS: Record<PeriodicFrequency, number> = {
  [PeriodicFrequency.Mensual]: 1,
  [PeriodicFrequency.Trimestral]: 3,
  [PeriodicFrequency.Semestral]: 6,
};
