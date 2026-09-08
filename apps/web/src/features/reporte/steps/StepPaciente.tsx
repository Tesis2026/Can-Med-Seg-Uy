import {
  UY_DEPARTMENTS,
  UY_DEPARTMENT_LABELS,
  type AdverseEventReportDraft,
  type Patient,
} from "@canmedseg/shared";

import {
  DateTriple,
  Field,
  SelectInput,
  TextInput,
  UnitInput,
} from "../FormFields";
import { COUNTRY_OPTIONS, SEX_OPTIONS } from "../options";
import type { StepErrors } from "../validate";
import {
  computeAgeAtEventStart,
  computeAgeYears,
  computeBmi,
  earliestEventStartDate,
} from "../validate";

type StepPacienteProps = {
  draft: AdverseEventReportDraft;
  errors: StepErrors;
  onChange: (patient: Patient) => void;
};

function parseOptionalNumber(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function StepPaciente({ draft, errors, onChange }: StepPacienteProps) {
  const p = draft.patient;
  const bmi = computeBmi(p.weightKg, p.heightM);
  const heightCm = p.heightM === undefined ? "" : String(p.heightM * 100);
  const ageDisplay =
    p.ageAtEventStart?.toString() ??
    computeAgeAtEventStart(draft)?.toString() ??
    "";

  function patch(partial: Partial<Patient>) {
    onChange({ ...p, ...partial });
  }

  return (
    <>
      <Field
        label="Iniciales"
        htmlFor="f-initials"
        required
        error={errors.initials}
      >
        <TextInput
          id="f-initials"
          value={p.initials}
          maxLength={4}
          hasError={Boolean(errors.initials)}
          onChange={(e) => patch({ initials: e.target.value })}
          autoComplete="off"
        />
      </Field>

      <Field label="Número de cédula" htmlFor="f-cedula" error={errors.nationalId}>
        <TextInput
          id="f-cedula"
          value={p.nationalId ?? ""}
          inputMode="numeric"
          hasError={Boolean(errors.nationalId)}
          onChange={(e) =>
            patch({
              nationalId: e.target.value.replace(/\D/g, "").slice(0, 8),
            })
          }
        />
      </Field>

      <Field label="Sexo" htmlFor="f-sex" required error={errors.sex}>
        <SelectInput
          id="f-sex"
          value={p.sex ?? ""}
          hasError={Boolean(errors.sex)}
          onChange={(e) =>
            patch({
              sex: e.target.value
                ? (e.target.value as Patient["sex"])
                : undefined,
            })
          }
        >
          {SEX_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Peso" htmlFor="f-peso" error={errors.weightKg}>
        <UnitInput
          id="f-peso"
          unit="kg"
          value={p.weightKg?.toString() ?? ""}
          min={5}
          max={200}
          step="0.1"
          hasError={Boolean(errors.weightKg)}
          onChange={(v) => patch({ weightKg: parseOptionalNumber(v) })}
        />
      </Field>

      <Field label="Talla" htmlFor="f-talla" error={errors.heightM}>
        <UnitInput
          id="f-talla"
          unit="cm"
          value={heightCm}
          min={50}
          max={250}
          step="1"
          hasError={Boolean(errors.heightM)}
          onChange={(v) => {
            const centimeters = parseOptionalNumber(v);
            patch({ heightM: centimeters === undefined ? undefined : centimeters / 100 });
          }}
        />
      </Field>

      <Field
        label="Índice de masa corporal"
        htmlFor="f-imc"
        hint="Se calcula en kg/m² a partir del peso y la talla"
      >
        <TextInput
          id="f-imc"
          value={bmi}
          readOnly
          placeholder="Se calcula a partir de peso y talla"
        />
      </Field>

      <Field
        label="Fecha de nacimiento"
        required
        error={errors.birthDate}
        hint="dd/mm/aaaa"
      >
        <DateTriple
          idPrefix="f-birth"
          value={p.birthDate}
          hasError={Boolean(errors.birthDate)}
          onChange={(birthDate) => {
            const eventStart = earliestEventStartDate(draft);
            patch({
              birthDate,
              ageAtEventStart: computeAgeYears(birthDate, eventStart),
            });
          }}
        />
      </Field>

      <Field
        label="Edad al comienzo del evento adverso"
        htmlFor="f-edad"
        hint="Se calcula en años con la fecha de nacimiento y, si ya está cargada, la fecha de inicio del evento"
      >
        <TextInput
          id="f-edad"
          value={ageDisplay}
          readOnly
          placeholder="Se calcula a partir de la fecha de nacimiento"
        />
      </Field>

      <Field
        label="País en donde comenzó el evento adverso"
        htmlFor="f-pais"
        required
        error={errors.countryOfEventStart}
      >
        <SelectInput
          id="f-pais"
          value={p.countryOfEventStart || "Uruguay"}
          hasError={Boolean(errors.countryOfEventStart)}
          onChange={(e) => patch({ countryOfEventStart: e.target.value })}
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectInput>
      </Field>

      {/* Alimenta la distribución por región del dashboard (RF-7.2). */}
      {(p.countryOfEventStart || "Uruguay") === "Uruguay" ? (
        <Field label="Departamento" htmlFor="f-departamento" error={errors.department}>
          <SelectInput
            id="f-departamento"
            value={p.department ?? ""}
            hasError={Boolean(errors.department)}
            placeholder="Seleccionar departamento"
            onChange={(e) =>
              patch({
                department: e.target.value
                  ? (e.target.value as Patient["department"])
                  : undefined,
              })
            }
          >
            {UY_DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {UY_DEPARTMENT_LABELS[department]}
              </option>
            ))}
          </SelectInput>
        </Field>
      ) : null}
    </>
  );
}
