import {
  captchaChallengeSchema,
  captchaVerificationSchema,
  type CaptchaChallenge,
  type CaptchaVerification,
} from "@canmedseg/shared";

import { apiFetch } from "../../lib/api";

export async function requestChallenge(): Promise<CaptchaChallenge> {
  return captchaChallengeSchema.parse(
    await apiFetch("/api/captcha/challenge", {
      method: "POST",
      fallbackMessage: "No se pudo generar la verificación de seguridad.",
    }),
  );
}

// POST /api/captcha/verify
export async function solveChallenge(
  challengeId: string,
  answer: string,
): Promise<CaptchaVerification> {
  return captchaVerificationSchema.parse(
    await apiFetch("/api/captcha/verify", {
      method: "POST",
      body: { challengeId, answer },
      fallbackMessage: "No se pudo verificar el código de seguridad.",
    }),
  );
}
