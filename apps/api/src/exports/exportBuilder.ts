import {
  ACCESS_FORM_LABELS,
  ACTION_TAKEN_LABELS,
  ADMINISTRATION_ROUTE_LABELS,
  CAUSALITY_LABELS,
  EVENT_OUTCOME_LABELS,
  INDICATION_LABELS,
  PRESENTATION_LABELS,
  PROFESSION_LABELS,
  REPORTING_AREA_LABELS,
  REPORT_STATUS_LABELS,
  SERIOUSNESS_LABELS,
  SEVERITY_GRADE_LABELS,
  SEX_LABELS,
  UY_DEPARTMENT_LABELS,
  labelFor,
  type AdverseEventReportDraft,
  type ExportFormat,
  type SubmittedReportStatus,
} from "@canmedseg/shared";
import ExcelJS from "exceljs";
import type { Pool } from "pg";

import { buildReportFilter } from "../analytics/analyticsFilters";
import { resolvePseudonyms } from "./pseudonyms";

/**
 * Construcción del archivo de exportación (RF-8.1, RF-8.5 a RF-8.10).
 *
 * Los módulos repetibles van en hojas propias vinculadas por el identificador
 * del reporte (RF-8.6), y ningún campo identificatorio sale del sistema: la
 * cédula se reemplaza por el seudónimo y el resto se omite (RF-8.7).
 */

type ExportRow = {
  id: string;
  status: SubmittedReportStatus;
  submitted_at: Date;
  reviewed_at: Date | null;
  patient_national_id: string | null;
  patient_department: string | null;
  form_data: AdverseEventReportDraft;
};

export type ExportSheet = {
  name: string;
  columns: string[];
  rows: (string | number)[][];
};

export type ExportBundle = {
  sheets: ExportSheet[];
  reportCount: number;
  generatedAt: Date;
  filtersSummary: string;
};

const REPORT_COLUMNS = [
  "ID reporte",
  "Seudónimo paciente",
  "Estado",
  "Fecha de notificación",
  "Fecha de validación",
  "Iniciales",
  "Sexo",
  "Edad al comienzo del evento",
  "Fecha de nacimiento",
  "Peso (kg)",
  "Talla (m)",
  "País del evento",
  "Departamento",
  "Descripción del evento adverso",
  "Clasificación de gravedad",
  "Relación causal",
  "Enfermedades previas",
  "Tratamientos concomitantes",
  "Comentarios adicionales",
  "Área reportante",
  "Profesión del notificador",
  "Establecimiento de salud",
];

const EVENT_COLUMNS = [
  "ID reporte",
  "N.º de evento",
  "Reacción o síntoma",
  "Fecha de inicio",
  "Fecha de finalización",
  "Duración (días)",
  "Estado actual",
  "Grave",
  "Indicador de gravedad",
];

const MEDICINE_COLUMNS = [
  "ID reporte",
  "N.º de medicamento",
  "Nombre",
  "Compañía",
  "Número de lote",
  "Forma de acceso",
  "Tipo de presentación",
  "Dosis",
  "Unidad de composición",
  "THC",
  "CBD",
  "Otros",
  "Tomas por día",
  "Cantidad por toma",
  "Vía de administración",
  "Inicio de administración",
  "Fin de administración",
  "Duración (días)",
  "Cambio reciente de producto",
  "Detalle del cambio",
  "Indicación",
  "Motivo principal de uso",
  "Acción tomada",
];

const CONCOMITANT_COLUMNS = [
  "ID reporte",
  "N.º de tratamiento",
  "Nombre",
  "Miligramos por toma",
  "Tomas por día",
  "Fecha de inicio",
  "Fecha de fin",
  "Duración (días)",
];

function text(value: string | null | undefined): string {
  return value ?? "";
}

function num(value: number | undefined): string | number {
  return value ?? "";
}

function bool(value: boolean | undefined): string {
  if (value === undefined) return "";
  return value ? "Sí" : "No";
}

function isoDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

/** Lee los reportes filtrados y arma las cuatro hojas del archivo. */
export async function buildExportBundle(
  pool: Pool,
  filters: Parameters<typeof buildReportFilter>[0],
  filtersSummary: string,
): Promise<ExportBundle> {
  const { where, params } = buildReportFilter(filters);
  const result = await pool.query<ExportRow>(
    `SELECT r.id, r.status, r.submitted_at, r.reviewed_at,
            r.patient_national_id, r.patient_department, r.form_data
       FROM reports r
      WHERE ${where}
      ORDER BY r.submitted_at DESC`,
    params,
  );

  const documents = result.rows
    .map((row) => row.patient_national_id)
    .filter((value): value is string => Boolean(value && value.trim()));
  const pseudonyms = await resolvePseudonyms(pool, documents);

  const reports: (string | number)[][] = [];
  const events: (string | number)[][] = [];
  const medicines: (string | number)[][] = [];
  const concomitants: (string | number)[][] = [];

  for (const row of result.rows) {
    const report = row.form_data;
    const patient = report.patient ?? {};
    const contact = report.contact ?? {};
    const pseudonym = row.patient_national_id
      ? (pseudonyms.get(row.patient_national_id) ?? "")
      : "";

    reports.push([
      row.id,
      pseudonym,
      REPORT_STATUS_LABELS[row.status],
      isoDate(row.submitted_at),
      isoDate(row.reviewed_at),
      text(patient.initials),
      labelFor(SEX_LABELS, patient.sex),
      num(patient.ageAtEventStart),
      text(patient.birthDate),
      num(patient.weightKg),
      num(patient.heightM),
      text(patient.countryOfEventStart),
      labelFor(UY_DEPARTMENT_LABELS, row.patient_department ?? patient.department),
      text(report.adverseEventDescription),
      labelFor(SEVERITY_GRADE_LABELS, report.severityGrade),
      labelFor(CAUSALITY_LABELS, report.causality),
      text(report.previousDiseases),
      bool(report.hasConcomitantTreatments),
      text(report.additionalComments),
      labelFor(REPORTING_AREA_LABELS, contact.reportingArea),
      labelFor(PROFESSION_LABELS, contact.profession),
      text(contact.healthFacility),
    ]);

    (report.events ?? []).forEach((event, index) => {
      events.push([
        row.id,
        index + 1,
        text(event.meddraTerm),
        text(event.startDate),
        text(event.endDate),
        num(event.durationDays),
        labelFor(EVENT_OUTCOME_LABELS, event.outcome),
        bool(event.isSerious),
        labelFor(SERIOUSNESS_LABELS, event.seriousnessCriterion),
      ]);
    });

    (report.medicines ?? []).forEach((medicine, index) => {
      medicines.push([
        row.id,
        index + 1,
        text(medicine.name),
        text(medicine.company),
        text(medicine.batchNumber),
        labelFor(ACCESS_FORM_LABELS, medicine.accessForm),
        labelFor(PRESENTATION_LABELS, medicine.presentation),
        text(medicine.dose),
        medicine.compositionUnit === "ml" ? "ml" : "%",
        num(medicine.thcPercent),
        num(medicine.cbdPercent),
        num(medicine.otherPercent),
        num(medicine.dosesPerDay),
        num(medicine.amountPerDose),
        labelFor(ADMINISTRATION_ROUTE_LABELS, medicine.administrationRoute),
        text(medicine.administrationStartDate),
        text(medicine.administrationEndDate),
        num(medicine.administrationDurationDays),
        bool(medicine.recentProductChange),
        text(medicine.recentProductChangeDetail),
        text(medicine.indicationText),
        labelFor(INDICATION_LABELS, medicine.indicationCategory),
        labelFor(ACTION_TAKEN_LABELS, medicine.actionTaken),
      ]);
    });

    (report.concomitantTreatments ?? []).forEach((treatment, index) => {
      concomitants.push([
        row.id,
        index + 1,
        text(treatment.name),
        num(treatment.mgPerDose),
        num(treatment.dosesPerDay),
        text(treatment.startDate),
        text(treatment.endDate),
        num(treatment.durationDays),
      ]);
    });
  }

  return {
    sheets: [
      { name: "Reportes", columns: REPORT_COLUMNS, rows: reports },
      { name: "Eventos adversos", columns: EVENT_COLUMNS, rows: events },
      { name: "Medicamentos", columns: MEDICINE_COLUMNS, rows: medicines },
      { name: "Concomitantes", columns: CONCOMITANT_COLUMNS, rows: concomitants },
    ],
    reportCount: result.rows.length,
    generatedAt: new Date(),
    filtersSummary,
  };
}

function csvCell(value: string | number): string {
  const raw = String(value ?? "");
  if (/[";\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

/**
 * CSV con la portada de RF-8.10 arriba. Se usa `;` como separador y BOM para
 * que Excel en español lo abra en columnas sin pasos manuales.
 */
export function toCsv(bundle: ExportBundle): Buffer {
  const lines: string[] = [
    csvCell("Reportes de farmacovigilancia de cannabis medicinal"),
    `${csvCell("Generado")};${csvCell(bundle.generatedAt.toISOString())}`,
    `${csvCell("Filtros")};${csvCell(bundle.filtersSummary)}`,
    `${csvCell("Reportes incluidos")};${csvCell(bundle.reportCount)}`,
    "",
  ];

  for (const sheet of bundle.sheets) {
    lines.push(csvCell(sheet.name));
    lines.push(sheet.columns.map(csvCell).join(";"));
    for (const row of sheet.rows) lines.push(row.map(csvCell).join(";"));
    lines.push("");
  }

  return Buffer.from(`﻿${lines.join("\r\n")}`, "utf8");
}

/** XLSX con una portada y una hoja por módulo repetible (RF-8.6, RF-8.10). */
export async function toXlsx(bundle: ExportBundle): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Reporte FV Uruguay";
  workbook.created = bundle.generatedAt;

  const cover = workbook.addWorksheet("Portada");
  cover.columns = [{ width: 28 }, { width: 90 }];
  cover.addRow(["Reportes de farmacovigilancia de cannabis medicinal"]);
  cover.getRow(1).font = { bold: true, size: 14 };
  cover.addRow([]);
  cover.addRow(["Generado", bundle.generatedAt.toISOString()]);
  cover.addRow(["Filtros aplicados", bundle.filtersSummary]);
  cover.addRow(["Reportes incluidos", bundle.reportCount]);
  cover.addRow([]);
  cover.addRow([
    "Privacidad",
    "La cédula se reemplaza por un seudónimo estable por persona. El archivo no contiene nombre, apellido, correo ni teléfono.",
  ]);
  cover.getColumn(1).font = { bold: true };
  cover.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  for (const sheet of bundle.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.addRow(sheet.columns);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8EEF7" },
    };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    for (const row of sheet.rows) worksheet.addRow(row);
    worksheet.columns.forEach((column, index) => {
      const header = sheet.columns[index] ?? "";
      column.width = Math.min(45, Math.max(14, header.length + 4));
    });
    if (sheet.rows.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columns.length },
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function exportFileName(format: ExportFormat, generatedAt: Date): string {
  const stamp = generatedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `reportes-farmacovigilancia-${stamp}.${format}`;
}
