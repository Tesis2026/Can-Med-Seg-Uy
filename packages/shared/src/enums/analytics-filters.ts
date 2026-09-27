export const ADULT_AGE = 18;

export const AgeGroup = {
  Menores: "menores",
  Mayores: "mayores",
} as const;

export type AgeGroup = (typeof AgeGroup)[keyof typeof AgeGroup];

export const AGE_GROUPS = Object.values(AgeGroup);

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  [AgeGroup.Menores]: `Menores de ${ADULT_AGE}`,
  [AgeGroup.Mayores]: `${ADULT_AGE} años o más`,
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
