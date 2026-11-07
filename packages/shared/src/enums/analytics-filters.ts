import { SIN_DATO } from "./analytics-chart";

/**
 * Tramos etarios (RF-7.8). Única fuente para el gráfico «Distribución por grupo
 * etario» y el filtro «Edad», así ambos muestran siempre las mismas opciones.
 * «Sin dato» agrupa los reportes sin edad o con una edad fuera de rango.
 */
export const AGE_BUCKETS = [
  { key: "0_2", label: "0 a 2 años", min: 0, max: 2 },
  { key: "3_6", label: "3 a 6 años", min: 3, max: 6 },
  { key: "7_11", label: "7 a 11 años", min: 7, max: 11 },
  { key: "12_17", label: "12 a 17 años", min: 12, max: 17 },
  { key: "18_44", label: "18 a 44 años", min: 18, max: 44 },
  { key: "45_mas", label: "45 años o más", min: 45, max: 200 },
] as const;

/** Misma clave que el resto de las categorías «Sin dato» de los gráficos. */
export const AGE_SIN_DATO = SIN_DATO;

export type AgeGroup = (typeof AGE_BUCKETS)[number]["key"] | typeof AGE_SIN_DATO;

export const AGE_GROUPS: readonly AgeGroup[] = [
  ...AGE_BUCKETS.map((bucket) => bucket.key),
  AGE_SIN_DATO,
];

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  ...(Object.fromEntries(AGE_BUCKETS.map((bucket) => [bucket.key, bucket.label])) as Record<
    (typeof AGE_BUCKETS)[number]["key"],
    string
  >),
  [AGE_SIN_DATO]: "Sin dato",
};

export const COMPOSITION_BUCKETS = [
  { key: "0_5", label: "0 a 5 %", min: 0, max: 5 },
  { key: "5_10", label: "5 a 10 %", min: 5, max: 10 },
  { key: "10_20", label: "10 a 20 %", min: 10, max: 20 },
  { key: "20_50", label: "20 a 50 %", min: 20, max: 50 },
  { key: "50_100", label: "50 a 100 %", min: 50, max: 100 },
] as const;

export type CompositionBucket = (typeof COMPOSITION_BUCKETS)[number]["key"];

export const COMPOSITION_BUCKET_KEYS = COMPOSITION_BUCKETS.map((bucket) => bucket.key);

export function compositionBucketLabel(key: string): string {
  return COMPOSITION_BUCKETS.find((bucket) => bucket.key === key)?.label ?? key;
}
