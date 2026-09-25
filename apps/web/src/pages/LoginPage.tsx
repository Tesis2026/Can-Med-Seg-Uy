import { signInInputSchema } from "@canmedseg/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

// Registro con GUB UY: deprecado momentáneamente.
// import { loginUrl } from "../features/auth/authApi";
import { useSession } from "../features/auth/SessionContext";
import { Field, TextInput } from "../features/reporte/FormFields";

import styles from "./LoginPage.module.css";

/**
 * Registro con GUB UY: deprecado momentáneamente. Mensajes de error que devuelve
 * GET /api/auth/callback; se mantienen porque la ruta sigue existiendo.
 */
const ERROR_MESSAGES: Record<string, { title: string; detail: string }> = {
  idp: {
    title: "No se pudo iniciar sesión. Verifique su cuenta gub.uy o intente nuevamente.",
    detail: "El proveedor de identidad rechazó la solicitud.",
  },
  estado_expirado: {
    title: "La solicitud de inicio de sesión expiró.",
    detail: "Vuelva a presionar «Ingresar con GUB UY».",
  },
  respuesta_invalida: {
    title: "No se pudo completar el inicio de sesión.",
    detail: "La respuesta del proveedor de identidad estaba incompleta.",
  },
  cuenta_deshabilitada: {
    title: "Su cuenta está deshabilitada.",
    detail: "Comuníquese con el administrador del sistema.",
  },
  inesperado: {
    title: "Ocurrió un error inesperado al iniciar sesión.",
    detail: "Intente nuevamente en unos minutos.",
  },
};

type FieldErrors = Partial<Record<"email" | "password", string>>;

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading, offline, signIn } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const returnTo = searchParams.get("returnTo") ?? undefined;
  const errorCode = searchParams.get("error");
  const passwordWasReset = searchParams.get("restablecida") === "1";
  const error = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.inesperado) : null;

  useEffect(() => {
    if (!loading && session.authenticated) {
      navigate(returnTo ?? "/", { replace: true });
    }
  }, [loading, session.authenticated, navigate, returnTo]);

  // Registro con GUB UY: deprecado momentáneamente.
  // function handleLogin() {
  //   window.location.assign(loginUrl(returnTo));
  // }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = signInInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === "email" || field === "password") && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await signIn(parsed.data);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión.");
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.main}>
      <section className={styles.loginCard} aria-labelledby="login-title">
        <div className={styles.titleBlk}>
          <h1 id="login-title" className={styles.title}>
            Iniciar sesión
          </h1>
          <p className={styles.subtitle}>Ingrese con el email y la contraseña de su cuenta.</p>
        </div>

        <form className={styles.formBlk} onSubmit={(event) => void handleSubmit(event)} noValidate>
          <Field label="Email" htmlFor="login-email" error={fieldErrors.email}>
            <TextInput
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              hasError={Boolean(fieldErrors.email)}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Contraseña" htmlFor="login-password" error={fieldErrors.password}>
            <TextInput
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              hasError={Boolean(fieldErrors.password)}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <div className={styles.forgotRow}>
            <Link className={styles.link} to="/olvide-contrasena">
              ¿Olvidó su contraseña?
            </Link>
          </div>
          <button type="submit" className={styles.submitBtn} disabled={offline || submitting}>
            {submitting ? "Ingresando…" : "Ingresar"}
          </button>
          <p className={styles.hint}>
            Las cuentas las crea el administrador del sistema.
          </p>
        </form>

        {/*
          Registro con GUB UY: deprecado momentáneamente. Para reactivarlo, descomentar
          este bloque, `handleLogin` y el import de `loginUrl`.

        <div className={styles.gubBlk}>
          <button type="button" className={styles.gubBtn} onClick={handleLogin} disabled={offline}>
            Ingresar con GUB UY
          </button>
          <p className={styles.hint}>
            Será redirigido al portal de identidad digital de gub.uy.
          </p>
        </div>
        */}

        {passwordWasReset && !submitError ? (
          <div className={styles.okBox} role="status">
            <span className={styles.okIcon} aria-hidden="true">
              ✓
            </span>
            <div className={styles.errTxt}>
              <p className={styles.okTitle}>Su contraseña se actualizó.</p>
              <p className={styles.okDetail}>Ya puede ingresar con la contraseña nueva.</p>
            </div>
          </div>
        ) : null}

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

        {error ? (
          <div className={styles.errBox} role="alert">
            <span className={styles.errIcon} aria-hidden="true">
              !
            </span>
            <div className={styles.errTxt}>
              <p className={styles.errTitle}>{error?.title}</p>
              <p className={styles.errDetail}>{error?.detail}</p>
            </div>
          </div>
        ) : null}

        {offline ? (
          <div className={styles.errBox} role="alert">
            <span className={styles.errIcon} aria-hidden="true">
              !
            </span>
            <div className={styles.errTxt}>
              <p className={styles.errTitle}>El servicio de inicio de sesión no está disponible.</p>
              <p className={styles.errDetail}>
                Puede continuar como visitante y enviar su reporte sin iniciar sesión.
              </p>
            </div>
          </div>
        ) : null}

        <div className={styles.linksRow}>
          <Link className={styles.link} to="/">
            Volver al inicio
          </Link>
          {/* Desvío del .pen: la Semana 3 exige una salida explícita a modo visitante. */}
          <Link className={styles.link} to="/reporte">
            Continuar como visitante
          </Link>
          <a className={styles.link} href="#ayuda">
            ¿Necesita ayuda?
          </a>
        </div>
      </section>
    </div>
  );
}
