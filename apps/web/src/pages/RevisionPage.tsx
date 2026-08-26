import {
  REPORT_STATUS_LABELS,
  ReportStatus,
  Permission,
  hasPermission,
  type ReviewQueueItem,
  type MspPendingItem,
} from "@canmedseg/shared";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";
import { reportPatientTitle, formatReportDateTime } from "../features/reporte/ReportDetailView";
import { listMspPending, listReviewQueue } from "../features/reporte/reportApi";

import styles from "./MisReportes.module.css";
import revisionStyles from "./Revision.module.css";

type Tab = "revision" | "msp";

/**
 * Frame «Bandeja de reportes en revisión» — RF-5.2.
 * Varios investigadores ven la misma cola; no hay asignación 1-a-1.
 */
export function RevisionPage() {
  const { session, loading: sessionLoading } = useSession();
  const [tab, setTab] = useState<Tab>("revision");
  const [queue, setQueue] = useState<ReviewQueueItem[] | null>(null);
  const [mspPending, setMspPending] = useState<MspPendingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const canReview = hasPermission(session.permissions, Permission.ReportReview);

  useEffect(() => {
    if (!canReview) return;
    let cancelled = false;
    void (async () => {
      try {
        const [inReview, pending] = await Promise.all([
          listReviewQueue(),
          listMspPending(),
        ]);
        if (!cancelled) {
          setQueue(inReview);
          setMspPending(pending);
        }
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error ? cause.message : "No se pudo cargar la bandeja.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canReview]);

  const activeList = tab === "revision" ? queue : mspPending;

  const filtered = useMemo(() => {
    if (!activeList) return null;
    const needle = query.trim().toLowerCase();
    if (!needle) return activeList;
    return activeList.filter((item) =>
      [item.patientInitials, item.patientNationalId, item.adverseEventDescription]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [activeList, query]);

  if (sessionLoading) {
    return <p className={styles.state}>Cargando…</p>;
  }

  if (!session.authenticated || !canReview) {
    return <Navigate to="/login?returnTo=%2Frevision" replace />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Bandeja de reportes en revisión</h1>
        <p className={styles.subtitle}>
          Revise los reportes enviados, complete la relación causal y clasifique su destino.
        </p>
      </div>

      <div className={revisionStyles.tabs} role="tablist" aria-label="Vistas de revisión">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "revision"}
          className={`${revisionStyles.tab} ${tab === "revision" ? revisionStyles.tabActive : ""}`}
          onClick={() => setTab("revision")}
        >
          En revisión ({queue?.length ?? "…"})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "msp"}
          className={`${revisionStyles.tab} ${tab === "msp" ? revisionStyles.tabActive : ""}`}
          onClick={() => setTab("msp")}
        >
          Envíos MSP pendientes ({mspPending?.length ?? "…"})
        </button>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {activeList !== null && activeList.length > 0 ? (
        <div className={styles.searchRow}>
          <input
            className={styles.search}
            type="search"
            value={query}
            aria-label="Buscar en la bandeja"
            placeholder="Buscar por iniciales, cédula o evento…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      ) : null}

      {activeList === null ? <p className={styles.state}>Cargando bandeja…</p> : null}

      {activeList !== null && activeList.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            {tab === "revision"
              ? "No hay reportes pendientes de revisión."
              : "No hay envíos al MSP pendientes de reintento."}
          </p>
        </div>
      ) : null}

      {filtered !== null && activeList !== null && activeList.length > 0 ? (
        <div className={styles.tableCard}>
          <div className={styles.thead}>
            <span className={`${styles.th} ${styles.colMain}`}>Paciente / evento</span>
            <span className={`${styles.th} ${styles.colDate}`}>Notificado</span>
            <span className={`${styles.th} ${styles.colStatus}`}>Estado</span>
            <span className={`${styles.th} ${styles.colLink}`} />
          </div>

          {filtered.length === 0 ? (
            <div className={styles.row}>
              <span className={styles.emptyText}>Ningún reporte coincide con la búsqueda.</span>
            </div>
          ) : null}

          {filtered.map((item) => (
            <div className={styles.row} key={item.id}>
              <div className={styles.colMain}>
                <span className={styles.patient}>
                  {reportPatientTitle({
                    initials: item.patientInitials,
                    nationalId: item.patientNationalId,
                  })}
                </span>
                {item.adverseEventDescription ? (
                  <span className={styles.summary}>{item.adverseEventDescription}</span>
                ) : null}
                {item.hasSeriousEvent ? (
                  <span className={revisionStyles.seriousBadge}>Evento grave</span>
                ) : null}
                {tab === "msp" && (item as MspPendingItem).lastError ? (
                  <span className={revisionStyles.mspHint}>
                    {(item as MspPendingItem).lastError}
                  </span>
                ) : null}
              </div>
              <div className={styles.colDate}>
                <span className={styles.date}>{formatReportDateTime(item.submittedAt)}</span>
              </div>
              <div className={styles.colStatus}>
                <span
                  className={`${styles.status} ${
                    tab === "revision" ? styles.statusEnRevision : styles.statusAprobadoMsp
                  }`}
                >
                  {tab === "revision"
                    ? REPORT_STATUS_LABELS[ReportStatus.EnRevision]
                    : REPORT_STATUS_LABELS[ReportStatus.AprobadoMsp]}
                </span>
              </div>
              <div className={styles.colLink}>
                {tab === "revision" ? (
                  <Link className={styles.link} to={`/revision/${item.id}`}>
                    Revisar
                  </Link>
                ) : (
                  <span className={styles.summary}>Cola Semana 8</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
