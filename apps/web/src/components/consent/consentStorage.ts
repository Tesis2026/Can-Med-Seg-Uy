/** Clave de sessionStorage: consentimiento de inicio aceptado (habilita el wizard). */
export const CONSENT_INICIO_STORAGE_KEY = "canmedseg_consent_inicio";

export function setConsentInicioAccepted(): void {
  sessionStorage.setItem(CONSENT_INICIO_STORAGE_KEY, "1");
}

export function hasConsentInicioAccepted(): boolean {
  return sessionStorage.getItem(CONSENT_INICIO_STORAGE_KEY) === "1";
}

export function clearConsentInicioAccepted(): void {
  sessionStorage.removeItem(CONSENT_INICIO_STORAGE_KEY);
}
