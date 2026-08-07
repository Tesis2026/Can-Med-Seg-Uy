import { useEffect, useId, useRef } from "react";

import { CONSENT_FINAL_PARAGRAPHS, CONSENT_FINAL_TITLE } from "./consentCopy";
import styles from "./ConsentFinalModal.module.css";

export type ConsentFinalModalProps = {
  open: boolean;
  /** Deshabilita botones mientras el wizard envía el reporte. */
  submitting?: boolean;
  onBack: () => void;
  onAccept: () => void;
};

/**
 * Pop-up final de consentimiento (Form-5 → Enviar reportes).
 * El wizard debe importarlo y abrirlo antes del envío.
 */
export function ConsentFinalModal({
  open,
  submitting = false,
  onBack,
  onAccept,
}: ConsentFinalModalProps) {
  const titleId = useId();
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    acceptRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        onBack();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onBack, submitting]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onBack();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className={styles.title}>
          {CONSENT_FINAL_TITLE}
        </h2>
        <div className={styles.body}>
          {CONSENT_FINAL_PARAGRAPHS.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.back}
            onClick={onBack}
            disabled={submitting}
          >
            Volver
          </button>
          <button
            ref={acceptRef}
            type="button"
            className={styles.accept}
            onClick={onAccept}
            disabled={submitting}
          >
            {submitting ? "Enviando…" : "Aceptar y enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
