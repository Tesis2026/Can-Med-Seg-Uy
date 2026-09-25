import { requestPasswordResetInputSchema } from "@canmedseg/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { requestPasswordReset } from "../features/auth/authApi";
import { Field, TextInput } from "../features/reporte/FormFields";

import styles from "./LoginPage.module.css";

export function OlvideContrasenaPage() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = requestPasswordResetInputSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Ingrese un email válido");
      return;
    }

    setFieldError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(parsed.data.email);
      setSentTo(parsed.data.email);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "No se pudo enviar el pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.main}>
      <section className={styles.loginCard} aria-labelledby="forgot-title">
        <div className={styles.titleBlk}>
          <h1 id="forgot-title" className={styles.title}>
            Recuperar contraseña
          </h1>
          <p className={styles.subtitle}>
            Ingrese el email de su cuenta y le enviaremos un enlace para elegir una contraseña nueva.
          </p>
        </div>

        {sentTo ? (
          <div className={styles.okBox} role="status">
            <span className={styles.okIcon} aria-hidden="true">
              ✓
            </span>
            <div className={styles.errTxt}>
              <p className={styles.okTitle}>Revise su correo.</p>
              <p className={styles.okDetail}>
                Si {sentTo} está registrado, le enviamos un enlace para restablecer la contraseña.
                Vence en 1 hora. Si no lo ve, revise la carpeta de correo no deseado.
              </p>
            </div>
          </div>
        ) : (
          <form className={styles.formBlk} onSubmit={(event) => void handleSubmit(event)} noValidate>
            <Field label="Email" htmlFor="forgot-email" error={fieldError ?? undefined}>
              <TextInput
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                hasError={Boolean(fieldError)}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? "Enviando…" : "Enviar enlace"}
            </button>
          </form>
        )}

        {submitError ? (
          <div className={styles.errBox} role="alert">
            <span className={styles.errIcon} aria-hidden="true">
              !
            </span>
            <div className={styles.errTxt}>
              <p className={styles.errTitle}>{submitError}</p>
            </div>
          </div>
        ) : null}

        <div className={styles.linksRow}>
          <Link className={styles.link} to="/login">
            Volver a iniciar sesión
          </Link>
          <Link className={styles.link} to="/">
            Volver al inicio
          </Link>
        </div>
      </section>
    </div>
  );
}
