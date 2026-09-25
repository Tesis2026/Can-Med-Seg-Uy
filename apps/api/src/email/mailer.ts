import nodemailer, { type Transporter } from "nodemailer";

import { config } from "../config";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const smtpHost = config.SMTP_HOST?.trim();

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

export const isEmailDeliveryConfigured = Boolean(smtpHost);

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!smtpHost) {
    console.info(
      [
        "──── Email (SMTP sin configurar: no se envía) ────",
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
