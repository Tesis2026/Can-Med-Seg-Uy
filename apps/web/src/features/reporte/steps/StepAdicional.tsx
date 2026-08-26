import {
  createEmptyConcomitantTreatment,
  type AdverseEventReportDraft,
  type ConcomitantTreatment,
} from "@canmedseg/shared";

import {
  AddButton,
  DateTriple,
  Field,
  SelectInput,
  SubCard,
  TextInput,
  UnitInput,
} from "../FormFields";
import fieldStyles from "../FormFields.module.css";
import { YES_NO_OPTIONS } from "../options";
import type { StepErrors } from "../validate";
import { durationDaysBetween } from "../validate";

type StepAdicionalProps = {
  draft: AdverseEventReportDraft;
  errors: StepErrors;
  onChange: (patch: Partial<AdverseEventReportDraft>) => void;
};

function parseOptionalNumber(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function StepAdicional({ draft, errors, onChange }: StepAdicionalProps) {
  const treatments = draft.concomitantTreatments ?? [];
  const showTreatments = draft.hasConcomitantTreatments === true;

  function updateTreatment(
    index: number,
    partial: Partial<ConcomitantTreatment>,
  ) {
    onChange({
      concomitantTreatments: treatments.map((t, i) =>
        i === index ? { ...t, ...partial } : t,
      ),
    });
  }

  return (
    <>
      <Field
        label="Enfermedades previas o actuales"
        htmlFor="f-enfermedades"
        error={errors.previousDiseases}
      >
        <textarea
          id="f-enfermedades"
          className={fieldStyles.textarea}
          value={draft.previousDiseases ?? ""}
          maxLength={500}
          rows={4}
          onChange={(e) => onChange({ previousDiseases: e.target.value })}
        />
      </Field>

      <Field
        label="Tratamientos farmacológicos concomitantes"
        htmlFor="f-conc-si-no"
      >
        <SelectInput
          id="f-conc-si-no"
          value={
            draft.hasConcomitantTreatments === undefined
              ? ""
              : draft.hasConcomitantTreatments
                ? "si"
                : "no"
          }
          onChange={(e) => {
            if (!e.target.value) {
              onChange({ hasConcomitantTreatments: undefined });
              return;
            }
            const yes = e.target.value === "si";
            onChange({
              hasConcomitantTreatments: yes,
              concomitantTreatments: yes
                ? treatments.length > 0
                  ? treatments
                  : [createEmptyConcomitantTreatment()]
                : [],
            });
          }}
        >
          {YES_NO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectInput>
      </Field>

      {errors.concomitant ? (
        <p className={fieldStyles.error}>{errors.concomitant}</p>
      ) : null}

      {showTreatments
        ? treatments.map((t, index) => {
            const computedDuration = durationDaysBetween(t.startDate, t.endDate);
            const durationDisplay =
              t.durationDays?.toString() ??
              (computedDuration !== undefined
                ? String(computedDuration)
                : "");

            return (
              <SubCard
                key={index}
                title={`Tratamiento concomitante${
                  treatments.length > 1 ? ` (${index + 1})` : ""
                }`}
                onRemove={
                  treatments.length > 1
                    ? () =>
                        onChange({
                          concomitantTreatments: treatments.filter(
                            (_, i) => i !== index,
                          ),
                        })
                    : undefined
                }
              >
                <Field
                  label="Nombre del medicamento"
                  htmlFor={`conc-${index}-name`}
                  required
                  error={errors[`concomitant.${index}.name`]}
                >
                  <TextInput
                    id={`conc-${index}-name`}
                    value={t.name}
                    hasError={Boolean(errors[`concomitant.${index}.name`])}
                    onChange={(e) =>
                      updateTreatment(index, { name: e.target.value })
                    }
                  />
                </Field>

                <Field
                  label="Posología (miligramos/toma)"
                  htmlFor={`conc-${index}-mg`}
                >
                  <UnitInput
                    id={`conc-${index}-mg`}
                    unit="mg"
                    value={t.mgPerDose?.toString() ?? ""}
                    min={0}
                    step="0.1"
                    onChange={(v) =>
                      updateTreatment(index, {
                        mgPerDose: parseOptionalNumber(v),
                      })
                    }
                  />
                </Field>

                <Field
                  label="Posología (tomas/día)"
                  htmlFor={`conc-${index}-tomas`}
                >
                  <TextInput
                    id={`conc-${index}-tomas`}
                    type="number"
                    min={1}
                    value={t.dosesPerDay?.toString() ?? ""}
                    onChange={(e) =>
                      updateTreatment(index, {
                        dosesPerDay: parseOptionalNumber(e.target.value),
                      })
                    }
                  />
                </Field>

                <Field
                  label="Fecha de inicio de la administración del medicamento"
                  required
                  error={errors[`concomitant.${index}.startDate`]}
                  hint="dd/mm/aaaa"
                >
                  <DateTriple
                    idPrefix={`conc-${index}-start`}
                    value={t.startDate}
                    hasError={Boolean(errors[`concomitant.${index}.startDate`])}
                    onChange={(startDate) => {
                      const durationDays =
                        durationDaysBetween(startDate, t.endDate) ??
                        t.durationDays;
                      updateTreatment(index, { startDate, durationDays });
                    }}
                  />
                </Field>

                <Field
                  label="Fecha de fin de la administración del medicamento"
                  error={errors[`concomitant.${index}.endDate`]}
                  hint="En caso de aún no haber finalizado, no completar"
                >
                  <DateTriple
                    idPrefix={`conc-${index}-end`}
                    value={t.endDate ?? ""}
                    hasError={Boolean(errors[`concomitant.${index}.endDate`])}
                    onChange={(endDate) => {
                      const durationDays =
                        durationDaysBetween(t.startDate, endDate) ??
                        t.durationDays;
                      updateTreatment(index, { endDate, durationDays });
                    }}
                  />
                </Field>

                <Field
                  label="Duración del uso del medicamento concomitante"
                  htmlFor={`conc-${index}-dur`}
                  hint="Se calcula en días a partir de las fechas de inicio y fin"
                >
                  <UnitInput
                    id={`conc-${index}-dur`}
                    unit="días"
                    value={durationDisplay}
                    min={1}
                    onChange={(v) =>
                      updateTreatment(index, {
                        durationDays: parseOptionalNumber(v),
                      })
                    }
                  />
                </Field>
              </SubCard>
            );
          })
        : null}

      {showTreatments ? (
        <AddButton
          onClick={() =>
            onChange({
              concomitantTreatments: [
                ...treatments,
                createEmptyConcomitantTreatment(),
              ],
            })
          }
        >
          Agregar otro medicamento
        </AddButton>
      ) : null}

      <Field
        label="Comentarios adicionales"
        htmlFor="f-comments"
        error={errors.additionalComments}
      >
        <textarea
          id="f-comments"
          className={fieldStyles.textarea}
          value={draft.additionalComments ?? ""}
          maxLength={500}
          rows={4}
          onChange={(e) => onChange({ additionalComments: e.target.value })}
        />
      </Field>
    </>
  );
}
