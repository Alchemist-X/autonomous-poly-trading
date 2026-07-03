// Read-only shapes served by the public web API (overview, positions, trades,
// runs, tracked sources, resolution checks). Split out of index.ts (Stage 2,
// 2026-07-03); re-exported verbatim from index.ts.
import type { Artifact, PublicRunStatus, RunMode, SystemStatus, TradeDecision } from "./trade-decision.js";

export interface OverviewPoint {
  timestamp: string;
  total_equity_usd: number;
  drawdown_pct: number;
}

export interface OverviewResponse {
  status: SystemStatus;
  cash_balance_usd: number;
  total_equity_usd: number;
  high_water_mark_usd: number;
  drawdown_pct: number;
  open_positions: number;
  last_run_at: string | null;
  latest_risk_event: string | null;
  equity_curve: OverviewPoint[];
}

export interface PublicPosition {
  id: string;
  event_slug: string;
  market_slug: string;
  token_id: string;
  side: "BUY" | "SELL";
  outcome_label: string;
  size: number;
  avg_cost: number;
  current_price: number;
  current_value_usd: number;
  unrealized_pnl_pct: number;
  stop_loss_pct: number;
  opened_at: string;
  updated_at: string;
}

export interface PublicTrade {
  id: string;
  market_slug: string;
  token_id: string;
  status: string;
  side: "BUY" | "SELL";
  requested_notional_usd: number;
  filled_notional_usd: number;
  avg_price: number | null;
  order_id: string | null;
  timestamp_utc: string;
}

export interface PublicArtifactListItem {
  id: string;
  title: string;
  kind: Artifact["kind"];
  path: string;
  published_at_utc: string;
}

export interface PublicRunSummary {
  id: string;
  mode: RunMode;
  runtime: string;
  status: PublicRunStatus;
  bankroll_usd: number;
  decision_count: number;
  generated_at_utc: string;
}

export interface PublicRunDetail extends PublicRunSummary {
  prompt_summary: string;
  reasoning_md: string;
  logs_md: string;
  decisions: TradeDecision[];
  artifacts: Artifact[];
  tracked_sources: PublicTrackedSource[];
  resolution_checks: PublicResolutionCheck[];
}

export interface PublicTrackedSource {
  id: string;
  run_id: string | null;
  decision_id: string | null;
  event_slug: string;
  market_slug: string;
  title: string;
  url: string;
  source_kind: string;
  role: string;
  status: string;
  retrieved_at_utc: string;
  last_checked_at: string | null;
  note: string | null;
  content_hash: string | null;
}

export interface PublicResolutionCheck {
  id: string;
  event_slug: string;
  market_slug: string;
  track_status: string;
  interval_minutes: number;
  next_check_at: string | null;
  last_checked_at: string | null;
  summary: string;
  trackability: string | null;
  source_url: string | null;
  source_type: string | null;
  report_path: string | null;
}
