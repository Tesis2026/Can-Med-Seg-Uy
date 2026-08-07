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
} from "../options";
import type { StepErrors } from "../validate";

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
      <p
        className={fieldStyles.hint}
        style={{ fontSize: 14, color: "var(--color-text-secondary)" }}
      >
        Ingrese el nombre y detalles del medicamento de cannabis medicinal
        implicado en el evento adverso.
      </p>

      {errors.medicines ? (
        <p className={fieldStyles.error}>{errors.medicines}</p>
      ) : null}

      {medicines.map((m, index) => (
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
            hint="Campo obligatorio"
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
            hint="Como se muestra en el empaque"
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
              onChange={(e) => updateAt(index, { batchNumber: e.target.value })}
            />
          </Field>

          <Field
            label="Forma de acceso"
            htmlFor={`med-${index}-access`}
            hint="Farmacia comunitaria, institucional, uso compasivo u otra"
          >
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
            hint="Solución oral, aceite o sustancia vegetal"
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

          <Field label="Dosis/presentación (THC)" htmlFor={`med-${index}-thc`}>
            <UnitInput
              id={`med-${index}-thc`}
              unit="mg"
              value={m.thcMg?.toString() ?? ""}
              min={0}
              step="0.1"
              onChange={(v) =>
                updateAt(index, { thcMg: parseOptionalNumber(v) })
              }
            />
          </Field>

          <Field label="Dosis/presentación (CBD)" htmlFor={`med-${index}-cbd`}>
            <UnitInput
              id={`med-${index}-cbd`}
              unit="mg"
              value={m.cbdMg?.toString() ?? ""}
              min={0}
              step="0.1"
              onChange={(v) =>
                updateAt(index, { cbdMg: parseOptionalNumber(v) })
              }
            />
          </Field>

          <Field label="Dosis/presentación (Otro)" htmlFor={`med-${index}-otro`}>
            <UnitInput
              id={`med-${index}-otro`}
              unit="mg"
              value={m.otherCompositionMg?.toString() ?? ""}
              min={0}
              step="0.1"
              onChange={(v) =>
                updateAt(index, {
                  otherCompositionMg: parseOptionalNumber(v),
                })
              }
            />
          </Field>

          <Field
            label="Imagen del envase"
            htmlFor={`med-${index}-img`}
            hint="Cargar archivo (.jpeg, .jpg, .png)"
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

          <Field label="Nº gotas por toma" htmlFor={`med-${index}-gotas`}>
            <TextInput
              id={`med-${index}-gotas`}
              type="number"
              min={0}
              value={m.dropsPerDose?.toString() ?? ""}
              onChange={(e) =>
                updateAt(index, {
                  dropsPerDose: parseOptionalNumber(e.target.value),
                })
              }
            />
          </Field>

          <Field label="Nº tomas por día" htmlFor={`med-${index}-tomas`}>
            <TextInput
              id={`med-${index}-tomas`}
              type="number"
              min={0}
              value={m.dosesPerDay?.toString() ?? ""}
              onChange={(e) =>
                updateAt(index, {
                  dosesPerDay: parseOptionalNumber(e.target.value),
                })
              }
            />
          </Field>

          <Field
            label="Cambio reciente de producto (marca, dosis y/o composición)"
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
              <option value="si">Sí</option>
              <option value="no">No</option>
            </SelectInput>
          </Field>

          {m.recentProductChange ? (
            <Field
              label="Si: especificar marca, dosis y/o presentación"
              htmlFor={`med-${index}-cambio-det`}
              required
              error={errors[`medicines.${index}.recentProductChangeDetail`]}
            >
              <TextInput
                id={`med-${index}-cambio-det`}
                value={m.recentProductChangeDetail ?? ""}
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

          <Field label="Vía de administración" htmlFor={`med-${index}-via`}>
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
            label="Fecha de inicio de la administración"
            required
            error={errors[`medicines.${index}.administrationStartDate`]}
            hint="Formato dd/mm/aaaa — año entre 1900 y 2100"
          >
            <DateTriple
              idPrefix={`med-${index}-start`}
              value={m.administrationStartDate}
              hasError={Boolean(
                errors[`medicines.${index}.administrationStartDate`],
              )}
              onChange={(administrationStartDate) =>
                updateAt(index, { administrationStartDate })
              }
            />
          </Field>

          <Field
            label="Fecha de fin de la administración"
            error={errors[`medicines.${index}.administrationEndDate`]}
            hint="En caso de aún no haber finalizado, no completar"
          >
            <DateTriple
              idPrefix={`med-${index}-end`}
              value={m.administrationEndDate ?? ""}
              hasError={Boolean(
                errors[`medicines.${index}.administrationEndDate`],
              )}
              onChange={(administrationEndDate) =>
                updateAt(index, { administrationEndDate })
              }
            />
          </Field>

          <Field
            label="Duración de la administración del medicamento"
            htmlFor={`med-${index}-dur`}
            hint="Tiempo de uso del medicamento sospechado"
          >
            <UnitInput
              id={`med-${index}-dur`}
              unit="días"
              value={m.administrationDurationDays?.toString() ?? ""}
              min={0}
              onChange={(v) =>
                updateAt(index, {
                  administrationDurationDays: parseOptionalNumber(v),
                })
              }
            />
          </Field>

          <Field
            label="Motivo principal de uso del medicamento"
            htmlFor={`med-${index}-ind`}
            hint="Epilepsia, dolor, náuseas, espasticidad, ansiedad, etc."
          >
            <SelectInput
              id={`med-${index}-ind`}
              value={m.mainIndication ?? ""}
              onChange={(e) =>
                updateAt(index, {
                  mainIndication: e.target.value
                    ? (e.target.value as Medicine["mainIndication"])
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
      ))}

      <AddButton
        onClick={() => onChange([...medicines, createEmptyMedicine()])}
      >
        Agregar otro medicamento
      </AddButton>
    </>
  );
}
