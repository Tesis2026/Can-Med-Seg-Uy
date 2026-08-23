import { z } from "zod";

/**
 * CAPTCHA del envío anónimo (RF-3.6). El desafío se genera y se valida en el
 * servidor: la web solo recibe la imagen y devuelve la respuesta escrita.
 */

export const captchaChallengeSchema = z.object({
  id: z.string().uuid(),
  /** Imagen del desafío como data URI (SVG) lista para un <img src>. */
  imageDataUrl: z.string().min(1),
  /** Cantidad de caracteres que se esperan, para el `maxlength` del campo. */
  length: z.number().int().positive(),
  expiresAt: z.string().datetime(),
});

export type CaptchaChallenge = z.infer<typeof captchaChallengeSchema>;

export const captchaAnswerInputSchema = z.object({
  challengeId: z.string().uuid(),
  answer: z.string().min(1).max(16),
});

export type CaptchaAnswerInput = z.infer<typeof captchaAnswerInputSchema>;

/** Comprobante de un desafío resuelto; se adjunta al envío del reporte. */
export const captchaVerificationSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string().datetime(),
});

export type CaptchaVerification = z.infer<typeof captchaVerificationSchema>;
