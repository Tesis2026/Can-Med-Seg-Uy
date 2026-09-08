import {
  ANALYTICS_CHART_LABELS,
  ANALYTICS_UNIT_LABELS,
  PERIODIC_FREQUENCY_LABELS,
  type AnalyticsFilters,
} from "@canmedseg/shared";
import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";

import { getDashboard } from "../analytics/analyticsRepository";
import { config } from "../config";
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
 * El armado del contenido está resuelto acá: se calculan los gráficos elegidos
 * por cada investigador sobre el período que le corresponde. El transporte de
 * correo llega en Semana 8; hasta entonces `deliver` deja el resumen en el log
 * y el envío queda registrado igual, con su período y su resultado.
 */

export type PeriodicReportContent = {
  recipient: PendingRecipient;
  periodLabel: string;
  reportCount: number;
  charts: { label: string; unit: string; total: number; top: string }[];
};

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
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
    .map((series) => {
      const top = [...series.slices].sort((a, b) => b.value - a.value)[0];
      return {
        label: ANALYTICS_CHART_LABELS[series.chart],
        unit: ANALYTICS_UNIT_LABELS[series.unit],
        total: series.total,
        top: top && top.value > 0 ? `${top.label} (${top.percentage} %)` : "sin datos",
      };
    });

  return {
    recipient,
    periodLabel: `${isoDay(recipient.period.start)} a ${isoDay(recipient.period.end)}`,
    reportCount: dashboard.headline.totalReports,
    charts,
  };
}

/** Punto de integración del correo. Semana 8 reemplaza el cuerpo por el envío real. */
async function deliver(
  log: FastifyBaseLogger,
  content: PeriodicReportContent,
): Promise<void> {
  if (!content.recipient.email) {
    throw new Error("El investigador no tiene correo electrónico registrado");
  }
  log.info(
    {
      to: content.recipient.email,
      frecuencia: PERIODIC_FREQUENCY_LABELS[content.recipient.frequency],
      periodo: content.periodLabel,
      reportes: content.reportCount,
      graficos: content.charts.map((chart) => chart.label),
    },
    "Reporte periódico listo para enviar",
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
