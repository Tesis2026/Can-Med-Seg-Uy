import type { AdverseEventReportDraft, Contact } from "@canmedseg/shared";

import { Field, SelectInput, TextInput } from "../FormFields";
import { PROFESSION_OPTIONS } from "../options";
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
      <Field label="Área reportante" htmlFor="f-area">
        <TextInput
          id="f-area"
          value={c.reportingArea ?? ""}
          onChange={(e) => patch({ reportingArea: e.target.value })}
        />
      </Field>

      <Field
        label="Profesión"
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

      <Field label="Nombre/s" htmlFor="f-nombre">
        <TextInput
          id="f-nombre"
          value={c.firstName ?? ""}
          onChange={(e) => patch({ firstName: e.target.value })}
        />
      </Field>

      <Field label="Apellido/s" htmlFor="f-apellido">
        <TextInput
          id="f-apellido"
          value={c.lastName ?? ""}
          onChange={(e) => patch({ lastName: e.target.value })}
        />
      </Field>

      <Field label="Establecimiento de Salud" htmlFor="f-estab">
        <TextInput
          id="f-estab"
          value={c.healthFacility ?? ""}
          onChange={(e) => patch({ healthFacility: e.target.value })}
        />
      </Field>

      <Field
        label="Correo electrónico"
        htmlFor="f-email"
        required
        error={errors.email}
        hint="Formato de email válido"
      >
        <TextInput
          id="f-email"
          type="email"
          value={c.email}
          hasError={Boolean(errors.email)}
          autoComplete="email"
          placeholder="nombre@ejemplo.com"
          onChange={(e) => patch({ email: e.target.value })}
        />
      </Field>

      <Field
        label="Teléfono"
        htmlFor="f-tel"
        required
        error={errors.phone}
        hint="Uruguay: móvil 09X XXX XXX o fijo (ej. 2XXX XXXX) · también +598…"
      >
        <TextInput
          id="f-tel"
          type="tel"
          value={c.phone}
          hasError={Boolean(errors.phone)}
          autoComplete="tel"
          placeholder="099 123 456"
          onChange={(e) => patch({ phone: e.target.value })}
        />
      </Field>
    </>
  );
}
