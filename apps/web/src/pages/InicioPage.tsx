import { HEALTH_PROFESSION_SUBTYPE_LABELS, ROLE_LABELS, Role } from "@canmedseg/shared";
import { Link, Navigate } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";

import styles from "./InicioPage.module.css";

/**
 * Destino del login: muestra la identidad y los roles de la sesión.
 * Las homes por rol (bandeja, dashboard, historial, admin) llegan en las
 * semanas siguientes del plan.
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

      <div className={styles.actions}>
        <Link className={styles.primary} to="/reporte">
          Reportar evento adverso
        </Link>
        <Link className={styles.secondary} to="/consentimiento">
          Consentimiento informado
        </Link>
      </div>
    </div>
  );
}
