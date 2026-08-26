import { ROLE_LABELS, visibleRoles } from "@canmedseg/shared";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";
import { clearReportDraftStorage } from "../features/reporte/useReportDraft";

import styles from "./AppShell.module.css";

export type AppShellProps = {
  /** Muestra el botón de menú a la derecha. La landing lo oculta. Default: true */
  showMenu?: boolean;
  children?: ReactNode;
};

export function AppShell({ showMenu = true, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.leftHdr}>
            <Link to="/" className={styles.logoBox} aria-label="Inicio">
              <span className={styles.logoText}>Ministerio de Salud Pública</span>
            </Link>
          </div>
          {showMenu ? <HeaderMenu /> : null}
        </div>
      </header>

      <main className={styles.main}>{children ?? <Outlet />}</main>

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          Farmacovigilancia - Ministerio de Salud Pública
        </p>
      </footer>
    </div>
  );
}

/**
 * Menú del header. Además de la navegación, expone el enlace permanente al
 * consentimiento informado exigido por las notas de cliente (Ley 18.331).
 */
function HeaderMenu() {
  const { session, user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    try {
      await logout();
      // El formulario en curso queda en la pestaña: no debe heredarlo quien entre después.
      clearReportDraftStorage();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("No se pudo cerrar la sesión", error);
    } finally {
      setOpen(false);
    }
  }

  const roleLabels = visibleRoles(user?.roles.map((entry) => entry.role) ?? []).map(
    (role) => ROLE_LABELS[role],
  );

  return (
    <div className={styles.menuArea} ref={containerRef}>
      <button
        type="button"
        className={styles.menuBtn}
        aria-label="Menú"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((previous) => !previous)}
      >
        <svg
          className={styles.menuIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open ? (
        <div className={styles.menuPanel} role="menu">
          {user ? (
            <div className={styles.menuUser}>
              <p className={styles.menuUserName}>{user.displayName}</p>
              {roleLabels.length > 0 ? (
                <p className={styles.menuUserRoles}>{roleLabels.join(" · ")}</p>
              ) : null}
            </div>
          ) : (
            <div className={styles.menuUser}>
              <p className={styles.menuUserName}>Visitante</p>
              <p className={styles.menuUserRoles}>
                Puede reportar sin iniciar sesión; sin borradores ni historial.
              </p>
            </div>
          )}

          <Link className={styles.menuItem} role="menuitem" to="/">
            Inicio
          </Link>
          <Link className={styles.menuItem} role="menuitem" to="/reporte?nuevo=1">
            Nuevo reporte
          </Link>
          {session.authenticated ? (
            <>
              <Link
                className={styles.menuItem}
                role="menuitem"
                to="/formularios-en-progreso"
              >
                Formularios en progreso
              </Link>
              <Link className={styles.menuItem} role="menuitem" to="/historial">
                Historial de reportes
              </Link>
            </>
          ) : null}

          {session.authenticated ? (
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              onClick={() => void handleLogout()}
            >
              Cerrar sesión
            </button>
          ) : (
            <Link
              className={styles.menuItem}
              role="menuitem"
              to={`/login?returnTo=${encodeURIComponent(location.pathname)}`}
            >
              Iniciar sesión con GUB UY
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
