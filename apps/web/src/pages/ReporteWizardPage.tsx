import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReportStatus } from "@canmedseg/shared";

import {
  ConsentFinalModal,
  ConsentInicioModal,
  hasConsentInicioAccepted,
  setConsentInicioAccepted,
} from "../components/consent";
import { useSession } from "../features/auth/SessionContext";
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

export function ReporteWizardPage() {
  const navigate = useNavigate();
  const { session, consentPending, loading: sessionLoading } = useSession();
  const { draft, draftRef, updateDraft, clearDraft } = useReportDraft();
  const [errors, setErrors] = useState<StepErrors>({});
  const [showFinalConsent, setShowFinalConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(() => hasConsentInicioAccepted());

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

  const step = draft.currentStep;
  const title = STEP_TITLES[step - 1];

  function goTo(next: number) {
    updateDraft((prev) => ({
      ...prev,
      currentStep: next,
      status: ReportStatus.EnProgreso,
    }));
    setErrors({});
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
      const created = await submitReport(draftRef.current);
      clearDraft();
      navigate("/reporte/exito", { state: { reportId: created.id } });
      setShowFinalConsent(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el reporte. Intente nuevamente.",
      );
      setShowFinalConsent(false);
    } finally {
      setSubmitting(false);
    }
  }

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

  return (
    <>
      <section className={styles.card}>
        <ProgressBar step={step} />
        <h1 className={styles.title}>{title}</h1>

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

        <WizardNav
          step={step}
          onPrev={handlePrev}
          onNext={handleNext}
          onSubmit={handleSubmitClick}
          emailReceipt={draft.contact.sendEmailReceipt}
          onEmailReceiptChange={(sendEmailReceipt) =>
            updateDraft((prev) => ({
              ...prev,
              contact: { ...prev.contact, sendEmailReceipt },
            }))
          }
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
