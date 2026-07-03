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
  // LLM evaluation runs per cycle are capped to bound cost.
  maxEvalsPerCycle: number;
  // Engine rounds per evaluation (state resumes, so belief accumulates).
  evalMaxRounds: number;
  // Maker fills are assumed fee-free (Polymarket charges takers); override to
  // model a maker fee as a fraction of the taker fee.
  makerFeeFactor: number;
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
    stopLossPct: num("PAPER_STOP_LOSS_PCT", 0.35, 0.01),
    hybridMarketRatio: Math.min(1, num("PAPER_HYBRID_MARKET_RATIO", 0.5)),
    limitTtlHours: num("PAPER_LIMIT_TTL_HOURS", 8, 0.1),
    watchlistPath: env.PAPER_WATCHLIST?.trim() || null,
    entryEdgePp: num("PAPER_ENTRY_EDGE_PP", 8, 0.5),
    entryNotionalUsd: num("PAPER_ENTRY_NOTIONAL_USD", 50, 1),
    maxPositions: num("PAPER_MAX_POSITIONS", 10, 1),
    maxEvalsPerCycle: num("PAPER_MAX_EVALS_PER_CYCLE", 12, 1),
    evalMaxRounds: num("PAPER_EVAL_MAX_ROUNDS", 1, 1),
    makerFeeFactor: num("PAPER_MAKER_FEE_FACTOR", 0)
  };
}
