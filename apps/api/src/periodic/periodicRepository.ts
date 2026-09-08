import {
  ANALYTICS_CHARTS,
  PERIODIC_FREQUENCY_MONTHS,
  PeriodicFrequency,
  type AnalyticsChart,
  type PeriodicPreferences,
  type SavePeriodicPreferences,
} from "@canmedseg/shared";
import type { Pool } from "pg";

/**
 * Preferencias y planificación de los reportes periódicos (RF-8.3, RF-8.4,
 * RF-8.11 a RF-8.14).
 */

type PreferencesRow = {
  frequency: PeriodicFrequency;
  charts: string[];
  enabled: boolean;
  last_sent_at: Date | null;
};

export type PeriodicPeriod = {
  start: Date;
  end: Date;
};

/** Sin fila configurada el investigador recibe todos los gráficos (RF-8.13). */
const DEFAULT_PREFERENCES: PreferencesRow = {
  frequency: PeriodicFrequency.Mensual,
  charts: [],
  enabled: true,
  last_sent_at: null,
};

function toCharts(stored: string[]): AnalyticsChart[] {
  const known = new Set<string>(ANALYTICS_CHARTS);
  const selected = stored.filter((chart) => known.has(chart)) as AnalyticsChart[];
  return selected.length > 0 ? selected : [...ANALYTICS_CHARTS];
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Período que cubre el próximo envío: desde el último enviado hasta hoy. */
export function periodFor(
  frequency: PeriodicFrequency,
  lastSentAt: Date | null,
  now = new Date(),
): PeriodicPeriod {
  const months = PERIODIC_FREQUENCY_MONTHS[frequency];
  const start = lastSentAt ? new Date(lastSentAt) : new Date(now);
  if (!lastSentAt) start.setMonth(start.getMonth() - months);
  return { start, end: now };
}

/**
 * Fecha del próximo envío. Quien nunca recibió uno entra en la corrida siguiente
 * con el período completo hacia atrás; después se cuenta desde el último envío
 * (RF-8.11).
 */
export function nextRunOn(
  frequency: PeriodicFrequency,
  lastSentAt: Date | null,
): Date {
  if (!lastSentAt) return new Date();
  const next = new Date(lastSentAt);
  next.setMonth(next.getMonth() + PERIODIC_FREQUENCY_MONTHS[frequency]);
  return next;
}

/**
 * Si corresponde enviar en esta corrida. Es una decisión aparte de `nextRunOn`,
 * que solo sirve para mostrar la fecha en pantalla: quien nunca recibió un
 * reporte vence siempre, sin depender de la comparación de relojes.
 */
export function isDue(
  frequency: PeriodicFrequency,
  lastSentAt: Date | null,
  now = new Date(),
): boolean {
  if (!lastSentAt) return true;
  return nextRunOn(frequency, lastSentAt).getTime() <= now.getTime();
}

function toPreferences(row: PreferencesRow): PeriodicPreferences {
  return {
    frequency: row.frequency,
    charts: toCharts(row.charts),
    enabled: row.enabled,
    lastSentAt: row.last_sent_at ? row.last_sent_at.toISOString() : null,
    nextRunOn: isoDay(nextRunOn(row.frequency, row.last_sent_at)),
  };
}

export async function getPreferences(
  pool: Pool,
  userId: string,
): Promise<PeriodicPreferences> {
  const result = await pool.query<PreferencesRow>(
    `SELECT frequency, charts, enabled, last_sent_at
       FROM periodic_report_preferences WHERE user_id = $1`,
    [userId],
  );
  return toPreferences(result.rows[0] ?? DEFAULT_PREFERENCES);
}

export async function savePreferences(
  pool: Pool,
  userId: string,
  input: SavePeriodicPreferences,
): Promise<PeriodicPreferences> {
  const result = await pool.query<PreferencesRow>(
    `INSERT INTO periodic_report_preferences (user_id, frequency, charts, enabled, updated_at)
          VALUES ($1, $2, $3::text[], $4, now())
     ON CONFLICT (user_id) DO UPDATE
            SET frequency = EXCLUDED.frequency,
                charts = EXCLUDED.charts,
                enabled = EXCLUDED.enabled,
                updated_at = now()
      RETURNING frequency, charts, enabled, last_sent_at`,
    [userId, input.frequency, input.charts, input.enabled],
  );
  const row = result.rows[0];
  if (!row) throw new Error("PostgreSQL no devolvió las preferencias guardadas");
  return toPreferences(row);
}

export type PendingRecipient = {
  userId: string;
  email: string | null;
  displayName: string;
  frequency: PeriodicFrequency;
  charts: AnalyticsChart[];
  period: PeriodicPeriod;
};

/**
 * Investigadores a los que les toca un envío. Incluye a quienes nunca
 * configuraron preferencias, que reciben la frecuencia por defecto (RF-8.11).
 */
export async function listDueRecipients(
  pool: Pool,
  now = new Date(),
): Promise<PendingRecipient[]> {
  const result = await pool.query<{
    user_id: string;
    email: string | null;
    display_name: string | null;
    frequency: PeriodicFrequency | null;
    charts: string[] | null;
    enabled: boolean | null;
    last_sent_at: Date | null;
  }>(
    `SELECT u.id AS user_id,
            u.email,
            u.display_name,
            p.frequency,
            p.charts,
            p.enabled,
            p.last_sent_at
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id AND ur.role IN ('investigador', 'msp')
       LEFT JOIN periodic_report_preferences p ON p.user_id = u.id
      WHERE u.disabled_at IS NULL
        AND coalesce(p.enabled, true)
      GROUP BY u.id, u.email, u.display_name, p.frequency, p.charts, p.enabled, p.last_sent_at`,
  );

  const due: PendingRecipient[] = [];
  for (const row of result.rows) {
    const frequency = row.frequency ?? DEFAULT_PREFERENCES.frequency;
    if (!isDue(frequency, row.last_sent_at, now)) continue;

    due.push({
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name ?? row.email ?? "Investigador",
      frequency,
      charts: toCharts(row.charts ?? []),
      period: periodFor(frequency, row.last_sent_at, now),
    });
  }
  return due;
}

/**
 * Reserva el envío del período. Devuelve `null` si ya existía, con lo que un
 * reintento nunca duplica el correspondiente al mismo período (RF-8.14).
 */
export async function claimDelivery(
  pool: Pool,
  recipient: PendingRecipient,
): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO periodic_report_deliveries
            (user_id, period_start, period_end, frequency, charts)
          VALUES ($1, $2::date, $3::date, $4, $5::text[])
     ON CONFLICT (user_id, period_start, period_end) DO NOTHING
       RETURNING id`,
    [
      recipient.userId,
      isoDay(recipient.period.start),
      isoDay(recipient.period.end),
      recipient.frequency,
      recipient.charts,
    ],
  );
  return result.rows[0]?.id ?? null;
}

export async function markDeliverySent(
  pool: Pool,
  deliveryId: string,
  userId: string,
  reportCount: number,
): Promise<void> {
  await pool.query(
    `UPDATE periodic_report_deliveries
        SET status = 'enviado', sent_at = now(), attempts = attempts + 1,
            report_count = $2, last_error = NULL
      WHERE id = $1`,
    [deliveryId, reportCount],
  );
  await pool.query(
    `INSERT INTO periodic_report_preferences (user_id, last_sent_at)
          VALUES ($1, now())
     ON CONFLICT (user_id) DO UPDATE SET last_sent_at = now()`,
    [userId],
  );
}

export async function markDeliveryFailed(
  pool: Pool,
  deliveryId: string,
  error: string,
): Promise<void> {
  await pool.query(
    `UPDATE periodic_report_deliveries
        SET status = 'fallido', attempts = attempts + 1, last_error = $2
      WHERE id = $1`,
    [deliveryId, error.slice(0, 500)],
  );
}

/** Envíos que fallaron y siguen pendientes de reintento. */
export async function listFailedDeliveries(pool: Pool): Promise<
  { id: string; userId: string; attempts: number; lastError: string | null }[]
> {
  const result = await pool.query<{
    id: string;
    user_id: string;
    attempts: number;
    last_error: string | null;
  }>(
    `SELECT id, user_id, attempts, last_error
       FROM periodic_report_deliveries
      WHERE status = 'fallido'
      ORDER BY created_at DESC
      LIMIT 50`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    attempts: row.attempts,
    lastError: row.last_error,
  }));
}
