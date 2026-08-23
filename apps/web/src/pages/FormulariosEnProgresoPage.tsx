import type { ReportDraftSummary } from "@canmedseg/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";
import { deleteDraft, listDrafts } from "../features/reporte/reportApi";

import styles from "./MisReportes.module.css";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function draftTitle(draft: ReportDraftSummary): string {
  const parts = [draft.patientInitials, draft.patientNationalId].filter(
    (part) => part.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(" - ") : "Reporte sin datos del paciente";
}

/**
 * Frame «Formularios en progreso» del .pen — RF-4.5.
 * Un visitante no tiene borradores (RF-4.4): la ruta exige sesión.
 */
export function FormulariosEnProgresoPage() {
  const { session, loading: sessionLoading } = useSession();
  const [drafts, setDrafts] = useState<ReportDraftSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDrafts(await listDrafts());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudieron cargar los formularios en progreso.",
      );
    }
  }, []);

  useEffect(() => {
    if (!session.authenticated) return;
    void load();
  }, [session.authenticated, load]);

  if (sessionLoading) {
    return <p className={styles.state}>Cargando…</p>;
  }

  if (!session.authenticated) {
    return <Navigate to="/login?returnTo=%2Fformularios-en-progreso" replace />;
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await deleteDraft(id);
      setDrafts((previous) => (previous ?? []).filter((item) => item.id !== id));
      setConfirmingId(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo eliminar el borrador.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Formularios en progreso</h1>
        <p className={styles.subtitle}>
          Reportes guardados que aún no fueron enviados. Puede retomarlos o eliminar el
          borrador.
        </p>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {drafts === null ? <p className={styles.state}>Cargando borradores…</p> : null}

      {drafts !== null && drafts.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            No tiene formularios en progreso. Los reportes se guardan automáticamente al
            pasar de sección.
          </p>
          <Link className={styles.primary} to="/reporte?nuevo=1">
            Nuevo reporte
          </Link>
        </div>
      ) : null}

      {drafts !== null && drafts.length > 0 ? (
        <div className={styles.tableCard}>
          <div className={styles.thead}>
            <span className={`${styles.th} ${styles.colMain}`}>Paciente</span>
            <span className={`${styles.th} ${styles.colDate}`}>Última edición</span>
            <span className={`${styles.th} ${styles.colActions}`}>Acciones</span>
          </div>

          {drafts.map((draft) => (
            <div className={styles.row} key={draft.id}>
              <div className={styles.colMain}>
                <span className={styles.patient}>{draftTitle(draft)}</span>
              </div>
              <div className={styles.colDate}>
                <span className={styles.date}>{formatDateTime(draft.updatedAt)}</span>
              </div>
              <div className={styles.colActions}>
                {confirmingId === draft.id ? (
                  <>
                    <span className={styles.confirmText}>¿Eliminar el borrador?</span>
                    <button
                      type="button"
                      className={styles.danger}
                      disabled={deletingId === draft.id}
                      onClick={() => void handleDelete(draft.id)}
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      className={styles.linkButton}
                      disabled={deletingId === draft.id}
                      onClick={() => setConfirmingId(null)}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <Link className={styles.primary} to={`/reporte?borrador=${draft.id}`}>
                      Retomar
                    </Link>
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => setConfirmingId(draft.id)}
                    >
                      Eliminar borrador
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
