import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  COMPOSITION_BUCKETS,
  REPORTING_AREA_LABELS,
  UY_REGIONS,
  UY_REGION_LABELS,
  type AnalyticsFilterOptions,
  type AnalyticsFilters,
} from "@canmedseg/shared";
import { useEffect, useState } from "react";

import { fetchFilterOptions } from "./analyticsApi";

import styles from "./analytics.module.css";

type FiltrosDashboardProps = {
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
};

type SelectFilterProps = {
  label: string;
  value: string | undefined;
  allLabel: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
};

function SelectFilter({ label, value, allLabel, options, onChange }: SelectFilterProps) {
  const current = value ?? "";
  const known = current === "" || options.some((option) => option.value === current);
  return (
    <label className={styles.filter}>
      <span className={styles.filterLabel}>{label}</span>
      <select
        className={styles.select}
        value={current}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {known ? null : <option value={current}>{current}</option>}
      </select>
    </label>
  );
}

const AGE_OPTIONS = AGE_GROUPS.map((value) => ({ value, label: AGE_GROUP_LABELS[value] }));
const REGION_OPTIONS = UY_REGIONS.map((value) => ({ value, label: UY_REGION_LABELS[value] }));
const COMPOSITION_OPTIONS = COMPOSITION_BUCKETS.map((bucket) => ({
  value: bucket.key,
  label: bucket.label,
}));
const REPORTING_AREA_OPTIONS = Object.entries(REPORTING_AREA_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const SERIOUS_OPTIONS = [
  { value: "true", label: "Solo graves" },
  { value: "false", label: "Solo no graves" },
];

const toOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

/**
 * Filtros globales del dashboard (RF-7.3): se eligen una vez y recalculan todos
 * los gráficos, la tabla y la exportación.
 */
export function FiltrosDashboard({ filters, onChange }: FiltrosDashboardProps) {
  const [options, setOptions] = useState<AnalyticsFilterOptions>({ products: [], meddraTerms: [] });

  useEffect(() => {
    let cancelled = false;
    fetchFilterOptions()
      .then((result) => {
        if (!cancelled) setOptions(result);
      })
      .catch((error: unknown) => console.error("No se pudieron cargar las opciones de filtro", error));
    return () => {
      cancelled = true;
    };
  }, []);

  function patch(partial: Partial<AnalyticsFilters>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className={styles.filterRow}>
      <SelectFilter
        label="Edad"
        value={filters.ageGroup}
        allLabel="Todas"
        options={AGE_OPTIONS}
        onChange={(value) => patch({ ageGroup: value as AnalyticsFilters["ageGroup"] })}
      />
      <SelectFilter
        label="Región"
        value={filters.region}
        allLabel="Todas"
        options={REGION_OPTIONS}
        onChange={(value) => patch({ region: value as AnalyticsFilters["region"] })}
      />
      <SelectFilter
        label="Gravedad"
        value={filters.serious === undefined ? undefined : String(filters.serious)}
        allLabel="Todas"
        options={SERIOUS_OPTIONS}
        onChange={(value) => patch({ serious: value === undefined ? undefined : value === "true" })}
      />
      <SelectFilter
        label="Producto"
        value={filters.product}
        allLabel="Todos"
        options={toOptions(options.products)}
        onChange={(value) => patch({ product: value })}
      />
      <SelectFilter
        label="Contenido de THC"
        value={filters.thc}
        allLabel="Todos"
        options={COMPOSITION_OPTIONS}
        onChange={(value) => patch({ thc: value as AnalyticsFilters["thc"] })}
      />
      <SelectFilter
        label="Contenido de CBD"
        value={filters.cbd}
        allLabel="Todos"
        options={COMPOSITION_OPTIONS}
        onChange={(value) => patch({ cbd: value as AnalyticsFilters["cbd"] })}
      />
      <SelectFilter
        label="Clasificación MedDRA"
        value={filters.meddra}
        allLabel="Todas"
        options={toOptions(options.meddraTerms)}
        onChange={(value) => patch({ meddra: value })}
      />
      <SelectFilter
        label="Área reportante"
        value={filters.reportingArea}
        allLabel="Todas"
        options={REPORTING_AREA_OPTIONS}
        onChange={(value) => patch({ reportingArea: value })}
      />

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
