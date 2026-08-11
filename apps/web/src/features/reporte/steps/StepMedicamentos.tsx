import {
  createEmptyMedicine,
  type AdverseEventReportDraft,
  type Medicine,
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
import {
  ACCESS_FORM_OPTIONS,
  ACTION_TAKEN_OPTIONS,
  INDICATION_OPTIONS,
  PRESENTATION_OPTIONS,
  ROUTE_OPTIONS,
  YES_NO_OPTIONS,
} from "../options";
import type { StepErrors } from "../validate";
import { durationDaysBetween } from "../validate";

type StepMedicamentosProps = {
  draft: AdverseEventReportDraft;
  errors: StepErrors;
  onChange: (medicines: Medicine[]) => void;
};

function parseOptionalNumber(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function StepMedicamentos({
  draft,
  errors,
  onChange,
}: StepMedicamentosProps) {
  const medicines = draft.medicines;

  function updateAt(index: number, partial: Partial<Medicine>) {
    onChange(
      medicines.map((m, i) => (i === index ? { ...m, ...partial } : m)),
    );
  }

  return (
    <>
      {errors.medicines ? (
        <p className={fieldStyles.error}>{errors.medicines}</p>
      ) : null}

      {medicines.map((m, index) => {
        return (
          <SubCard
            key={index}
            title={`Medicamento${medicines.length > 1 ? ` (${index + 1})` : ""}`}
            onRemove={
              medicines.length > 1
                ? () => onChange(medicines.filter((_, i) => i !== index))
                : undefined
            }
          >
            <Field
              label="Nombre del medicamento"
              htmlFor={`med-${index}-name`}
              required
              error={errors[`medicines.${index}.name`]}
            >
              <TextInput
                id={`med-${index}-name`}
                value={m.name}
                hasError={Boolean(errors[`medicines.${index}.name`])}
                onChange={(e) => updateAt(index, { name: e.target.value })}
              />
            </Field>

            <Field
              label="Compañía farmacéutica productora/distribuidora del medicamento"
              htmlFor={`med-${index}-co`}
            >
              <TextInput
                id={`med-${index}-co`}
                value={m.company ?? ""}
                onChange={(e) => updateAt(index, { company: e.target.value })}
              />
            </Field>

            <Field label="Número de lote" htmlFor={`med-${index}-lote`}>
              <TextInput
                id={`med-${index}-lote`}
                value={m.batchNumber ?? ""}
                onChange={(e) =>
                  updateAt(index, { batchNumber: e.target.value })
                }
              />
            </Field>

            <Field label="Forma de acceso" htmlFor={`med-${index}-access`}>
              <SelectInput
                id={`med-${index}-access`}
                value={m.accessForm ?? ""}
                onChange={(e) =>
                  updateAt(index, {
                    accessForm: e.target.value
                      ? (e.target.value as Medicine["accessForm"])
                      : undefined,
                  })
                }
              >
                {ACCESS_FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field
              label="Tipo de presentación"
              htmlFor={`med-${index}-pres`}
            >
              <SelectInput
                id={`med-${index}-pres`}
                value={m.presentation ?? ""}
                onChange={(e) =>
                  updateAt(index, {
                    presentation: e.target.value
                      ? (e.target.value as Medicine["presentation"])
                      : undefined,
                  })
                }
              >
                {PRESENTATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Dosis" htmlFor={`med-${index}-dosis`}>
              <TextInput
                id={`med-${index}-dosis`}
                value={m.dose ?? ""}
                onChange={(e) => updateAt(index, { dose: e.target.value })}
              />
            </Field>

            <Field
              label="Imagen del envase"
              htmlFor={`med-${index}-img`}
              hint="Formato .jpeg, .jpg, .png"
            >
              <input
                id={`med-${index}-img`}
                type="file"
                accept=".jpeg,.jpg,.png,image/jpeg,image/png"
                className={fieldStyles.input}
                style={{ height: "auto", padding: "6px 12px" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  updateAt(index, {
                    packageImageName: file?.name ?? "",
                  });
                }}
              />
              {m.packageImageName ? (
                <p className={fieldStyles.hint}>
                  Archivo seleccionado: {m.packageImageName}
                </p>
              ) : null}
            </Field>

            <Field
              label="Dosis/presentación (THC)"
              htmlFor={`med-${index}-thc`}
              error={errors[`medicines.${index}.thcPercent`]}
            >
              <UnitInput
                id={`med-${index}-thc`}
                unit="%"
                value={m.thcPercent?.toString() ?? ""}
                min={0}
                max={100}
                step="0.1"
                hasError={Boolean(errors[`medicines.${index}.thcPercent`])}
                onChange={(v) =>
                  updateAt(index, { thcPercent: parseOptionalNumber(v) })
                }
              />
            </Field>

            <Field
              label="Dosis/presentación (CBD)"
              htmlFor={`med-${index}-cbd`}
              error={errors[`medicines.${index}.cbdPercent`]}
            >
              <UnitInput
                id={`med-${index}-cbd`}
                unit="%"
                value={m.cbdPercent?.toString() ?? ""}
                min={0}
                max={100}
                step="0.1"
                hasError={Boolean(errors[`medicines.${index}.cbdPercent`])}
                onChange={(v) =>
                  updateAt(index, { cbdPercent: parseOptionalNumber(v) })
                }
              />
            </Field>

            <Field
              label="Dosis/presentación (Otro)"
              htmlFor={`med-${index}-otro`}
              error={errors[`medicines.${index}.otherPercent`]}
            >
              <UnitInput
                id={`med-${index}-otro`}
                unit="%"
                value={m.otherPercent?.toString() ?? ""}
                min={0}
                max={100}
                step="0.1"
                hasError={Boolean(errors[`medicines.${index}.otherPercent`])}
                onChange={(v) =>
                  updateAt(index, { otherPercent: parseOptionalNumber(v) })
                }
              />
            </Field>

            <Field
              label="Posología (veces al día)"
              htmlFor={`med-${index}-veces`}
            >
              <TextInput
                id={`med-${index}-veces`}
                type="number"
                min={1}
                value={m.dosesPerDay?.toString() ?? ""}
                onChange={(e) =>
                  updateAt(index, {
                    dosesPerDay: parseOptionalNumber(e.target.value),
                  })
                }
              />
            </Field>

            <Field
              label="Posología (cantidad por cada vez)"
              htmlFor={`med-${index}-cant`}
              hint="Gotas"
            >
              <TextInput
                id={`med-${index}-cant`}
                type="number"
                min={1}
                value={m.amountPerDose?.toString() ?? ""}
                onChange={(e) =>
                  updateAt(index, {
                    amountPerDose: parseOptionalNumber(e.target.value),
                  })
                }
              />
            </Field>

            <Field
              label="Vía de administración"
              htmlFor={`med-${index}-via`}
            >
              <SelectInput
                id={`med-${index}-via`}
                value={m.administrationRoute ?? ""}
                onChange={(e) =>
                  updateAt(index, {
                    administrationRoute: e.target.value
                      ? (e.target.value as Medicine["administrationRoute"])
                      : undefined,
                  })
                }
              >
                {ROUTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field
              label="Fecha de inicio de la administración del medicamento"
              error={errors[`medicines.${index}.administrationStartDate`]}
              hint="dd/mm/aaaa — desde la fecha de nacimiento hasta hoy"
            >
              <DateTriple
                idPrefix={`med-${index}-start`}
                value={m.administrationStartDate ?? ""}
                hasError={Boolean(
                  errors[`medicines.${index}.administrationStartDate`],
                )}
                onChange={(administrationStartDate) => {
                  updateAt(index, {
                    administrationStartDate,
                    administrationDurationDays: durationDaysBetween(
                      administrationStartDate,
                      m.administrationEndDate,
                    ),
                  });
                }}
              />
            </Field>

            <Field
              label="Fecha de fin de la administración del medicamento"
              error={errors[`medicines.${index}.administrationEndDate`]}
              hint="No anterior al inicio ni a la fecha de nacimiento. Si aún no finalizó, dejar vacío"
            >
              <DateTriple
                idPrefix={`med-${index}-end`}
                value={m.administrationEndDate ?? ""}
                hasError={Boolean(
                  errors[`medicines.${index}.administrationEndDate`],
                )}
                onChange={(administrationEndDate) => {
                  updateAt(index, {
                    administrationEndDate,
                    administrationDurationDays: durationDaysBetween(
                      m.administrationStartDate,
                      administrationEndDate,
                    ),
                  });
                }}
              />
            </Field>

            <Field
              label="Duración de la administración del medicamento"
              htmlFor={`med-${index}-dur`}
              hint="Días — se calcula automáticamente con las fechas de inicio y fin"
            >
              <UnitInput
                id={`med-${index}-dur`}
                unit="días"
                value={
                  durationDaysBetween(
                    m.administrationStartDate,
                    m.administrationEndDate,
                  )?.toString() ?? ""
                }
                readOnly
                placeholder="Se calcula con inicio y fin"
              />
            </Field>

            <Field
              label="Cambio reciente de producto"
              htmlFor={`med-${index}-cambio`}
            >
              <SelectInput
                id={`med-${index}-cambio`}
                value={
                  m.recentProductChange === undefined
                    ? ""
                    : m.recentProductChange
                      ? "si"
                      : "no"
                }
                onChange={(e) => {
                  if (!e.target.value) {
                    updateAt(index, { recentProductChange: undefined });
                    return;
                  }
                  updateAt(index, {
                    recentProductChange: e.target.value === "si",
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

            {m.recentProductChange ? (
              <Field
                label="Cambio reciente de producto-Especificar"
                htmlFor={`med-${index}-cambio-det`}
                required
                error={errors[`medicines.${index}.recentProductChangeDetail`]}
              >
                <TextInput
                  id={`med-${index}-cambio-det`}
                  value={m.recentProductChangeDetail ?? ""}
                  maxLength={100}
                  hasError={Boolean(
                    errors[`medicines.${index}.recentProductChangeDetail`],
                  )}
                  onChange={(e) =>
                    updateAt(index, {
                      recentProductChangeDetail: e.target.value,
                    })
                  }
                />
              </Field>
            ) : null}

            <Field
              label="Indicación de la administración del medicamento"
              htmlFor={`med-${index}-ind-txt`}
              hint="Texto libre"
            >
              <TextInput
                id={`med-${index}-ind-txt`}
                value={m.indicationText ?? ""}
                onChange={(e) =>
                  updateAt(index, { indicationText: e.target.value })
                }
              />
            </Field>

            <Field
              label="Indicación de la administración del medicamento"
              htmlFor={`med-${index}-ind`}
              hint="Lista desplegable"
            >
              <SelectInput
                id={`med-${index}-ind`}
                value={m.indicationCategory ?? ""}
                onChange={(e) =>
                  updateAt(index, {
                    indicationCategory: e.target.value
                      ? (e.target.value as Medicine["indicationCategory"])
                      : undefined,
                  })
                }
              >
                {INDICATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field
              label="Acción tomada con el medicamento"
              htmlFor={`med-${index}-acc`}
            >
              <SelectInput
                id={`med-${index}-acc`}
                value={m.actionTaken ?? ""}
                onChange={(e) =>
                  updateAt(index, {
                    actionTaken: e.target.value
                      ? (e.target.value as Medicine["actionTaken"])
                      : undefined,
                  })
                }
              >
                {ACTION_TAKEN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </SubCard>
        );
      })}

      <AddButton
        onClick={() => onChange([...medicines, createEmptyMedicine()])}
      >
        Agregar otro medicamento
      </AddButton>
    </>
  );
}
