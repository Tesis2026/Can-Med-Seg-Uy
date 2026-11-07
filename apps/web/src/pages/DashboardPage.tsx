import {
  Permission,
  hasPermission,
  type AnalyticsDashboard,
  type AnalyticsFilters,
  type ReportTablePage,
  type ReportTableQuery,
  type ReportTableSort,
} from "@canmedseg/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";
import { fetchDashboard, fetchReportTable, filtersFromParams, filtersToParams } from "../features/analytics/analyticsApi";
import { ChartCard } from "../features/analytics/charts/ChartCard";
import { FiltrosDashboard } from "../features/analytics/FiltrosDashboard";
import { LoadingOverlay } from "../features/analytics/LoadingOverlay";

import styles from "../features/analytics/analytics.module.css";

const numberFormat = new Intl.NumberFormat("es-UY");

const COLUMNS: { key: ReportTableSort; label: string }[] = [
  { key: "patient", label: "Paciente" },
  { key: "submittedAt", label: "Notificado" },
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

/** Frame «Dashboard principal» del diseño (RF-7). */
export function DashboardPage() {
  const { session, loading: sessionLoading } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);

  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [table, setTable] = useState<ReportTablePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const dashboardReturnTo = useMemo(() => {
    const params = filtersToParams(filters);
    if (search.trim()) params.set("search", search.trim());
    return `/dashboard?${params.toString()}`;
  }, [filters, search]);
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
    setLoadingDashboard(true);
    void (async () => {
      try {
        const result = await fetchDashboard(filters);
        if (!cancelled) setDashboard(result);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "No se pudo cargar el dashboard.");
        }
      } finally {
        if (!cancelled) setLoadingDashboard(false);
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
    setLoadingTable(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await fetchReportTable(query);
          if (!cancelled) setTable(result);
        } catch {
          if (!cancelled) setTable(null);
        } finally {
          if (!cancelled) setLoadingTable(false);
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

      <div
        className={`${styles.loadingHost} ${dashboard ? "" : styles.loadingHostEmpty}`}
        aria-busy={loadingDashboard}
      >
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
        <LoadingOverlay active={loadingDashboard} label="Actualizando métricas…" />
      </div>

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

        <div
          className={`${styles.loadingHost} ${table ? "" : styles.loadingHostEmpty}`}
          aria-busy={loadingTable}
        >
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
                            {row.serious === null ? <span>Sin dato</span> : row.serious ? (
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
                          <Link
                            className={styles.rowLink}
                            to={`/historial/${row.id}`}
                            state={{ returnTo: dashboardReturnTo }}
                          >
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
          ) : table ? (
            <p className={styles.state}>Ningún reporte coincide con la búsqueda.</p>
          ) : null}
          <LoadingOverlay active={loadingTable} label="Cargando reportes…" />
        </div>
      </section>
    </div>
  );
}
