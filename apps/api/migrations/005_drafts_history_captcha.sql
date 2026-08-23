-- Semana 4 — Borradores `en_progreso` (RF-4), historial propio (RF-6)
-- y CAPTCHA del envío anónimo (RF-3.6).

-- 1) Un borrador es un reporte en estado `en_progreso` (RF-4.3 y §3 de
--    documentacion/diagramas.md): comparte el id con el reporte final, así el
--    historial mantiene la trazabilidad. Como está incompleto por definición, las
--    columnas obligatorias del envío pasan a ser condicionales.
ALTER TABLE reports
  ALTER COLUMN patient_initials DROP NOT NULL,
  ALTER COLUMN patient_sex DROP NOT NULL,
  ALTER COLUMN patient_birth_date DROP NOT NULL,
  ALTER COLUMN patient_age_at_event_start DROP NOT NULL,
  ALTER COLUMN patient_country_of_event_start DROP NOT NULL,
  ALTER COLUMN adverse_event_description DROP NOT NULL,
  ALTER COLUMN contact_profession DROP NOT NULL,
  ALTER COLUMN contact_email DROP NOT NULL,
  ALTER COLUMN contact_phone DROP NOT NULL,
  ALTER COLUMN submitted_at DROP NOT NULL;

ALTER TABLE reports
  -- Sección del asistente en la que quedó el borrador (RF-3.1 / RF-4.1).
  ADD COLUMN IF NOT EXISTS current_step smallint NOT NULL DEFAULT 5,
  -- Caducidad por inactividad; se recalcula en cada autoguardado.
  ADD COLUMN IF NOT EXISTS draft_expires_at timestamptz;

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_current_step_range;
ALTER TABLE reports
  ADD CONSTRAINT reports_current_step_range CHECK (current_step BETWEEN 1 AND 5);

-- RF-4.4: los reportes anónimos no tienen guardado parcial.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_draft_requires_owner;
ALTER TABLE reports
  ADD CONSTRAINT reports_draft_requires_owner CHECK (
    status <> 'en_progreso' OR notifier_user_id IS NOT NULL
  );

-- Lo que dejó de ser NOT NULL sigue siendo obligatorio una vez enviado (RF-3.2).
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_submitted_is_complete;
ALTER TABLE reports
  ADD CONSTRAINT reports_submitted_is_complete CHECK (
    status = 'en_progreso' OR (
      submitted_at IS NOT NULL
      AND patient_initials IS NOT NULL
      AND patient_sex IS NOT NULL
      AND patient_birth_date IS NOT NULL
      AND patient_age_at_event_start IS NOT NULL
      AND patient_country_of_event_start IS NOT NULL
      AND adverse_event_description IS NOT NULL
      AND contact_profession IS NOT NULL
      AND contact_email IS NOT NULL
      AND contact_phone IS NOT NULL
    )
  );

-- Listado «Formularios en progreso», ordenado por última edición (RF-4.5).
CREATE INDEX IF NOT EXISTS reports_drafts_by_owner_idx
  ON reports (notifier_user_id, updated_at DESC)
  WHERE status = 'en_progreso';

-- Historial propio ordenado por fecha de envío (RF-6.1).
CREATE INDEX IF NOT EXISTS reports_history_by_owner_idx
  ON reports (notifier_user_id, submitted_at DESC)
  WHERE status <> 'en_progreso';

-- 2) CAPTCHA de los envíos sin sesión (RF-3.6). El desafío se resuelve contra el
--    servidor y deja un token de un solo uso que acompaña al POST del reporte.
CREATE TABLE IF NOT EXISTS captcha_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Texto del desafío en mayúsculas. No es una credencial: se compara en claro.
  answer text NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  solved_at timestamptz,
  token_hash text UNIQUE,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ip_address text
);

CREATE INDEX IF NOT EXISTS captcha_challenges_expires_at_idx
  ON captcha_challenges (expires_at);
