import { Link } from "react-router-dom";

import {
  CONSENT_FINAL_PARAGRAPHS,
  CONSENT_INICIO_PARAGRAPHS,
} from "../components/consent";

import styles from "./ConsentimientoPage.module.css";

/**
 * Página documental del consentimiento informado (frame `Consentimiento` del .pen).
 * Es el enlace persistente exigido por las notas de cliente: el texto tiene que
 * estar accesible dentro de la app, no solo en los pop-ups.
 *
 * El contenido es el mismo que muestran los modales (`consentCopy.ts`), sin
 * ninguna referencia a cómo o cuándo se despliega: esta página la lee el
 * notificador, no el equipo de desarrollo.
 */
export function ConsentimientoPage() {
  return (
    <div className={styles.page}>
      <section className={styles.section} aria-labelledby="consent-title">
        <h1 id="consent-title" className={styles.title}>
          Consentimiento informado
        </h1>
        {CONSENT_INICIO_PARAGRAPHS.map((paragraph, index) => (
          <p key={index} className={styles.paragraph}>
            {paragraph}
          </p>
        ))}
      </section>

      <section className={styles.section} aria-labelledby="consent-declaration-title">
        <h2 id="consent-declaration-title" className={styles.subtitle}>
          Declaración
        </h2>
        {CONSENT_FINAL_PARAGRAPHS.map((paragraph, index) => (
          <p key={index} className={styles.paragraph}>
            {paragraph}
          </p>
        ))}
      </section>

      <div className={styles.actions}>
        <Link className={styles.primary} to="/reporte">
          Reportar evento adverso
        </Link>
        <Link className={styles.secondary} to="/">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
