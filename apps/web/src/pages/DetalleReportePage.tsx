import { type ReportDetail } from "@canmedseg/shared";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";
import {
  ReportDetailView,
  formatReportDateTime,
  reportPatientTitle,
} from "../features/reporte/ReportDetailView";
import { fetchReport } from "../features/reporte/reportApi";

import styles from "./MisReportes.module.css";

/**
 * Frame «Detalle de reporte enviado» del .pen: vista de solo lectura con los
 * datos tal como se enviaron (RF-6.1).
 */
export function DetalleReportePage() {
  const { id = "" } = useParams();
  const { session, loading: sessionLoading } = useSession();
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.authenticated || !id) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchReport(id);
        if (!cancelled) setDetail(result);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "No se pudo abrir el reporte.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.authenticated, id]);

  if (sessionLoading) {
    return <p className={styles.state}>Cargando…</p>;
  }

  if (!session.authenticated) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(`/historial/${id}`)}`} replace />;
  }

  return (
    <div className={styles.page}>
      <Link className={styles.back} to="/historial">
        ← Volver al historial
      </Link>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {!detail && !error ? <p className={styles.state}>Cargando reporte…</p> : null}

      {detail ? (
        <>
          <div className={styles.detailHead}>
            <div className={styles.detailTitle}>
              <h1 className={styles.detailPatient}>
                {reportPatientTitle(detail.report.patient)}
              </h1>
              <p className={styles.detailMeta}>
                Enviado el {formatReportDateTime(detail.submittedAt)}
              </p>
            </div>
          </div>
          <ReportDetailView detail={detail} />
        </>
      ) : null}
    </div>
  );
}
