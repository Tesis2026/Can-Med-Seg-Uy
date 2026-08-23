import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ReportStatus } from "@canmedseg/shared";

import {
  ConsentFinalModal,
  ConsentInicioModal,
  hasConsentInicioAccepted,
  setConsentInicioAccepted,
} from "../components/consent";
import { useSession } from "../features/auth/SessionContext";
import { CaptchaField } from "../features/captcha/CaptchaField";
import { ProgressBar } from "../features/reporte/ProgressBar";
import { submitReport } from "../features/reporte/reportApi";
import { STEP_TITLES } from "../features/reporte/options";
import styles from "../features/reporte/reporte.module.css";
import { StepAdicional } from "../features/reporte/steps/StepAdicional";
import { StepContacto } from "../features/reporte/steps/StepContacto";
import { StepEventos } from "../features/reporte/steps/StepEventos";
import { StepMedicamentos } from "../features/reporte/steps/StepMedicamentos";
import { StepPaciente } from "../features/reporte/steps/StepPaciente";
import { useReportDraft } from "../features/reporte/useReportDraft";
import { validateStep, type StepErrors } from "../features/reporte/validate";
import { WizardNav } from "../features/reporte/WizardNav";

function formatSavedAt(date: Date): string {
  return date.toLocaleTimeString("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function ReporteWizardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, consentPending, loading: sessionLoading } = useSession();

  // La URL solo transporta la intención inicial; después se limpia.
  const [resumeId] = useState(() => searchParams.get("borrador"));
  const [startFresh] = useState(() => searchParams.has("nuevo"));

  const persistDrafts = session.authenticated;
  const {
    draft,
    draftRef,
    draftId,
    updateDraft,
    clearDraft,
    saveDraft,
    saveState,
    savedAt,
    saveError,
    resuming,
    resumeError,
  } = useReportDraft({ persist: persistDrafts, resumeId, startFresh });

  const [errors, setErrors] = useState<StepErrors>({});
  const [showFinalConsent, setShowFinalConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(() => hasConsentInicioAccepted());
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => {
    if (!searchParams.has("borrador") && !searchParams.has("nuevo")) return;
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  /**
   * El consentimiento se pide antes de empezar el reporte (notas de cliente).
   * Quien ya lo aceptó al iniciar sesión no lo vuelve a ver; el visitante anónimo
   * lo acepta acá mismo en vez de ser expulsado al inicio.
   */
  useEffect(() => {
    if (sessionLoading || consentAccepted) return;
    if (session.authenticated && !consentPending) {
      setConsentInicioAccepted();
      setConsentAccepted(true);
    }
  }, [sessionLoading, consentAccepted, session.authenticated, consentPending]);

  /** Autoguardado también al abandonar el asistente sin cambiar de sección. */
  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;
  useEffect(
    () => () => {
      void saveDraftRef.current({ keepalive: true });
    },
    [],
  );

  const step = draft.currentStep;
  const title = STEP_TITLES[step - 1];

  function goTo(next: number) {
    updateDraft((prev) => ({
      ...prev,
      currentStep: next,
      status: ReportStatus.EnProgreso,
    }));
    setErrors({});
    // RF-4.2: el guardado parcial se dispara al pasar de sección.
    void saveDraft();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleNext() {
    const current = draftRef.current;
    const nextErrors = validateStep(current.currentStep, current);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    goTo(Math.min(5, current.currentStep + 1));
  }

  function handlePrev() {
    goTo(Math.max(1, draftRef.current.currentStep - 1));
  }

  function handleSubmitClick() {
    const current = draftRef.current;
    const nextErrors = validateStep(5, current);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setShowFinalConsent(true);
  }

  async function handleAcceptAndSend() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await submitReport(draftRef.current, { draftId, captchaToken });
      clearDraft();
      navigate("/reporte/exito", { state: { reportId: created.id } });
      setShowFinalConsent(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el reporte. Intente nuevamente.",
      );
      // El comprobante del CAPTCHA es de un solo uso: hay que resolver otro.
      setCaptchaToken(null);
      setShowFinalConsent(false);
    } finally {
      setSubmitting(false);
    }
  }

  const handleCaptchaVerified = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, []);

  if (!consentAccepted) {
    return (
      <ConsentInicioModal
        open
        onAccept={() => {
          setConsentInicioAccepted();
          setConsentAccepted(true);
        }}
        onCancel={() => navigate("/", { replace: true })}
      />
    );
  }

  if (resuming) {
    return <p className={styles.loading}>Abriendo el borrador…</p>;
  }

  return (
    <>
      <section className={styles.card}>
        <ProgressBar step={step} />
        <h1 className={styles.title}>{title}</h1>

        {resumeError ? (
          <p className={styles.submitError} role="alert">
            {resumeError}
          </p>
        ) : null}

        {submitError ? (
          <p className={styles.submitError} role="alert">
            {submitError}
          </p>
        ) : null}

        <div className={styles.fields}>
          {step === 1 ? (
            <StepPaciente
              draft={draft}
              errors={errors}
              onChange={(patient) =>
                updateDraft((prev) => ({ ...prev, patient }))
              }
            />
          ) : null}

          {step === 2 ? (
            <StepEventos
              draft={draft}
              errors={errors}
              onChange={(patch) =>
                updateDraft((prev) => ({ ...prev, ...patch }))
              }
            />
          ) : null}

          {step === 3 ? (
            <StepMedicamentos
              draft={draft}
              errors={errors}
              onChange={(medicines) =>
                updateDraft((prev) => ({ ...prev, medicines }))
              }
            />
          ) : null}

          {step === 4 ? (
            <StepAdicional
              draft={draft}
              errors={errors}
              onChange={(patch) =>
                updateDraft((prev) => ({ ...prev, ...patch }))
              }
            />
          ) : null}

          {step === 5 ? (
            <StepContacto
              draft={draft}
              errors={errors}
              onChange={(contact) =>
                updateDraft((prev) => ({ ...prev, contact }))
              }
            />
          ) : null}
        </div>

        {/* RF-3.6: la verificación solo se pide a quien no inició sesión. */}
        {step === 5 && !session.authenticated ? (
          <CaptchaField onVerified={handleCaptchaVerified} />
        ) : null}

        <WizardNav
          step={step}
          onPrev={handlePrev}
          onNext={handleNext}
          onSubmit={handleSubmitClick}
          submitDisabled={!session.authenticated && !captchaToken}
          emailReceipt={draft.contact.sendEmailReceipt}
          onEmailReceiptChange={(sendEmailReceipt) =>
            updateDraft((prev) => ({
              ...prev,
              contact: { ...prev.contact, sendEmailReceipt },
            }))
          }
        />

        <DraftStatus
          persist={persistDrafts}
          state={saveState}
          savedAt={savedAt}
          error={saveError}
        />
      </section>

      <ConsentFinalModal
        open={showFinalConsent}
        submitting={submitting}
        onBack={() => setShowFinalConsent(false)}
        onAccept={() => {
          void handleAcceptAndSend();
        }}
      />
    </>
  );
}

type DraftStatusProps = {
  persist: boolean;
  state: "idle" | "saving" | "saved" | "error";
  savedAt: Date | null;
  error: string | null;
};

/** Mensaje de estado del guardado parcial (RF-4.2) / aviso al visitante (RF-4.4). */
function DraftStatus({ persist, state, savedAt, error }: DraftStatusProps) {
  if (!persist) {
    return (
      <p className={styles.draftNotice}>
        Está reportando sin iniciar sesión: el formulario no se guarda como borrador ni
        queda en un historial. Inicie sesión con GUB UY si quiere retomarlo más tarde.
      </p>
    );
  }

  if (state === "error") {
    return (
      <p className={styles.draftError} role="alert">
        {error ?? "No se pudo guardar el borrador."}
      </p>
    );
  }

  if (state === "saving") {
    return <p className={styles.draftNotice}>Guardando borrador…</p>;
  }

  if (state === "saved" && savedAt) {
    return (
      <p className={styles.draftNotice} role="status">
        Borrador guardado a las {formatSavedAt(savedAt)}. Puede retomarlo desde
        «Formularios en progreso».
      </p>
    );
  }

  return (
    <p className={styles.draftNotice}>
      El formulario se guarda automáticamente al pasar de sección.
    </p>
  );
}
