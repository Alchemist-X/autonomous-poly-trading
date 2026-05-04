-- Phase 2 paper-mode tables for the multi-user managed trading flow.
-- `managed_paper_runs` records one run of the dispatcher per user (one per
-- daily-pulse fan-out), `managed_decisions` records the per-market decisions
-- inside that run. Phase 3 will add `mode = 'live'` runs and link executions.

CREATE TABLE IF NOT EXISTS managed_paper_runs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES managed_users(id) ON DELETE CASCADE,
  mode varchar(16) NOT NULL DEFAULT 'paper',
  status varchar(32) NOT NULL,
  bankroll_usd numeric(14, 2),
  decision_count integer NOT NULL DEFAULT 0,
  started_at_utc timestamptz NOT NULL,
  completed_at_utc timestamptz,
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_managed_paper_runs_user
  ON managed_paper_runs (user_id);
CREATE INDEX IF NOT EXISTS idx_managed_paper_runs_user_started
  ON managed_paper_runs (user_id, started_at_utc DESC);

CREATE TABLE IF NOT EXISTS managed_decisions (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES managed_paper_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES managed_users(id) ON DELETE CASCADE,
  action varchar(16) NOT NULL,
  event_slug text NOT NULL,
  market_slug text NOT NULL,
  token_id text NOT NULL,
  side varchar(8),
  notional_usd numeric(14, 2) NOT NULL,
  bankroll_ratio numeric(8, 6) NOT NULL,
  ai_prob numeric(8, 6) NOT NULL,
  market_prob numeric(8, 6) NOT NULL,
  edge numeric(8, 6) NOT NULL,
  confidence varchar(16),
  thesis_md text NOT NULL,
  risk_tier_at_decision varchar(16) NOT NULL,
  risk_caps_applied jsonb,
  skipped_reason text,
  metadata jsonb,
  created_at_utc timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_managed_decisions_user
  ON managed_decisions (user_id);
CREATE INDEX IF NOT EXISTS idx_managed_decisions_run
  ON managed_decisions (run_id);
