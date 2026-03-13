CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY,
  runtime varchar(128) NOT NULL,
  mode varchar(16) NOT NULL,
  status varchar(32) NOT NULL,
  bankroll_usd numeric(14, 2) NOT NULL,
  prompt_summary text NOT NULL DEFAULT '',
  reasoning_md text NOT NULL DEFAULT '',
  logs_md text NOT NULL DEFAULT '',
  generated_at_utc timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_decisions (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  action varchar(16) NOT NULL,
  event_slug text NOT NULL,
  market_slug text NOT NULL,
  token_id text NOT NULL,
  side varchar(8) NOT NULL,
  notional_usd numeric(14, 2) NOT NULL,
  order_type varchar(16) NOT NULL,
  ai_prob numeric(8, 6) NOT NULL,
  market_prob numeric(8, 6) NOT NULL,
  edge numeric(8, 6) NOT NULL,
  confidence varchar(16) NOT NULL,
  thesis_md text NOT NULL,
  sources jsonb NOT NULL,
  stop_loss_pct numeric(8, 6) NOT NULL,
  resolution_track_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS execution_events (
  id uuid PRIMARY KEY,
  run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  decision_id uuid REFERENCES agent_decisions(id) ON DELETE SET NULL,
  market_slug text NOT NULL,
  token_id text NOT NULL,
  side varchar(8) NOT NULL,
  status varchar(32) NOT NULL,
  requested_notional_usd numeric(14, 2) NOT NULL,
  filled_notional_usd numeric(14, 2) NOT NULL DEFAULT 0,
  avg_price numeric(8, 6),
  order_id text,
  raw_response jsonb,
  timestamp_utc timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY,
  event_slug text NOT NULL,
  market_slug text NOT NULL,
  token_id text NOT NULL,
  side varchar(8) NOT NULL,
  outcome_label text NOT NULL,
  size numeric(18, 6) NOT NULL,
  avg_cost numeric(8, 6) NOT NULL,
  current_price numeric(8, 6) NOT NULL,
  current_value_usd numeric(14, 2) NOT NULL,
  unrealized_pnl_pct numeric(8, 6) NOT NULL,
  stop_loss_pct numeric(8, 6) NOT NULL,
  opened_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id uuid PRIMARY KEY,
  cash_balance_usd numeric(14, 2) NOT NULL,
  total_equity_usd numeric(14, 2) NOT NULL,
  high_water_mark_usd numeric(14, 2) NOT NULL,
  drawdown_pct numeric(8, 6) NOT NULL,
  open_positions integer NOT NULL,
  halted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risk_events (
  id uuid PRIMARY KEY,
  event_type varchar(64) NOT NULL,
  severity varchar(16) NOT NULL,
  message text NOT NULL,
  related_token_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resolution_checks (
  id uuid PRIMARY KEY,
  event_slug text NOT NULL,
  market_slug text NOT NULL,
  track_status varchar(32) NOT NULL,
  interval_minutes integer NOT NULL,
  next_check_at timestamptz,
  last_checked_at timestamptz,
  summary text NOT NULL DEFAULT '',
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS artifacts (
  id uuid PRIMARY KEY,
  run_id uuid REFERENCES agent_runs(id) ON DELETE CASCADE,
  kind varchar(64) NOT NULL,
  title text NOT NULL,
  path text NOT NULL,
  content text,
  published_at_utc timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS system_state (
  key varchar(64) PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
