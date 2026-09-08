import { useId, useState } from "react";
import type { AnalyticsSlice } from "@canmedseg/shared";

import { colorForIndex } from "./palette";

import styles from "./charts.module.css";

type DonutChartProps = {
  slices: AnalyticsSlice[];
  unitLabel: string;
};

const SIZE = 260;
const RADIUS = 92;
const THICKNESS = 34;
const CENTER = SIZE / 2;

const numberFormat = new Intl.NumberFormat("es-UY");

function polar(angle: number, radius: number): { x: number; y: number } {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(radians), y: CENTER + radius * Math.sin(radians) };
}

function arcPath(start: number, end: number): string {
  const outerStart = polar(start, RADIUS);
  const outerEnd = polar(end, RADIUS);
  const innerEnd = polar(end, RADIUS - THICKNESS);
  const innerStart = polar(start, RADIUS - THICKNESS);
  const largeArc = end - start > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${RADIUS - THICKNESS} ${RADIUS - THICKNESS} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

/**
 * Anillo para repartos de pocas categorías. Cada porción lleva su etiqueta
 * afuera, de modo que la identidad nunca depende solo del color.
 */
export function DonutChart({ slices, unitLabel }: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const titleId = useId();

  const visible = slices.filter((slice) => slice.value > 0);
  const total = visible.reduce((sum, slice) => sum + slice.value, 0);

  if (total === 0) {
    return <p className={styles.emptyPlot}>Sin datos para graficar.</p>;
  }

  let angle = 0;
  const arcs = visible.map((slice, index) => {
    const sweep = (slice.value / total) * 360;
    // Separación mínima entre porciones, para que se lean como bloques distintos.
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const mid = start + sweep / 2;
    return { slice, start, end, mid, index };
  });

  return (
    <div className={styles.plotWrap}>
      <svg
        className={styles.donut}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          Gráfico de anillo con {visible.length} categorías, en {unitLabel}
        </title>
        {arcs.map(({ slice, start, end, index }) => (
          <path
            key={slice.key}
            d={arcPath(start, end)}
            fill={colorForIndex(index, slice.key)}
            stroke="#ffffff"
            strokeWidth={2}
            opacity={hovered === null || hovered === index ? 1 : 0.55}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        <text x={CENTER} y={CENTER - 6} className={styles.donutTotal} textAnchor="middle">
          {numberFormat.format(total)}
        </text>
        <text x={CENTER} y={CENTER + 14} className={styles.donutUnit} textAnchor="middle">
          {unitLabel}
        </text>
      </svg>

      <ul className={styles.legend}>
        {arcs.map(({ slice, index }) => (
          <li
            key={slice.key}
            className={styles.legendItem}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className={styles.legendSwatch}
              style={{ background: colorForIndex(index, slice.key) }}
              aria-hidden="true"
            />
            <span className={styles.legendLabel}>{slice.label}</span>
            <span className={styles.legendValue}>
              {numberFormat.format(slice.value)} ({slice.percentage} %)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
