// All knobs are env-tunable with the DELTAPM_ prefix. The two USER-DECIDED
// risk anchors (2026-08-22): per-position hard stop at −20% adverse move, and
// a portfolio halt at −25% total loss from initial capital. Those defaults
// must never be changed by an agent without explicit user sign-off (repo
// policy: the executor layer clips, prompts never override).

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === "" ? fallback : raw.trim();
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  return !["0", "false", "off", "no"].includes(raw);
}

export const config = {
  // --- identity / infra
  serviceName: "delta-pm",
  version: "0.1.0",
  statusPort: num("DELTAPM_STATUS_PORT", 8792),
  ingestToken: str("DELTAPM_INGEST_TOKEN", ""), // empty = /ingest disabled

  // --- news feed (The Information)
  feedUrl: str("DELTAPM_FEED_URL", "https://www.theinformation.com/feed"),
  sitemapNewsUrl: str("DELTAPM_SITEMAP_URL", "https://www.theinformation.com/sitemap-news.xml"),
  feedPollSeconds: num("DELTAPM_FEED_POLL_SECONDS", 60),

  // --- market data (Hyperliquid public info API; SOLE source per user decision)
  hlInfoUrl: str("DELTAPM_HL_INFO_URL", "https://api.hyperliquid.xyz/info"),
  hlDex: str("DELTAPM_HL_DEX", "xyz"),
  ctxPollSeconds: num("DELTAPM_CTX_POLL_SECONDS", 60), // metaAndAssetCtxs sweep (weight 20)
  candleSweepMinutes: num("DELTAPM_CANDLE_SWEEP_MINUTES", 5), // 1m-candle archive sweep

  // --- analysis
  provider: str("DELTAPM_PROVIDER", "auto"), // auto|deepseek|claude|rules
  deepseekApiKey: str("DEEPSEEK_API_KEY", ""),
  deepseekBaseUrl: str("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
  deepseekModel: str("DEEPSEEK_MODEL", "deepseek-chat"),
  claudeCliPath: str("DELTAPM_CLAUDE_CLI", "claude"),
  analysisConcurrency: num("DELTAPM_ANALYSIS_CONCURRENCY", 3),
  analysisTimeoutMs: num("DELTAPM_ANALYSIS_TIMEOUT_MS", 600_000),
  // Gate-time prior-coverage web search (~15s, universe-matched items only).
  // Uses the forecast-engine backend keys (EXA_API_KEY / TAVILY_API_KEY);
  // without a key it degrades to a recorded skip, never a silent pass.
  coverageCheckEnabled: bool("DELTAPM_COVERAGE_CHECK", true),

  // --- paper book
  initialCapitalUsd: num("DELTAPM_INITIAL_CAPITAL_USD", 10_000),

  // --- risk (USER-DECIDED anchors first)
  hardStopAdversePct: num("DELTAPM_HARD_STOP_ADVERSE_PCT", 0.2), // user 2026-08-22
  portfolioHaltLossPct: num("DELTAPM_PORTFOLIO_HALT_LOSS_PCT", 0.25), // user 2026-08-22
  riskBudgetPct: num("DELTAPM_RISK_BUDGET_PCT", 0.01),
  riskBudgetHighConfPct: num("DELTAPM_RISK_BUDGET_HIGH_CONF_PCT", 0.015),
  tierCapPct: {
    1: num("DELTAPM_TIER1_CAP_PCT", 0.3),
    2: num("DELTAPM_TIER2_CAP_PCT", 0.15),
    3: num("DELTAPM_TIER3_CAP_PCT", 0.05)
  } as Record<1 | 2 | 3, number>,
  grossCapPct: num("DELTAPM_GROSS_CAP_PCT", 1.5),
  netCapPct: num("DELTAPM_NET_CAP_PCT", 1.0),
  clusterCapPct: num("DELTAPM_CLUSTER_CAP_PCT", 0.4),
  isolatedMarginCapPct: num("DELTAPM_ISOLATED_MARGIN_CAP_PCT", 0.5),
  // USER-DECIDED 2026-08-23: plain long/short, NO leverage. Raising this
  // needs explicit user sign-off.
  maxLeverage: num("DELTAPM_MAX_LEVERAGE", 1),
  dailyLossStopPct: num("DELTAPM_DAILY_LOSS_STOP_PCT", 0.03),
  cooldownHours: num("DELTAPM_COOLDOWN_HOURS", 72),
  minTradeUsd: num("DELTAPM_MIN_TRADE_USD", 50),
  entryCostMultiple: num("DELTAPM_ENTRY_COST_MULTIPLE", 3),
  entryVolFraction: num("DELTAPM_ENTRY_VOL_FRACTION", 0.5),
  adverseDriftVolFraction: num("DELTAPM_ADVERSE_DRIFT_VOL_FRACTION", 0.3),
  takerFeeRate: num("DELTAPM_TAKER_FEE_RATE", 0.00009), // growth-mode base tier, re-read live later
  slippageBudgetPctByTier: {
    1: num("DELTAPM_SLIPPAGE_T1_PCT", 0.0005),
    2: num("DELTAPM_SLIPPAGE_T2_PCT", 0.0015),
    3: num("DELTAPM_SLIPPAGE_T3_PCT", 0.003)
  } as Record<1 | 2 | 3, number>,

  // --- scheduling
  fastTickMinutes: num("DELTAPM_FAST_TICK_MINUTES", 10),
  dailyReviewUtc: str("DELTAPM_DAILY_REVIEW_UTC", "13:00"), // pre-RTH daily position review

  // --- push notifications (Feishu custom-bot webhook; empty = disabled)
  feishuWebhook: str("DELTAPM_FEISHU_WEBHOOK", ""),
  auditPageUrl: str("DELTAPM_AUDIT_PAGE_URL", "https://forecasting-agent.com/live-delta-pm"),

  // --- switches
  feedEnabled: bool("DELTAPM_FEED_ENABLED", true),
  marketEnabled: bool("DELTAPM_MARKET_ENABLED", true)
};

export type Config = typeof config;
