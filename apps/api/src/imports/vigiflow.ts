import ExcelJS from 'exceljs';
import { adverseEventReportDraftSchema, type ReportImportRow } from '@canmedseg/shared';

type SourceRow = Record<string, string>;
export type ParsedImportRow = ReportImportRow & { sourceData: { report: SourceRow; medicines: SourceRow[]; reactions: SourceRow[] } };
export class ImportFileError extends Error {}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const ID = 'Número de identificación único mundial';
const LOCAL_ID = 'Id del reporte de seguridad';
const get = (row: SourceRow, key: string) => row[normalize(key)]?.trim() ?? '';
const idOf = (row: SourceRow) => get(row, ID) || get(row, LOCAL_ID);

function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10).replace(/-/g, '');
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map(part => part.text).join('');
    if ('formula' in value || 'sharedFormula' in value) throw new ImportFileError('El archivo contiene fórmulas. Exporte los datos de VigiFlow como valores.');
    if ('text' in value) return value.text;
    throw new ImportFileError('El archivo contiene celdas con errores o valores no compatibles.');
  }
  return String(value).trim();
}

function readRows(book: ExcelJS.Workbook, name: string, required: string[]): SourceRow[] {
  const sheet = book.worksheets.find(s => normalize(s.name) === normalize(name));
  if (!sheet) throw new ImportFileError(`Falta la hoja «${name}».`);
  if (sheet.rowCount > 10001 || sheet.columnCount > 150) throw new ImportFileError(`La hoja «${name}» supera el límite de 10.000 filas o 150 columnas.`);
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, col) => { headers[col] = normalize(text(cell.value)); });
  if (!headers.includes(normalize(ID)) && !headers.includes(normalize(LOCAL_ID))) throw new ImportFileError(`Falta el identificador del reporte en «${name}».`);
  for (const key of required) if (!headers.includes(normalize(key))) throw new ImportFileError(`Falta la columna «${key}» en «${name}».`);
  const used = headers.filter(Boolean);
  if (new Set(used).size !== used.length) throw new ImportFileError(`Hay encabezados repetidos en «${name}».`);
  const rows: SourceRow[] = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const entry: SourceRow = { __row: String(number) };
    row.eachCell((cell, col) => { if (headers[col]) entry[headers[col]!] = text(cell.value); });
    if (Object.entries(entry).some(([key, value]) => key !== '__row' && value.trim())) rows.push(entry);
  });
  return rows;
}

export function parseVigiDate(value: string): string {
  if (!value.trim()) return '';
  const match = /^(\d{4})(\d{2})(\d{2})(?:\s.*)?$/.exec(value) ?? /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(value);
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match && !local) return '';
  const [year, month, day] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [Number(local![3]), Number(local![2]), Number(local![1])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}
const isoDate = (value: string) => value ? `${value.slice(6)}-${value.slice(3, 5)}-${value.slice(0, 2)}T12:00:00.000Z` : null;

function checkArchive(buffer: Buffer): void {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > buffer.length) throw new ImportFileError('El archivo no es un XLSX válido.');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  let expanded = 0;
  if (count > 2000) throw new ImportFileError('El XLSX contiene demasiados elementos.');
  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) throw new ImportFileError('La estructura del XLSX no es válida.');
    expanded += buffer.readUInt32LE(offset + 24);
    if (expanded > 50 * 1024 * 1024) throw new ImportFileError('El contenido descomprimido supera los 50 MB.');
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
}

export async function parseVigiFlow(buffer: Buffer): Promise<ParsedImportRow[]> {
  checkArchive(buffer);
  const book = new ExcelJS.Workbook();
  try { await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]); }
  catch { throw new ImportFileError('No se pudo leer el XLSX. Seleccione una exportación válida de VigiFlow.'); }
  const reports = readRows(book, 'Reportes', ['Iniciales', 'Sexo', 'Caso narrativo']);
  const medicines = readRows(book, 'Medicamentos', ['Rol del medicamento', 'Nombre del medicamento (patente-WHODrug)']);
  const reactions = readRows(book, 'Reacciones', ['Reacción / evento (MedDRA) LLT', 'Grave']);
  if (!reports.length) throw new ImportFileError('La hoja «Reportes» no contiene reportes.');
  const aliases = new Map<string, string>();
  for (const row of reports) {
    for (const key of [get(row, ID), get(row, LOCAL_ID)].filter(Boolean)) {
      const previous = aliases.get(key);
      if (previous && previous !== idOf(row)) throw new ImportFileError(`El identificador ${key} está asociado a más de un reporte.`);
      aliases.set(key, idOf(row));
    }
  }
  const group = (rows: SourceRow[], sheet: string) => {
    const result = new Map<string, SourceRow[]>();
    for (const row of rows) {
      const ids = [get(row, ID), get(row, LOCAL_ID)].filter(Boolean);
      const matches = new Set(ids.map(id => aliases.get(id)).filter(Boolean));
      if (matches.size !== 1 || ids.some(id => !aliases.has(id))) throw new ImportFileError(`La fila ${row.__row} de «${sheet}» no se puede vincular a un único reporte.`);
      const id = [...matches][0]!;
      result.set(id, [...(result.get(id) ?? []), row]);
    }
    return result;
  };
  const medsById = group(medicines, 'Medicamentos');
  const eventsById = group(reactions, 'Reacciones');
  const counts = new Map<string, number>();
  for (const row of reports) counts.set(idOf(row), (counts.get(idOf(row)) ?? 0) + 1);

  return reports.map(source => {
    const externalId = idOf(source);
    const warnings: string[] = [];
    const errors: string[] = [];
    if (!externalId) errors.push('Falta el identificador de VigiFlow.');
    if ((counts.get(externalId) ?? 0) > 1) errors.push('Identificador repetido en la hoja Reportes.');
    const date = (row: SourceRow, key: string) => {
      const raw = get(row, key);
      const parsed = parseVigiDate(raw);
      if (raw && !parsed) warnings.push(`${key}: fecha incompleta o inválida «${raw}»; se conserva solo en el original.`);
      return parsed;
    };
    const number = (row: SourceRow, key: string) => {
      const raw = get(row, key);
      if (!raw) return undefined;
      const value = Number(raw.replace(',', '.'));
      if (!Number.isFinite(value) || value <= 0) { warnings.push(`${key}: valor no reconocido «${raw}».`); return undefined; }
      return value;
    };
    const mapped = (row: SourceRow, key: string, options: Record<string, string>) => {
      const raw = get(row, key);
      if (!raw) return undefined;
      const normalizedValue = normalize(raw);
      const value = Object.prototype.hasOwnProperty.call(options, normalizedValue) ? options[normalizedValue] : undefined;
      if (!value) warnings.push(`${key}: «${raw}» se conserva en el original, sin equivalencia automática.`);
      return value;
    };
    const integer = (raw: string, label: string) => {
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 0 || value > 2147483647) {
        errors.push(`${label}: valor fuera del rango de almacenamiento admitido.`);
        return undefined;
      }
      return value;
    };
    const duration = (row: SourceRow) => {
      const raw = get(row, 'Duración');
      const days = /^(\d+)\s*(dia|dias|day|days)$/i.exec(normalize(raw));
      if (raw && !days) warnings.push(`Duración «${raw}»: se conserva en el original; no se convierte automáticamente a días.`);
      return days ? integer(days[1]!, 'Duración') : undefined;
    };
    const sourceMeds = medsById.get(externalId) ?? [];
    const sourceEvents = eventsById.get(externalId) ?? [];
    const events = sourceEvents.map(row => {
      const serious = mapped(row, 'Grave', { si: 'true', no: 'false' });
      const criterion = mapped(row, 'Criterio (s) de Gravedad', {
        muerte: 'muerte', 'amenaza de vida': 'amenaza_vida', 'peligro para la vida': 'amenaza_vida',
        hospitalizacion: 'hospitalizacion', 'causo/prolongo hospitalizacion': 'hospitalizacion',
        discapacidad: 'discapacidad', 'anomalia congenita': 'malformacion_congenita',
        'otra condicion medica importante': 'otra_condicion_medica',
      });
      if (serious === 'true' && !criterion) warnings.push('Evento grave sin un criterio único reconocible; consulte el original.');
      return {
        meddraTerm: get(row, 'Reacción / evento (MedDRA) LLT') || get(row, 'PT'),
        startDate: date(row, 'Fecha de comienzo / Horario'), endDate: date(row, 'Fecha de finalización / Horario'),
        durationDays: duration(row),
        isSerious: serious === undefined ? undefined : serious === 'true', seriousnessCriterion: criterion,
        outcome: mapped(row, 'Resultado', {
          'recuperado/resuelto': 'recuperada_resuelta', 'en recuperacion/en resolucion': 'en_recuperacion',
          'no recuperado/no resuelto': 'no_recuperada', 'recuperado/resuelto con secuelas': 'recuperada_con_secuelas',
          fatal: 'mortal', muerte: 'mortal', desconocido: 'desconocido',
        }),
      };
    });
    const implicated: SourceRow[] = [];
    const concomitant: SourceRow[] = [];
    for (const row of sourceMeds) {
      const role = normalize(get(row, 'Rol del medicamento'));
      if (role === 'concomitante') concomitant.push(row);
      else if (['sospechoso', 'interaccion', 'interactuante'].includes(role)) implicated.push(row);
      else errors.push(`Rol del medicamento no reconocido: «${get(row, 'Rol del medicamento')}».`);
    }
    const medName = (row: SourceRow) => get(row, 'Nombre del medicamento (patente-WHODrug)') || get(row, 'Nombre del medicamento tal como fue reportado por el notificador inicial / original');
    const mappedMeds = implicated.map(row => {
      if (get(row, 'Concentración')) warnings.push(`${medName(row)}: concentración conservada en el original; no se infiere composición THC/CBD.`);
      if (get(row, 'Intervalo de dosificación')) warnings.push(`${medName(row)}: intervalo conservado en el original; no se infieren tomas diarias.`);
      return {
        name: medName(row), company: get(row, 'Laboratorio titular del registro') || get(row, 'Laboratorio titular del registro (WHODrug)'),
        batchNumber: get(row, 'Número de lote'),
        dose: [get(row, 'Dosis (número y unidad)'), get(row, 'Dosis') && `Dosis declarada: ${get(row, 'Dosis')}`, get(row, 'Intervalo de dosificación')].filter(Boolean).join('; '),
        presentation: mapped(row, get(row, 'Forma farmacéutica (EDQM)') ? 'Forma farmacéutica (EDQM)' : 'Forma farmacéutica', {
          'solucion oral': 'solucion_oral', aceite: 'aceite', 'sustancia vegetal': 'sustancia_vegetal', 'uso topico': 'uso_topico',
        }),
        administrationRoute: mapped(row, get(row, 'Vía de administración (EDQM)') ? 'Vía de administración (EDQM)' : 'Vía de administración', {
          oral: 'oral', 'via oral': 'oral', sublingual: 'sublingual', 'via sublingual': 'sublingual',
          topica: 'topico', 'via cutanea': 'topico', 'via intravenosa': 'intravenosa', 'via intramuscular': 'intramuscular',
          'via subcutanea': 'subcutanea', 'via rectal': 'rectal', 'via nasal': 'nasal', 'via inhalatoria': 'respiratoria', desconocida: 'desconocido',
        }),
        administrationStartDate: date(row, 'Comienzo de la administración'), administrationEndDate: date(row, 'Fin de la administración'),
        administrationDurationDays: duration(row),
        indicationText: get(row, 'Indicación (MedDRA)') || get(row, 'Indicación tal como fue reportado por el notificador primario / original'),
        actionTaken: mapped(row, 'Acción tomada', {
          'medicamento retirado': 'retirado', 'dosis reducida': 'dosis_reducida', 'dosis aumentada': 'dosis_aumentada',
          'dosis no modificada': 'dosis_no_modificada', desconocida: 'desconocida', 'no aplicable': 'no_aplica',
        }),
      };
    });
    const ageRaw = get(source, 'Edad al comienzo de la reacción');
    const age = /^(\d+)\s*(año|años|year|years)$/i.exec(ageRaw);
    if (ageRaw && !age) warnings.push(`Edad «${ageRaw}»: no se convierte automáticamente a años enteros.`);
    const height = number(source, 'Altura (cm)');
    warnings.push('País del evento y departamento del paciente no informados: no se deducen de la ubicación del notificador.');
    warnings.push('La exportación no incluye email ni teléfono del notificador; quedan vacíos.');
    if (get(source, 'Número de identificación ')) warnings.push('El identificador del paciente se conserva en el original; no se asume que sea una cédula uruguaya.');
    const report = adverseEventReportDraftSchema.parse({
      status: 'aprobado_local', currentStep: 5,
      patient: {
        initials: get(source, 'Iniciales'), countryOfEventStart: '', birthDate: date(source, 'Fecha de nacimiento'),
        sex: mapped(source, 'Sexo', { femenino: 'femenino', masculino: 'masculino', otro: 'otro' }),
        weightKg: number(source, 'Peso (kg)'), heightM: height === undefined ? undefined : height / 100,
        ageAtEventStart: age ? integer(age[1]!, 'Edad') : undefined,
      },
      adverseEventDescription: get(source, 'Caso narrativo'), events, medicines: mappedMeds,
      additionalComments: get(source, 'Comentarios del notificador'),
      hasConcomitantTreatments: concomitant.length ? true : undefined,
      concomitantTreatments: concomitant.map(row => ({ name: medName(row), startDate: date(row, 'Comienzo de la administración'), endDate: date(row, 'Fin de la administración'), durationDays: duration(row) || undefined })),
      contact: {
        healthFacility: get(source, 'Organización (Notificador primario)'),
        profession: mapped(source, 'Profesión del notificador', { medico: 'medico', farmaceutico: 'farmaceutico', 'otro profesional de la salud': 'otro_profesional_salud', consumidor: 'paciente' }),
      },
    });
    if (!events.length) errors.push('El reporte no tiene filas en Reacciones.');
    if (!mappedMeds.length) errors.push('El reporte no tiene medicamentos sospechosos o interactuantes.');
    if (events.some(event => !event.meddraTerm)) errors.push('Hay reacciones sin término MedDRA.');
    if (mappedMeds.some(med => !med.name)) errors.push('Hay medicamentos sin nombre.');
    if (concomitant.some(row => !medName(row))) errors.push('Hay tratamientos concomitantes sin nombre.');
    if (report.patient.initials.length > 4) errors.push('Las iniciales exceden los 4 caracteres admitidos.');
    if ((report.patient.weightKg ?? 0) >= 10000 || (report.patient.heightM ?? 0) >= 100) errors.push('Peso o talla fuera del rango admitido.');
    if (report.contact.healthFacility.length > 100) errors.push('El establecimiento de salud excede los 100 caracteres admitidos.');
    const submittedAt = isoDate(date(source, 'Fecha de recepción inicial'));
    if (!submittedAt) errors.push('Falta una fecha de recepción inicial completa y válida.');
    return { externalId, rowNumber: Number(source.__row), report, submittedAt, warnings: [...new Set(warnings)], errors, duplicate: false,
      sourceData: { report: source, medicines: sourceMeds, reactions: sourceEvents } };
  });
}
