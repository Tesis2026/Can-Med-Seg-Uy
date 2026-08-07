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

function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

export function validateStep(
  step: number,
  draft: AdverseEventReportDraft,
): StepErrors {
  const errors: StepErrors = {};
  const today = startOfToday();

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
    if (!errors.birthDate) {
      const birth = parseToDate(p.birthDate);
      if (birth && birth.getTime() > today.getTime()) {
        errors.birthDate = "La fecha de nacimiento no puede ser futura";
      }
    }

    const ageMsg = ageError(p.ageAtEventStart, true);
    if (ageMsg) errors.ageAtEventStart = ageMsg;

    if (!p.countryOfEventStart.trim()) {
      errors.countryOfEventStart = "Campo obligatorio";
    }
  }

  if (step === 2) {
    if (draft.events.length === 0) {
      errors.events = "Agregue al menos un evento adverso";
    }
    draft.events.forEach((ev, i) => {
      if (!ev.description.trim()) {
        errors[`events.${i}.description`] = "Campo obligatorio";
      }

      requireDate(errors, `events.${i}.startDate`, ev.startDate);
      if (!errors[`events.${i}.startDate`]) {
        const start = parseToDate(ev.startDate);
        if (start && start.getTime() > today.getTime()) {
          errors[`events.${i}.startDate`] =
            "La fecha de inicio no puede ser futura";
        }
      }

      optionalDate(errors, `events.${i}.endDate`, ev.endDate);
      assertRangeOrder(
        errors,
        `events.${i}.startDate`,
        `events.${i}.endDate`,
        ev.startDate,
        ev.endDate,
      );

      if (
        ev.durationDays !== undefined &&
        (!Number.isFinite(ev.durationDays) ||
          ev.durationDays < 0 ||
          ev.durationDays > 36500)
      ) {
        errors[`events.${i}.durationDays`] = "Duración inválida";
      }

      if (ev.isSerious === undefined) {
        errors[`events.${i}.isSerious`] = "Campo obligatorio";
      }
      if (
        ev.isSerious &&
        (!ev.seriousnessCriteria || ev.seriousnessCriteria.length === 0)
      ) {
        errors[`events.${i}.seriousnessCriteria`] =
          "Seleccione al menos un indicador de gravedad";
      }
      if (
        ev.isSerious &&
        ev.seriousnessCriteria.includes("otra_condicion_medica") &&
        !ev.otherSeriousCondition?.trim()
      ) {
        errors[`events.${i}.otherSeriousCondition`] =
          "Especifique la otra condición médica";
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
      requireDate(
        errors,
        `medicines.${i}.administrationStartDate`,
        m.administrationStartDate,
      );
      if (!errors[`medicines.${i}.administrationStartDate`]) {
        const start = parseToDate(m.administrationStartDate);
        if (start && start.getTime() > today.getTime()) {
          errors[`medicines.${i}.administrationStartDate`] =
            "La fecha de inicio no puede ser futura";
        }
      }
      optionalDate(
        errors,
        `medicines.${i}.administrationEndDate`,
        m.administrationEndDate,
      );
      assertRangeOrder(
        errors,
        `medicines.${i}.administrationStartDate`,
        `medicines.${i}.administrationEndDate`,
        m.administrationStartDate,
        m.administrationEndDate,
      );

      for (const [key, label] of [
        ["thcMg", "THC"],
        ["cbdMg", "CBD"],
        ["otherCompositionMg", "Otros"],
      ] as const) {
        const v = m[key];
        if (v !== undefined && (!Number.isFinite(v) || v < 0 || v > 100000)) {
          errors[`medicines.${i}.${key}`] = `${label}: valor numérico inválido`;
        }
      }

      if (
        m.recentProductChange === true &&
        !m.recentProductChangeDetail?.trim()
      ) {
        errors[`medicines.${i}.recentProductChangeDetail`] =
          "Especifique marca, dosis y/o presentación";
      }
    });
  }

  if (step === 4) {
    draft.concomitantTreatments.forEach((t, i) => {
      if (t.name.trim() || t.startDate) {
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
      }
    });
  }

  if (step === 5) {
    const c = draft.contact;
    if (!c.profession) errors.profession = "Campo obligatorio";

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
