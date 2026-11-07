import styles from "./analytics.module.css";

type LoadingOverlayProps = {
  active: boolean;
  label?: string;
};

/**
 * Capa de carga sobre una sección del dashboard. Queda siempre montada para que
 * la salida se anime con un fundido: aparece con un pequeño retraso (así las
 * respuestas rápidas no parpadean) y se desvanece al terminar.
 */
export function LoadingOverlay({ active, label = "Actualizando…" }: LoadingOverlayProps) {
  return (
    <div
      className={`${styles.loadingOverlay} ${active ? styles.loadingOverlayActive : ""}`}
      aria-hidden={!active}
    >
      <div className={styles.loadingBadge} role="status">
        <span className={styles.loadingSpinner} aria-hidden="true" />
        {active ? label : null}
      </div>
    </div>
  );
}
