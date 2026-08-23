import {
  HEALTH_PROFESSION_SUBTYPE_LABELS,
  ROLE_LABELS,
  Role,
  type NotifierStats,
} from "@canmedseg/shared";
import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";
import { fetchNotifierStats } from "../features/reporte/reportApi";

import styles from "./InicioPage.module.css";

const numberFormat = new Intl.NumberFormat("es-UY");

/**
 * Frame «Home usuario común» del .pen: bienvenida, estadísticas de incentivo y
 * accesos a reportar, borradores (RF-4.5) e historial (RF-6.1).
 */
export function InicioPage() {
  const { session, user, loading } = useSession();

  if (loading) {
    return <p className={styles.loading}>Cargando su sesión…</p>;
  }

  if (!session.authenticated || !user) {
    return <Navigate to="/login?returnTo=%2Finicio" replace />;
  }

  return (
    <div className={styles.page}>
      <section className={styles.welcome}>
        <p className={styles.welcomeLabel}>Bienvenido/a</p>
        <h1 className={styles.welcomeName}>{user.displayName}</h1>
        <ul className={styles.roleChips}>
          {user.roles.map((entry) => (
            <li key={entry.role} className={styles.chip}>
              {ROLE_LABELS[entry.role]}
              {entry.role === Role.ProfesionalSalud && entry.healthProfessionSubtype
                ? ` · ${HEALTH_PROFESSION_SUBTYPE_LABELS[entry.healthProfessionSubtype]}`
                : ""}
            </li>
          ))}
        </ul>
      </section>

      <SystemStats />

      <h2 className={styles.sectionTitle}>Reportes</h2>

      <div className={styles.grid}>
        <ActionCard
          to="/reporte?nuevo=1"
          icon={<IconNuevo />}
          title="Nuevo reporte"
          description="Iniciar un nuevo reporte."
        />
        <ActionCard
          to="/formularios-en-progreso"
          icon={<IconBorrador />}
          title="Formularios en progreso"
          description="Continuar reportes guardados sin enviar."
        />
        <ActionCard
          to="/historial"
          icon={<IconHistorial />}
          title="Historial de reportes"
          description="Consultar reportes enviados anteriormente."
        />
      </div>
    </div>
  );
}

/** Estadísticas del sistema: reportes propios y total nacional (notas de cliente). */
function SystemStats() {
  const [stats, setStats] = useState<NotifierStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchNotifierStats();
        if (!cancelled) setStats(result);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null;

  const total = stats ? numberFormat.format(stats.totalSubmitted) : "—";
  const own = stats ? numberFormat.format(stats.ownSubmitted) : "—";
  const totalFrase =
    stats?.totalSubmitted === 1
      ? "El sistema ya registra 1 reporte de evento adverso en Uruguay."
      : `El sistema ya registra ${total} reportes de eventos adversos en Uruguay.`;

  return (
    <section className={styles.statsCard}>
      <h2 className={styles.statsTitle}>Estadísticas del sistema</h2>
      <div className={styles.statsRow}>
        <div className={styles.statTile}>
          <p className={styles.statValue}>{own}</p>
          <p className={styles.statLabel}>Sus reportes</p>
        </div>
        <div className={styles.statTile}>
          <p className={styles.statValue}>{total}</p>
          <p className={styles.statLabel}>Reportes en Uruguay</p>
        </div>
      </div>
      <p className={styles.statsLead}>
        ¡Gracias por contribuir! Cada reporte fortalece la farmacovigilancia nacional.
      </p>
      <p className={styles.statsText}>
        {totalFrase} Cada reporte ayuda a mejorar la farmacovigilancia.
      </p>
    </section>
  );
}

type ActionCardProps = {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
};

function ActionCard({ to, icon, title, description }: ActionCardProps) {
  return (
    <Link className={styles.card} to={to}>
      <span className={styles.cardIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.cardTitle}>{title}</span>
      <span className={styles.cardText}>{description}</span>
      <span className={styles.cardFoot} aria-hidden="true">
        <IconArrow />
      </span>
    </Link>
  );
}

function IconNuevo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M12 12v5M9.5 14.5h5" />
    </svg>
  );
}

function IconBorrador() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20h16M5 15.5 15.5 5a2.1 2.1 0 0 1 3 3L8 18.5l-4 1z" />
    </svg>
  );
}

function IconHistorial() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V9H8" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}
