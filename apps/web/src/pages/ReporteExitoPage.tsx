import { Link, useLocation } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";

import styles from "./Page.module.css";

export function ReporteExitoPage() {
  const location = useLocation();
  const { session } = useSession();
  const reportId = (location.state as { reportId?: string } | null)?.reportId;

  return (
    <section className={styles.page}>
      <div className={styles.successCard}>
        <h1>Reporte enviado</h1>
        <p className={styles.lead}>
          Gracias. Su notificación de evento adverso fue registrada correctamente y quedó
          en revisión.
        </p>
        {reportId ? (
          <p className={styles.muted}>Identificador del reporte: {reportId}</p>
        ) : null}
        {!session.authenticated ? (
          <p className={styles.muted}>
            Guarde este identificador: al reportar sin iniciar sesión, el reporte no queda
            asociado a un historial que pueda consultar después.
          </p>
        ) : null}
        <div className={styles.actions}>
          {session.authenticated ? (
            <Link className={styles.primary} to="/historial">
              Ver mi historial
            </Link>
          ) : (
            <Link className={styles.primary} to="/">
              Volver al inicio
            </Link>
          )}
          <Link className={styles.secondary} to="/reporte?nuevo=1">
            Cargar otro reporte
          </Link>
        </div>
      </div>
    </section>
  );
}
