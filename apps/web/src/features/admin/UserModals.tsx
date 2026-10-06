import {
  PASSWORD_MIN_LENGTH,
  inviteResearcherInputSchema,
  setUserPasswordInputSchema,
  type AdminUser,
  type PendingInvitation,
} from "@canmedseg/shared";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";

import modalStyles from "../../components/consent/ConsentModal.module.css";
import styles from "../../pages/GestionUsuarios.module.css";
import { Field, TextInput } from "../reporte/FormFields";
import { deleteUser, inviteResearcher, setUserPassword } from "./adminUsersApi";

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

export function InviteResearcherModal({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (invitation: PendingInvitation) => void;
}) {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = inviteResearcherInputSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Ingrese un email válido");
      return;
    }

    setFieldError(null);
    setSubmitting(true);
    try {
      onInvited(await inviteResearcher(parsed.data));
    } catch (cause) {
      setSubmitError(errorMessage(cause, "No se pudo enviar la invitación."));
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame title="Invitar investigador" onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className={modalStyles.body}>
          <div className={styles.form}>
            <p className={styles.info}>
              La persona invitada recibirá un email con un enlace para crear su cuenta. El enlace vence en 7 días.
            </p>
            <Field label="Email" htmlFor="invite-email" required error={fieldError ?? undefined}>
              <TextInput
                id="invite-email"
                type="email"
                value={email}
                autoComplete="off"
                autoFocus
                hasError={Boolean(fieldError)}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

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
            {submitting ? "Enviando…" : "Enviar invitación"}
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
