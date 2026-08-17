import styles from "./WizardNav.module.css";

type WizardNavProps = {
  step: number;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  emailReceipt?: boolean;
  onEmailReceiptChange?: (value: boolean) => void;
};

export function WizardNav({
  step,
  onPrev,
  onNext,
  onSubmit,
  emailReceipt,
  onEmailReceiptChange,
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
          <>
            <label className={styles.receipt}>
              <input
                type="checkbox"
                checked={Boolean(emailReceipt)}
                onChange={(e) => onEmailReceiptChange?.(e.target.checked)}
              />
              Deseo recibir un resumen de lo notificado
            </label>
            <button type="button" className={styles.primary} onClick={onSubmit}>
              Enviar reportes
            </button>
          </>
        ) : (
          <button type="button" className={styles.primary} onClick={onNext}>
            Siguiente sección
          </button>
        )}
      </div>
    </div>
  );
}
