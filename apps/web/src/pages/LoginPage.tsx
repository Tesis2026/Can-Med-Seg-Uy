import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { loginUrl } from "../features/auth/authApi";
import { useSession } from "../features/auth/SessionContext";

import styles from "./LoginPage.module.css";

/** Mensajes de error que devuelve GET /api/auth/callback. */
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

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading, offline } = useSession();

  const returnTo = searchParams.get("returnTo") ?? undefined;
  const errorCode = searchParams.get("error");
  const error = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.inesperado) : null;

  useEffect(() => {
    if (!loading && session.authenticated) {
      navigate(returnTo ?? "/", { replace: true });
    }
  }, [loading, session.authenticated, navigate, returnTo]);

  function handleLogin() {
    window.location.assign(loginUrl(returnTo));
  }

  return (
    <div className={styles.main}>
      <section className={styles.loginCard} aria-labelledby="login-title">
        <div className={styles.titleBlk}>
          <h1 id="login-title" className={styles.title}>
            Iniciar sesión
          </h1>
          <p className={styles.subtitle}>Acceda con su cuenta gub.uy para continuar.</p>
        </div>

        <div className={styles.gubBlk}>
          <button type="button" className={styles.gubBtn} onClick={handleLogin} disabled={offline}>
            Ingresar con GUB UY
          </button>
          <p className={styles.hint}>
            Será redirigido al portal de identidad digital de gub.uy.
          </p>
        </div>

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
              <p className={styles.errTitle}>El servicio de identidad no está disponible.</p>
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
