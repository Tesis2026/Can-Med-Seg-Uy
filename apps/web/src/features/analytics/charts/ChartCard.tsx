import { AnalyticsChart, ANALYTICS_UNIT_LABELS, type AnalyticsSeries } from "@canmedseg/shared";
import { useId, useState } from "react";

import { BarChart } from "./BarChart";
import { DonutChart } from "./DonutChart";
import { SINGLE_SERIES_COLOR } from "./palette";

import styles from "./charts.module.css";

type ChartCardProps = {
  series: AnalyticsSeries;
};

const numberFormat = new Intl.NumberFormat("es-UY");

/** El anillo se reserva para repartos de pocas categorías. */
const DONUT_CHARTS = new Set<string>([AnalyticsChart.Sexo, AnalyticsChart.Gravedad]);

/** Series de un solo trazo: el color no distingue categorías. */
const SINGLE_SERIES = new Set<string>([AnalyticsChart.SerieTemporal]);

/**
 * Tarjeta de un gráfico, con alternancia entre la vista visual y la tabla de
 * datos. La tabla es también lo que hace legible el gráfico para quien no
 * distingue los colores.
 */
export function ChartCard({ series }: ChartCardProps) {
  const [view, setView] = useState<"grafico" | "tabla">("grafico");
  const panelId = useId();

  const unitLabel = ANALYTICS_UNIT_LABELS[series.unit];
  const hasData = series.total > 0;

  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>{series.label}</h3>

      <div className={styles.tabs} role="tablist" aria-label={series.label}>
        <button
          type="button"
          role="tab"
          aria-selected={view === "grafico"}
          aria-controls={panelId}
          className={`${styles.tab} ${view === "grafico" ? styles.tabActive : ""}`}
          onClick={() => setView("grafico")}
        >
          Gráfico
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "tabla"}
          aria-controls={panelId}
          className={`${styles.tab} ${view === "tabla" ? styles.tabActive : ""}`}
          onClick={() => setView("tabla")}
        >
          Tabla
        </button>
      </div>

      <p className={styles.cardMeta}>
        {numberFormat.format(series.total)} {unitLabel}
        {series.excluded > 0
          ? ` · ${numberFormat.format(series.excluded)} sin graficar por estar cargados en mililitros`
          : ""}
      </p>

      <div id={panelId} role="tabpanel" className={styles.panel}>
        {!hasData ? (
          <p className={styles.emptyPlot}>Sin datos para graficar.</p>
        ) : view === "tabla" ? (
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th scope="col">Categoría</th>
                <th scope="col" className={styles.numeric}>
                  {unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)}
                </th>
                <th scope="col" className={styles.numeric}>
                  Porcentaje
                </th>
              </tr>
            </thead>
            <tbody>
              {series.slices.map((slice) => (
                <tr key={slice.key}>
                  <td>{slice.label}</td>
                  <td className={styles.numeric}>{numberFormat.format(slice.value)}</td>
                  <td className={styles.numeric}>{slice.percentage} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : DONUT_CHARTS.has(series.chart) ? (
          <DonutChart slices={series.slices} unitLabel={unitLabel} />
        ) : (
          <BarChart
            slices={series.slices}
            unitLabel={unitLabel}
            singleColor={SINGLE_SERIES.has(series.chart) ? SINGLE_SERIES_COLOR : undefined}
          />
        )}
      </div>
    </section>
  );
}
