import type { ReactNode } from "react";
import { Link, Outlet } from "react-router-dom";

import styles from "./AppShell.module.css";

export type AppShellProps = {
  /** Título del header (p. ej. "Consentimiento"). Default: Reporte FV Uruguay */
  title?: string;
  /** Muestra el control "Menú" a la derecha. Landing lo oculta (false). Default: true */
  showMenu?: boolean;
  children?: ReactNode;
};

export function AppShell({
  title = "Reporte FV Uruguay",
  showMenu = true,
  children,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.leftHdr}>
            <Link to="/" className={styles.logoBox} aria-label="Inicio">
              <span className={styles.logoText}>
                Ministerio de Salud Pública
              </span>
            </Link>
            <span className={styles.headerTitle}>{title}</span>
          </div>
          {showMenu ? (
            <div className={styles.menuArea}>
              <button type="button" className={styles.menuBtn} aria-label="Menú">
                Menú
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className={styles.main}>{children ?? <Outlet />}</main>

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          Farmacovigilancia - Ministerio de Salud Pública
        </p>
        <p className={styles.footerPowered}>Powered by VigiFlow eForms</p>
      </footer>
    </div>
  );
}
