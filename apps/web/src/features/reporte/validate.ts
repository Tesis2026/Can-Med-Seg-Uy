import type { AdverseEventReportDraft } from "@canmedseg/shared";

import { dateValidationError, parseToDate } from "./FormFields";
import {
  ageError,
  emailError,
  heightMError,
  initialsError,
  uyCiError,
  uyPhoneError,
  weightKgError,
} from "./uyValidation";

export type StepErrors = Record<string, string>;

function requireDate(
  errors: StepErrors,
  key: string,
  value: string | undefined,
) {
  const msg = dateValidationError(value ?? "", { required: true });
  if (msg) errors[key] = msg;
}

function optionalDate(
  errors: StepErrors,
  key: string,
  value: string | undefined,
) {
  const msg = dateValidationError(value ?? "", { required: false });
  if (msg) errors[key] = msg;
}

function assertRangeOrder(
  errors: StepErrors,
  startKey: string,
  endKey: string,
  startValue: string | undefined,
  endValue: string | undefined,
) {
  if (errors[startKey] || errors[endKey]) return;
  const start = startValue ? parseToDate(startValue) : null;
  const end = endValue ? parseToDate(endValue) : null;
  if (start && end && end.getTime() < start.getTime()) {
    errors[endKey] = "La fecha de fin no puede ser anterior al inicio";
  }
}

/** La fecha no puede ser anterior a la fecha de nacimiento. */
function assertNotBeforeBirth(
  errors: StepErrors,
  key: string,
  value: string | undefined,
  birthDate: string | undefined,
) {
  if (errors[key]) return;
  const date = value ? parseToDate(value) : null;
  const birth = birthDate ? parseToDate(birthDate) : null;
  if (date && birth && date.getTime() < birth.getTime()) {
    errors[key] = "No puede ser anterior a la fecha de nacimiento";
  }
}

function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/**
 * Duración en días entre inicio y fin (mismo día = 0).
 * Solo se calcula si ambas fechas son válidas y fin ≥ inicio.
 */
export function durationDaysBetween(
  startValue: string | undefined,
  endValue: string | undefined,
): number | undefined {
  const start = startValue ? parseToDate(startValue) : null;
  const end = endValue ? parseToDate(endValue) : null;
  if (!start || !end) return undefined;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return undefined;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function validateStep(
  step: number,
  draft: AdverseEventReportDraft,
): StepErrors {
  const errors: StepErrors = {};

  if (step === 1) {
    const p = draft.patient;

    const initialsMsg = initialsError(p.initials, true);
    if (initialsMsg) errors.initials = initialsMsg;

    const ciMsg = uyCiError(p.nationalId ?? "", false);
    if (ciMsg) errors.nationalId = ciMsg;

    if (!p.sex) errors.sex = "Campo obligatorio";

    const wMsg = weightKgError(p.weightKg);
    if (wMsg) errors.weightKg = wMsg;

    const hMsg = heightMError(p.heightM);
    if (hMsg) errors.heightM = hMsg;

    requireDate(errors, "birthDate", p.birthDate);

    const ageMsg = ageError(p.ageAtEventStart, false);
    if (ageMsg) errors.ageAtEventStart = ageMsg;

    if (!p.countryOfEventStart.trim()) {
      errors.countryOfEventStart = "Campo obligatorio";
    }
  }

  if (step === 2) {
    if (!draft.adverseEventDescription.trim()) {
      errors.adverseEventDescription = "Campo obligatorio";
    } else if (draft.adverseEventDescription.length > 500) {
      errors.adverseEventDescription = "Máximo 500 caracteres";
    }

    if (draft.events.length === 0) {
      errors.events = "Agregue al menos una reacción/síntoma";
    }
    draft.events.forEach((ev, i) => {
      if (!ev.meddraTerm.trim()) {
        errors[`events.${i}.meddraTerm`] = "Campo obligatorio";
      }

      requireDate(errors, `events.${i}.startDate`, ev.startDate);
      optionalDate(errors, `events.${i}.endDate`, ev.endDate);
      assertNotBeforeBirth(
        errors,
        `events.${i}.startDate`,
        ev.startDate,
        draft.patient.birthDate,
      );
      assertNotBeforeBirth(
        errors,
        `events.${i}.endDate`,
        ev.endDate,
        draft.patient.birthDate,
      );
      assertRangeOrder(
        errors,
        `events.${i}.startDate`,
        `events.${i}.endDate`,
        ev.startDate,
        ev.endDate,
      );

      if (ev.isSerious === undefined) {
        errors[`events.${i}.isSerious`] = "Campo obligatorio";
      }
      if (ev.isSerious && !ev.seriousnessCriterion) {
        errors[`events.${i}.seriousnessCriterion`] =
          "Seleccione el indicador de gravedad";
      }
    });
  }

  if (step === 3) {
    if (draft.medicines.length === 0) {
      errors.medicines = "Agregue al menos un medicamento";
    }
    draft.medicines.forEach((m, i) => {
      if (!m.name.trim()) {
        errors[`medicines.${i}.name`] = "Campo obligatorio";
      }

      optionalDate(
        errors,
        `medicines.${i}.administrationStartDate`,
        m.administrationStartDate,
      );
      optionalDate(
        errors,
        `medicines.${i}.administrationEndDate`,
        m.administrationEndDate,
      );
      assertNotBeforeBirth(
        errors,
        `medicines.${i}.administrationStartDate`,
        m.administrationStartDate,
        draft.patient.birthDate,
      );
      assertNotBeforeBirth(
        errors,
        `medicines.${i}.administrationEndDate`,
        m.administrationEndDate,
        draft.patient.birthDate,
      );
      assertRangeOrder(
        errors,
        `medicines.${i}.administrationStartDate`,
        `medicines.${i}.administrationEndDate`,
        m.administrationStartDate,
        m.administrationEndDate,
      );

      for (const [key, label] of [
        ["thcPercent", "THC"],
        ["cbdPercent", "CBD"],
        ["otherPercent", "Otro"],
      ] as const) {
        const v = m[key];
        if (v !== undefined && (!Number.isFinite(v) || v < 0 || v > 100)) {
          errors[`medicines.${i}.${key}`] =
            `${label}: valor entre 0 y 100 (%)`;
        }
      }

      if (
        m.recentProductChangeDetail &&
        m.recentProductChangeDetail.length > 100
      ) {
        errors[`medicines.${i}.recentProductChangeDetail`] =
          "Máximo 100 caracteres";
      }

      if (
        m.recentProductChange === true &&
        !m.recentProductChangeDetail?.trim()
      ) {
        errors[`medicines.${i}.recentProductChangeDetail`] =
          "Especifique el cambio reciente de producto";
      }
    });
  }

  if (step === 4) {
    if (
      draft.previousDiseases &&
      draft.previousDiseases.length > 500
    ) {
      errors.previousDiseases = "Máximo 500 caracteres";
    }

    if (
      draft.additionalComments &&
      draft.additionalComments.length > 500
    ) {
      errors.additionalComments = "Máximo 500 caracteres";
    }

    if (draft.hasConcomitantTreatments === true) {
      if (draft.concomitantTreatments.length === 0) {
        errors.concomitant = "Agregue al menos un medicamento concomitante";
      }
      draft.concomitantTreatments.forEach((t, i) => {
        if (!t.name.trim()) {
          errors[`concomitant.${i}.name`] = "Campo obligatorio";
        }
        requireDate(errors, `concomitant.${i}.startDate`, t.startDate);
        optionalDate(errors, `concomitant.${i}.endDate`, t.endDate);
        assertRangeOrder(
          errors,
          `concomitant.${i}.startDate`,
          `concomitant.${i}.endDate`,
          t.startDate,
          t.endDate,
        );
      });
    }
  }

  if (step === 5) {
    const c = draft.contact;
    if (!c.profession) errors.profession = "Campo obligatorio";

    if (c.reportingArea && c.reportingArea.length > 500) {
      errors.reportingArea = "Máximo 500 caracteres";
    }
    if (c.firstName && c.firstName.length > 50) {
      errors.firstName = "Máximo 50 caracteres";
    }
    if (c.lastName && c.lastName.length > 50) {
      errors.lastName = "Máximo 50 caracteres";
    }
    if (c.healthFacility && c.healthFacility.length > 100) {
      errors.healthFacility = "Máximo 100 caracteres";
    }

    const mailMsg = emailError(c.email, true);
    if (mailMsg) errors.email = mailMsg;

    const phoneMsg = uyPhoneError(c.phone, true);
    if (phoneMsg) errors.phone = phoneMsg;
  }

  return errors;
}

export function computeBmi(
  weightKg: number | undefined,
  heightM: number | undefined,
): string {
  if (!weightKg || !heightM || heightM <= 0) return "";
  const bmi = weightKg / (heightM * heightM);
  if (!Number.isFinite(bmi)) return "";
  return bmi.toFixed(1);
}

/** Años cumplidos entre fecha de nacimiento y una fecha de referencia. */
export function computeAgeYears(
  birthDateValue: string | undefined,
  referenceDateValue?: string | undefined,
): number | undefined {
  const birth = birthDateValue ? parseToDate(birthDateValue) : null;
  if (!birth) return undefined;

  let reference: Date;
  if (referenceDateValue) {
    const parsed = parseToDate(referenceDateValue);
    if (!parsed) return undefined;
    reference = parsed;
  } else {
    reference = startOfToday();
  }

  if (reference.getTime() < birth.getTime()) return undefined;

  let age = reference.getFullYear() - birth.getFullYear();
  const monthDiff = reference.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && reference.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  if (age < 0 || age > 120) return undefined;
  return age;
}

/** Fecha de inicio de evento más temprana entre las reacciones, si hay. */
export function earliestEventStartDate(
  draft: AdverseEventReportDraft,
): string | undefined {
  let earliest: Date | null = null;
  let earliestRaw: string | undefined;
  for (const ev of draft.events) {
    if (!ev.startDate?.trim()) continue;
    const d = parseToDate(ev.startDate);
    if (!d) continue;
    if (!earliest || d.getTime() < earliest.getTime()) {
      earliest = d;
      earliestRaw = ev.startDate;
    }
  }
  return earliestRaw;
}

/** Edad al comienzo del evento: nacimiento + inicio de evento (o hoy si aún no hay). */
export function computeAgeAtEventStart(
  draft: AdverseEventReportDraft,
): number | undefined {
  return computeAgeYears(
    draft.patient.birthDate,
    earliestEventStartDate(draft),
  );
}
