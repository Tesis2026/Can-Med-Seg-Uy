import {
  createEmptyAdverseEvent,
  type AdverseEvent,
  type AdverseEventReportDraft,
  type SeriousnessCriterion,
} from "@canmedseg/shared";

import {
  AddButton,
  DateTriple,
  Field,
  SearchableSelect,
  SelectInput,
  SubCard,
  UnitInput,
} from "../FormFields";
import fieldStyles from "../FormFields.module.css";
import {
  EVENT_OUTCOME_OPTIONS,
  MEDDRA_DEMO_OPTIONS,
  SERIOUSNESS_OPTIONS,
  YES_NO_OPTIONS,
} from "../options";
import type { StepErrors } from "../validate";
import {
  computeAgeYears,
  durationDaysBetween,
  earliestEventStartDate,
} from "../validate";

type StepEventosProps = {
  draft: AdverseEventReportDraft;
  errors: StepErrors;
  onChange: (patch: Partial<AdverseEventReportDraft>) => void;
};

export function StepEventos({ draft, errors, onChange }: StepEventosProps) {
  const events = draft.events;

  function setEvents(
    next: AdverseEvent[] | ((prev: AdverseEvent[]) => AdverseEvent[]),
  ) {
    const eventsNext = typeof next === "function" ? next(events) : next;
    const ageAtEventStart = computeAgeYears(
      draft.patient.birthDate,
      earliestEventStartDate({ ...draft, events: eventsNext }),
    );
    onChange({
      events: eventsNext,
      patient: {
        ...draft.patient,
        ageAtEventStart,
      },
    });
  }

  function updateAt(index: number, partial: Partial<AdverseEvent>) {
    setEvents((prev) =>
      prev.map((ev, i) => (i === index ? { ...ev, ...partial } : ev)),
    );
  }

  return (
    <>
      <Field
        label="Evento adverso"
        htmlFor="f-evento-desc"
        required
        error={errors.adverseEventDescription}
      >
        <textarea
          id="f-evento-desc"
          className={fieldStyles.textarea}
          value={draft.adverseEventDescription}
          maxLength={500}
          rows={4}
          onChange={(e) =>
            onChange({ adverseEventDescription: e.target.value })
          }
        />
      </Field>

      {errors.events ? (
        <p className={fieldStyles.error}>{errors.events}</p>
      ) : null}

      {events.map((ev, index) => {
        return (
          <SubCard
            key={index}
            title={`Reacción/Síntoma${events.length > 1 ? ` (${index + 1})` : ""}`}
            onRemove={
              events.length > 1
                ? () => setEvents((prev) => prev.filter((_, i) => i !== index))
                : undefined
            }
          >
            <Field
              label="Reacción/Síntoma"
              htmlFor={`ev-${index}-meddra`}
              required
              error={errors[`events.${index}.meddraTerm`]}
              hint="Clasificación según diccionario médico MedDRA"
            >
              <SearchableSelect
                id={`ev-${index}-meddra`}
                options={MEDDRA_DEMO_OPTIONS}
                value={ev.meddraTerm ?? ""}
                placeholder="Buscar término MedDRA..."
                onChange={(meddraTerm) => updateAt(index, { meddraTerm })}
              />
            </Field>

            <Field
              label="Fecha de inicio del evento adverso"
              required
              error={errors[`events.${index}.startDate`]}
              hint="dd/mm/aaaa — desde la fecha de nacimiento hasta hoy"
            >
              <DateTriple
                idPrefix={`ev-${index}-start`}
                value={ev.startDate ?? ""}
                hasError={Boolean(errors[`events.${index}.startDate`])}
                onChange={(startDate) => {
                  updateAt(index, {
                    startDate,
                    durationDays: durationDaysBetween(startDate, ev.endDate),
                  });
                }}
              />
            </Field>

            <Field
              label="Fecha de finalización del evento adverso"
              error={errors[`events.${index}.endDate`]}
              hint="Si aún no finalizó, dejar vacío"
            >
              <DateTriple
                idPrefix={`ev-${index}-end`}
                value={ev.endDate ?? ""}
                hasError={Boolean(errors[`events.${index}.endDate`])}
                onChange={(endDate) => {
                  updateAt(index, {
                    endDate,
                    durationDays: durationDaysBetween(ev.startDate, endDate),
                  });
                }}
              />
            </Field>

            <Field
              label="Duración del evento adverso"
              htmlFor={`ev-${index}-dur`}
              hint="Días — se calcula automáticamente con las fechas de inicio y fin"
            >
              <UnitInput
                id={`ev-${index}-dur`}
                unit="días"
                value={
                  durationDaysBetween(ev.startDate, ev.endDate)?.toString() ??
                  ""
                }
                readOnly
                placeholder="Se calcula con inicio y fin"
              />
            </Field>

            <Field
              label="Estado actual del evento adverso"
              htmlFor={`ev-${index}-out`}
            >
              <SelectInput
                id={`ev-${index}-out`}
                value={ev.outcome ?? ""}
                onChange={(e) =>
                  updateAt(index, {
                    outcome: e.target.value
                      ? (e.target.value as AdverseEvent["outcome"])
                      : undefined,
                  })
                }
              >
                {EVENT_OUTCOME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field
              label="¿El evento adverso fue grave?"
              htmlFor={`ev-${index}-grave`}
              required
              error={errors[`events.${index}.isSerious`]}
              hint="Se considera grave si causó la muerte, puso en riesgo la vida, requirió o prolongó una hospitalización, produjo discapacidad, una malformación congénita u otra condición médica importante."
            >
              <SelectInput
                id={`ev-${index}-grave`}
                value={
                  ev.isSerious === undefined ? "" : ev.isSerious ? "si" : "no"
                }
                hasError={Boolean(errors[`events.${index}.isSerious`])}
                onChange={(e) => {
                  if (!e.target.value) {
                    updateAt(index, {
                      isSerious: undefined,
                      seriousnessCriterion: undefined,
                    });
                    return;
                  }
                  const isSerious = e.target.value === "si";
                  updateAt(index, {
                    isSerious,
                    seriousnessCriterion: isSerious
                      ? ev.seriousnessCriterion
                      : undefined,
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

            {ev.isSerious ? (
              <Field
                label="Indicador de gravedad"
                htmlFor={`ev-${index}-ind`}
                required
                error={errors[`events.${index}.seriousnessCriterion`]}
              >
                <SelectInput
                  id={`ev-${index}-ind`}
                  value={ev.seriousnessCriterion ?? ""}
                  hasError={Boolean(
                    errors[`events.${index}.seriousnessCriterion`],
                  )}
                  onChange={(e) =>
                    updateAt(index, {
                      seriousnessCriterion: e.target.value
                        ? (e.target.value as SeriousnessCriterion)
                        : undefined,
                    })
                  }
                >
                  {SERIOUSNESS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            ) : null}
          </SubCard>
        );
      })}

      <AddButton
        onClick={() =>
          setEvents((prev) => [...prev, createEmptyAdverseEvent()])
        }
      >
        Agregar otra reacción/síntoma
      </AddButton>

    </>
  );
}
