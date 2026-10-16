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

export type PeriodicReportChart = {
  label: string;
  unit: string;
  total: number;
  /** Categorías con más casos, ya ordenadas de mayor a menor. */
  rows: { label: string; value: number; percentage: number }[];
};

export function periodicReportEmail(input: {
  to: string;
  name: string;
  frequencyLabel: string;
  periodLabel: string;
  reportCount: number;
  charts: PeriodicReportChart[];
  dashboardUrl: string;
}): EmailMessage {
  const greeting = input.name ? `Hola ${input.name}:` : "Hola:";
  const subject = `Reporte ${input.frequencyLabel.toLowerCase()} de farmacovigilancia (${input.periodLabel})`;
  const reports = input.reportCount === 1 ? "1 reporte" : `${input.reportCount} reportes`;

  const text = [
    greeting,
    "",
    `Este es su reporte ${input.frequencyLabel.toLowerCase()} del sistema de Farmacovigilancia`,
    `de Cannabis Medicinal. Período: ${input.periodLabel}. Reportes del período: ${reports}.`,
    "",
    ...input.charts.flatMap((chart) => [
      `${chart.label} (${chart.total} ${chart.unit}):`,
      ...(chart.rows.length
        ? chart.rows.map((row) => `  - ${row.label}: ${row.value} (${row.percentage} %)`)
        : ["  - Sin datos en el período"]),
      "",
    ]),
    "Para ver los gráficos completos, abra el dashboard con el período ya filtrado:",
    input.dashboardUrl,
    "",
    "Puede cambiar la frecuencia o los gráficos incluidos desde «Reportes periódicos».",
    "",
    "Farmacovigilancia - Ministerio de Salud Pública",
  ].join("\n");

  const chartsHtml = input.charts
    .map((chart) => {
      const rows = chart.rows.length
        ? chart.rows
            .map(
              (row) => `
              <tr>
                <td style="padding:4px 0;">${escapeHtml(row.label)}</td>
                <td style="padding:4px 0;text-align:right;white-space:nowrap;">${row.value} (${row.percentage} %)</td>
              </tr>`,
            )
            .join("")
        : `
              <tr><td colspan="2" style="padding:4px 0;color:#666666;">Sin datos en el período</td></tr>`;
      return `
          <p style="margin:16px 0 4px;font-weight:600;">
            ${escapeHtml(chart.label)}
            <span style="font-weight:400;color:#666666;">· ${chart.total} ${escapeHtml(chart.unit)}</span>
          </p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;border-top:1px solid #e0e0e0;">${rows}
          </table>`;
    })
    .join("");

  const url = escapeHtml(input.dashboardUrl);
  const html = layout(`
          <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 4px;">
            Este es su reporte ${escapeHtml(input.frequencyLabel.toLowerCase())} del sistema de
            Farmacovigilancia de Cannabis Medicinal.
          </p>
          <p style="margin:0 0 8px;color:#666666;font-size:13px;">
            Período: ${escapeHtml(input.periodLabel)} · Reportes del período: ${escapeHtml(reports)}
          </p>${chartsHtml}
          <p style="margin:24px 0 20px;"></p>
          ${button(url, "Ver el dashboard del período")}
          <p style="margin:0;color:#666666;font-size:13px;">
            Puede cambiar la frecuencia o los gráficos incluidos desde «Reportes periódicos».
          </p>`);

  return { to: input.to, subject, text, html };
}
