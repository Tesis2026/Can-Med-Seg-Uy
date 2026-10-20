import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { parseVigiDate, parseVigiFlow } from './vigiflow';

export function fixture(id = 'TEST-001') {
  const book = new ExcelJS.Workbook();
  book.addWorksheet('Reportes').addRows([
    ['Número de identificación único mundial', 'Id del reporte de seguridad', 'Iniciales', 'Sexo', 'Caso narrativo', 'Fecha de nacimiento', 'Fecha de recepción inicial', 'Edad al comienzo de la reacción', 'Altura (cm)', 'Estado o provincia', 'País del notificador'],
    [id, id, 'AB', 'Femenino', 'Caso de prueba', 19950315, 20261001, '31 Año', 162, 'Montevideo', 'Uruguay'],
  ]);
  book.addWorksheet('Medicamentos').addRows([
    ['Número de identificación único mundial', 'Rol del medicamento', 'Nombre del medicamento (patente-WHODrug)', 'Comienzo de la administración', 'Concentración', 'Forma farmacéutica (EDQM)', 'Vía de administración (EDQM)'],
    [id, 'Sospechoso', 'Producto de prueba', 20260805, '10 %', 'Solución oral', 'Vía oral'],
  ]);
  book.addWorksheet('Reacciones').addRows([
    ['Número de identificación único mundial', 'Reacción / evento (MedDRA) LLT', 'Grave', 'Fecha de comienzo / Horario', 'Resultado'],
    [id, 'Somnolencia', 'No', '20260930 12:00:00', 'No recuperado/no resuelto'],
  ]);
  return book;
}
const parse = async (book: ExcelJS.Workbook) => parseVigiFlow(Buffer.from(await book.xlsx.writeBuffer()));

test('mapea fechas, talla y categorías sin inferir ubicación o composición', async () => {
  const [row] = await parse(fixture());
  assert.deepEqual(row!.errors, []);
  assert.equal(row!.report.patient.heightM, 1.62);
  assert.equal(row!.report.patient.birthDate, '15/03/1995');
  assert.equal(row!.report.patient.department, undefined);
  assert.equal(row!.report.patient.countryOfEventStart, '');
  assert.equal(row!.report.medicines[0]!.cbdPercent, undefined);
  assert.equal(row!.report.medicines[0]!.presentation, 'solucion_oral');
  assert.equal(row!.report.events[0]!.outcome, 'no_recuperada');
  assert.equal(row!.submittedAt, '2026-10-01T12:00:00.000Z');
  assert.equal(row!.sourceData.medicines[0]!['concentracion'], '10 %');
});
test('agrupa múltiples eventos y separa concomitantes', async () => {
  const book = fixture();
  book.getWorksheet('Reacciones')!.addRow(['TEST-001', 'Náuseas', '', 20260930]);
  book.getWorksheet('Medicamentos')!.addRow(['TEST-001', 'Concomitante', 'Otro medicamento', 20260805]);
  const [row] = await parse(book);
  assert.equal(row!.report.events.length, 2);
  assert.equal(row!.report.events[1]!.isSerious, undefined);
  assert.equal(row!.report.medicines.length, 1);
  assert.equal(row!.report.concomitantTreatments.length, 1);
});
test('rechaza relaciones huérfanas', async () => {
  const book = fixture();
  book.getWorksheet('Reacciones')!.addRow(['OTRO', 'Náuseas', 'No']);
  await assert.rejects(parse(book), /no se puede vincular/);
});
test('marca identificadores repetidos sin duplicar eventos silenciosamente', async () => {
  const book = fixture();
  book.getWorksheet('Reportes')!.addRow(book.getWorksheet('Reportes')!.getRow(2).values);
  const rows = await parse(book);
  assert.ok(rows.every(row => row.errors.includes('Identificador repetido en la hoja Reportes.')));
});
test('rechaza hojas faltantes y archivos inválidos', async () => {
  const book = fixture(); book.removeWorksheet('Reacciones');
  await assert.rejects(parse(book), /Falta la hoja/);
  await assert.rejects(parseVigiFlow(Buffer.from('no es un xlsx')), /no es un XLSX/);
});
test('no interpreta fechas parciales o imposibles', () => {
  assert.equal(parseVigiDate('20260230'), '');
  assert.equal(parseVigiDate('2026'), '');
  assert.equal(parseVigiDate('20240229'), '29/02/2024');
});
test('rechaza fórmulas y roles desconocidos', async () => {
  const book = fixture();
  book.getWorksheet('Reportes')!.getCell('E2').value = { formula: '1+1', result: 2 };
  await assert.rejects(parse(book), /fórmulas/);
  const other = fixture(); other.getWorksheet('Medicamentos')!.getCell('B2').value = 'Sin especificar';
  const [row] = await parse(other);
  assert.ok(row!.errors.some(error => error.includes('Rol del medicamento')));
});

test('acepta más de 1.000 reportes y conserva sus relaciones', async () => {
  const book = fixture('VOLUMEN-0');
  for (let i = 1; i < 1001; i++) {
    const id = `VOLUMEN-${i}`;
    book.getWorksheet('Reportes')!.addRow([id, id, 'AB', 'Femenino', `Caso ${i}`, 19950315, 20261001]);
    book.getWorksheet('Medicamentos')!.addRow([id, 'Sospechoso', `Producto ${i}`]);
    book.getWorksheet('Reacciones')!.addRow([id, `Reacción ${i}`, 'No']);
  }
  const rows = await parse(book);
  assert.equal(rows.length, 1001);
  assert.ok(rows.every(row => row.errors.length === 0));
  assert.equal(rows[1000]!.report.medicines[0]!.name, 'Producto 1000');
  assert.equal(rows[1000]!.report.events[0]!.meddraTerm, 'Reacción 1000');
});

test('vincula mediante el ID de seguridad cuando falta el ID mundial', async () => {
  const book = fixture();
  book.getWorksheet('Reportes')!.getCell('A2').value = '';
  const [row] = await parse(book);
  assert.equal(row!.externalId, 'TEST-001');
  assert.deepEqual(row!.errors, []);
});

test('vincula el ID alternativo sin mezclar reportes', async () => {
  const book = fixture();
  book.getWorksheet('Reportes')!.getCell('B2').value = 'LOCAL-01';
  book.getWorksheet('Medicamentos')!.getCell('A2').value = 'LOCAL-01';
  assert.equal((await parse(book))[0]!.report.medicines.length, 1);
});

test('rechaza alias compartidos por distintos reportes', async () => {
  const book = fixture();
  book.getWorksheet('Reportes')!.addRow(['OTRO', 'TEST-001', 'CD', 'Masculino', 'Otro caso', 19900101, 20261001]);
  await assert.rejects(parse(book), /más de un reporte/);
});

for (const [name, change, message] of [
  ['encabezado requerido ausente', (book: ExcelJS.Workbook) => { book.getWorksheet('Reportes')!.getCell('C1').value = 'Otra columna'; }, /Falta la columna/],
  ['encabezados duplicados', (book: ExcelJS.Workbook) => { book.getWorksheet('Reportes')!.getCell('L1').value = '  INICIALES  '; }, /encabezados repetidos/],
  ['archivo sin reportes', (book: ExcelJS.Workbook) => { book.getWorksheet('Reportes')!.spliceRows(2, 1); }, /no contiene reportes/],
  ['celda con error de Excel', (book: ExcelJS.Workbook) => { book.getWorksheet('Reportes')!.getCell('E2').value = { error: '#VALUE!' }; }, /celdas con errores/],
] as const) {
  test(`rechaza ${name}`, async () => {
    const book = fixture(); change(book);
    await assert.rejects(parse(book), message);
  });
}

for (const [name, change, message] of [
  ['fecha de recepción inválida', (book: ExcelJS.Workbook) => { book.getWorksheet('Reportes')!.getCell('G2').value = '20260230'; }, /fecha de recepción/],
  ['iniciales demasiado largas', (book: ExcelJS.Workbook) => { book.getWorksheet('Reportes')!.getCell('C2').value = 'ABCDE'; }, /iniciales exceden/],
  ['reacción sin MedDRA', (book: ExcelJS.Workbook) => { book.getWorksheet('Reacciones')!.getCell('B2').value = ''; }, /sin término MedDRA/],
  ['medicamento sin nombre', (book: ExcelJS.Workbook) => { book.getWorksheet('Medicamentos')!.getCell('C2').value = ''; }, /medicamentos sin nombre/],
  ['sin medicamentos sospechosos', (book: ExcelJS.Workbook) => { book.getWorksheet('Medicamentos')!.getCell('B2').value = 'Concomitante'; }, /no tiene medicamentos sospechosos/],
  ['sin reacciones', (book: ExcelJS.Workbook) => { book.getWorksheet('Reacciones')!.spliceRows(2, 1); }, /no tiene filas en Reacciones/],
] as const) {
  test(`marca el reporte con ${name}`, async () => {
    const book = fixture(); change(book);
    const [row] = await parse(book);
    assert.ok(row!.errors.some(error => message.test(error)));
  });
}

test('conserva texto enriquecido y convierte fechas tipadas de Excel', async () => {
  const book = fixture();
  book.getWorksheet('Reportes')!.getCell('E2').value = { richText: [{ text: 'Narrativa ' }, { text: 'completa' }] };
  book.getWorksheet('Reportes')!.getCell('F2').value = new Date('1995-03-15T00:00:00Z');
  const [row] = await parse(book);
  assert.equal(row!.report.adverseEventDescription, 'Narrativa completa');
  assert.equal(row!.report.patient.birthDate, '15/03/1995');
});

test('normaliza encabezados y categorías sin depender de tildes o mayúsculas', async () => {
  const book = fixture();
  book.getWorksheet('Reportes')!.getCell('A1').value = ' NUMERO DE IDENTIFICACION UNICO MUNDIAL ';
  book.getWorksheet('Reportes')!.getCell('D2').value = ' FEMENINO ';
  book.getWorksheet('Reacciones')!.getCell('C2').value = 'SÍ';
  const [row] = await parse(book);
  assert.equal(row!.report.patient.sex, 'femenino');
  assert.equal(row!.report.events[0]!.isSerious, true);
  assert.ok(row!.warnings.some(warning => warning.includes('criterio único')));
});

test('valores ajenos a las categorías se conservan sin romper el análisis', async () => {
  for (const value of ['Sin especificar', 'constructor', '__proto__', 'toString']) {
    const book = fixture(); book.getWorksheet('Reportes')!.getCell('D2').value = value;
    const [row] = await parse(book);
    assert.equal(row!.report.patient.sex, undefined);
    assert.ok(row!.warnings.some(warning => warning.includes(value)));
  }
});

test('convierte coma decimal y no inventa edad en años para lactantes', async () => {
  const book = fixture();
  book.getWorksheet('Reportes')!.getCell('I2').value = '162,5';
  book.getWorksheet('Reportes')!.getCell('H2').value = '6 Mes';
  const [row] = await parse(book);
  assert.equal(row!.report.patient.heightM, 1.625);
  assert.equal(row!.report.patient.ageAtEventStart, undefined);
  assert.ok(row!.warnings.some(warning => warning.includes('6 Mes')));
});

test('duraciones y edades fuera del rango de almacenamiento generan errores por reporte', async () => {
  const book = fixture();
  book.getWorksheet('Reportes')!.getCell('H2').value = '2147483648 Año';
  book.getWorksheet('Reacciones')!.getCell('F1').value = 'Duración';
  book.getWorksheet('Reacciones')!.getCell('F2').value = '2147483648 Días';
  const [row] = await parse(book);
  assert.ok(row!.errors.some(error => error.includes('Edad')));
  assert.ok(row!.errors.some(error => error.includes('Duración')));
});

test('rechaza un ZIP truncado y un tamaño descomprimido excesivo', async () => {
  const buffer = Buffer.from(await fixture().xlsx.writeBuffer());
  await assert.rejects(parseVigiFlow(buffer.subarray(0, buffer.length - 10)), /no es un XLSX/);
  const modified = Buffer.from(buffer);
  const end = modified.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const central = modified.readUInt32LE(end + 16);
  modified.writeUInt32LE(51 * 1024 * 1024, central + 24);
  await assert.rejects(parseVigiFlow(modified), /50 MB/);
});
