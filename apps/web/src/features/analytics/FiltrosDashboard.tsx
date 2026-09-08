import {
  ADMINISTRATION_ROUTE_LABELS,
  PROFESSION_LABELS,
  REPORT_STATUS_LABELS,
  ReportStatus,
  type AnalyticsFilters,
  type SubmittedReportStatus,
} from "@canmedseg/shared";

import styles from "./analytics.module.css";

type FiltrosDashboardProps = {
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
};

/** Estados que puede elegir el investigador dentro del conjunto aprobado. */
const ESTADOS: SubmittedReportStatus[] = [
  ReportStatus.AprobadoLocal,
  ReportStatus.EnviadoMsp,
];

/**
 * Filtros globales del dashboard (RF-7.3): se eligen una vez y recalculan todos
 * los gráficos, la tabla y la exportación.
 */
export function FiltrosDashboard({ filters, onChange }: FiltrosDashboardProps) {
  function patch(partial: Partial<AnalyticsFilters>) {
    onChange({ ...filters, ...partial });
  }

  const estadoActual =
    filters.statuses && filters.statuses.length === 1 ? filters.statuses[0] : "";

  return (
    <div className={styles.filterRow}>
      <label className={styles.filter}>
        <span className={styles.filterLabel}>Estado</span>
        <select
          className={styles.select}
          value={estadoActual}
          onChange={(event) =>
            patch({
              statuses: event.target.value
                ? [event.target.value as SubmittedReportStatus]
                : undefined,
            })
          }
        >
          <option value="">Todos los aprobados</option>
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {REPORT_STATUS_LABELS[estado]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.filter}>
        <span className={styles.filterLabel}>Gravedad</span>
        <select
          className={styles.select}
          value={filters.serious === undefined ? "" : String(filters.serious)}
          onChange={(event) =>
            patch({
              serious: event.target.value === "" ? undefined : event.target.value === "true",
            })
          }
        >
          <option value="">Todas</option>
          <option value="true">Solo graves</option>
          <option value="false">Solo no graves</option>
        </select>
      </label>

      <label className={styles.filter}>
        <span className={styles.filterLabel}>Tipo de notificador</span>
        <select
          className={styles.select}
          value={filters.profession ?? ""}
          onChange={(event) => patch({ profession: event.target.value || undefined })}
        >
          <option value="">Todos</option>
          {Object.entries(PROFESSION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.filter}>
        <span className={styles.filterLabel}>Vía de administración</span>
        <select
          className={styles.select}
          value={filters.administrationRoute ?? ""}
          onChange={(event) =>
            patch({ administrationRoute: event.target.value || undefined })
          }
        >
          <option value="">Todas</option>
          {Object.entries(ADMINISTRATION_ROUTE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.filter}>
        <span className={styles.filterLabel}>La fecha corresponde a</span>
        <select
          className={styles.select}
          value={filters.dateField}
          onChange={(event) =>
            patch({ dateField: event.target.value as AnalyticsFilters["dateField"] })
          }
        >
          <option value="notificacion">Fecha de notificación</option>
          <option value="evento">Fecha del evento</option>
        </select>
      </label>

      <label className={styles.filter}>
        <span className={styles.filterLabel}>Desde</span>
        <input
          type="date"
          className={styles.select}
          value={filters.from ?? ""}
          onChange={(event) => patch({ from: event.target.value || undefined })}
        />
      </label>

      <label className={styles.filter}>
        <span className={styles.filterLabel}>Hasta</span>
        <input
          type="date"
          className={styles.select}
          value={filters.to ?? ""}
          onChange={(event) => patch({ to: event.target.value || undefined })}
        />
      </label>

      <button
        type="button"
        className={styles.clearFilters}
        onClick={() => onChange({ dateField: "notificacion" })}
      >
        Limpiar filtros
      </button>
    </div>
  );
}
