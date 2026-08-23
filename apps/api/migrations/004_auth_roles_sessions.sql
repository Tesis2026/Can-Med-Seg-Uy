-- Semana 3 — Auth GUB UY (mock OIDC), sesión y modelo multi-rol.
-- Roles objetivo: documentacion/diagramas.md §4 · plan-arquitectura.md

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'comun', 'profesional_salud', 'investigador', 'msp', 'admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE role_request_status AS ENUM ('pendiente', 'aprobada', 'rechazada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS identity_provider text NOT NULL DEFAULT 'gubuy',
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS first_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS users_identity_idx
  ON users (identity_provider, gub_sub);

-- Un usuario puede tener varios roles simultáneos (RF-1 / notas de cliente).
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  -- Subtipo del rol «Profesional de la salud» (médico, químico, enfermero, …).
  health_profession_subtype text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES users(id),
  PRIMARY KEY (user_id, role),
  CONSTRAINT user_roles_subtype_scope CHECK (
    health_profession_subtype IS NULL OR role = 'profesional_salud'
  )
);

CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles (role);

-- Sesión de servidor: la cookie httpOnly transporta un token opaco; se guarda su hash.
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text,
  ip_address text
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

-- Estado del authorization code flow (state + nonce + PKCE). Sirve para el IdP mock
-- y para GUB UY real: solo cambian las URLs del proveedor por variables de entorno.
CREATE TABLE IF NOT EXISTS auth_login_states (
  state text PRIMARY KEY,
  nonce text NOT NULL,
  code_verifier text NOT NULL,
  return_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS auth_login_states_expires_at_idx ON auth_login_states (expires_at);

-- Códigos de autorización emitidos por el IdP mock local. Tabla exclusiva de dev:
-- con GUB UY real la emite el proveedor y esta tabla queda sin uso.
CREATE TABLE IF NOT EXISTS auth_mock_authorization_codes (
  code text PRIMARY KEY,
  account_id text NOT NULL,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  nonce text,
  code_challenge text,
  code_challenge_method text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

-- Estructura de RF-2 (los flujos de solicitud/aprobación se implementan en Semana 7).
CREATE TABLE IF NOT EXISTS role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_role user_role NOT NULL,
  health_profession_subtype text,
  status role_request_status NOT NULL DEFAULT 'pendiente',
  verification_note text,
  verification_document_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES users(id),
  decision_note text,
  CONSTRAINT role_requests_requestable_role CHECK (
    requested_role IN ('profesional_salud', 'investigador', 'msp')
  ),
  CONSTRAINT role_requests_subtype_scope CHECK (
    health_profession_subtype IS NULL OR requested_role = 'profesional_salud'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS role_requests_one_pending_per_role_idx
  ON role_requests (user_id, requested_role)
  WHERE status = 'pendiente';

CREATE INDEX IF NOT EXISTS role_requests_status_idx ON role_requests (status, created_at DESC);
