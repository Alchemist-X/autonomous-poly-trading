// LongPort (长桥/Longbridge) MCP integration — READ-ONLY market data only.
//
// Wires the official LongPort MCP server (github.com/longportapp/longport-mcp,
// hosted at https://mcp.longportapp.com) into the claude-cli engine so the
// news-impact analyst can ground its numbers (direction, expectedMovePct) on
// the ACTUAL live price and recent move of an impacted US stock, instead of
// reasoning from the news text alone.
//
// SAFETY MODEL — non-negotiable, this is a real brokerage account:
//   The LongPort MCP exposes 145 tools, 14 of which PLACE/CANCEL/REPLACE REAL
//   ORDERS (submit_order, cancel_order, replace_order, ...) plus account,
//   funds-transfer, DCA, alert and watchlist WRITE tools. Raven Delta is a
//   demo_read_only news engine and the whole project is PAPER-ONLY. So we use
//   an ALLOWLIST-ONLY control: claude's --allowedTools names ONLY the read
//   market-data tools; every tool NOT on the list is unreachable. A missed
//   read tool is merely unavailable (harmless); a leaked write tool would be
//   catastrophic — so the list is curated, never a wildcard. The allowlist is
//   the SOLE load-bearing control. The --disallowedTools denylist is a
//   best-effort, hand-curated subset (defense-in-depth only) — do NOT relax
//   allowlist curation trusting it to catch a write tool it may not list.
//   As a fail-closed backstop, assertReadOnlyAllowlist() throws (rather than
//   spawn) if any allowlisted name matches a sensitive order/account pattern.
//
// Tool names verified against longportapp/longport-mcp src/tools/*.rs
// (145 tools across 13 categories, retrieved 2026-07-07).

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// The MCP server name we register under; claude exposes each tool as
// `mcp__${SERVER_NAME}__<tool>`. Fixed so the allowlist prefixes are stable.
export const LONGPORT_SERVER_NAME = "longport";

// READ-ONLY market-data tools we expose to the analyst. Scope (user decision
// 2026-07-07): "quotes + market data" — Quote (reads) + Market + Fundamental +
// Calendar + the `now` utility. Deliberately EXCLUDES the three watchlist-write
// tools that live in the quote category, plus account/portfolio reads, news
// screeners, and the server-side quant_run script executor.
export const LONGPORT_READ_TOOLS: readonly string[] = Object.freeze([
  // --- Quote (real-time & historical market data; reads only) ---
  "static_info",
  "quote",
  "option_quote",
  "warrant_quote",
  "depth",
  "brokers",
  "participants",
  "trades",
  "intraday",
  "candlesticks",
  "history_candlesticks_by_offset",
  "history_candlesticks_by_date",
  "trading_days",
  "option_chain_expiry_date_list",
  "option_chain_info_by_date",
  "capital_flow",
  "capital_distribution",
  "trading_session",
  "market_temperature",
  "history_market_temperature",
  "filings",
  "warrant_issuers",
  "warrant_list",
  "calc_indexes",
  "security_list",
  "short_positions",
  "option_volume",
  "option_volume_daily",
  // --- Market (status, ranks, holdings, anomalies; reads only) ---
  "market_status",
  "broker_holding",
  "broker_holding_detail",
  "broker_holding_daily",
  "ah_premium",
  "ah_premium_intraday",
  "trade_stats",
  "anomaly",
  "constituent",
  "industry_rank",
  "short_trades",
  "top_movers",
  "rank_categories",
  "rank_list",
  // --- Fundamental (financials, ratings, dividends, valuations; reads only) ---
  "financial_report",
  "financial_report_latest",
  "financial_report_snapshot",
  "financial_statement",
  "institution_rating",
  "institution_rating_detail",
  "institution_rating_history",
  "institution_rating_industry_rank",
  "dividend",
  "dividend_detail",
  "forecast_eps",
  "consensus",
  "valuation",
  "valuation_history",
  "valuation_rank",
  "valuation_comparison",
  "industry_valuation",
  "industry_valuation_dist",
  "company",
  "executive",
  "shareholder",
  "shareholder_top",
  "shareholder_detail",
  "fund_holder",
  "corp_action",
  "invest_relation",
  "operating",
  "business_segments",
  "business_segments_history",
  "institutional_views",
  "industry_peers",
  // --- Calendar & utility ---
  "finance_calendar",
  "now",
]);

// Write / trade / account tools — NEVER allowed. Passed as --disallowedTools
// (defense-in-depth) and used as the test oracle: the allowlist must be
// disjoint from this set. Any future write tool the MCP adds is excluded by
// the allowlist-only semantics regardless of whether it is listed here.
export const LONGPORT_BLOCKED_TOOLS: readonly string[] = Object.freeze([
  // Trade — real orders against a real account
  "submit_order",
  "cancel_order",
  "replace_order",
  "estimate_max_purchase_quantity",
  "account_balance",
  "stock_positions",
  "fund_positions",
  "margin_ratio",
  "short_margin",
  "today_orders",
  "order_detail",
  "today_executions",
  "history_orders",
  "history_executions",
  "cash_flow",
  // Watchlist writes (they live in the quote category — easy to miss)
  "create_watchlist_group",
  "delete_watchlist_group",
  "update_watchlist_group",
  "watchlist",
  // Alerts (CRUD), DCA (recurring-investment writes), sharelists, statements
  "alert_add",
  "alert_delete",
  "alert_disable",
  "alert_enable",
  "alert_list",
  "dca_create",
  "dca_update",
  "dca_pause",
  "dca_resume",
  "dca_stop",
  "dca_history",
  "dca_list",
  "dca_stats",
  "dca_check",
  "sharelist_add",
  "sharelist_create",
  "sharelist_delete",
  "sharelist_detail",
  "sharelist_list",
  "sharelist_popular",
  "sharelist_remove",
  "sharelist_sort",
  "statement_export",
  "statement_list",
  // ATM (bank cards, deposits, withdrawals) & portfolio account analytics
  "bank_cards",
  "deposits",
  "withdrawals",
  "exchange_rate",
  "profit_analysis",
  "profit_analysis_detail",
  // Reverse-auth + server-side script executor + user screeners
  "authenticate",
  "quant_run",
  "screener_search",
  "screener_indicators",
  "screener_recommend_strategies",
  "screener_strategy",
  "screener_user_strategies",
]);

// Fail-closed backstop: names that must NEVER appear in the read allowlist. The
// patterns catch order/account/funds/write verbs precisely enough to avoid
// false-positives on genuine market-data reads (e.g. `short_positions` = market
// short interest, `capital_flow`, `fund_holder` are all fine and unmatched).
const SENSITIVE_TOOL_PATTERN =
  /^(submit|cancel|replace|dca|alert|sharelist|statement)_|_orders?$|order_detail|execution|account_balance|stock_positions|fund_positions|^margin_ratio$|^short_margin$|deposit|withdraw|bank_cards|exchange_rate|profit_analysis|authenticate|quant_run|^watchlist$|watchlist_group|estimate_max_purchase|^cash_flow$/;

export function isSensitiveToolName(name: string): boolean {
  return SENSITIVE_TOOL_PATTERN.test(name);
}

// Throws if a sensitive tool ever slips into LONGPORT_READ_TOOLS (e.g. a future
// edit adds one without updating the blocklist). Called before every spawn so a
// misconfiguration fails the run instead of granting the tool.
export function assertReadOnlyAllowlist(): void {
  const offenders = LONGPORT_READ_TOOLS.filter((t) => SENSITIVE_TOOL_PATTERN.test(t));
  if (offenders.length > 0) {
    throw new Error(
      `LongPort allowlist safety violation: sensitive tool(s) in the read allowlist: ${offenders.join(", ")}`
    );
  }
}

function qualify(tool: string): string {
  return `mcp__${LONGPORT_SERVER_NAME}__${tool}`;
}

// Fully-qualified allow / deny tool identifiers as claude's --allowedTools /
// --disallowedTools see them.
export const LONGPORT_ALLOWED_TOOL_IDS: readonly string[] = Object.freeze(
  LONGPORT_READ_TOOLS.map(qualify)
);
export const LONGPORT_BLOCKED_TOOL_IDS: readonly string[] = Object.freeze(
  LONGPORT_BLOCKED_TOOLS.map(qualify)
);

export interface LongportResolution {
  enabled: boolean;
  reason: string;
}

// Opt-in via DELTA_LONGPORT_ENABLED=1 (default OFF so the app is unchanged for
// anyone who has not deployed credentials). Only the claude-cli engine can use
// MCP tools; deepseek/rules ignore this.
export function resolveLongport(): LongportResolution {
  if (process.env.DELTA_LONGPORT_ENABLED?.trim() !== "1") {
    return { enabled: false, reason: "DELTA_LONGPORT_ENABLED not set" };
  }
  return { enabled: true, reason: "DELTA_LONGPORT_ENABLED=1" };
}

export function longportMcpUrl(): string {
  return (process.env.DELTA_LONGPORT_MCP_URL?.trim() || "https://mcp.longportapp.com").replace(/\/+$/, "");
}

// The MCP config object claude --mcp-config consumes. When a bearer token is
// present (DELTA_LONGPORT_TOKEN — a LongPort OAuth access token) it is injected
// as an Authorization header so a HEADLESS server run authenticates without the
// interactive browser OAuth flow. Without a token, the config still points at
// the hosted endpoint and relies on a claude session that has already completed
// `claude mcp add` OAuth (documented).
export function buildLongportMcpConfig(): {
  config: { mcpServers: Record<string, { type: "http"; url: string; headers?: Record<string, string> }> };
  hasToken: boolean;
} {
  const token = process.env.DELTA_LONGPORT_TOKEN?.trim();
  const server: { type: "http"; url: string; headers?: Record<string, string> } = {
    type: "http",
    url: longportMcpUrl(),
  };
  if (token) server.headers = { Authorization: `Bearer ${token}` };
  return { config: { mcpServers: { [LONGPORT_SERVER_NAME]: server } }, hasToken: Boolean(token) };
}

export interface LongportCliArtifacts {
  configPath: string; // temp mcp-config file (0600); caller MUST call cleanup()
  allowedTools: readonly string[];
  disallowedTools: readonly string[];
  cleanup: () => void;
}

// Materialize the mcp-config to a private temp file (0600 — it may carry the
// bearer token) and return the args the provider needs. The caller MUST invoke
// cleanup() in a finally block so the token never lingers on disk.
export function prepareLongportCli(): LongportCliArtifacts {
  assertReadOnlyAllowlist(); // fail-closed: never spawn with a tainted allowlist
  const { config } = buildLongportMcpConfig();
  // mkdtemp creates the directory with 0700 (POSIX), so the 0600 config inside
  // is not readable by other users on the host.
  const dir = mkdtempSync(path.join(tmpdir(), "delta-longport-"));
  const configPath = path.join(dir, "mcp-config.json");
  writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  return {
    configPath,
    allowedTools: LONGPORT_ALLOWED_TOOL_IDS,
    disallowedTools: LONGPORT_BLOCKED_TOOL_IDS,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort; a leftover 0600 temp file is not worth failing a run
      }
    },
  };
}
