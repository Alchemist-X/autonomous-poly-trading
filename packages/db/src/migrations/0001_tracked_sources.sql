CREATE TABLE IF NOT EXISTS tracked_sources (
  id uuid PRIMARY KEY,
  run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  decision_id uuid REFERENCES agent_decisions(id) ON DELETE SET NULL,
  event_slug text NOT NULL,
  market_slug text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  source_kind varchar(64) NOT NULL,
  role varchar(32) NOT NULL,
  status varchar(32) NOT NULL,
  retrieved_at_utc timestamptz NOT NULL,
  last_checked_at timestamptz,
  note text,
  content_hash varchar(128),
  metadata jsonb
);
