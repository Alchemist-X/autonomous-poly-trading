-- Access-control tables for the hosted prediction engine.
-- App users are separate from `managed_users` so social login / quotas can
-- launch without changing the Privy managed-trading schema.

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY,
  oidc_issuer text NOT NULL,
  oidc_subject text NOT NULL,
  email varchar(320),
  name text,
  image_url text,
  role varchar(24) NOT NULL DEFAULT 'user',
  status varchar(24) NOT NULL DEFAULT 'pending_invite',
  activated_at timestamptz,
  last_login_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_oidc_identity_unique UNIQUE (oidc_issuer, oidc_subject)
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);
CREATE INDEX IF NOT EXISTS idx_app_users_status ON app_users (status);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users (role);

CREATE TABLE IF NOT EXISTS invite_codes (
  id uuid PRIMARY KEY,
  code_hash varchar(128) NOT NULL UNIQUE,
  label text,
  status varchar(24) NOT NULL DEFAULT 'active',
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  allowed_email_domain varchar(255),
  expires_at timestamptz,
  created_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_status ON invite_codes (status);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires ON invite_codes (expires_at);

CREATE TABLE IF NOT EXISTS prediction_usage_events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  action varchar(32) NOT NULL DEFAULT 'prediction_run',
  status varchar(24) NOT NULL DEFAULT 'running',
  event_text text,
  backend_source varchar(24),
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prediction_usage_user_started
  ON prediction_usage_events (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_usage_user_status
  ON prediction_usage_events (user_id, status);
CREATE INDEX IF NOT EXISTS idx_prediction_usage_action_started
  ON prediction_usage_events (action, started_at DESC);
