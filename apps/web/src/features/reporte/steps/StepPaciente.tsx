import type { AdverseEventReportDraft, Patient } from "@canmedseg/shared";

import {
  DateTriple,
  Field,
  SelectInput,
  TextInput,
  UnitInput,
} from "../FormFields";
import { COUNTRY_OPTIONS, SEX_OPTIONS } from "../options";
import type { StepErrors } from "../validate";
import { computeBmi } from "../validate";

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

  function patch(partial: Partial<Patient>) {
    onChange({ ...p, ...partial });
  }

  return (
    <>
      <Field label="Iniciales" htmlFor="f-initials" required error={errors.initials}>
        <TextInput
          id="f-initials"
          value={p.initials}
          hasError={Boolean(errors.initials)}
          onChange={(e) => patch({ initials: e.target.value })}
          autoComplete="off"
        />
      </Field>

      <Field
        label="Número de Cédula"
        htmlFor="f-cedula"
        error={errors.nationalId}
        hint="Opcional — cédula uruguaya con dígito verificador"
      >
        <TextInput
          id="f-cedula"
          value={p.nationalId ?? ""}
          inputMode="numeric"
          hasError={Boolean(errors.nationalId)}
          placeholder="Ej. 12345678"
          onChange={(e) => patch({ nationalId: e.target.value })}
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

      <Field
        label="Peso (Kg)"
        htmlFor="f-peso"
        error={errors.weightKg}
      >
        <UnitInput
          id="f-peso"
          unit="kg"
          value={p.weightKg?.toString() ?? ""}
          min={0}
          step="0.1"
          hasError={Boolean(errors.weightKg)}
          onChange={(v) => patch({ weightKg: parseOptionalNumber(v) })}
        />
      </Field>

      <Field
        label="Talla (m)"
        htmlFor="f-talla"
        error={errors.heightM}
      >
        <UnitInput
          id="f-talla"
          unit="m"
          value={p.heightM?.toString() ?? ""}
          min={0}
          step="0.01"
          hasError={Boolean(errors.heightM)}
          onChange={(v) => patch({ heightM: parseOptionalNumber(v) })}
        />
      </Field>

      <Field
        label="Índice de masa corporal"
        htmlFor="f-imc"
        hint="kg/m² — puede calcularse a partir de peso y talla"
      >
        <TextInput
          id="f-imc"
          value={bmi}
          readOnly
          placeholder="kg/m² — puede calcularse a partir de peso y talla"
        />
      </Field>

      <Field
        label="Fecha de nacimiento"
        required
        error={errors.birthDate}
        hint="Formato dd/mm/aaaa — año entre 1900 y 2100"
      >
        <DateTriple
          idPrefix="f-birth"
          value={p.birthDate}
          hasError={Boolean(errors.birthDate)}
          onChange={(birthDate) => patch({ birthDate })}
        />
      </Field>

      <Field
        label="Edad al comienzo del evento adverso"
        htmlFor="f-edad"
        required
        error={errors.ageAtEventStart}
        hint="Campo obligatorio"
      >
        <TextInput
          id="f-edad"
          type="number"
          min={0}
          value={p.ageAtEventStart?.toString() ?? ""}
          hasError={Boolean(errors.ageAtEventStart)}
          onChange={(e) =>
            patch({ ageAtEventStart: parseOptionalNumber(e.target.value) })
          }
        />
      </Field>

      <Field
        label="País donde comenzó el evento adverso"
        htmlFor="f-pais"
        required
        error={errors.countryOfEventStart}
        hint="Campo obligatorio"
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
    </>
  );
}
