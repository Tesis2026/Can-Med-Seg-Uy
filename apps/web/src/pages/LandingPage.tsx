import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  ConsentInicioModal,
  setConsentInicioAccepted,
} from "../components/consent";
import { Button } from "../components/ui/Button";
import { useSession } from "../features/auth/SessionContext";

import styles from "./LandingPage.module.css";

const FOOTER_LINKS = [
  { label: "Ministerio de Salud Pública", href: "#" },
  { label: "Preguntas frecuentes", href: "#" },
  { label: "Contacto / Ayuda", href: "#" },
  { label: "Política de privacidad", href: "#" },
] as const;

export function LandingPage() {
  const navigate = useNavigate();
  const { session, user, consentPending } = useSession();
  const [consentOpen, setConsentOpen] = useState(false);

  function handleReportClick() {
    // Un usuario que ya consintió al ingresar no vuelve a ver el pop-up.
    if (session.authenticated && !consentPending) {
      setConsentInicioAccepted();
      navigate("/reporte");
      return;
    }
    setConsentOpen(true);
  }

  function handleConsentCancel() {
    setConsentOpen(false);
  }

  function handleConsentAccept() {
    setConsentInicioAccepted();
    setConsentOpen(false);
    navigate("/reporte");
  }

  return (
    <div className={styles.landing}>
      <section className={styles.hero} aria-labelledby="landing-hero-title">
        <h2 id="landing-hero-title" className={styles.heroTitle}>
          Farmacovigilancia para Cannabis Medicinal
        </h2>
        <p className={`${styles.heroBody} ${styles.heroBodyDesktop}`}>
          Este sistema permite a residentes y profesionales de la salud reportar
          efectos adversos asociados al uso de cannabis medicinal, contribuyendo
          a la seguridad y monitorización de estos tratamientos en Uruguay.
        </p>
        <p className={`${styles.heroBody} ${styles.heroBodyMobile}`}>
          Este sistema permite a ciudadanos y profesionales de la salud reportar
          efectos adversos asociados al uso de cannabis medicinal, contribuyendo
          a la seguridad y monitoreo de estos tratamientos en Uruguay.
        </p>
        {user ? (
          <p className={styles.sessionNote}>
            Sesión iniciada como <strong>{user.displayName}</strong>.
          </p>
        ) : null}
        <div className={styles.btnRow}>
          <Button variant="primary" type="button" onClick={handleReportClick}>
            Reportar evento adverso
          </Button>
          {session.authenticated ? (
            <Button variant="secondary" to="/inicio">
              Ir a mi inicio
            </Button>
          ) : (
            <Button variant="secondary" to="/login">
              Iniciar sesión con GUB UY
            </Button>
          )}
        </div>
      </section>

      <section className={styles.infoSection} aria-label="Características">
        <article className={styles.featCard}>
          <h3 className={`${styles.featTitle} ${styles.featTitleDesktop}`}>
            Reporte
          </h3>
          <h3 className={`${styles.featTitle} ${styles.featTitleMobile}`}>
            Reporte ciudadano
          </h3>
          <p className={styles.featBody}>
            Cualquier persona puede reportar una sospecha de reacción adversa de
            forma sencilla.
          </p>
        </article>
        <article className={styles.featCard}>
          <h3 className={styles.featTitle}>Datos protegidos</h3>
          <p className={styles.featBody}>
            Su información se maneja de forma confidencial conforme a la
            normativa vigente.
          </p>
        </article>
      </section>

      <nav className={styles.linksSection} aria-label="Enlaces institucionales">
        {FOOTER_LINKS.map((link) => (
          <a key={link.label} href={link.href} className={styles.link}>
            {link.label}
          </a>
        ))}
        {/* Enlace persistente al consentimiento informado (Ley 18.331). */}
        <Link to="/consentimiento" className={styles.link}>
          Consentimiento informado y protección de datos
        </Link>
      </nav>

      <ConsentInicioModal
        open={consentOpen}
        onAccept={handleConsentAccept}
        onCancel={handleConsentCancel}
      />
    </div>
  );
}
