import type { EmailMessage } from "./mailer";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function button(url: string, label: string): string {
  return `<p style="margin:0 0 20px;">
            <a href="${url}" style="display:inline-block;background:#1a4a8c;color:#ffffff;text-decoration:none;padding:12px 20px;font-weight:600;border-radius:2px;">
              ${label}
            </a>
          </p>`;
}

/** Marco común de los emails (encabezado MSP, cuerpo y pie). */
function layout(body: string): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#ebebeb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#222222;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;">
      <tr>
        <td style="background:#1a4a8c;color:#ffffff;padding:16px 24px;font-size:14px;font-weight:600;">
          Ministerio de Salud Pública
        </td>
      </tr>
      <tr>
        <td style="padding:28px 24px;font-size:14px;line-height:1.55;">${body}
        </td>
      </tr>
      <tr>
        <td style="background:#e0e0e0;color:#666666;padding:12px 24px;font-size:12px;text-align:center;">
          Farmacovigilancia - Ministerio de Salud Pública
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function passwordResetEmail(input: {
  to: string;
  name: string;
  url: string;
  expiresInMinutes: number;
}): EmailMessage {
  const greeting = input.name ? `Hola ${input.name}:` : "Hola:";
  const subject = "Restablecer su contraseña — Farmacovigilancia MSP";

  const text = [
    greeting,
    "",
    "Recibimos un pedido para restablecer la contraseña de su cuenta en el sistema de",
    "Farmacovigilancia de Cannabis Medicinal del Ministerio de Salud Pública.",
    "",
    "Para elegir una contraseña nueva, abra este enlace:",
    input.url,
    "",
    `El enlace vence en ${input.expiresInMinutes} minutos y se puede usar una sola vez.`,
    "",
    "Si no pidió este cambio, ignore este mensaje: su contraseña actual sigue siendo válida.",
    "",
    "Farmacovigilancia - Ministerio de Salud Pública",
  ].join("\n");

  const url = escapeHtml(input.url);
  const html = layout(`
          <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 20px;">
            Recibimos un pedido para restablecer la contraseña de su cuenta en el sistema de
            Farmacovigilancia de Cannabis Medicinal.
          </p>
          ${button(url, "Elegir una contraseña nueva")}
          <p style="margin:0 0 12px;color:#666666;font-size:13px;">
            El enlace vence en ${input.expiresInMinutes} minutos y se puede usar una sola vez.
            Si el botón no funciona, copie esta dirección en el navegador:<br />
            <a href="${url}" style="color:#1a4a8c;word-break:break-all;">${url}</a>
          </p>
          <p style="margin:0;color:#666666;font-size:13px;">
            Si no pidió este cambio, ignore este mensaje: su contraseña actual sigue siendo válida.
          </p>`);

  return { to: input.to, subject, text, html };
}

export function invitationEmail(input: {
  to: string;
  inviterName: string;
  url: string;
  expiresInDays: number;
}): EmailMessage {
  const subject = "Invitación como investigador — Farmacovigilancia MSP";
  const inviter = input.inviterName.trim() || "El administrador del sistema";

  const text = [
    "Hola:",
    "",
    `${inviter} lo invitó a sumarse como investigador al sistema de Farmacovigilancia`,
    "de Cannabis Medicinal del Ministerio de Salud Pública.",
    "",
    "Para crear su cuenta, abra este enlace y complete sus datos:",
    input.url,
    "",
    `La invitación vence en ${input.expiresInDays} días y se puede usar una sola vez.`,
    "",
    "Si no esperaba esta invitación, ignore este mensaje.",
    "",
    "Farmacovigilancia - Ministerio de Salud Pública",
  ].join("\n");

  const url = escapeHtml(input.url);
  const html = layout(`
          <p style="margin:0 0 12px;">Hola:</p>
          <p style="margin:0 0 20px;">
            ${escapeHtml(inviter)} lo invitó a sumarse como <strong>investigador</strong> al sistema
            de Farmacovigilancia de Cannabis Medicinal del Ministerio de Salud Pública.
          </p>
          ${button(url, "Crear mi cuenta")}
          <p style="margin:0 0 12px;color:#666666;font-size:13px;">
            La invitación vence en ${input.expiresInDays} días y se puede usar una sola vez.
            Si el botón no funciona, copie esta dirección en el navegador:<br />
            <a href="${url}" style="color:#1a4a8c;word-break:break-all;">${url}</a>
          </p>
          <p style="margin:0;color:#666666;font-size:13px;">
            Si no esperaba esta invitación, ignore este mensaje.
          </p>`);

  return { to: input.to, subject, text, html };
}
