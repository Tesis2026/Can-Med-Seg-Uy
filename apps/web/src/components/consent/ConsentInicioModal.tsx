import { useEffect, useId, useRef } from "react";

import { CONSENT_INICIO_PARAGRAPHS, CONSENT_INICIO_TITLE } from "./consentCopy";
import styles from "./ConsentModal.module.css";

export type ConsentInicioModalProps = {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
  /** Texto del botón primario. Default: "Aceptar y continuar". */
  acceptLabel?: string;
  /** Texto del botón secundario. Default: "Cancelar". */
  cancelLabel?: string;
  /** Deshabilita los botones mientras se registra el consentimiento. */
  busy?: boolean;
  /**
   * Permite cerrar con Escape o clic en el fondo. En el primer login es `false`:
   * sin consentimiento no se puede usar la app (Ley 18.331).
   */
  dismissible?: boolean;
  /** Mensaje de error a mostrar dentro del modal (p. ej. falla al registrar). */
  error?: string | null;
};

export function ConsentInicioModal({
  open,
  onAccept,
  onCancel,
  acceptLabel = "Aceptar y continuar",
  cancelLabel = "Cancelar",
  busy = false,
  dismissible = true,
  error = null,
}: ConsentInicioModalProps) {
  const titleId = useId();
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    acceptRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissible && !busy) {
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
  }, [open, onCancel, dismissible, busy]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && dismissible && !busy) onCancel();
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
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            ref={acceptRef}
            type="button"
            className={styles.acceptBtn}
            onClick={onAccept}
            disabled={busy}
          >
            {busy ? "Registrando…" : acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
