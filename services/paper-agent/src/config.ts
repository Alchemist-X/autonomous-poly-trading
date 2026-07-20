// Paper-agent configuration. Everything is env-tunable; defaults are the
// first-phase test-book settings agreed 2026-07-03. This service NEVER places
// real orders — it only reads public market data and simulates fills.

export interface PaperConfig {
  bankrollUsd: number;
  // UTC "HH:MM" times for the three daily evaluation cycles.
  evalTimesUtc: string[];
  // Minutes between resting-limit-order fill checks (and resolution checks).
  fillCheckMinutes: number;
  // Exit when net edge of holding (fair − executable, after fees) drops below
  // this many percentage points. 0 = the standing "negative net edge → sell".
  exitEdgePp: number;
  // When an evaluation is saturated at the held side's probability bound
  // (engine ceiling 0.99), the derived negative edge is a clamp artifact, not
  // information — hold to resolution instead of selling (user 2026-07-20).
  // Stop-loss and full-value capture (bid net of fees ≥ 0.999) still exit.
  saturatedHoldEnabled: boolean;
  // Hard stop: exit regardless of model view when mark loses this fraction of
  // entry price. Standing rule: stop-loss outranks everything.
  stopLossPct: number;
  // Fraction of an exit sent as an immediate (taker) market order; the rest
  // rests as a maker limit order. 0.5 = the agreed 50/50 hybrid.
  hybridMarketRatio: number;
  // Hours a resting limit exit may wait before being converted to market.
  limitTtlHours: number;
  // Optional watchlist file (one Polymarket market slug per line) for
  // autonomous entries; empty/missing file = evaluation-only book.
  watchlistPath: string | null;
  entryEdgePp: number;
  entryNotionalUsd: number;
  maxPositions: number;
  // Cap open positions sharing one Gamma event (e.g. the same macro question
  // at different expiries) — prevents stacking one underlying bet.
  maxPerEvent: number;
  // LLM evaluation runs per cycle are capped to bound cost.
  maxEvalsPerCycle: number;
  // Engine rounds per evaluation (state resumes, so belief accumulates).
  evalMaxRounds: number;
  // Which engine provider evaluates positions. "claude" = Claude Code CLI
  // with native WebSearch (subscription quota); "deepseek" = OpenAI-compatible
  // endpoint (DeepSeek/Kimi) with the function-calling research loop.
  evalProvider: "claude" | "deepseek";
  // Market universe: when set, each cycle auto-scans these Gamma tag
  // categories for entry candidates (merged with the watchlist file).
  categories: string[];
  scanMinLiquidityUsd: number;
  scanMinVolume24hUsd: number;
  scanPerCategory: number;
}

function num(name: string, fallback: number, min = 0): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

export function loadPaperConfig(env: NodeJS.ProcessEnv = process.env): PaperConfig {
  const times = (env.PAPER_EVAL_TIMES_UTC ?? "00:10,08:10,16:10")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^\d{2}:\d{2}$/.test(t));
  return {
    bankrollUsd: num("PAPER_BANKROLL_USD", 1000, 1),
    evalTimesUtc: times.length ? times : ["00:10", "08:10", "16:10"],
    fillCheckMinutes: num("PAPER_FILL_CHECK_MINUTES", 10, 1),
    exitEdgePp: num("PAPER_EXIT_EDGE_PP", 0),
    saturatedHoldEnabled: !["0", "false", "off", "no"].includes(
      (env.PAPER_SATURATED_HOLD ?? "").trim().toLowerCase()
    ),
    stopLossPct: num("PAPER_STOP_LOSS_PCT", 0.35, 0.01),
    hybridMarketRatio: Math.min(1, num("PAPER_HYBRID_MARKET_RATIO", 0.5)),
    limitTtlHours: num("PAPER_LIMIT_TTL_HOURS", 8, 0.1),
    watchlistPath: env.PAPER_WATCHLIST?.trim() || null,
    entryEdgePp: num("PAPER_ENTRY_EDGE_PP", 8, 0.5),
    entryNotionalUsd: num("PAPER_ENTRY_NOTIONAL_USD", 50, 1),
    maxPositions: num("PAPER_MAX_POSITIONS", 10, 1),
    maxPerEvent: num("PAPER_MAX_PER_EVENT", 1, 1),
    maxEvalsPerCycle: num("PAPER_MAX_EVALS_PER_CYCLE", 12, 1),
    evalMaxRounds: num("PAPER_EVAL_MAX_ROUNDS", 1, 1),
    evalProvider: env.PAPER_EVAL_PROVIDER?.trim() === "deepseek" ? "deepseek" : "claude",
    categories: (env.PAPER_CATEGORIES ?? "")
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean),
    scanMinLiquidityUsd: num("PAPER_SCAN_MIN_LIQUIDITY_USD", 5000, 0),
    scanMinVolume24hUsd: num("PAPER_SCAN_MIN_VOLUME24H_USD", 10000, 0),
    scanPerCategory: num("PAPER_SCAN_PER_CATEGORY", 8, 1)
  };
}
