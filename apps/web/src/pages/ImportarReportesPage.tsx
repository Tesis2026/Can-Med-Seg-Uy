import { Permission, hasPermission, type ReportImportPreview, type ReportImportResult } from '@canmedseg/shared';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useSession } from '../features/auth/SessionContext';
import { apiFetch } from '../lib/api';
import { ReportDetailView } from '../features/reporte/ReportDetailView';
import styles from './ImportarReportes.module.css';

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export function ImportarReportesPage() {
  const { session, loading } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<{ filename: string; data: string } | null>(null);
  const [preview, setPreview] = useState<ReportImportPreview | null>(null);
  const [result, setResult] = useState<ReportImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (loading) return <p>Cargando…</p>;
  if (!session.authenticated) return <Navigate to="/login?returnTo=%2Fimportar-reportes" replace />;
  if (!hasPermission(session.permissions, Permission.ReportImport)) return <Navigate to="/" replace />;

  async function analyze() {
    if (!file) return;
    setBusy(true); setError(''); setPreview(null); setResult(null); setPayload(null);
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Seleccione un archivo .xlsx de VigiFlow.');
      if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera los 5 MB.');
      const body = { filename: file.name, data: await readFile(file) };
      const response = await apiFetch<ReportImportPreview>('/api/imports/vigiflow/preview', { method: 'POST', body });
      setPayload(body); setPreview(response);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo analizar el archivo.'); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!payload) return;
    setBusy(true); setError('');
    try {
      setResult(await apiFetch<ReportImportResult>('/api/imports/vigiflow/confirm', { method: 'POST', body: payload }));
      setPayload(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo importar el archivo.'); }
    finally { setBusy(false); }
  }
  const ready = preview?.rows.filter(row => !row.duplicate && !row.errors.length).length ?? 0;
  return <div className={styles.page}>
    <h1>Importar reportes</h1>
    <p>Cargar exportación de VigiFlow con las hojas Reportes, Medicamentos y Reacciones.</p>
    <section className={styles.card}>
      <h2>Seleccionar archivo</h2>
      <p>Hasta 5 MB por archivo. Primero podrá revisar los datos; todavía no se guardará ningún reporte.</p>
      <label htmlFor="vigiflow-file">Archivo Excel de VigiFlow</label>
      <input id="vigiflow-file" type="file" accept=".xlsx" disabled={busy} onChange={event => {
        setFile(event.target.files?.[0] ?? null); setPreview(null); setResult(null); setPayload(null); setError('');
      }} />
      <button disabled={!file || busy} onClick={() => void analyze()}>{busy ? 'Procesando…' : 'Analizar archivo'}</button>
    </section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {preview && <section className={styles.card}>
      <h2>Vista previa</h2>
      <p>{preview.rows.length} {preview.rows.length === 1 ? 'reporte encontrado' : 'reportes encontrados'} · {ready} disponibles para importar · {preview.rows.filter(row => row.duplicate).length} ya importados.</p>
      <div className={styles.tableWrap}><table>
        <thead><tr><th>Identificador VigiFlow</th><th>Paciente</th><th>Eventos / medicamentos</th><th>Resultado</th></tr></thead>
        <tbody>{preview.rows.map(row => <tr key={row.rowNumber}>
          <td>{row.externalId || `Fila ${row.rowNumber}`}</td>
          <td>{row.report.patient.initials || 'Sin dato'}</td>
          <td>{row.report.events.length} / {row.report.medicines.length}</td>
          <td>{row.duplicate ? 'Ya importado' : row.errors.length ? 'No se puede importar' : 'Disponible'}
            <details><summary>Ver datos y observaciones</summary>
              <p>{row.report.adverseEventDescription || 'Sin descripción'}</p>
              <p>Reacciones: {row.report.events.map(event => event.meddraTerm).join(', ')}</p>
              <p>Medicamentos: {row.report.medicines.map(med => med.name).join(', ')}</p>
              <p>Concomitantes: {row.report.concomitantTreatments.map(med => med.name).join(', ') || 'Sin dato'}</p>
              {row.errors.length > 0 && <ul>{row.errors.map((message, i) => <li className={styles.error} key={`e${i}`}>{message}</li>)}</ul>}
              <details><summary>Ver todos los campos mapeados</summary>
                <ReportDetailView readonlyNote={false} detail={{ id: row.externalId, status: 'aprobado_local', createdAt: row.submittedAt ?? '', submittedAt: row.submittedAt ?? '', report: row.report }} />
              </details>
            </details>
          </td>
        </tr>)}</tbody>
      </table></div>
      {!result && <button disabled={!ready || busy || !payload} onClick={() => void confirm()}>{busy ? 'Importando…' : `Importar ${ready} ${ready === 1 ? 'reporte' : 'reportes'}`}</button>}
    </section>}
    {result && <section className={styles.card} role="status">
      <h2>Importación finalizada</h2>
      <p>{result.imported} reportes importados. {result.skipped} omitidos.</p>
      <Link to="/historial">Ver historial de reportes</Link>
    </section>}
  </div>;
}
