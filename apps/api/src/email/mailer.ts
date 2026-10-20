import { config } from "../config";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function brevoApiKey(): string | undefined {
  return config.BREVO_API_KEY?.trim() || undefined;
}

/** Parsea `Nombre <correo@dominio>` o un email suelto. */
export function parseFromAddress(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].replace(/^["']|["']$/g, "").trim();
    return { name: name || undefined, email: match[2].trim() };
  }
  return { email: from.trim() };
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(brevoApiKey());
}

function logEmailInsteadOfSending(message: EmailMessage): void {
  console.info(
    [
      "──── Email (sin BREVO_API_KEY: no se envía) ────",
      `Para: ${message.to}`,
      `Asunto: ${message.subject}`,
      "",
      message.text,
      "──────────────────────────────────────────────────",
    ].join("\n"),
  );
}

/**
 * Envío por la API HTTP de Brevo. Sin `BREVO_API_KEY`, solo escribe el mail en el log
 * (útil en local y en tests).
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = brevoApiKey();
  if (!apiKey) {
    logEmailInsteadOfSending(message);
    return;
  }

  const sender = parseFromAddress(config.EMAIL_FROM);
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: sender.name ? { name: sender.name, email: sender.email } : { email: sender.email },
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Brevo respondió ${response.status}: ${detail}`);
  }
}
