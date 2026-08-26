import {
  Permission,
  REPORT_STATUS_LABELS,
  ReportStatus,
  hasPermission,
  type Causality,
  type ReviewReportDetail,
  type SeverityGrade,
} from "@canmedseg/shared";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";
import {
  CAUSALITY_OPTIONS,
  SEVERITY_GRADE_OPTIONS,
} from "../features/reporte/options";
import {
  ReportDetailView,
  formatReportDateTime,
  reportPatientTitle,
} from "../features/reporte/ReportDetailView";
import { ApiError } from "../lib/api";
import { classifyReport, fetchReviewReport, saveReviewCorrections } from "../features/reporte/reportApi";

import styles from "./MisReportes.module.css";
import revisionStyles from "./Revision.module.css";

/**
 * Frame «Detalle investigación»: revisar, corregir gravedad/causal y clasificar (RF-5).
 */
export function RevisionDetallePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const canReview = hasPermission(session.permissions, Permission.ReportReview);

  const [detail, setDetail] = useState<ReviewReportDetail | null>(null);
  const [causality, setCausality] = useState<Causality | "">("");
  const [severityGrade, setSeverityGrade] = useState<SeverityGrade | "">("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canReview || !id) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchReviewReport(id);
        if (cancelled) return;
        setDetail(result);
        setCausality(result.report.causality ?? "");
        setSeverityGrade(result.report.severityGrade ?? "");
        setReviewNotes(result.reviewNotes ?? "");
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "No se pudo abrir el reporte.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canReview, id]);

  async function persistCorrections() {
    if (!id || !causality) return;
    const updated = await saveReviewCorrections(id, {
      causality,
      ...(severityGrade ? { severityGrade } : {}),
      ...(reviewNotes.trim() ? { reviewNotes: reviewNotes.trim() } : {}),
    });
    setDetail(updated);
  }

  async function handleClassify(
    decision: "aprobado_local" | "enviar_msp" | "rechazado",
  ) {
    if (!id || !causality) {
      setError("Seleccione la relación causal antes de clasificar.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await persistCorrections();
      const result = await classifyReport(id, {
        decision,
        causality,
        ...(severityGrade ? { severityGrade } : {}),
        ...(reviewNotes.trim() ? { reviewNotes: reviewNotes.trim() } : {}),
      });
      const label = REPORT_STATUS_LABELS[result.status];
      setSuccess(`Reporte clasificado como «${label}».`);
      window.setTimeout(() => navigate("/revision", { replace: true }), 900);
    } catch (cause) {
      const message =
        cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "No se pudo clasificar el reporte.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading) {
    return <p className={styles.state}>Cargando…</p>;
  }

  if (!session.authenticated || !canReview) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(`/revision/${id}`)}`} replace />;
  }

  return (
    <div className={styles.page}>
      <Link className={styles.back} to="/revision">
        ← Volver a la bandeja
      </Link>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className={revisionStyles.success} role="status">
          {success}
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
                {REPORT_STATUS_LABELS[ReportStatus.EnRevision]} · Notificado el{" "}
                {formatReportDateTime(detail.submittedAt)}
              </p>
            </div>
          </div>

          <p className={revisionStyles.classifyLead}>
            Revise el reporte, complete la relación causal y clasifique su destino.
          </p>

          <section className={revisionStyles.classifyCard} aria-labelledby="classify-title">
            <h2 id="classify-title" className={revisionStyles.classifyTitle}>
              Clasificación del investigador
            </h2>

            <div className={revisionStyles.field}>
              <label className={revisionStyles.label} htmlFor="causality">
                Relación causal{" "}
                <span className={revisionStyles.labelHint}>(Escala OMS-UMC)</span>
              </label>
              <select
                id="causality"
                className={revisionStyles.select}
                value={causality}
                required
                onChange={(event) => setCausality(event.target.value as Causality | "")}
              >
                <option value="">Seleccione…</option>
                {CAUSALITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={revisionStyles.field}>
              <label className={revisionStyles.label} htmlFor="severity">
                Clasificación de gravedad{" "}
                <span className={revisionStyles.labelHint}>(corrección limitada)</span>
              </label>
              <select
                id="severity"
                className={revisionStyles.select}
                value={severityGrade}
                onChange={(event) =>
                  setSeverityGrade(event.target.value as SeverityGrade | "")
                }
              >
                <option value="">Sin cambios</option>
                {SEVERITY_GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={revisionStyles.field}>
              <label className={revisionStyles.label} htmlFor="notes">
                Notas internas de revisión
              </label>
              <textarea
                id="notes"
                className={revisionStyles.textarea}
                value={reviewNotes}
                maxLength={500}
                placeholder="Observaciones para auditoría (opcional)."
                onChange={(event) => setReviewNotes(event.target.value)}
              />
            </div>

            <div className={revisionStyles.actions}>
              <button
                type="button"
                className={revisionStyles.btnPrimary}
                disabled={busy || !causality}
                onClick={() => void handleClassify("aprobado_local")}
              >
                Aprobado para análisis local
              </button>
              <button
                type="button"
                className={revisionStyles.btnSecondary}
                disabled={busy || !causality}
                onClick={() => void handleClassify("enviar_msp")}
              >
                Aprobado con envío al MSP
              </button>
              <button
                type="button"
                className={revisionStyles.btnDanger}
                disabled={busy || !causality}
                onClick={() => void handleClassify("rechazado")}
              >
                Rechazar (no relacionado)
              </button>
            </div>
          </section>

          <ReportDetailView detail={detail} readonlyNote={false} />
        </>
      ) : null}
    </div>
  );
}
