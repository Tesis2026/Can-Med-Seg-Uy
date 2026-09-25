-- Gestión de usuarios con better-auth: ingreso con email + contraseña y alta,
-- baja, activación y desactivación por el administrador (RF-11).
-- Diseño: docs/superpowers/specs/2026-09-25-gestion-usuarios-better-auth-design.md
--
-- Registro con GUB UY: deprecado momentáneamente. Las tablas de la 004
-- (sessions, auth_login_states, auth_mock_authorization_codes) quedan sin cambios
-- para poder reactivarlo sin migraciones.

-- 1) Columnas que better-auth y su plugin admin esperan en el modelo `user`.
--    `display_name` hace de `name` y `email`/`created_at`/`updated_at` ya existían.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image text,
  -- Espejo para el plugin admin (`admin` | `user`); los roles reales viven en user_roles.
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS ban_expires timestamptz;

UPDATE users u
   SET role = CASE
     WHEN EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
       THEN 'admin' ELSE 'user' END
 WHERE role IS NULL;

-- 2) Credenciales (hash de la contraseña) — modelo `account`.
CREATE TABLE IF NOT EXISTS auth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_accounts_user_id_idx ON auth_accounts (user_id);

-- 3) Sesiones de better-auth — modelo `session`. Conviven con `sessions` (GUB UY).
CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  impersonated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);

-- 4) Tokens de verificación — modelo `verification`. El core la exige aunque hoy no se use.
CREATE TABLE IF NOT EXISTS auth_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_verifications_identifier_idx ON auth_verifications (identifier);

-- 5) Borrar un usuario borra todo lo suyo: reportes (con sus eventos, medicamentos,
--    imágenes, auditoría y outbox, que ya cascadean sobre reports), borradores y
--    su registro de exportaciones.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_notifier_user_id_fkey;
ALTER TABLE reports
  ADD CONSTRAINT reports_notifier_user_id_fkey
  FOREIGN KEY (notifier_user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE export_logs DROP CONSTRAINT IF EXISTS export_logs_requested_by_fkey;
ALTER TABLE export_logs
  ADD CONSTRAINT export_logs_requested_by_fkey
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE;

-- 6) Lo que el usuario dejó sobre datos de otros no se borra: la marca queda en NULL.
--    Borrar a un investigador no borra los reportes ajenos que revisó.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_reviewed_by_fkey;
ALTER TABLE reports
  ADD CONSTRAINT reports_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE report_review_events ALTER COLUMN reviewer_user_id DROP NOT NULL;
ALTER TABLE report_review_events DROP CONSTRAINT IF EXISTS report_review_events_reviewer_user_id_fkey;
ALTER TABLE report_review_events
  ADD CONSTRAINT report_review_events_reviewer_user_id_fkey
  FOREIGN KEY (reviewer_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_granted_by_fkey;
ALTER TABLE user_roles
  ADD CONSTRAINT user_roles_granted_by_fkey
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE role_requests DROP CONSTRAINT IF EXISTS role_requests_decided_by_fkey;
ALTER TABLE role_requests
  ADD CONSTRAINT role_requests_decided_by_fkey
  FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL;
