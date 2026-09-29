-- Alta por invitación (plugin app-invite de better-auth): el administrador invita
-- por email y la persona completa su registro desde el enlace. Toda cuenta
-- invitada queda con el rol Investigador.

CREATE TABLE IF NOT EXISTS app_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text,
  email text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'canceled', 'expired')),
  expires_at timestamptz,
  domain_whitelist text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_invitations_email_idx ON app_invitations (lower(email));
CREATE INDEX IF NOT EXISTS app_invitations_status_idx ON app_invitations (status);
