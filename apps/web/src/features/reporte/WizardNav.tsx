import styles from "./WizardNav.module.css";

type WizardNavProps = {
  step: number;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  /** Bloquea el envío hasta resolver el CAPTCHA del camino anónimo (RF-3.6). */
  submitDisabled?: boolean;
};

export function WizardNav({
  step,
  onPrev,
  onNext,
  onSubmit,
  submitDisabled = false,
}: WizardNavProps) {
  const isLast = step >= 5;

  return (
    <div className={styles.nav}>
      {step > 1 ? (
        <button type="button" className={styles.secondary} onClick={onPrev}>
          Sección anterior
        </button>
      ) : (
        <span />
      )}

      <div className={styles.right}>
        {isLast ? (
          <button
            type="button"
            className={styles.primary}
            onClick={onSubmit}
            disabled={submitDisabled}
            title={
              submitDisabled
                ? "Complete la verificación de seguridad para enviar el reporte"
                : undefined
            }
          >
            Enviar reportes
          </button>
        ) : (
          <button type="button" className={styles.primary} onClick={onNext}>
            Siguiente sección
          </button>
        )}
      </div>
    </div>
  );
}
