import {
  CONSENT_VERSION,
  anonymousSession,
  sessionSchema,
  type Session,
  type SignInInput,
} from "@canmedseg/shared";

import { ApiError, apiFetch, apiUrl } from "../../lib/api";

/**
 * Registro con GUB UY: deprecado momentáneamente (la web ya no lo enlaza).
 *
 * URL de inicio del login OIDC; se navega con `window.location` (redirect al IdP).
 */
export function loginUrl(returnTo?: string): string {
  const search = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  return apiUrl(`/api/auth/login${search}`);
}

export async function signIn(input: SignInInput): Promise<void> {
  try {
    await apiFetch("/api/auth/sign-in/email", {
      method: "POST",
      body: input,
      fallbackMessage: "No se pudo iniciar sesión. Intente nuevamente.",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError("Email o contraseña incorrectos.", 401);
    }
    throw error;
  }
}

export async function fetchSession(): Promise<Session> {
  try {
    return sessionSchema.parse(await apiFetch("/api/auth/session"));
  } catch (error) {
    // Sin API arriba la app sigue funcionando en modo visitante (RF-1.2).
    if (error instanceof ApiError && error.status === 401) return anonymousSession();
    throw error;
  }
}

export async function logout(): Promise<Session> {
  await apiFetch("/api/auth/logout", {
    method: "POST",
    fallbackMessage: "No se pudo cerrar la sesión.",
  });
  return anonymousSession();
}

/** Registra el consentimiento (Ley 18.331) aceptado en el primer login. */
export async function acceptConsent(): Promise<Session> {
  return sessionSchema.parse(
    await apiFetch("/api/auth/consent", {
      method: "POST",
      body: { version: CONSENT_VERSION },
      fallbackMessage: "No se pudo registrar el consentimiento.",
    }),
  );
}
