import {
  createEmptyConcomitantTreatment,
  type AdverseEventReportDraft,
  type ConcomitantTreatment,
} from "@canmedseg/shared";

import {
  AddButton,
  DateTriple,
  Field,
  SearchableSelect,
  SubCard,
  TextInput,
  UnitInput,
} from "../FormFields";
import fieldStyles from "../FormFields.module.css";
import { CIE10_DEMO_OPTIONS } from "../options";
import type { StepErrors } from "../validate";

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
  const diseases = draft.diseases ?? [];
  const treatments = draft.concomitantTreatments ?? [];

  function updateTreatment(index: number, partial: Partial<ConcomitantTreatment>) {
    onChange({
      concomitantTreatments: treatments.map((t, i) =>
        i === index ? { ...t, ...partial } : t,
      ),
    });
  }

  return (
    <>
      <p
        className={fieldStyles.hint}
        style={{ fontSize: 14, color: "var(--color-text-secondary)" }}
      >
        Enfermedades previas o actuales (CIE-10), tratamientos farmacológicos
        concomitantes y comentarios adicionales.
      </p>

      <h3 className={fieldStyles.subTitle}>Enfermedades previas o actuales</h3>
      <p className={fieldStyles.hint}>
        Lista desplegable según CIE-10 (módulo repetible)
      </p>

      {(diseases.length === 0 ? [""] : diseases).map((disease, index) => (
        <Field
          key={index}
          label={index === 0 ? "Código CIE-10" : `Código CIE-10 (${index + 1})`}
          htmlFor={`cie-${index}`}
        >
          <SearchableSelect
            id={`cie-${index}`}
            options={CIE10_DEMO_OPTIONS}
            value={disease}
            placeholder="Buscar código CIE-10..."
            onChange={(next) => {
              const list = diseases.length === 0 ? [""] : [...diseases];
              list[index] = next;
              onChange({ diseases: list });
            }}
          />
        </Field>
      ))}

      <button
        type="button"
        className={fieldStyles.removeBtn}
        onClick={() => {
          const base = diseases.length === 0 ? [""] : diseases;
          onChange({ diseases: [...base, ""] });
        }}
      >
        Agregar otra enfermedad
      </button>

      <h3 className={fieldStyles.subTitle} style={{ marginTop: 8 }}>
        Tratamientos farmacológicos concomitantes
      </h3>

      {treatments.map((t, index) => (
        <SubCard
          key={index}
          title={`Tratamiento concomitante (${index + 1})`}
          hint="Módulo repetible. Complete los datos de cada medicamento concomitante."
          onRemove={() =>
            onChange({
              concomitantTreatments: treatments.filter((_, i) => i !== index),
            })
          }
        >
          <Field
            label="Nombre del medicamento"
            htmlFor={`conc-${index}-name`}
            required={Boolean(t.name || t.startDate)}
            error={errors[`concomitant.${index}.name`]}
          >
            <TextInput
              id={`conc-${index}-name`}
              value={t.name}
              hasError={Boolean(errors[`concomitant.${index}.name`])}
              onChange={(e) => updateTreatment(index, { name: e.target.value })}
            />
          </Field>

          <Field label="Posología — Nº mg por toma" htmlFor={`conc-${index}-mg`}>
            <TextInput
              id={`conc-${index}-mg`}
              type="number"
              min={0}
              value={t.mgPerDose?.toString() ?? ""}
              onChange={(e) =>
                updateTreatment(index, {
                  mgPerDose: parseOptionalNumber(e.target.value),
                })
              }
            />
          </Field>

          <Field
            label="Posología — Nº tomas por día"
            htmlFor={`conc-${index}-tomas`}
          >
            <TextInput
              id={`conc-${index}-tomas`}
              type="number"
              min={0}
              value={t.dosesPerDay?.toString() ?? ""}
              onChange={(e) =>
                updateTreatment(index, {
                  dosesPerDay: parseOptionalNumber(e.target.value),
                })
              }
            />
          </Field>

          <Field
            label="Fecha de inicio de la administración"
            required={Boolean(t.name || t.startDate)}
            error={errors[`concomitant.${index}.startDate`]}
            hint="Formato dd/mm/aaaa — año entre 1900 y 2100"
          >
            <DateTriple
              idPrefix={`conc-${index}-start`}
              value={t.startDate}
              hasError={Boolean(errors[`concomitant.${index}.startDate`])}
              onChange={(startDate) => updateTreatment(index, { startDate })}
            />
          </Field>

          <Field
            label="Fecha de fin de la administración"
            error={errors[`concomitant.${index}.endDate`]}
            hint="En caso de aún no haber finalizado, no completar"
          >
            <DateTriple
              idPrefix={`conc-${index}-end`}
              value={t.endDate ?? ""}
              hasError={Boolean(errors[`concomitant.${index}.endDate`])}
              onChange={(endDate) => updateTreatment(index, { endDate })}
            />
          </Field>

          <Field
            label="Duración del uso del medicamento concomitante"
            htmlFor={`conc-${index}-dur`}
            hint="Tiempo de uso del medicamento concomitante"
          >
            <UnitInput
              id={`conc-${index}-dur`}
              unit="días"
              value={t.durationDays?.toString() ?? ""}
              min={0}
              onChange={(v) =>
                updateTreatment(index, {
                  durationDays: parseOptionalNumber(v),
                })
              }
            />
          </Field>
        </SubCard>
      ))}

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
        Agregar otro tratamiento
      </AddButton>

      <Field label="Comentarios adicionales" htmlFor="f-comments">
        <textarea
          id="f-comments"
          className={fieldStyles.textarea}
          value={draft.additionalComments ?? ""}
          rows={4}
          onChange={(e) => onChange({ additionalComments: e.target.value })}
        />
      </Field>
    </>
  );
}
