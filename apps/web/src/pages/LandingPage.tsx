import { Permission, hasPermission } from "@canmedseg/shared";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ConsentInicioModal,
  setConsentInicioAccepted,
} from "../components/consent";
import { Button } from "../components/ui/Button";
import { useSession } from "../features/auth/SessionContext";

import styles from "./LandingPage.module.css";

export function LandingPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  // Reporte anónimo: desactivado momentáneamente (el visitante no tiene `ReportSubmit`).
  const puedeReportar = hasPermission(session.permissions, Permission.ReportSubmit);

  const [consentOpen, setConsentOpen] = useState(false);

  function handleReportClick() {
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
          Farmacovigilancia de cannabis medicinal
        </h2>
        <p className={`${styles.heroBody} ${styles.heroBodyDesktop}`}>
          Gestión y análisis de reportes de farmacovigilancia sobre cannabis medicinal en Uruguay.
        </p>
        <p className={`${styles.heroBody} ${styles.heroBodyMobile}`}>
          Gestión y análisis de reportes de farmacovigilancia sobre cannabis medicinal en Uruguay.
        </p>
        <div className={styles.btnRow}>
          {puedeReportar ? (
            <Button variant="primary" type="button" onClick={handleReportClick}>
              Reportar evento adverso
            </Button>
          ) : null}
          {/* Registro con GUB UY: deprecado momentáneamente. Texto anterior: «Iniciar sesión con GUB UY». */}
          <Button variant="secondary" to="/login">
            Iniciar sesión
          </Button>
        </div>
      </section>


      <ConsentInicioModal
        open={consentOpen}
        onAccept={handleConsentAccept}
        onCancel={handleConsentCancel}
      />
    </div>
  );
}
