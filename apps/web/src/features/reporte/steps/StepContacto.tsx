import type { AdverseEventReportDraft, Contact } from "@canmedseg/shared";

import { Field, SelectInput, TextInput } from "../FormFields";
import { PROFESSION_OPTIONS, REPORTING_AREA_OPTIONS } from "../options";
import type { StepErrors } from "../validate";

type StepContactoProps = {
  draft: AdverseEventReportDraft;
  errors: StepErrors;
  onChange: (contact: Contact) => void;
};

export function StepContacto({ draft, errors, onChange }: StepContactoProps) {
  const c = draft.contact;

  function patch(partial: Partial<Contact>) {
    onChange({ ...c, ...partial });
  }

  return (
    <>
      <Field
        label="Área reportante"
        htmlFor="f-area"
        error={errors.reportingArea}
      >
        <SelectInput
          id="f-area"
          value={c.reportingArea ?? ""}
          hasError={Boolean(errors.reportingArea)}
          placeholder="Seleccionar institución"
          onChange={(e) =>
            patch({
              reportingArea: e.target.value,
              reportingAreaOther:
                e.target.value === "otro" ? c.reportingAreaOther : "",
            })
          }
        >
          {REPORTING_AREA_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </Field>

      {c.reportingArea === "otro" ? (
        <Field
          label="Especifique la institución"
          htmlFor="f-area-other"
          required
          error={errors.reportingAreaOther}
        >
          <TextInput
            id="f-area-other"
            value={c.reportingAreaOther ?? ""}
            maxLength={100}
            hasError={Boolean(errors.reportingAreaOther)}
            onChange={(e) => patch({ reportingAreaOther: e.target.value })}
          />
        </Field>
      ) : null}

      <Field
        label="Rol o profesión"
        htmlFor="f-prof"
        required
        error={errors.profession}
      >
        <SelectInput
          id="f-prof"
          value={c.profession ?? ""}
          hasError={Boolean(errors.profession)}
          onChange={(e) =>
            patch({
              profession: e.target.value
                ? (e.target.value as Contact["profession"])
                : undefined,
            })
          }
        >
          {PROFESSION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Nombre(s)" htmlFor="f-nombre" error={errors.firstName}>
        <TextInput
          id="f-nombre"
          value={c.firstName ?? ""}
          maxLength={50}
          hasError={Boolean(errors.firstName)}
          onChange={(e) => patch({ firstName: e.target.value })}
        />
      </Field>

      <Field label="Apellidos(s)" htmlFor="f-apellido" error={errors.lastName}>
        <TextInput
          id="f-apellido"
          value={c.lastName ?? ""}
          maxLength={50}
          hasError={Boolean(errors.lastName)}
          onChange={(e) => patch({ lastName: e.target.value })}
        />
      </Field>

      <Field
        label="Establecimiento de salud"
        htmlFor="f-estab"
        error={errors.healthFacility}
      >
        <TextInput
          id="f-estab"
          value={c.healthFacility ?? ""}
          maxLength={100}
          hasError={Boolean(errors.healthFacility)}
          onChange={(e) => patch({ healthFacility: e.target.value })}
        />
      </Field>

      <Field
        label="Correo electrónico"
        htmlFor="f-email"
        required
        error={errors.email}
      >
        <TextInput
          id="f-email"
          type="email"
          value={c.email}
          hasError={Boolean(errors.email)}
          autoComplete="email"
          onChange={(e) => patch({ email: e.target.value })}
        />
      </Field>

      <Field
        label="Teléfono"
        htmlFor="f-tel"
        required
        error={errors.phone}
      >
        <TextInput
          id="f-tel"
          type="tel"
          value={c.phone}
          hasError={Boolean(errors.phone)}
          autoComplete="tel"
          onChange={(e) => patch({ phone: e.target.value })}
        />
      </Field>
    </>
  );
}
