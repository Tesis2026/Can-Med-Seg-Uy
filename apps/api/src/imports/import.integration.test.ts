import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import ExcelJS from 'exceljs';

// Ejecutar con IMPORT_TEST_DB=1 contra una base local migrada.
test('integración del importador con API y PostgreSQL', { skip: process.env.IMPORT_TEST_DB !== '1' }, async t => {
  const { pool } = await import('../database/pool');
  const { auth } = await import('../auth/betterAuth');
  const { assignInitialRoles } = await import('../admin/userAdminRepository');
  const { buildApp } = await import('../app');
  const app = await buildApp();
  const suffix = randomUUID();
  const email = `import-test-${suffix}@example.invalid`;
  const password = randomUUID();
  let userId: string | undefined;
  try {
    const created = await auth.api.createUser({ body: { email, password, name: 'Prueba importador', role: 'user' } });
    userId = created.user.id;
    const signIn = await app.inject({ method: 'POST', url: '/api/auth/sign-in/email', headers: { origin: 'http://localhost:5173' }, payload: { email, password } });
    assert.equal(signIn.statusCode, 200, signIn.body);
    const cookie = signIn.cookies.map(entry => `${entry.name}=${entry.value}`).join('; ');
    const book = new ExcelJS.Workbook();
    const externalId = `IMPORT-TEST-${suffix}`;
    book.addWorksheet('Reportes').addRows([
      ['Número de identificación único mundial', 'Iniciales', 'Sexo', 'Caso narrativo', 'Fecha de recepción inicial'],
      [externalId, 'TT', '', 'Prueba sintética del importador', 20261001],
    ]);
    book.addWorksheet('Medicamentos').addRows([
      ['Número de identificación único mundial', 'Rol del medicamento', 'Nombre del medicamento (patente-WHODrug)'],
      [externalId, 'Sospechoso', 'Medicamento de prueba'],
      [externalId, 'Concomitante', 'Concomitante de prueba'],
    ]);
    book.addWorksheet('Reacciones').addRows([
      ['Número de identificación único mundial', 'Reacción / evento (MedDRA) LLT', 'Grave'],
      [externalId, 'Reacción de prueba', ''], [externalId, 'Segunda reacción', 'No'],
    ]);
    const payload = { filename: 'prueba.xlsx', data: Buffer.from(await book.xlsx.writeBuffer()).toString('base64') };
    const inject = (action: string, authenticated = true) => app.inject({ method: 'POST', url: `/api/imports/vigiflow/${action}`, headers: authenticated ? { cookie } : {}, payload });
    assert.equal((await inject('preview', false)).statusCode, 401);
    assert.equal((await inject('confirm')).statusCode, 403);
    await t.test('administrador sin rol investigador no puede importar', async () => {
      await assignInitialRoles(pool, userId!, [{ role: 'admin', healthProfessionSubtype: null }], null);
      assert.equal((await inject('preview')).statusCode, 403);
      assert.equal((await inject('confirm')).statusCode, 403);
      await pool.query("DELETE FROM user_roles WHERE user_id = $1 AND role = 'admin'", [userId]);
    });
    await assignInitialRoles(pool, userId, [{ role: 'investigador', healthProfessionSubtype: null }], null);
    const post = (body: unknown, action = 'preview') => app.inject({ method: 'POST', url: `/api/imports/vigiflow/${action}`, headers: { cookie }, payload: body as Record<string, unknown> });
    for (const [name, body, status] of [
      ['extensión incorrecta', { ...payload, filename: 'prueba.csv' }, 400],
      ['base64 inválido', { ...payload, data: '???' }, 400],
      ['archivo vacío', { ...payload, data: '' }, 400],
      ['contenido que no es XLSX', { ...payload, data: Buffer.from('texto').toString('base64') }, 400],
      ['archivo superior a 5 MB', { ...payload, data: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') }, 413],
      ['solicitud demasiado grande', { ...payload, data: 'A'.repeat(7_100_001) }, 413],
    ] as const) {
      await t.test(`API rechaza ${name}`, async () => {
        const response = await post(body);
        assert.equal(response.statusCode, status, response.body);
      });
    }
    const preview = await inject('preview');
    assert.equal(preview.statusCode, 200, preview.body);
    assert.equal(preview.json().rows[0].duplicate, false);
    await t.test('analizar no escribe reportes', async () => {
      const count = await pool.query('SELECT count(*)::int AS total FROM reports WHERE notifier_user_id = $1', [userId]);
      assert.equal(count.rows[0].total, 0);
    });
    const responses = await Promise.all([inject('confirm'), inject('confirm')]);
    for (const response of responses) assert.equal(response.statusCode, 201, response.body);
    assert.equal(responses.reduce((sum, response) => sum + response.json().imported, 0), 1);
    assert.equal(responses.reduce((sum, response) => sum + response.json().skipped, 0), 1);
    assert.equal((await inject('preview')).json().rows[0].duplicate, true);
    const id = responses.flatMap(response => response.json().ids)[0];
    const detail = await app.inject({ method: 'GET', url: `/api/reports/${id}`, headers: { cookie } });
    assert.equal(detail.statusCode, 200, detail.body);
    assert.equal(detail.json().status, 'aprobado_local');
    assert.equal(detail.json().importDetails.externalId, externalId);
    assert.equal(detail.json().report.events.length, 2);
    assert.equal(detail.json().report.concomitantTreatments.length, 1);
    const stored = await pool.query('SELECT is_serious FROM report_adverse_events WHERE report_id = $1 ORDER BY position', [id]);
    assert.equal(stored.rows[0].is_serious, null);
    const { getReportTable } = await import('../analytics/reportTableRepository');
    const table = await getReportTable(pool, { dateField: 'notificacion', page: 1, pageSize: 20, sort: 'submittedAt', direction: 'desc', search: 'Prueba sintética del importador' });
    assert.equal(table.rows.find(row => row.id === id)?.serious, null);
    const { buildExportBundle } = await import('../exports/exportBuilder');
    const bundle = await buildExportBundle(pool, { dateField: 'notificacion' }, 'Prueba de importación');
    assert.ok(bundle.sheets[0]!.rows.some(row => row[0] === id));
    const exportedEvents = bundle.sheets[1]!.rows.filter(row => row[0] === id);
    assert.equal(exportedEvents.length, 2);
    assert.equal(exportedEvents[0]![7], '');
    await t.test('reimportar no sobrescribe datos existentes', async () => {
      book.getWorksheet('Reportes')!.getCell('D2').value = 'Cambio que no debe persistir';
      const response = await post({ filename: 'otra-version.xlsx', data: Buffer.from(await book.xlsx.writeBuffer()).toString('base64') }, 'confirm');
      assert.equal(response.statusCode, 201, response.body);
      assert.equal(response.json().imported, 0);
      assert.equal(response.json().skipped, 1);
      const storedReport = await pool.query('SELECT adverse_event_description FROM reports WHERE id = $1', [id]);
      assert.equal(storedReport.rows[0].adverse_event_description, 'Prueba sintética del importador');
    });
    await t.test('lote mixto importa solo nuevos válidos y omite duplicados y errores', async () => {
      for (const [tail, date] of [['VALIDO', 20261001], ['INVALIDO', 20260230]] as const) {
        const key = `${externalId}-${tail}`;
        book.getWorksheet('Reportes')!.addRow([key, 'MM', '', 'Prueba de lote mixto', date]);
        book.getWorksheet('Medicamentos')!.addRow([key, 'Sospechoso', 'Medicamento del lote']);
        book.getWorksheet('Reacciones')!.addRow([key, 'Reacción del lote', 'No']);
      }
      const body = { filename: 'mixto.xlsx', data: Buffer.from(await book.xlsx.writeBuffer()).toString('base64') };
      const response = await post(body, 'confirm');
      assert.equal(response.statusCode, 201, response.body);
      assert.equal(response.json().imported, 1);
      assert.equal(response.json().skipped, 2);
      const invalid = await pool.query('SELECT id FROM reports WHERE external_report_id = $1', [`${externalId}-INVALIDO`]);
      assert.equal(invalid.rowCount, 0);
      const count = await pool.query('SELECT count(*)::int AS total FROM reports WHERE notifier_user_id = $1', [userId]);
      assert.equal(count.rows[0].total, 2);
    });
    await t.test('eliminar desde el historial borra solo el reporte propio y sus datos asociados', async () => {
      const response = await app.inject({ method: 'DELETE', url: `/api/reports/history/${id}`, headers: { cookie } });
      assert.equal(response.statusCode, 204, response.body);
      const detail = await app.inject({ method: 'GET', url: `/api/reports/${id}`, headers: { cookie } });
      assert.equal(detail.statusCode, 404);
      const history = await app.inject({ method: 'GET', url: '/api/reports/history', headers: { cookie } });
      assert.ok(history.json().every((report: { id: string }) => report.id !== id));
      const importedDetails = await pool.query('SELECT count(*)::int AS total FROM report_import_details WHERE report_id = $1', [id]);
      assert.equal(importedDetails.rows[0].total, 0);
    });
  } finally {
    if (userId) {
      await pool.query('DELETE FROM reports WHERE notifier_user_id = $1', [userId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    await app.close();
  }
});
