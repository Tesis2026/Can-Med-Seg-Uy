import { HEALTH_PROFESSION_SUBTYPE_LABELS, ROLE_LABELS, Role } from "@canmedseg/shared";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";

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
              <span className={styles.logoText}>Ministerio de Salud Pública</span>
            </Link>
            <span className={styles.headerTitle}>{title}</span>
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
      navigate("/", { replace: true });
    } catch (error) {
      console.error("No se pudo cerrar la sesión", error);
    } finally {
      setOpen(false);
    }
  }

  const healthProSubtype = user?.roles.find((entry) => entry.role === Role.ProfesionalSalud)
    ?.healthProfessionSubtype;

  return (
    <div className={styles.menuArea} ref={containerRef}>
      <button
        type="button"
        className={styles.menuBtn}
        aria-label="Menú"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        Menú
      </button>

      {open ? (
        <div className={styles.menuPanel} role="menu">
          {user ? (
            <div className={styles.menuUser}>
              <p className={styles.menuUserName}>{user.displayName}</p>
              <p className={styles.menuUserRoles}>
                {user.roles
                  .map((entry) =>
                    entry.role === Role.ProfesionalSalud && entry.healthProfessionSubtype
                      ? `${ROLE_LABELS[entry.role]} (${HEALTH_PROFESSION_SUBTYPE_LABELS[entry.healthProfessionSubtype]})`
                      : ROLE_LABELS[entry.role],
                  )
                  .join(" · ")}
              </p>
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
          {session.authenticated ? (
            <Link className={styles.menuItem} role="menuitem" to="/inicio">
              Mi inicio
            </Link>
          ) : null}
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
          <Link className={styles.menuItem} role="menuitem" to="/consentimiento">
            Consentimiento informado
          </Link>

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

          {healthProSubtype ? (
            <p className={styles.menuFootnote}>
              Rol verificado: {HEALTH_PROFESSION_SUBTYPE_LABELS[healthProSubtype]}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
