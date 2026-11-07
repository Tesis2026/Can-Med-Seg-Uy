import { useState } from "react";
import type { AnalyticsSlice } from "@canmedseg/shared";

import { colorForIndex } from "./palette";

import styles from "./charts.module.css";

type BarChartProps = {
  slices: AnalyticsSlice[];
  /** Una sola serie usa un color único; las distribuciones, la paleta. */
  singleColor?: string;
  unitLabel: string;
};

const TICK_COUNT = 4;

const numberFormat = new Intl.NumberFormat("es-UY");

/**
 * Escala redondeada hacia arriba a un múltiplo de la cantidad de divisiones,
 * para que todas las marcas del eje caigan en números enteros.
 */
function niceMax(value: number): number {
  if (value <= 0) return TICK_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.ceil((step * magnitude) / TICK_COUNT) * TICK_COUNT;
}

/**
 * Barras horizontales con la categoría a la izquierda y el eje de magnitud
 * abajo. Está armado con elementos de la página, no con un dibujo escalado, para
 * que el texto conserve su tamaño en pantallas chicas. El valor va escrito al
 * final de cada barra, así la lectura nunca depende del color.
 */
export function BarChart({ slices, singleColor, unitLabel }: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = niceMax(Math.max(...slices.map((slice) => slice.value), 0));
  const ticks = Array.from(
    { length: TICK_COUNT + 1 },
    (_, index) => (max / TICK_COUNT) * index,
  );

  return (
    <div className={styles.plotWrap}>
      <div className={styles.bars}>
        {/* Filas explícitas: la grilla de fondo se superpone a todas las barras
            sin ocupar celdas de la autocolocación. */}
        <div
          className={styles.grid}
          aria-hidden="true"
          style={{ gridRow: `1 / ${slices.length + 1}` }}
        >
          {ticks.map((tick) => (
            <span key={tick} className={styles.gridLine} />
          ))}
        </div>

        {slices.map((slice, index) => {
          const color = singleColor ?? colorForIndex(index, slice.key);
          const width = max > 0 ? (slice.value / max) * 100 : 0;
          const dimmed = hovered !== null && hovered !== index;
          const row = { gridRow: index + 1 };

          return (
            <div
              key={slice.key}
              className={styles.barRow}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className={styles.barLabel} style={row} title={slice.label}>
                {slice.label}
              </span>
              <span className={styles.barTrack} style={row}>
                <span
                  className={styles.barFill}
                  style={{
                    width: `${Math.max(width, slice.value > 0 ? 0.6 : 0)}%`,
                    background: color,
                    opacity: dimmed ? 0.55 : 1,
                  }}
                />
              </span>
              <span className={styles.barValue} style={row}>{numberFormat.format(slice.value)}</span>
            </div>
          );
        })}

        <div
          className={styles.axisRow}
          aria-hidden="true"
          style={{ gridRow: slices.length + 1 }}
        >
          {ticks.map((tick) => (
            <span key={tick} className={styles.axisTick}>
              {numberFormat.format(Math.round(tick))}
            </span>
          ))}
        </div>
      </div>

      <p className={styles.hint} role="status">
        {hovered !== null && slices[hovered] ? (
          <>
            <span
              className={styles.hintSwatch}
              style={{
                background: singleColor ?? colorForIndex(hovered, slices[hovered].key),
              }}
            />
            {slices[hovered].label}: {numberFormat.format(slices[hovered].value)}{" "}
            {unitLabel} ({slices[hovered].percentage} %)
          </>
        ) : null}
      </p>
    </div>
  );
}
