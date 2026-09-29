import nodemailer, { type Transporter } from "nodemailer";

import { config } from "../config";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const brevoApiKey = config.BREVO_API_KEY?.trim();
const smtpHost = config.SMTP_HOST?.trim();

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const user = config.SMTP_USER?.trim();
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: user ? { user, pass: config.SMTP_PASS ?? "" } : undefined,
    });
  }
  return transporter;
}

/** `"Nombre <correo@dominio>"` o solo `"correo@dominio"`. */
function parseSender(from: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (!match) return { email: from.trim() };
  const name = match[1]?.replace(/^"|"$/g, "").trim();
  return { name: name || undefined, email: match[2]!.trim() };
}

async function sendWithBrevo(apiKey: string, message: EmailMessage): Promise<void> {
  const response = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: parseSender(config.EMAIL_FROM),
      to: [{ email: message.to }],
      subject: message.subject,
      textContent: message.text,
      htmlContent: message.html,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Brevo respondió ${response.status}: ${detail}`);
  }
}

export const isEmailDeliveryConfigured = Boolean(brevoApiKey || smtpHost);

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (brevoApiKey) {
    await sendWithBrevo(brevoApiKey, message);
    return;
  }

  if (!smtpHost) {
    console.info(
      [
        "──── Email (envío sin configurar: no se envía) ────",
        `Para: ${message.to}`,
        `Asunto: ${message.subject}`,
        "",
        message.text,
        "──────────────────────────────────────────────────",
      ].join("\n"),
    );
    return;
  }

  await getTransporter().sendMail({
    from: config.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
