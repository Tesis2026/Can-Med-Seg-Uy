import { Link, useLocation } from "react-router-dom";

import styles from "./Page.module.css";

export function ReporteExitoPage() {
  const location = useLocation();
  const reportId = (location.state as { reportId?: string } | null)?.reportId;

  return (
    <section className={styles.page}>
      <div className={styles.successCard}>
        <h1>Reporte enviado</h1>
        <p className={styles.lead}>
          Gracias. Su notificación de evento adverso fue registrada correctamente.
        </p>
        {reportId ? (
          <p className={styles.muted}>Identificador del reporte: {reportId}</p>
        ) : null}
        <div className={styles.actions}>
          <Link className={styles.primary} to="/">
            Volver al inicio
          </Link>
          <Link className={styles.secondary} to="/reporte">
            Cargar otro reporte
          </Link>
        </div>
      </div>
    </section>
  );
}
