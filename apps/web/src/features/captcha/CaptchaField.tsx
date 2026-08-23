import type { CaptchaChallenge } from "@canmedseg/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../lib/api";
import { requestChallenge, solveChallenge } from "./captchaApi";

import styles from "./CaptchaField.module.css";

type CaptchaFieldProps = {
  /** Se invoca con el comprobante al resolverlo, y con `null` al invalidarse. */
  onVerified: (token: string | null) => void;
};

/**
 * Verificación de seguridad previa al envío sin sesión (RF-3.6).
 * Los usuarios logueados no ven este bloque.
 */
export function CaptchaField({ onVerified }: CaptchaFieldProps) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // El callback del padre se lee por referencia: así `loadChallenge` es estable
  // y el efecto de arranque no vuelve a pedir un desafío en cada render.
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  const loadChallenge = useCallback(
    async (focus: boolean) => {
      setBusy(true);
      setError(null);
      setAnswer("");
      setVerified(false);
      onVerifiedRef.current(null);
      try {
        setChallenge(await requestChallenge());
        if (focus) inputRef.current?.focus();
      } catch (cause) {
        setChallenge(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo generar la verificación de seguridad.",
        );
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadChallenge(false);
  }, [loadChallenge]);

  async function handleVerify() {
    if (!challenge || answer.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const verification = await solveChallenge(challenge.id, answer);
      setVerified(true);
      onVerifiedRef.current(verification.token);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "No se pudo verificar el código.";
      // Un desafío expirado o sin intentos ya no sirve: se pide otro.
      const expired = cause instanceof ApiError && cause.reason !== "invalido";
      if (expired) {
        await loadChallenge(true);
      } else {
        setAnswer("");
        inputRef.current?.focus();
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  if (verified) {
    return (
      <div className={styles.block}>
        <p className={styles.label}>Verificación de seguridad</p>
        <p className={styles.verified} role="status">
          Verificación completada. Ya puede enviar el reporte.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.block}>
      <label className={styles.label} htmlFor="f-captcha">
        Verificación de seguridad <span className={styles.req}>*</span>
      </label>
      <p className={styles.hint}>
        Está reportando sin iniciar sesión. Escriba los caracteres de la imagen para
        confirmar que no es un programa automático.
      </p>

      <div className={styles.row}>
        <div className={styles.imageBox}>
          {challenge ? (
            <img
              className={styles.image}
              src={challenge.imageDataUrl}
              alt="Caracteres de la verificación de seguridad"
            />
          ) : (
            <span className={styles.imagePlaceholder}>Generando código…</span>
          )}
        </div>

        <button
          type="button"
          className={styles.refresh}
          onClick={() => void loadChallenge(true)}
          disabled={busy}
        >
          Generar otro código
        </button>
      </div>

      <div className={styles.row}>
        <input
          id="f-captcha"
          ref={inputRef}
          className={`${styles.input} ${error ? styles.inputError : ""}`}
          value={answer}
          maxLength={challenge?.length ?? 8}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          aria-describedby={error ? "f-captcha-error" : undefined}
          placeholder="Código de la imagen"
          onChange={(event) => setAnswer(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            void handleVerify();
          }}
        />
        <button
          type="button"
          className={styles.verify}
          onClick={() => void handleVerify()}
          disabled={busy || !challenge || answer.trim().length === 0}
        >
          Verificar
        </button>
      </div>

      {error ? (
        <p className={styles.error} id="f-captcha-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
