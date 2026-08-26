-- Semana 5 — Revisión del investigador (RF-5): clasificación, auditoría y outbox MSP.

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- RF-5.6: estados terminales no pueden volver atrás.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_terminal_status_immutable;
-- La inmutabilidad se aplica en la capa de aplicación al clasificar.

CREATE INDEX IF NOT EXISTS reports_review_queue_idx
  ON reports (submitted_at ASC)
  WHERE status = 'en_revision';

CREATE INDEX IF NOT EXISTS reports_msp_pending_idx
  ON reports (submitted_at ASC)
  WHERE status = 'aprobado_msp';

-- Auditoría de correcciones y clasificaciones (plan-arquitectura.md).
CREATE TABLE IF NOT EXISTS report_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('correccion', 'clasificacion')),
  previous_status report_status,
  new_status report_status,
  previous_snapshot jsonb,
  new_snapshot jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_review_events_report_idx
  ON report_review_events (report_id, created_at DESC);

-- Cola de envío al MSP (stub Semana 5; E2B real en Semana 8 — RF-5.4 / RF-9).
CREATE TABLE IF NOT EXISTS msp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'enviado', 'error')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS msp_outbox_status_idx ON msp_outbox (status, created_at ASC);
