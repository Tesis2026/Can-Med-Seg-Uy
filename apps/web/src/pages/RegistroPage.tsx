import { PASSWORD_MIN_LENGTH, acceptInvitationInputSchema } from "@canmedseg/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";
import { acceptInvitation, fetchInvitation } from "../features/auth/invitationApi";
import { Field, TextInput } from "../features/reporte/FormFields";
import { ApiError } from "../lib/api";

import styles from "./LoginPage.module.css";

type FieldErrors = Partial<Record<"displayName" | "password" | "confirmation", string>>;

type InvitationState =
  | { kind: "loading" }
  | { kind: "ready"; email: string }
  | { kind: "invalid" }
  | { kind: "error"; message: string };

function isInvalidInvitation(cause: unknown): boolean {
  return cause instanceof ApiError && (cause.reason === "invitacion_invalida" || cause.status === 404);
}

export function RegistroPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { refresh } = useSession();

  const [invitation, setInvitation] = useState<InvitationState>({ kind: "loading" });
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetchInvitation(id)
      .then((details) => {
        if (active) setInvitation({ kind: "ready", email: details.email });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        // Un id que no es uuid lo rechaza la validación (400): también es un enlace inválido.
        if (isInvalidInvitation(cause) || (cause instanceof ApiError && cause.status === 400)) {
          setInvitation({ kind: "invalid" });
        } else {
          setInvitation({
            kind: "error",
            message: cause instanceof Error ? cause.message : "No se pudo cargar la invitación.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = acceptInvitationInputSchema.safeParse({ displayName, password, confirmation });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          (field === "displayName" || field === "password" || field === "confirmation") &&
          !errors[field]
        ) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await acceptInvitation(id, parsed.data);
      await refresh();
      navigate("/", { replace: true });
    } catch (cause) {
      if (isInvalidInvitation(cause)) {
        setInvitation({ kind: "invalid" });
      } else {
        setSubmitError(cause instanceof Error ? cause.message : "No se pudo completar el registro.");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.main}>
      <section className={styles.loginCard} aria-labelledby="registro-title">
        <div className={styles.titleBlk}>
          <h1 id="registro-title" className={styles.title}>
            Crear su cuenta
          </h1>
          <p className={styles.subtitle}>
            Fue invitado como investigador. Complete sus datos para ingresar al sistema.
          </p>
        </div>

        {invitation.kind === "loading" ? <p className={styles.subtitle}>Cargando invitación…</p> : null}

        {invitation.kind === "invalid" || invitation.kind === "error" ? (
          <div className={styles.errBox} role="alert">
            <span className={styles.errIcon} aria-hidden="true">
              !
            </span>
            <div className={styles.errTxt}>
              <p className={styles.errTitle}>
                {invitation.kind === "invalid"
                  ? "La invitación no es válida, ya fue usada o venció."
                  : invitation.message}
              </p>
              {invitation.kind === "invalid" ? (
                <p className={styles.errDetail}>
                  Pida una invitación nueva al administrador del sistema. Si ya creó su cuenta,{" "}
                  <Link className={styles.link} to="/login">
                    inicie sesión
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {invitation.kind === "ready" ? (
          <form className={styles.formBlk} onSubmit={(event) => void handleSubmit(event)} noValidate>
            <Field
              label="Email"
              htmlFor="registro-email"
              hint="Es el email al que llegó la invitación; no se puede cambiar."
            >
              <TextInput id="registro-email" type="email" value={invitation.email} readOnly />
            </Field>
            <Field label="Nombre completo" htmlFor="registro-name" required error={fieldErrors.displayName}>
              <TextInput
                id="registro-name"
                autoComplete="name"
                value={displayName}
                hasError={Boolean(fieldErrors.displayName)}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </Field>
            <Field
              label="Contraseña"
              htmlFor="registro-password"
              required
              hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}
              error={fieldErrors.password}
            >
              <TextInput
                id="registro-password"
                type="password"
                autoComplete="new-password"
                value={password}
                hasError={Boolean(fieldErrors.password)}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field
              label="Repetir contraseña"
              htmlFor="registro-confirmation"
              required
              error={fieldErrors.confirmation}
            >
              <TextInput
                id="registro-confirmation"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                hasError={Boolean(fieldErrors.confirmation)}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? "Creando cuenta…" : "Crear cuenta"}
            </button>
          </form>
        ) : null}

        {submitError ? (
          <div className={styles.errBox} role="alert">
            <span className={styles.errIcon} aria-hidden="true">
              !
            </span>
            <div className={styles.errTxt}>
              <p className={styles.errTitle}>{submitError}</p>
            </div>
          </div>
        ) : null}

        <div className={styles.linksRow}>
          <Link className={styles.link} to="/login">
            Ya tengo cuenta: iniciar sesión
          </Link>
        </div>
      </section>
    </div>
  );
}
