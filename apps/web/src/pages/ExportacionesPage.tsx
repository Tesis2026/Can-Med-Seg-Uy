import {
  Permission,
  analyticsFiltersSchema,
  hasPermission,
  type AnalyticsFilters,
  type ExportFormat,
  type ExportPreview,
} from "@canmedseg/shared";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { exportUrl, fetchExportPreview, filtersToParams } from "../features/analytics/analyticsApi";
import { useSession } from "../features/auth/SessionContext";

import styles from "../features/analytics/analytics.module.css";

const numberFormat = new Intl.NumberFormat("es-UY");

function filtersFromParams(params: URLSearchParams): AnalyticsFilters {
  const statuses = params.get("statuses");
  const serious = params.get("serious");
  return analyticsFiltersSchema.parse({
    dateField: params.get("dateField") === "evento" ? "evento" : "notificacion",
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    statuses: statuses ? statuses.split(",").filter(Boolean) : undefined,
    profession: params.get("profession") ?? undefined,
    administrationRoute: params.get("administrationRoute") ?? undefined,
    serious: serious === null ? undefined : serious === "true",
  });
}

/** Frame «Exportaciones» del diseño (RF-8.1, RF-8.2). */
export function ExportacionesPage() {
  const { session, loading: sessionLoading } = useSession();
  const [searchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);

  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authenticated = session.authenticated;
  const puedeExportar = hasPermission(session.permissions, Permission.ExportRead);

  useEffect(() => {
    if (!authenticated || !puedeExportar) return;
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const result = await fetchExportPreview(filters);
        if (!cancelled) setPreview(result);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "No se pudo calcular la exportación.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, puedeExportar, filters]);

  if (sessionLoading) return <p className={styles.state}>Cargando…</p>;
  if (!authenticated) return <Navigate to="/login?returnTo=%2Fexportaciones" replace />;
  if (!puedeExportar) return <Navigate to="/" replace />;

  const total = preview?.total ?? 0;

  return (
    <div className={styles.page}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Exportaciones</h1>
        <p className={styles.subtitle}>
          Exporte los reportes filtrados. La cédula se reemplaza por un identificador
          único por persona.
        </p>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.exportCard}>
        <h2 className={styles.sectionTitle}>Filtros aplicados</h2>
        <p className={styles.exportFilters}>
          {preview?.filtersSummary ?? "Calculando…"}
        </p>
        <Link className={styles.secondaryLink} to={`/dashboard?${filtersToParams(filters).toString()}`}>
          Cambiar los filtros en el dashboard
        </Link>

        <h2 className={styles.sectionTitle}>Formato de exportación</h2>
        <div className={styles.formatRow} role="radiogroup" aria-label="Formato">
          {(["xlsx", "csv"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={format === option}
              className={`${styles.formatOption} ${format === option ? styles.formatActive : ""}`}
              onClick={() => setFormat(option)}
            >
              {option === "xlsx" ? "Excel (.xlsx)" : "CSV"}
            </button>
          ))}
        </div>

        <p className={styles.exportCount}>
          {numberFormat.format(total)}{" "}
          {total === 1 ? "registro listo para exportar" : "registros listos para exportar"}, con
          todos los campos incluidos.
        </p>
        <p className={styles.exportNote}>
          El archivo no contiene cédula, nombre, apellido, correo ni teléfono. Los reportes
          de una misma persona comparten el mismo identificador, lo que permite agruparlos
          sin exponer su identidad.
        </p>
        {format === "xlsx" ? (
          <p className={styles.exportNote}>
            El archivo trae una portada con los filtros aplicados y una hoja por cada
            módulo: reportes, eventos adversos, medicamentos y tratamientos concomitantes.
          </p>
        ) : null}

        <a
          className={total > 0 ? styles.primaryButton : styles.primaryButtonDisabled}
          href={total > 0 ? exportUrl(filters, format) : undefined}
          aria-disabled={total === 0}
        >
          Descargar archivo
        </a>
      </section>
    </div>
  );
}
