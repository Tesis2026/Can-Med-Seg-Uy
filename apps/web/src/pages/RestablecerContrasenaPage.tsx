import { PASSWORD_MIN_LENGTH, resetPasswordInputSchema } from "@canmedseg/shared";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { resetPassword } from "../features/auth/authApi";
import { Field, TextInput } from "../features/reporte/FormFields";
import { ApiError } from "../lib/api";

import styles from "./LoginPage.module.css";

type FieldErrors = Partial<Record<"password" | "confirmation", string>>;

export function RestablecerContrasenaPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [invalidLink, setInvalidLink] = useState(!token);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSubmitError(null);

    const parsed = resetPasswordInputSchema.safeParse({ password, confirmation });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === "password" || field === "confirmation") && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await resetPassword(token, parsed.data.password);
      navigate("/login?restablecida=1", { replace: true });
    } catch (cause) {
      if (cause instanceof ApiError && cause.reason === "token_invalido") {
        setInvalidLink(true);
      } else {
        setSubmitError(cause instanceof Error ? cause.message : "No se pudo restablecer la contraseña.");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.main}>
      <section className={styles.loginCard} aria-labelledby="reset-title">
        <div className={styles.titleBlk}>
          <h1 id="reset-title" className={styles.title}>
            Elegir una contraseña nueva
          </h1>
          <p className={styles.subtitle}>
            Al guardarla se cierran las sesiones abiertas de su cuenta.
          </p>
        </div>

        {invalidLink ? (
          <div className={styles.errBox} role="alert">
            <span className={styles.errIcon} aria-hidden="true">
              !
            </span>
            <div className={styles.errTxt}>
              <p className={styles.errTitle}>El enlace no es válido o ya venció.</p>
              <p className={styles.errDetail}>
                Los enlaces sirven una sola vez y durante 1 hora.{" "}
                <Link className={styles.link} to="/olvide-contrasena">
                  Pedir un enlace nuevo
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <form className={styles.formBlk} onSubmit={(event) => void handleSubmit(event)} noValidate>
            <Field
              label="Nueva contraseña"
              htmlFor="reset-password"
              hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}
              error={fieldErrors.password}
            >
              <TextInput
                id="reset-password"
                type="password"
                autoComplete="new-password"
                value={password}
                hasError={Boolean(fieldErrors.password)}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field
              label="Repetir contraseña"
              htmlFor="reset-confirmation"
              error={fieldErrors.confirmation}
            >
              <TextInput
                id="reset-confirmation"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                hasError={Boolean(fieldErrors.confirmation)}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar contraseña"}
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
        </div>
      </section>
    </div>
  );
}
