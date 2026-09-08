import {
  Permission,
  REPORT_STATUS_LABELS,
  ReportStatus,
  analyticsFiltersSchema,
  hasPermission,
  type AnalyticsDashboard,
  type AnalyticsFilters,
  type ReportTablePage,
  type ReportTableQuery,
  type ReportTableSort,
  type SubmittedReportStatus,
} from "@canmedseg/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";
import { fetchDashboard, fetchReportTable, filtersToParams } from "../features/analytics/analyticsApi";
import { ChartCard } from "../features/analytics/charts/ChartCard";
import { FiltrosDashboard } from "../features/analytics/FiltrosDashboard";

import styles from "../features/analytics/analytics.module.css";

const numberFormat = new Intl.NumberFormat("es-UY");

const STATUS_CLASS: Record<SubmittedReportStatus, string> = {
  [ReportStatus.EnRevision]: styles.statusEnRevision,
  [ReportStatus.AprobadoLocal]: styles.statusAprobado,
  [ReportStatus.AprobadoMsp]: styles.statusAprobado,
  [ReportStatus.EnviadoMsp]: styles.statusAprobado,
  [ReportStatus.Rechazado]: styles.statusRechazado,
};

const COLUMNS: { key: ReportTableSort; label: string }[] = [
  { key: "patient", label: "Paciente" },
  { key: "submittedAt", label: "Notificado" },
  { key: "status", label: "Estado" },
  { key: "serious", label: "Gravedad" },
  { key: "profession", label: "Notificador" },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Lee los filtros de la URL, para que una vista filtrada se pueda compartir. */
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

/** Frame «Dashboard principal» del diseño (RF-7). */
export function DashboardPage() {
  const { session, loading: sessionLoading } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);

  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [table, setTable] = useState<ReportTablePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [sort, setSort] = useState<ReportTableSort>("submittedAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const authenticated = session.authenticated;
  const puedeVer = hasPermission(session.permissions, Permission.DashboardRead);

  const applyFilters = useCallback(
    (next: AnalyticsFilters) => {
      setPage(1);
      setSearchParams(filtersToParams(next), { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!authenticated || !puedeVer) return;
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const result = await fetchDashboard(filters);
        if (!cancelled) setDashboard(result);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "No se pudo cargar el dashboard.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, puedeVer, filters]);

  useEffect(() => {
    if (!authenticated || !puedeVer) return;
    let cancelled = false;
    const query: ReportTableQuery = {
      ...filters,
      search: search.trim() || undefined,
      sort,
      direction,
      page,
      pageSize: 10,
    };
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await fetchReportTable(query);
          if (!cancelled) setTable(result);
        } catch {
          if (!cancelled) setTable(null);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authenticated, puedeVer, filters, search, sort, direction, page]);

  if (sessionLoading) return <p className={styles.state}>Cargando…</p>;
  if (!authenticated) return <Navigate to="/login?returnTo=%2Fdashboard" replace />;
  if (!puedeVer) return <Navigate to="/" replace />;

  function toggleSort(column: ReportTableSort) {
    if (sort === column) {
      setDirection((previous) => (previous === "asc" ? "desc" : "asc"));
    } else {
      setSort(column);
      setDirection("desc");
    }
    setPage(1);
  }

  const totalPages = table ? Math.max(1, Math.ceil(table.total / table.pageSize)) : 1;

  return (
    <div className={styles.page}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Dashboard analítico</h1>
        <p className={styles.subtitle}>
          Métricas agregadas sobre reportes aprobados. Los filtros aplican a todos los
          gráficos, a la tabla y a la exportación.
        </p>
      </div>

      <FiltrosDashboard filters={filters} onChange={applyFilters} />

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {dashboard && dashboard.headline.totalReports === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Ningún reporte aprobado coincide con los filtros elegidos. Ajuste el período o
            quite alguna condición para ver resultados.
          </p>
        </div>
      ) : null}

      {dashboard && dashboard.headline.totalReports > 0 ? (
        <>
          <div className={styles.kpiRow}>
            <div className={styles.kpi}>
              <p className={styles.kpiValue}>
                {numberFormat.format(dashboard.headline.totalReports)}
              </p>
              <p className={styles.kpiLabel}>Reportes analizados</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiValue}>{dashboard.headline.seriousPercentage} %</p>
              <p className={styles.kpiLabel}>Eventos graves</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiValue}>{dashboard.headline.topRoutePercentage} %</p>
              <p className={styles.kpiLabel}>
                Vía más frecuente: {dashboard.headline.topRouteLabel}
              </p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiValueSmall}>{dashboard.headline.peakMonthLabel}</p>
              <p className={styles.kpiLabel}>Pico de notificaciones</p>
            </div>
          </div>

          <div className={styles.chartGrid}>
            {dashboard.series.map((series) => (
              <ChartCard key={series.chart} series={series} />
            ))}
          </div>
        </>
      ) : null}

      <section className={styles.tableSection}>
        <div className={styles.tableHead}>
          <h2 className={styles.sectionTitle}>Reportes incluidos</h2>
          <Link className={styles.secondaryLink} to={`/exportaciones?${filtersToParams(filters).toString()}`}>
            Exportar estos reportes
          </Link>
        </div>

        <input
          className={styles.search}
          type="search"
          value={search}
          aria-label="Buscar en los reportes"
          placeholder="Buscar por paciente, evento o medicamento…"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />

        {table && table.rows.length > 0 ? (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.reportTable}>
                <thead>
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column.key} scope="col">
                        <button
                          type="button"
                          className={styles.sortButton}
                          onClick={() => toggleSort(column.key)}
                          aria-sort={
                            sort === column.key
                              ? direction === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          {column.label}
                          <span aria-hidden="true" className={styles.sortArrow}>
                            {sort === column.key ? (direction === "asc" ? "▲" : "▼") : ""}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th scope="col">Resumen</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.patientLabel}</td>
                      <td>{formatDate(row.submittedAt)}</td>
                      <td>
                        <span className={`${styles.status} ${STATUS_CLASS[row.status]}`}>
                          {REPORT_STATUS_LABELS[row.status]}
                        </span>
                      </td>
                      <td>
                        {row.serious ? (
                          <span className={styles.serious}>Grave</span>
                        ) : (
                          <span className={styles.notSerious}>No grave</span>
                        )}
                      </td>
                      <td>{row.professionLabel}</td>
                      <td className={styles.summaryCell}>
                        {row.eventSummary}
                        {row.medicineSummary ? ` · ${row.medicineSummary}` : ""}
                      </td>
                      <td>
                        <Link className={styles.rowLink} to={`/revision/${row.id}`}>
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>
                {numberFormat.format(table.total)} reportes · página {table.page} de{" "}
                {totalPages}
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={styles.pageButton}
                  disabled={table.page <= 1}
                  onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className={styles.pageButton}
                  disabled={table.page >= totalPages}
                  onClick={() => setPage((previous) => previous + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className={styles.state}>
            {table ? "Ningún reporte coincide con la búsqueda." : "Cargando reportes…"}
          </p>
        )}
      </section>
    </div>
  );
}
