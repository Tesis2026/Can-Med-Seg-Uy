import {
  ANALYTICS_CHART_LABELS,
  ANALYTICS_UNIT_LABELS,
  PERIODIC_FREQUENCY_LABELS,
  analyticsFiltersToQuery,
  type AnalyticsFilters,
} from "@canmedseg/shared";
import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";

import { getDashboard } from "../analytics/analyticsRepository";
import { config } from "../config";
import { sendEmail } from "../email/mailer";
import { periodicReportEmail, type PeriodicReportChart } from "../email/templates";
import {
  claimDelivery,
  listDueRecipients,
  markDeliveryFailed,
  markDeliverySent,
  type PendingRecipient,
} from "./periodicRepository";

/**
 * Reportes periódicos automáticos (RF-8.3, RF-8.12, RF-8.14).
 *
 * Para cada investigador se calculan los gráficos que eligió sobre el período
 * que le corresponde y se le envían por correo. Cada envío queda registrado con
 * su período y su resultado.
 */

export type PeriodicReportContent = {
  recipient: PendingRecipient;
  filters: AnalyticsFilters;
  periodLabel: string;
  reportCount: number;
  charts: PeriodicReportChart[];
};

/** Categorías por gráfico que se listan en el correo; el resto queda en el dashboard. */
const ROWS_PER_CHART = 5;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function displayDay(date: Date): string {
  return isoDay(date).split("-").reverse().join("/");
}

export async function buildPeriodicReport(
  pool: Pool,
  recipient: PendingRecipient,
): Promise<PeriodicReportContent> {
  const filters: AnalyticsFilters = {
    dateField: "notificacion",
    from: isoDay(recipient.period.start),
    to: isoDay(recipient.period.end),
  };

  const dashboard = await getDashboard(pool, filters);
  const selected = new Set(recipient.charts);

  const charts = dashboard.series
    .filter((series) => selected.has(series.chart))
    .map((series) => ({
      label: ANALYTICS_CHART_LABELS[series.chart],
      unit: ANALYTICS_UNIT_LABELS[series.unit],
      total: series.total,
      rows: series.slices
        .filter((slice) => slice.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, ROWS_PER_CHART)
        .map(({ label, value, percentage }) => ({ label, value, percentage })),
    }));

  return {
    recipient,
    filters,
    periodLabel: `${displayDay(recipient.period.start)} al ${displayDay(recipient.period.end)}`,
    reportCount: dashboard.headline.totalReports,
    charts,
  };
}

async function deliver(
  log: FastifyBaseLogger,
  content: PeriodicReportContent,
): Promise<void> {
  const { recipient } = content;
  if (!recipient.email) {
    throw new Error("El investigador no tiene correo electrónico registrado");
  }
  const dashboardUrl = new URL("/dashboard", config.WEB_BASE_URL);
  for (const [key, value] of Object.entries(analyticsFiltersToQuery(content.filters))) {
    dashboardUrl.searchParams.set(key, value);
  }
  await sendEmail(
    periodicReportEmail({
      to: recipient.email,
      name: recipient.displayName,
      frequencyLabel: PERIODIC_FREQUENCY_LABELS[recipient.frequency],
      periodLabel: content.periodLabel,
      reportCount: content.reportCount,
      charts: content.charts,
      dashboardUrl: dashboardUrl.toString(),
    }),
  );
  log.info(
    { to: recipient.email, periodo: content.periodLabel, reportes: content.reportCount },
    "Reporte periódico enviado",
  );
}

/** Una corrida del planificador. Devuelve cuántos envíos se concretaron. */
export async function runPeriodicReports(
  pool: Pool,
  log: FastifyBaseLogger,
  now = new Date(),
): Promise<number> {
  const recipients = await listDueRecipients(pool, now);
  let sent = 0;

  for (const recipient of recipients) {
    const deliveryId = await claimDelivery(pool, recipient);
    // Ya existía un envío para este período: no se duplica (RF-8.14).
    if (!deliveryId) continue;

    try {
      const content = await buildPeriodicReport(pool, recipient);
      await deliver(log, content);
      await markDeliverySent(pool, deliveryId, recipient.userId, content.reportCount);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      log.error({ error, userId: recipient.userId }, "Falló el reporte periódico");
      await markDeliveryFailed(pool, deliveryId, message);
    }
  }

  return sent;
}

/** Arranca la corrida periódica; se detiene al cerrar la aplicación. */
export function startPeriodicScheduler(
  pool: Pool,
  log: FastifyBaseLogger,
): () => void {
  if (!config.PERIODIC_REPORTS_ENABLED) {
    log.info("Planificador de reportes periódicos deshabilitado por configuración");
    return () => undefined;
  }

  const intervalMs = config.PERIODIC_REPORTS_INTERVAL_MINUTES * 60 * 1000;
  const timer = setInterval(() => {
    void runPeriodicReports(pool, log).catch((error: unknown) => {
      log.error({ error }, "Error en la corrida de reportes periódicos");
    });
  }, intervalMs);

  // No debe mantener vivo el proceso si no queda nada más por hacer.
  timer.unref();
  log.info(
    { cadaMinutos: config.PERIODIC_REPORTS_INTERVAL_MINUTES },
    "Planificador de reportes periódicos activo",
  );
  return () => clearInterval(timer);
}
