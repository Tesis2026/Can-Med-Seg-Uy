import {
  REPORT_STATUS_DESCRIPTIONS,
  REPORT_STATUS_LABELS,
  ReportStatus,
  type ReportHistoryItem,
  type SubmittedReportStatus,
} from "@canmedseg/shared";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";
import { listOwnReports } from "../features/reporte/reportApi";

import styles from "./MisReportes.module.css";

const STATUS_CLASS: Record<SubmittedReportStatus, string> = {
  [ReportStatus.EnRevision]: styles.statusEnRevision,
  [ReportStatus.AprobadoLocal]: styles.statusAprobadoLocal,
  [ReportStatus.AprobadoMsp]: styles.statusAprobadoMsp,
  [ReportStatus.EnviadoMsp]: styles.statusEnviadoMsp,
  [ReportStatus.Rechazado]: styles.statusRechazado,
};

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function reportTitle(report: Pick<ReportHistoryItem, "patientInitials" | "patientNationalId">) {
  const parts = [report.patientInitials, report.patientNationalId].filter(
    (part) => part.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(" - ") : "Reporte sin datos del paciente";
}

/**
 * Frame «Historial de reportes enviados» del .pen — RF-6.1.
 * Un visitante no tiene historial (RF-6.2): la ruta exige sesión.
 */
export function HistorialPage() {
  const { session, loading: sessionLoading } = useSession();
  const [reports, setReports] = useState<ReportHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!session.authenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await listOwnReports();
        if (!cancelled) setReports(result);
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error ? cause.message : "No se pudo cargar el historial.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.authenticated]);

  const filtered = useMemo(() => {
    if (!reports) return null;
    const needle = query.trim().toLowerCase();
    if (!needle) return reports;
    return reports.filter((report) =>
      [report.patientInitials, report.patientNationalId, report.adverseEventDescription]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [reports, query]);

  if (sessionLoading) {
    return <p className={styles.state}>Cargando…</p>;
  }

  if (!session.authenticated) {
    return <Navigate to="/login?returnTo=%2Fhistorial" replace />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Historial de reportes enviados</h1>
        <p className={styles.subtitle}>
          Consulte los reportes que ya fueron enviados al sistema y el estado de cada uno.
        </p>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {reports !== null && reports.length > 0 ? (
        <div className={styles.searchRow}>
          <input
            className={styles.search}
            type="search"
            value={query}
            aria-label="Buscar en el historial"
            placeholder="Buscar por iniciales, cédula o evento…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      ) : null}

      {reports === null ? <p className={styles.state}>Cargando historial…</p> : null}

      {reports !== null && reports.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Todavía no envió ningún reporte. Cuando envíe uno, aparecerá acá con su estado.
          </p>
          <Link className={styles.primary} to="/reporte?nuevo=1">
            Nuevo reporte
          </Link>
        </div>
      ) : null}

      {filtered !== null && reports !== null && reports.length > 0 ? (
        <div className={styles.tableCard}>
          <div className={styles.thead}>
            <span className={`${styles.th} ${styles.colMain}`}>Paciente</span>
            <span className={`${styles.th} ${styles.colDate}`}>Enviado</span>
            <span className={`${styles.th} ${styles.colStatus}`}>Estado</span>
            <span className={`${styles.th} ${styles.colLink}`} />
          </div>

          {filtered.length === 0 ? (
            <div className={styles.row}>
              <span className={styles.emptyText}>
                Ningún reporte coincide con la búsqueda.
              </span>
            </div>
          ) : null}

          {filtered.map((report) => (
            <div className={styles.row} key={report.id}>
              <div className={styles.colMain}>
                <span className={styles.patient}>{reportTitle(report)}</span>
                {report.adverseEventDescription ? (
                  <span className={styles.summary}>{report.adverseEventDescription}</span>
                ) : null}
              </div>
              <div className={styles.colDate}>
                <span className={styles.date}>{formatDateTime(report.submittedAt)}</span>
              </div>
              <div className={styles.colStatus}>
                <span className={`${styles.status} ${STATUS_CLASS[report.status]}`}>
                  {REPORT_STATUS_LABELS[report.status]}
                </span>
                <span className={styles.statusHint}>
                  {REPORT_STATUS_DESCRIPTIONS[report.status]}
                </span>
              </div>
              <div className={styles.colLink}>
                <Link className={styles.link} to={`/historial/${report.id}`}>
                  Ver
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
