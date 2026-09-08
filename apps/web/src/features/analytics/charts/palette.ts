/**
 * Paleta categórica de los gráficos.
 *
 * Orden fijo: el color sigue a la categoría por su posición dentro de la serie,
 * que el servidor devuelve siempre en el mismo orden. Así, al aplicar un filtro
 * que deja fuera categorías, las que quedan conservan su color.
 *
 * Validada sobre fondo blanco: banda de luminosidad, piso de croma, separación
 * para daltonismo y piso de visión normal. Tres tonos quedan por debajo de 3:1
 * de contraste, lo que obliga a etiquetas visibles junto a cada barra y a la
 * vista de tabla, que este dashboard ya trae.
 */
export const CATEGORICAL_PALETTE = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
] as const;

/** Color de las series de un solo trazo, como la evolución mensual. */
export const SINGLE_SERIES_COLOR = "#2a78d6";

/** Gris para la categoría «Sin dato»: no compite con las categorías reales. */
export const NO_DATA_COLOR = "#9a9a94";

export function colorForIndex(index: number, key?: string): string {
  if (key === "sin_dato") return NO_DATA_COLOR;
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length] ?? SINGLE_SERIES_COLOR;
}
