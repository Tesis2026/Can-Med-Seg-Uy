import {
  PASSWORD_MIN_LENGTH,
  ROLE_LABELS,
  Role,
  createUserInputSchema,
  setUserPasswordInputSchema,
  type AdminUser,
  type AssignableRole,
} from "@canmedseg/shared";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";

import modalStyles from "../../components/consent/ConsentModal.module.css";
import styles from "../../pages/GestionUsuarios.module.css";
import { Field, TextInput } from "../reporte/FormFields";
import { createUser, deleteUser, setUserPassword } from "./adminUsersApi";

type ModalFrameProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

function ModalFrame({ title, onClose, children }: ModalFrameProps) {
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={modalStyles.backdrop}>
      <div
        className={`${modalStyles.modal} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className={modalStyles.title}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

const SELECTABLE_ROLES: readonly AssignableRole[] = [Role.Investigador, Role.Admin];

type CreateErrors = Partial<Record<"displayName" | "email" | "password", string>>;

export function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (user: AdminUser) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<AssignableRole[]>([Role.Investigador]);
  const [errors, setErrors] = useState<CreateErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleRole(role: AssignableRole) {
    setRoles((previous) =>
      previous.includes(role) ? previous.filter((entry) => entry !== role) : [...previous, role],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = createUserInputSchema.safeParse({
      displayName,
      email,
      password,
      roles: [Role.Comun, ...roles].map((role) => ({ role, healthProfessionSubtype: null })),
    });

    if (!parsed.success) {
      const next: CreateErrors = {};
      for (const issue of parsed.error.issues) {
        const [key] = issue.path;
        if ((key === "displayName" || key === "email" || key === "password") && !next[key]) {
          next[key] = issue.message;
        }
      }
      setErrors(next);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      onCreated(await createUser(parsed.data));
    } catch (cause) {
      setSubmitError(errorMessage(cause, "No se pudo crear el usuario."));
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame title="Crear usuario" onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className={modalStyles.body}>
          <div className={styles.form}>
            <Field label="Nombre" htmlFor="new-user-name" required error={errors.displayName}>
              <TextInput
                id="new-user-name"
                value={displayName}
                autoComplete="off"
                hasError={Boolean(errors.displayName)}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="new-user-email" required error={errors.email}>
              <TextInput
                id="new-user-email"
                type="email"
                value={email}
                autoComplete="off"
                hasError={Boolean(errors.email)}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field
              label="Contraseña"
              htmlFor="new-user-password"
              required
              hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres. Compártala con el usuario por un medio seguro.`}
              error={errors.password}
            >
              <TextInput
                id="new-user-password"
                type="password"
                value={password}
                autoComplete="new-password"
                hasError={Boolean(errors.password)}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Roles</legend>
              {SELECTABLE_ROLES.map((role) => (
                <label key={role} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </fieldset>

            {submitError ? (
              <p className={modalStyles.error} role="alert">
                {submitError}
              </p>
            ) : null}
          </div>
        </div>

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.cancelBtn} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={modalStyles.acceptBtn} disabled={submitting}>
            {submitting ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function PasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = setUserPasswordInputSchema.safeParse({ password });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Contraseña inválida");
      return;
    }

    setFieldError(null);
    setSubmitting(true);
    try {
      await setUserPassword(user.id, parsed.data.password);
      onSaved();
    } catch (cause) {
      setSubmitError(errorMessage(cause, "No se pudo cambiar la contraseña."));
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame title="Cambiar contraseña" onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className={modalStyles.body}>
          <p>
            Nueva contraseña para <strong>{user.displayName}</strong>
            {user.email ? ` (${user.email})` : ""}.
          </p>
          <Field
            label="Nueva contraseña"
            htmlFor="user-new-password"
            required
            hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}
            error={fieldError ?? undefined}
          >
            <TextInput
              id="user-new-password"
              type="password"
              value={password}
              autoComplete="new-password"
              hasError={Boolean(fieldError)}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          {submitError ? (
            <p className={modalStyles.error} role="alert">
              {submitError}
            </p>
          ) : null}
        </div>

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.cancelBtn} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={modalStyles.acceptBtn} disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar contraseña"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function DeleteUserModal({
  user,
  onClose,
  onDeleted,
}: {
  user: AdminUser;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await deleteUser(user.id);
      onDeleted();
    } catch (cause) {
      setSubmitError(errorMessage(cause, "No se pudo borrar el usuario."));
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame title="Borrar usuario" onClose={onClose}>
      <div className={modalStyles.body}>
        <p>
          ¿Seguro que quiere borrar a <strong>{user.displayName}</strong>
          {user.email ? ` (${user.email})` : ""}?
        </p>
        <p className={styles.warning}>
          Se eliminan también todos sus reportes enviados, sus formularios en progreso y su
          historial. Esta acción no se puede deshacer. Si solo quiere impedir que ingrese,
          desactive la cuenta.
        </p>
        {submitError ? (
          <p className={modalStyles.error} role="alert">
            {submitError}
          </p>
        ) : null}
      </div>

      <div className={modalStyles.actions}>
        <button type="button" className={modalStyles.cancelBtn} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={`${modalStyles.acceptBtn} ${styles.dangerBtn}`}
          disabled={submitting}
          onClick={() => void handleDelete()}
        >
          {submitting ? "Borrando…" : "Borrar definitivamente"}
        </button>
      </div>
    </ModalFrame>
  );
}
