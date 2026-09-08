import {
  ANALYTICS_CHARTS,
  ANALYTICS_CHART_LABELS,
  PERIODIC_FREQUENCIES,
  PERIODIC_FREQUENCY_LABELS,
  Permission,
  hasPermission,
  type AnalyticsChart,
  type PeriodicFrequency,
  type PeriodicPreferences,
} from "@canmedseg/shared";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import {
  fetchPeriodicPreferences,
  savePeriodicPreferences,
} from "../features/analytics/analyticsApi";
import { useSession } from "../features/auth/SessionContext";

import styles from "../features/analytics/analytics.module.css";

function formatDate(value: string | null): string {
  if (!value) return "todavía sin envíos";
  return new Date(value).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Frame «Configuración de reportes periódicos» del diseño (RF-8.3, RF-8.4). */
export function ReportesPeriodicosPage() {
  const { session, loading: sessionLoading } = useSession();
  const [preferences, setPreferences] = useState<PeriodicPreferences | null>(null);
  const [frequency, setFrequency] = useState<PeriodicFrequency>("mensual");
  const [charts, setCharts] = useState<AnalyticsChart[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticated = session.authenticated;
  const puedeRecibir = hasPermission(
    session.permissions,
    Permission.PeriodicReportsReceive,
  );

  useEffect(() => {
    if (!authenticated || !puedeRecibir) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchPeriodicPreferences();
        if (cancelled) return;
        setPreferences(result);
        setFrequency(result.frequency);
        setCharts(result.charts);
        setEnabled(result.enabled);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "No se pudieron cargar las preferencias.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, puedeRecibir]);

  if (sessionLoading) return <p className={styles.state}>Cargando…</p>;
  if (!authenticated) {
    return <Navigate to="/login?returnTo=%2Freportes-periodicos" replace />;
  }
  if (!puedeRecibir) return <Navigate to="/" replace />;

  function toggleChart(chart: AnalyticsChart) {
    setSaved(false);
    setCharts((previous) =>
      previous.includes(chart)
        ? previous.filter((entry) => entry !== chart)
        : [...previous, chart],
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await savePeriodicPreferences({ frequency, charts, enabled });
      setPreferences(result);
      setCharts(result.charts);
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudieron guardar las preferencias.",
      );
    } finally {
      setSaving(false);
    }
  }

  const elegidos = charts.length === 0 ? ANALYTICS_CHARTS.length : charts.length;

  return (
    <div className={styles.page}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Reportes periódicos</h1>
        <p className={styles.subtitle}>
          Configure con qué frecuencia recibe el informe por correo y qué gráficos incluye.
        </p>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.exportCard}>
        <h2 className={styles.sectionTitle}>Frecuencia de envío</h2>
        <div className={styles.formatRow} role="radiogroup" aria-label="Frecuencia">
          {PERIODIC_FREQUENCIES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={frequency === option}
              className={`${styles.formatOption} ${frequency === option ? styles.formatActive : ""}`}
              onClick={() => {
                setFrequency(option);
                setSaved(false);
              }}
            >
              {PERIODIC_FREQUENCY_LABELS[option]}
            </button>
          ))}
        </div>

        <h2 className={styles.sectionTitle}>Gráficos a incluir</h2>
        <ul className={styles.chartChecklist}>
          {ANALYTICS_CHARTS.map((chart) => (
            <li key={chart}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={charts.includes(chart)}
                  onChange={() => toggleChart(chart)}
                />
                {ANALYTICS_CHART_LABELS[chart]}
              </label>
            </li>
          ))}
        </ul>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
              setSaved(false);
            }}
          />
          Deseo recibir el reporte periódico por correo electrónico
        </label>

        <p className={styles.exportNote}>
          {enabled
            ? `Recibirá un reporte ${PERIODIC_FREQUENCY_LABELS[frequency].toLowerCase()} con ${elegidos} gráficos.`
            : "No recibirá reportes periódicos mientras esta opción esté desmarcada."}
          {charts.length === 0
            ? " Si no elige ninguno, el informe llega con todos los gráficos."
            : ""}
        </p>

        {preferences ? (
          <p className={styles.exportNote}>
            Último envío: {formatDate(preferences.lastSentAt)}. Próximo previsto:{" "}
            {preferences.nextRunOn ?? "sin definir"}.
          </p>
        ) : null}

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? "Guardando…" : "Guardar preferencias"}
        </button>

        {saved ? (
          <p className={styles.savedNote} role="status">
            Preferencias guardadas.
          </p>
        ) : null}
      </section>
    </div>
  );
}
