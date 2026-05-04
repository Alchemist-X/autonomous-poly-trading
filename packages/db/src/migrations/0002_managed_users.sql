CREATE TABLE IF NOT EXISTS managed_users (
  id uuid PRIMARY KEY,
  privy_did varchar(128) NOT NULL UNIQUE,
  email varchar(320),
  eoa_address varchar(42) NOT NULL,
  safe_address varchar(42),
  status varchar(32) NOT NULL DEFAULT 'pending_deploy',
  ai_auto_trade_enabled boolean NOT NULL DEFAULT false,
  session_signer_authorized_at timestamptz,
  session_signer_revoked_at timestamptz,
  risk_tier varchar(16) NOT NULL DEFAULT 'balanced',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_managed_users_eoa ON managed_users (eoa_address);
CREATE INDEX IF NOT EXISTS idx_managed_users_safe ON managed_users (safe_address);
CREATE INDEX IF NOT EXISTS idx_managed_users_status ON managed_users (status);

CREATE TABLE IF NOT EXISTS managed_deposits (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES managed_users(id) ON DELETE CASCADE,
  tx_hash varchar(66) NOT NULL UNIQUE,
  amount_usd numeric(14, 2) NOT NULL,
  token_address varchar(42) NOT NULL,
  block_number integer,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_managed_deposits_user ON managed_deposits (user_id);
