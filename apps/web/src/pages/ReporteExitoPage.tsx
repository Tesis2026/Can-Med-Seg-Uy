import { Link } from "react-router-dom";

import styles from "./Page.module.css";

export function ReporteExitoPage() {
  return (
    <section className={styles.page}>
      <div className={styles.successCard}>
        <h1>Reporte enviado</h1>
        <p className={styles.lead}>
          Gracias. Su notificación de evento adverso fue registrada
          correctamente.
        </p>
        <p className={styles.muted}>
          En esta demo el envío es simulado: no se transfirió información a un
          servidor ni al MSP. Si marcó el recibo por correo, en producción
          recibiría un PDF de confirmación.
        </p>
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
