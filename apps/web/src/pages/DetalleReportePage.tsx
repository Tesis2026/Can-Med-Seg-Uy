import {
  REPORT_STATUS_DESCRIPTIONS,
  REPORT_STATUS_LABELS,
  ReportStatus,
  type AdverseEventReportDraft,
  type ReportDetail,
  type SubmittedReportStatus,
} from "@canmedseg/shared";
import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { useSession } from "../features/auth/SessionContext";
import {
  ACCESS_FORM_OPTIONS,
  ACTION_TAKEN_OPTIONS,
  CAUSALITY_OPTIONS,
  EVENT_OUTCOME_OPTIONS,
  INDICATION_OPTIONS,
  PRESENTATION_OPTIONS,
  PROFESSION_OPTIONS,
  REPORTING_AREA_OPTIONS,
  ROUTE_OPTIONS,
  SERIOUSNESS_OPTIONS,
  SEVERITY_GRADE_OPTIONS,
  SEX_OPTIONS,
} from "../features/reporte/options";
import { fetchReport } from "../features/reporte/reportApi";

import styles from "./MisReportes.module.css";

type Option = { readonly value: string; readonly label: string };

const STATUS_CLASS: Record<SubmittedReportStatus, string> = {
  [ReportStatus.EnRevision]: styles.statusEnRevision,
  [ReportStatus.AprobadoLocal]: styles.statusAprobadoLocal,
  [ReportStatus.AprobadoMsp]: styles.statusAprobadoMsp,
  [ReportStatus.EnviadoMsp]: styles.statusEnviadoMsp,
  [ReportStatus.Rechazado]: styles.statusRechazado,
};

function labelOf(options: readonly Option[], value: string | undefined): string {
  if (!value) return "";
  return options.find((option) => option.value === value)?.label ?? value;
}

function yesNo(value: boolean | undefined): string {
  if (value === undefined) return "";
  return value ? "Sí" : "No";
}

function numberOr(value: number | undefined, suffix = ""): string {
  if (value === undefined) return "";
  return `${value}${suffix}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Frame «Detalle de reporte enviado» del .pen: vista de solo lectura con los
 * datos tal como se enviaron, más el estado actual del reporte (RF-6.1).
 */
export function DetalleReportePage() {
  const { id = "" } = useParams();
  const { session, loading: sessionLoading } = useSession();
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.authenticated || !id) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchReport(id);
        if (!cancelled) setDetail(result);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "No se pudo abrir el reporte.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.authenticated, id]);

  if (sessionLoading) {
    return <p className={styles.state}>Cargando…</p>;
  }

  if (!session.authenticated) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(`/historial/${id}`)}`} replace />;
  }

  return (
    <div className={styles.page}>
      <Link className={styles.back} to="/historial">
        ← Volver al historial
      </Link>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {!detail && !error ? <p className={styles.state}>Cargando reporte…</p> : null}

      {detail ? <ReportView detail={detail} /> : null}
    </div>
  );
}

function ReportView({ detail }: { detail: ReportDetail }) {
  const report = detail.report;
  const patient = report.patient;
  const contact = report.contact;
  const title = [patient.initials, patient.nationalId]
    .filter((part) => (part ?? "").trim().length > 0)
    .join(" - ");

  return (
    <>
      <div className={styles.detailHead}>
        <div className={styles.detailTitle}>
          <h1 className={styles.detailPatient}>
            {title || "Reporte sin datos del paciente"}
          </h1>
          <p className={styles.detailMeta}>
            Enviado el {formatDateTime(detail.submittedAt)}
          </p>
        </div>
        <div className={styles.colStatus}>
          <span className={`${styles.status} ${STATUS_CLASS[detail.status]}`}>
            {REPORT_STATUS_LABELS[detail.status]}
          </span>
          <span className={styles.statusHint}>
            {REPORT_STATUS_DESCRIPTIONS[detail.status]}
          </span>
        </div>
      </div>

      <p className={styles.readonlyNote}>
        Vista de solo lectura. Los datos no pueden modificarse.
      </p>

      <div className={styles.detailCard}>
        <h2 className={styles.detailSection}>Información general del paciente</h2>
        <div className={styles.detailGrid}>
          <ReadOnlyField label="Iniciales" value={patient.initials} />
          <ReadOnlyField label="Número de cédula" value={patient.nationalId} />
          <ReadOnlyField label="Sexo" value={labelOf(SEX_OPTIONS, patient.sex)} />
          <ReadOnlyField label="Peso (kg)" value={numberOr(patient.weightKg)} />
          <ReadOnlyField label="Talla (m)" value={numberOr(patient.heightM)} />
          <ReadOnlyField label="Fecha de nacimiento" value={patient.birthDate} />
          <ReadOnlyField
            label="Edad al comienzo del evento adverso"
            value={numberOr(patient.ageAtEventStart, " años")}
          />
          <ReadOnlyField
            label="País donde comenzó el evento adverso"
            value={patient.countryOfEventStart}
          />
        </div>

        <h2 className={styles.detailSection}>Eventos adversos</h2>
        <div className={styles.detailGrid}>
          <ReadOnlyField
            label="Descripción del evento adverso"
            value={report.adverseEventDescription}
            wide
          />
          <ReadOnlyField
            label="Clasificación de gravedad"
            value={labelOf(SEVERITY_GRADE_OPTIONS, report.severityGrade)}
          />
          <ReadOnlyField
            label="Relación causal"
            value={labelOf(CAUSALITY_OPTIONS, report.causality)}
          />
        </div>

        {report.events.map((event, index) => (
          <div className={styles.detailSubcard} key={`evento-${index}`}>
            <p className={styles.detailSubtitle}>Reacción / síntoma {index + 1}</p>
            <div className={styles.detailGrid}>
              <ReadOnlyField label="Reacción / síntoma" value={event.meddraTerm} />
              <ReadOnlyField label="Fecha de inicio" value={event.startDate} />
              <ReadOnlyField label="Fecha de finalización" value={event.endDate} />
              <ReadOnlyField
                label="Duración del evento adverso"
                value={numberOr(event.durationDays, " días")}
              />
              <ReadOnlyField
                label="Estado actual del evento adverso"
                value={labelOf(EVENT_OUTCOME_OPTIONS, event.outcome)}
              />
              <ReadOnlyField
                label="¿El evento adverso fue grave?"
                value={yesNo(event.isSerious)}
              />
              <ReadOnlyField
                label="Indicador de gravedad"
                value={labelOf(SERIOUSNESS_OPTIONS, event.seriousnessCriterion)}
                wide
              />
            </div>
          </div>
        ))}

        <h2 className={styles.detailSection}>Medicamento implicado</h2>
        {report.medicines.map((medicine, index) => {
          const unit = medicine.compositionUnit === "ml" ? " ml" : " %";
          return (
            <div className={styles.detailSubcard} key={`medicamento-${index}`}>
              <p className={styles.detailSubtitle}>Medicamento {index + 1}</p>
              <div className={styles.detailGrid}>
                <ReadOnlyField label="Nombre del medicamento" value={medicine.name} />
                <ReadOnlyField
                  label="Compañía productora / distribuidora"
                  value={medicine.company}
                />
                <ReadOnlyField label="Número de lote" value={medicine.batchNumber} />
                <ReadOnlyField
                  label="Forma de acceso"
                  value={labelOf(ACCESS_FORM_OPTIONS, medicine.accessForm)}
                />
                <ReadOnlyField
                  label="Tipo de presentación"
                  value={labelOf(PRESENTATION_OPTIONS, medicine.presentation)}
                />
                <ReadOnlyField label="Dosis" value={medicine.dose} />
                <ReadOnlyField
                  label="Dosis/presentación (THC)"
                  value={numberOr(medicine.thcPercent, unit)}
                />
                <ReadOnlyField
                  label="Dosis/presentación (CBD)"
                  value={numberOr(medicine.cbdPercent, unit)}
                />
                <ReadOnlyField
                  label="Dosis/presentación (Otro)"
                  value={numberOr(medicine.otherPercent, unit)}
                />
                <ReadOnlyField
                  label="Posología (veces al día)"
                  value={numberOr(medicine.dosesPerDay)}
                />
                <ReadOnlyField
                  label="Posología (cantidad por vez)"
                  value={numberOr(medicine.amountPerDose)}
                />
                <ReadOnlyField
                  label="Vía de administración"
                  value={labelOf(ROUTE_OPTIONS, medicine.administrationRoute)}
                />
                <ReadOnlyField
                  label="Inicio de la administración"
                  value={medicine.administrationStartDate}
                />
                <ReadOnlyField
                  label="Fin de la administración"
                  value={medicine.administrationEndDate}
                />
                <ReadOnlyField
                  label="Duración de la administración"
                  value={numberOr(medicine.administrationDurationDays, " días")}
                />
                <ReadOnlyField
                  label="Cambio reciente de producto"
                  value={yesNo(medicine.recentProductChange)}
                />
                <ReadOnlyField
                  label="Detalle del cambio reciente"
                  value={medicine.recentProductChangeDetail}
                />
                <ReadOnlyField label="Indicación" value={medicine.indicationText} />
                <ReadOnlyField
                  label="Motivo principal de uso"
                  value={labelOf(INDICATION_OPTIONS, medicine.indicationCategory)}
                />
                <ReadOnlyField
                  label="Acción tomada con el medicamento"
                  value={labelOf(ACTION_TAKEN_OPTIONS, medicine.actionTaken)}
                />
                <ReadOnlyField
                  label="Imagen del envase"
                  value={medicine.packageImageName}
                />
              </div>
            </div>
          );
        })}

        <h2 className={styles.detailSection}>Información adicional</h2>
        <div className={styles.detailGrid}>
          <ReadOnlyField
            label="Enfermedades previas o actuales"
            value={report.previousDiseases}
            wide
          />
          <ReadOnlyField
            label="Tratamientos farmacológicos concomitantes"
            value={yesNo(report.hasConcomitantTreatments)}
          />
        </div>

        <ConcomitantList report={report} />

        <div className={styles.detailGrid}>
          <ReadOnlyField
            label="Comentarios adicionales"
            value={report.additionalComments}
            wide
          />
        </div>

        <h2 className={styles.detailSection}>Información de contacto</h2>
        <div className={styles.detailGrid}>
          <ReadOnlyField
            label="Área reportante"
            value={labelOf(REPORTING_AREA_OPTIONS, contact.reportingArea)}
          />
          <ReadOnlyField
            label="Institución especificada"
            value={contact.reportingAreaOther}
          />
          <ReadOnlyField
            label="Rol o profesión"
            value={labelOf(PROFESSION_OPTIONS, contact.profession)}
          />
          <ReadOnlyField label="Nombre(s)" value={contact.firstName} />
          <ReadOnlyField label="Apellido/s" value={contact.lastName} />
          <ReadOnlyField label="Establecimiento de salud" value={contact.healthFacility} />
          <ReadOnlyField label="Correo electrónico" value={contact.email} />
          <ReadOnlyField label="Teléfono" value={contact.phone} />
        </div>
      </div>
    </>
  );
}

function ConcomitantList({ report }: { report: AdverseEventReportDraft }) {
  if (report.concomitantTreatments.length === 0) return null;

  return (
    <>
      {report.concomitantTreatments.map((treatment, index) => (
        <div className={styles.detailSubcard} key={`concomitante-${index}`}>
          <p className={styles.detailSubtitle}>Medicamento concomitante {index + 1}</p>
          <div className={styles.detailGrid}>
            <ReadOnlyField label="Nombre del medicamento" value={treatment.name} />
            <ReadOnlyField
              label="Posología (mg por toma)"
              value={numberOr(treatment.mgPerDose)}
            />
            <ReadOnlyField
              label="Posología (tomas por día)"
              value={numberOr(treatment.dosesPerDay)}
            />
            <ReadOnlyField label="Fecha de inicio" value={treatment.startDate} />
            <ReadOnlyField label="Fecha de fin" value={treatment.endDate} />
            <ReadOnlyField
              label="Duración del uso"
              value={numberOr(treatment.durationDays, " días")}
            />
          </div>
        </div>
      ))}
    </>
  );
}

type ReadOnlyFieldProps = {
  label: string;
  value: string | undefined;
  wide?: boolean;
};

/** Campo en gris del frame `Detalle de reporte enviado`; se omite si está vacío. */
function ReadOnlyField({ label, value, wide = false }: ReadOnlyFieldProps): ReactNode {
  if (!value || !value.trim()) return null;
  return (
    <div className={`${styles.detailField} ${wide ? styles.detailFieldWide : ""}`}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );
}
