import {
  HEALTH_PROFESSION_SUBTYPE_LABELS,
  Permission,
  ROLE_LABELS,
  Role,
  hasPermission,
  isActiveRole,
  type AdminUser,
  type UserRole,
} from "@canmedseg/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { CreateUserModal, DeleteUserModal, PasswordModal } from "../features/admin/UserModals";
import { listUsers, setUserActive } from "../features/admin/adminUsersApi";
import { useSession } from "../features/auth/SessionContext";
import { formatReportDateTime } from "../features/reporte/ReportDetailView";

import styles from "./MisReportes.module.css";
import ownStyles from "./GestionUsuarios.module.css";

type Dialog =
  | { kind: "create" }
  | { kind: "password"; user: AdminUser }
  | { kind: "delete"; user: AdminUser }
  | null;

function roleLabel(entry: UserRole): string {
  if (entry.role === Role.ProfesionalSalud && entry.healthProfessionSubtype) {
    return HEALTH_PROFESSION_SUBTYPE_LABELS[entry.healthProfessionSubtype];
  }
  return ROLE_LABELS[entry.role];
}

export function GestionUsuariosPage() {
  const { session, user: currentUser, loading: sessionLoading } = useSession();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = hasPermission(session.permissions, Permission.UsersManage);

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el listado de usuarios.");
    }
  }, []);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  const filtered = useMemo(() => {
    if (!users) return null;
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((entry) =>
      [entry.displayName, entry.email ?? ""].join(" ").toLowerCase().includes(needle),
    );
  }, [users, query]);

  const closeDialog = useCallback(() => setDialog(null), []);

  async function toggleActive(target: AdminUser) {
    setBusyId(target.id);
    setNotice(null);
    setError(null);
    try {
      const updated = await setUserActive(target.id, !target.active);
      setUsers((previous) =>
        previous?.map((entry) => (entry.id === updated.id ? updated : entry)) ?? null,
      );
      setNotice(
        updated.active
          ? `Se activó la cuenta de ${updated.displayName}.`
          : `Se desactivó la cuenta de ${updated.displayName} y se cerraron sus sesiones.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el usuario.");
    } finally {
      setBusyId(null);
    }
  }

  if (sessionLoading) {
    return <p className={styles.state}>Cargando…</p>;
  }

  if (!session.authenticated) {
    return <Navigate to="/login?returnTo=%2Fadmin%2Fusuarios" replace />;
  }

  if (!canManage) {
    return (
      <div className={styles.page}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Gestión de usuarios</h1>
        </div>
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            No tiene permisos para ver esta página. Solo el administrador del sistema gestiona
            los usuarios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={ownStyles.headRow}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Gestión de usuarios</h1>
          <p className={styles.subtitle}>
            Cree cuentas con email y contraseña, y active, desactive o borre usuarios.
          </p>
        </div>
        <button type="button" className={styles.primary} onClick={() => setDialog({ kind: "create" })}>
          Crear usuario
        </button>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className={ownStyles.success} role="status">
          {notice}
        </p>
      ) : null}

      {users !== null && users.length > 0 ? (
        <div className={styles.searchRow}>
          <input
            className={styles.search}
            type="search"
            value={query}
            aria-label="Buscar usuarios"
            placeholder="Buscar por nombre o email…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      ) : null}

      {users === null && !error ? <p className={styles.state}>Cargando usuarios…</p> : null}

      {filtered !== null ? (
        <div className={styles.tableCard}>
          <div className={styles.thead}>
            <span className={`${styles.th} ${styles.colMain}`}>Usuario</span>
            <span className={`${styles.th} ${ownStyles.colRoles}`}>Roles</span>
            <span className={`${styles.th} ${ownStyles.colState}`}>Estado</span>
            <span className={`${styles.th} ${styles.colDate}`}>Último ingreso</span>
            <span className={`${styles.th} ${ownStyles.colActions}`} />
          </div>

          {filtered.length === 0 ? (
            <div className={styles.row}>
              <span className={styles.emptyText}>Ningún usuario coincide con la búsqueda.</span>
            </div>
          ) : null}

          {filtered.map((entry) => {
            const isSelf = entry.id === currentUser?.id;
            const roles = entry.roles.filter((role) => isActiveRole(role.role));
            return (
              <div
                className={`${styles.row} ${entry.active ? "" : ownStyles.inactiveRow}`}
                key={entry.id}
              >
                <div className={styles.colMain}>
                  <span className={ownStyles.name}>
                    {entry.displayName}
                    {isSelf ? " (usted)" : ""}
                  </span>
                  {entry.email ? <span className={ownStyles.email}>{entry.email}</span> : null}
                  {/* Registro con GUB UY: deprecado momentáneamente; se identifica el origen de esas cuentas. */}
                  {entry.identityProvider !== "local" ? (
                    <span className={ownStyles.origin}>Cuenta creada con GUB UY</span>
                  ) : null}
                </div>
                <div className={ownStyles.colRoles}>
                  {roles.length === 0 ? (
                    <span className={ownStyles.roleTag}>Sin rol activo</span>
                  ) : (
                    roles.map((role) => (
                      <span className={ownStyles.roleTag} key={role.role}>
                        {roleLabel(role)}
                      </span>
                    ))
                  )}
                </div>
                <div className={ownStyles.colState}>
                  <span
                    className={`${ownStyles.badge} ${
                      entry.active ? ownStyles.badgeActive : ownStyles.badgeInactive
                    }`}
                  >
                    {entry.active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className={styles.colDate}>
                  <span className={styles.date}>
                    {entry.lastLoginAt ? formatReportDateTime(entry.lastLoginAt) : "Nunca"}
                  </span>
                </div>
                <div className={ownStyles.colActions}>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => setDialog({ kind: "password", user: entry })}
                  >
                    Contraseña
                  </button>
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={isSelf || busyId === entry.id}
                    title={isSelf ? "No puede desactivar su propia cuenta" : undefined}
                    onClick={() => void toggleActive(entry)}
                  >
                    {entry.active ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    className={styles.danger}
                    disabled={isSelf}
                    title={isSelf ? "No puede borrar su propia cuenta" : undefined}
                    onClick={() => setDialog({ kind: "delete", user: entry })}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {dialog?.kind === "create" ? (
        <CreateUserModal
          onClose={closeDialog}
          onCreated={(created) => {
            setDialog(null);
            setNotice(`Se creó la cuenta de ${created.displayName}.`);
            void load();
          }}
        />
      ) : null}

      {dialog?.kind === "password" ? (
        <PasswordModal
          user={dialog.user}
          onClose={closeDialog}
          onSaved={() => {
            setDialog(null);
            setNotice(`Se actualizó la contraseña de ${dialog.user.displayName}.`);
          }}
        />
      ) : null}

      {dialog?.kind === "delete" ? (
        <DeleteUserModal
          user={dialog.user}
          onClose={closeDialog}
          onDeleted={() => {
            setDialog(null);
            setNotice(`Se borró a ${dialog.user.displayName} y todos sus datos.`);
            setUsers((previous) => previous?.filter((entry) => entry.id !== dialog.user.id) ?? null);
          }}
        />
      ) : null}
    </div>
  );
}
