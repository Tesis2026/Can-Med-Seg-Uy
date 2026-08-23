import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ConsentInicioModal, setConsentInicioAccepted } from "../../components/consent";
import { useSession } from "./SessionContext";

/**
 * Consentimiento informado en el **primer login** (Ley 18.331 — notas de cliente).
 * Bloquea la app hasta aceptar; si la persona no acepta, se cierra la sesión.
 * El mismo texto vuelve a pedirse al iniciar un reporte y queda accesible en
 * /consentimiento desde el menú.
 */
export function ConsentGate() {
  const { consentPending, acceptConsent, logout } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!consentPending) return null;

  async function handleAccept() {
    setBusy(true);
    setError(null);
    try {
      await acceptConsent();
      // Consentimiento de esta sesión de navegador: evita re-preguntar en el wizard.
      setConsentInicioAccepted();
    } catch (cause) {
      console.error("No se pudo registrar el consentimiento", cause);
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo registrar el consentimiento. Intente nuevamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline() {
    setBusy(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (cause) {
      console.error("No se pudo cerrar la sesión", cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsentInicioModal
      open
      dismissible={false}
      busy={busy}
      error={error}
      acceptLabel="Acepto y continúo"
      cancelLabel="No acepto (salir)"
      onAccept={() => void handleAccept()}
      onCancel={() => void handleDecline()}
    />
  );
}
