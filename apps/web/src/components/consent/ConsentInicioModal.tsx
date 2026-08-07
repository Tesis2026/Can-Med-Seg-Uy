import { useEffect, useId, useRef } from "react";

import { CONSENT_INICIO_PARAGRAPHS, CONSENT_INICIO_TITLE } from "./consentCopy";
import styles from "./ConsentModal.module.css";

export type ConsentInicioModalProps = {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
};

export function ConsentInicioModal({
  open,
  onAccept,
  onCancel,
}: ConsentInicioModalProps) {
  const titleId = useId();
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    acceptRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className={styles.title}>
          {CONSENT_INICIO_TITLE}
        </h2>
        <div className={styles.body}>
          {CONSENT_INICIO_PARAGRAPHS.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancelar
          </button>
          <button
            ref={acceptRef}
            type="button"
            className={styles.acceptBtn}
            onClick={onAccept}
          >
            Aceptar y continuar
          </button>
        </div>
      </div>
    </div>
  );
}
