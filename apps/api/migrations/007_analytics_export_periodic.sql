-- Semana 6 y parte de Semana 8: dashboard analítico (RF-7), exportación
-- seudonimizada (RF-8.1 a RF-8.10) y reportes periódicos (RF-8.3, RF-8.4).

-- 1) Departamento del paciente. Alimenta el gráfico por región (RF-7.10), que
--    hasta ahora no tenía origen de datos: el formulario solo pedía el país.
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS patient_department text;

-- 2) Seudónimos estables por persona (RF-8.2, RF-8.8). La correspondencia vive
--    en su propia tabla para que ninguna consulta analítica toque la cédula.
--    Se indexa por hash: la cédula en claro no se copia acá.
CREATE TABLE IF NOT EXISTS person_pseudonyms (
  document_hash text PRIMARY KEY,
  pseudonym text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Registro de exportaciones (RF-8.9).
CREATE TABLE IF NOT EXISTS export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES users(id),
  format text NOT NULL CHECK (format IN ('xlsx', 'csv')),
  filters jsonb NOT NULL,
  report_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS export_logs_user_idx
  ON export_logs (requested_by, created_at DESC);

-- 4) Preferencias de reportes periódicos, una fila por investigador (RF-8.4).
--    Sin fila configurada se envían todos los gráficos del MVP (RF-8.13).
CREATE TABLE IF NOT EXISTS periodic_report_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  frequency text NOT NULL DEFAULT 'mensual'
    CHECK (frequency IN ('mensual', 'trimestral', 'semestral')),
  charts text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Envíos periódicos ya realizados. La clave única evita duplicar el envío de
--    un mismo período cuando un reintento se superpone con la corrida siguiente
--    (RF-8.14).
CREATE TABLE IF NOT EXISTS periodic_report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  frequency text NOT NULL,
  charts text[] NOT NULL,
  report_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'enviado', 'fallido')),
  attempts smallint NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS periodic_report_deliveries_period_idx
  ON periodic_report_deliveries (user_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS periodic_report_deliveries_pending_idx
  ON periodic_report_deliveries (status, created_at)
  WHERE status <> 'enviado';

-- 6) Índices de apoyo para las agregaciones del dashboard. El conjunto base son
--    los reportes aprobados (RF-7.5), por eso el índice es parcial.
CREATE INDEX IF NOT EXISTS reports_analytics_base_idx
  ON reports (submitted_at DESC)
  WHERE status IN ('aprobado_local', 'enviado_msp');

CREATE INDEX IF NOT EXISTS reports_analytics_profession_idx
  ON reports (contact_profession)
  WHERE status IN ('aprobado_local', 'enviado_msp');

CREATE INDEX IF NOT EXISTS report_medicines_route_idx
  ON report_medicines (administration_route);

CREATE INDEX IF NOT EXISTS report_adverse_events_serious_idx
  ON report_adverse_events (is_serious);
