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
  TextInput,
  UnitInput,
} from "../FormFields";
import fieldStyles from "../FormFields.module.css";
import {
  CAUSALITY_OPTIONS,
  EVENT_OUTCOME_OPTIONS,
  MEDDRA_DEMO_OPTIONS,
  SERIOUSNESS_OPTIONS,
  SEVERITY_GRADE_OPTIONS,
} from "../options";
import type { StepErrors } from "../validate";

type StepEventosProps = {
  draft: AdverseEventReportDraft;
  errors: StepErrors;
  onChange: (
    events:
      | AdverseEvent[]
      | ((prev: AdverseEvent[]) => AdverseEvent[]),
  ) => void;
};

function parseOptionalNumber(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function StepEventos({ draft, errors, onChange }: StepEventosProps) {
  const events = draft.events;

  function updateAt(index: number, partial: Partial<AdverseEvent>) {
    onChange((prev) =>
      prev.map((ev, i) => (i === index ? { ...ev, ...partial } : ev)),
    );
  }

  function toggleCriterion(
    index: number,
    criterion: SeriousnessCriterion,
    checked: boolean,
  ) {
    const current = events[index].seriousnessCriteria ?? [];
    const next = checked
      ? [...current, criterion]
      : current.filter((c) => c !== criterion);
    updateAt(index, { seriousnessCriteria: next });
  }

  return (
    <>
      <p className={fieldStyles.hint} style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
        Describa cada evento adverso. Presione el botón &quot;Agregar otro evento
        adverso&quot; para agregar otros eventos que necesite describir.
      </p>

      {errors.events ? (
        <p className={fieldStyles.error}>{errors.events}</p>
      ) : null}

      {events.map((ev, index) => (
        <SubCard
          key={index}
          title={`Eventos adversos${events.length > 1 ? ` (${index + 1})` : ""}`}
          hint="Módulo repetible. Complete los datos de cada evento adverso."
          onRemove={
            events.length > 1
              ? () =>
                  onChange((prev) => prev.filter((_, i) => i !== index))
              : undefined
          }
        >
          <Field
            label="Reacción/Síntoma"
            htmlFor={`ev-${index}-meddra`}
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
            label="Evento adverso"
            htmlFor={`ev-${index}-desc`}
            required
            error={errors[`events.${index}.description`]}
          >
            <TextInput
              id={`ev-${index}-desc`}
              value={ev.description}
              hasError={Boolean(errors[`events.${index}.description`])}
              onChange={(e) => updateAt(index, { description: e.target.value })}
            />
          </Field>

          <Field
            label="Fecha de inicio del evento adverso"
            required
            error={errors[`events.${index}.startDate`]}
            hint="Formato dd/mm/aaaa — año entre 1900 y 2100"
          >
            <DateTriple
              idPrefix={`ev-${index}-start`}
              value={ev.startDate ?? ""}
              hasError={Boolean(errors[`events.${index}.startDate`])}
              onChange={(startDate) => updateAt(index, { startDate })}
            />
          </Field>

          <Field
            label="Fecha de finalización del evento adverso"
            error={errors[`events.${index}.endDate`]}
            hint="En caso de aún no haber finalizado, no completar"
          >
            <DateTriple
              idPrefix={`ev-${index}-end`}
              value={ev.endDate ?? ""}
              hasError={Boolean(errors[`events.${index}.endDate`])}
              onChange={(endDate) => updateAt(index, { endDate })}
            />
          </Field>

          <Field
            label="Duración del evento adverso"
            htmlFor={`ev-${index}-dur`}
            error={errors[`events.${index}.durationDays`]}
            hint="Duración de la manifestación clínica"
          >
            <UnitInput
              id={`ev-${index}-dur`}
              unit="días"
              value={ev.durationDays?.toString() ?? ""}
              min={0}
              hasError={Boolean(errors[`events.${index}.durationDays`])}
              onChange={(v) =>
                updateAt(index, { durationDays: parseOptionalNumber(v) })
              }
            />
          </Field>

          <Field label="Estado actual del evento adverso" htmlFor={`ev-${index}-out`}>
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
            hint="Criterios: amenaza de vida, muerte, hospitalización, discapacidad, malformación congénita u otra condición médica importante"
          >
            <SelectInput
              id={`ev-${index}-grave`}
              value={
                ev.isSerious === undefined ? "" : ev.isSerious ? "si" : "no"
              }
              hasError={Boolean(errors[`events.${index}.isSerious`])}
              onChange={(e) => {
                if (!e.target.value) {
                  updateAt(index, { isSerious: undefined });
                  return;
                }
                updateAt(index, { isSerious: e.target.value === "si" });
              }}
            >
              <option value="si">Sí</option>
              <option value="no">No</option>
            </SelectInput>
          </Field>

          {ev.isSerious ? (
            <>
              <Field
                label="Indicador de gravedad"
                required
                error={errors[`events.${index}.seriousnessCriteria`]}
              >
                <div className={fieldStyles.checkList}>
                  {SERIOUSNESS_OPTIONS.map((o) => (
                    <label key={o.value} className={fieldStyles.checkItem}>
                      <input
                        type="checkbox"
                        checked={(ev.seriousnessCriteria ?? []).includes(
                          o.value,
                        )}
                        onChange={(e) =>
                          toggleCriterion(index, o.value, e.target.checked)
                        }
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </Field>

              {(ev.seriousnessCriteria ?? []).includes(
                "otra_condicion_medica",
              ) ? (
                <Field
                  label="Especifique la otra condición médica importante"
                  htmlFor={`ev-${index}-otra`}
                  required
                  error={errors[`events.${index}.otherSeriousCondition`]}
                  hint="Complete solo si seleccionó la opción de otra condición médica importante"
                >
                  <TextInput
                    id={`ev-${index}-otra`}
                    value={ev.otherSeriousCondition ?? ""}
                    hasError={Boolean(
                      errors[`events.${index}.otherSeriousCondition`],
                    )}
                    onChange={(e) =>
                      updateAt(index, {
                        otherSeriousCondition: e.target.value,
                      })
                    }
                  />
                </Field>
              ) : null}
            </>
          ) : null}

          <Field
            label="Clasificación de gravedad"
            htmlFor={`ev-${index}-sev`}
            hint="Leve, moderado, grave (clasificación OMS)"
          >
            <SelectInput
              id={`ev-${index}-sev`}
              value={ev.severityGrade ?? ""}
              onChange={(e) =>
                updateAt(index, {
                  severityGrade: e.target.value
                    ? (e.target.value as AdverseEvent["severityGrade"])
                    : undefined,
                })
              }
            >
              {SEVERITY_GRADE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field
            label="Relación causal"
            htmlFor={`ev-${index}-caus`}
            hint="Escala de Causalidad OMS-UMC"
          >
            <SelectInput
              id={`ev-${index}-caus`}
              value={ev.causality ?? ""}
              onChange={(e) =>
                updateAt(index, {
                  causality: e.target.value
                    ? (e.target.value as AdverseEvent["causality"])
                    : undefined,
                })
              }
            >
              {CAUSALITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectInput>
          </Field>
        </SubCard>
      ))}

      <AddButton
        onClick={() =>
          onChange((prev) => [...prev, createEmptyAdverseEvent()])
        }
      >
        Agregar otro evento adverso
      </AddButton>
    </>
  );
}
