// Fee model — Polymarket's documented CLOB taker fee schedule
// (docs.polymarket.com/polymarket-learn/trading/fees, exchange-wide since
// 2026-07-01; help.polymarket.com article 13364478). Replaces the
// `bps × min(p, 1−p)` model that over-charged the Huginn fleet ledgers ~2.9×
// (measured 2026-08-23 → 2026-09-07: $6,476 charged vs $2,234 documented, and
// 32 maker fills charged fees that should have been 0).
//
//   fee_usd = C × feeRate × p × (1 − p)        C = shares, p = share price
//   docs' worked example: 100 shares @ $0.50 in Crypto (0.07) → $1.75
//
// Who pays: TAKERS only. Makers pay 0 and receive daily rebates (15–25% of
// taker fees by category); rebates are modelled as 0 for the paper book.
//
// Where the rate comes from:
// - The CLOB's per-market `taker_base_fee` (1000 bps on every fee-enabled
//   market, 0 on fee-free ones such as Geopolitics) is NOT the effective
//   rate. It is only the fee-free gate: 0 → no fee at all, >0 → fee-enabled.
// - The rate is looked up by market CATEGORY from Gamma market/event tag
//   slugs (CATEGORY_FEE_RATES via TAG_CATEGORY / TAG_ALIASES). No matching
//   tag → DEFAULT_FEE_RATE (the docs' "Other" bucket, 0.05). Both are
//   env-overridable (PAPER_FEE_RATES, PAPER_FEE_DEFAULT_RATE); the full
//   mapping is documented in docs/diagrams/paper-agent-fee-model.md.
// - A market the CLOB flags fee-enabled but whose tags map to a 0-rate
//   bucket is charged the DEFAULT rate, never 0: the exchange's own flag wins
//   over our tag mapping, and the paper book must not assume a free trade
//   the exchange says it charges for.
//
// Fee params are captured on the position at entry and refreshed best-effort
// at exit time, so a transient CLOB outage falls back to the stored values.

import { log } from "./log";

export type FeeCategory =
  | "politics"
  | "finance"
  | "tech"
  | "mentions"
  | "sports"
  | "economics"
  | "culture"
  | "weather"
  | "other"
  | "crypto"
  | "geopolitics";

export const FEE_CATEGORIES: readonly FeeCategory[] = [
  "politics",
  "finance",
  "tech",
  "mentions",
  "sports",
  "economics",
  "culture",
  "weather",
  "other",
  "crypto",
  "geopolitics"
];

// docs.polymarket.com/polymarket-learn/trading/fees — the 2026-07-01 schedule.
export const CATEGORY_FEE_RATES: Readonly<Record<FeeCategory, number>> = {
  politics: 0.04,
  finance: 0.04,
  tech: 0.04,
  mentions: 0.04,
  sports: 0.05,
  economics: 0.05,
  culture: 0.05,
  weather: 0.05,
  other: 0.05,
  crypto: 0.07,
  geopolitics: 0
};

// Applied when no tag maps to a category — the docs' "Other" bucket.
export const DEFAULT_FEE_RATE: number = CATEGORY_FEE_RATES.other;

// Gamma tag slug → fee category, exact matches. Covers Polymarket's top-level
// category tags, the scan categories in market-scan.ts, and the frequent
// sub-tags seen live (docs/diagrams/polymarket-category-tags.md). A market's
// tags are checked in the order Gamma lists them (primary tag first).
const TAG_CATEGORY: Readonly<Record<string, FeeCategory>> = {
  // politics
  politics: "politics",
  elections: "politics",
  "world-elections": "politics",
  "us-presidential-election": "politics",
  trump: "politics",
  "trump-presidency": "politics",
  // finance
  finance: "finance",
  stocks: "finance",
  ipos: "finance",
  // tech
  tech: "tech",
  ai: "tech",
  spacex: "tech",
  // mentions
  mentions: "mentions",
  "mention-markets": "mentions",
  // sports
  sports: "sports",
  soccer: "sports",
  football: "sports",
  nba: "sports",
  nfl: "sports",
  mlb: "sports",
  nhl: "sports",
  ncaa: "sports",
  tennis: "sports",
  wta: "sports",
  esports: "sports",
  formula1: "sports",
  chess: "sports",
  baseball: "sports",
  "league-of-legends": "sports",
  // economics
  economics: "economics",
  economy: "economics",
  "economic-policy": "economics",
  "fed-rates": "economics",
  fed: "economics",
  fomc: "economics",
  inflation: "economics",
  // culture
  culture: "culture",
  "pop-culture": "culture",
  music: "culture",
  awards: "culture",
  eurovision: "culture",
  movies: "culture",
  entertainment: "culture",
  // weather
  weather: "weather",
  temperature: "weather",
  climate: "weather",
  // crypto
  crypto: "crypto",
  bitcoin: "crypto",
  ethereum: "crypto",
  solana: "crypto",
  xrp: "crypto",
  "crypto-prices": "crypto",
  airdrops: "crypto",
  defi: "crypto",
  // geopolitics
  geopolitics: "geopolitics",
  "middle-east": "geopolitics",
  "foreign-policy": "geopolitics",
  ukraine: "geopolitics",
  "ukraine-peace-deal": "geopolitics",
  "strait-of-hormuz": "geopolitics"
};

// Substring aliases for the long tail of tags, tried only after no tag had an
// exact match. Patterns are deliberately specific ("ai" or "war" as a
// substring would hit "ukraine" / "warriors") — anything unmatched falls to
// the default bucket rather than a guessed one.
const TAG_ALIASES: ReadonlyArray<{ pattern: string; category: FeeCategory }> = [
  { pattern: "politic", category: "politics" },
  { pattern: "election", category: "politics" },
  { pattern: "trump", category: "politics" },
  { pattern: "sport", category: "sports" },
  { pattern: "esport", category: "sports" },
  { pattern: "soccer", category: "sports" },
  { pattern: "football", category: "sports" },
  { pattern: "league", category: "sports" },
  { pattern: "tennis", category: "sports" },
  { pattern: "crypto", category: "crypto" },
  { pattern: "bitcoin", category: "crypto" },
  { pattern: "ethereum", category: "crypto" },
  { pattern: "solana", category: "crypto" },
  { pattern: "defi", category: "crypto" },
  { pattern: "tech", category: "tech" },
  { pattern: "finance", category: "finance" },
  { pattern: "stock", category: "finance" },
  { pattern: "econ", category: "economics" },
  { pattern: "inflation", category: "economics" },
  { pattern: "weather", category: "weather" },
  { pattern: "climate", category: "weather" },
  { pattern: "hurricane", category: "weather" },
  { pattern: "culture", category: "culture" },
  { pattern: "entertain", category: "culture" },
  { pattern: "movie", category: "culture" },
  { pattern: "music", category: "culture" },
  { pattern: "oscar", category: "culture" },
  { pattern: "mention", category: "mentions" },
  { pattern: "geopolitic", category: "geopolitics" }
];

export interface FeeSchedule {
  rates: Readonly<Record<FeeCategory, number>>;
  defaultRate: number;
}

export const DEFAULT_FEE_SCHEDULE: FeeSchedule = { rates: CATEGORY_FEE_RATES, defaultRate: DEFAULT_FEE_RATE };

function parseRate(raw: string | undefined): number | null {
  const n = Number(raw?.trim());
  return raw !== undefined && raw.trim() !== "" && Number.isFinite(n) && n >= 0 && n < 1 ? n : null;
}

let processEnvSchedule: FeeSchedule | null = null;

// Operator overrides: PAPER_FEE_RATES="crypto=0.07,sports=0.05" replaces
// individual buckets; PAPER_FEE_DEFAULT_RATE replaces the no-match fallback.
// Malformed entries are ignored WITH a warning — a typo must never silently
// zero a fee. The process.env result is memoised (env does not change at
// runtime); tests pass their own env object.
export function loadFeeSchedule(env: NodeJS.ProcessEnv = process.env): FeeSchedule {
  if (env === process.env && processEnvSchedule) return processEnvSchedule;
  const rates: Record<FeeCategory, number> = { ...CATEGORY_FEE_RATES };
  for (const entry of (env.PAPER_FEE_RATES ?? "").split(",")) {
    if (!entry.trim()) continue;
    const [key, value] = entry.split("=");
    const category = key?.trim().toLowerCase() as FeeCategory | undefined;
    const rate = parseRate(value);
    if (!category || !FEE_CATEGORIES.includes(category) || rate === null) {
      log.warn(
        `PAPER_FEE_RATES entry "${entry.trim()}" ignored (expected <category>=<rate in [0,1)>, categories: ${FEE_CATEGORIES.join(", ")})`
      );
      continue;
    }
    rates[category] = rate;
  }
  let defaultRate = DEFAULT_FEE_RATE;
  if (env.PAPER_FEE_DEFAULT_RATE !== undefined && env.PAPER_FEE_DEFAULT_RATE.trim() !== "") {
    const rate = parseRate(env.PAPER_FEE_DEFAULT_RATE);
    if (rate === null)
      log.warn(
        `PAPER_FEE_DEFAULT_RATE="${env.PAPER_FEE_DEFAULT_RATE}" ignored (expected a rate in [0,1)); using ${DEFAULT_FEE_RATE}`
      );
    else defaultRate = rate;
  }
  const schedule: FeeSchedule = { rates, defaultRate };
  if (env === process.env) processEnvSchedule = schedule;
  return schedule;
}

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

export interface FeeCategoryMatch {
  category: FeeCategory | null; // null = no tag matched → schedule.defaultRate
  rate: number;
  matchedTag: string | null;
}

// Resolve the fee bucket from a market's Gamma tag slugs (or labels /
// `category` values — normalised to slug form). Exact matches over ALL tags
// win before any substring alias is tried, so ["trump-machado", "politics"]
// resolves through "politics", not the alias.
export function resolveFeeCategory(
  tags: readonly string[],
  schedule: FeeSchedule = DEFAULT_FEE_SCHEDULE
): FeeCategoryMatch {
  const normalized = tags.map((t) => [t, normalizeTag(t)] as const).filter(([, n]) => n.length > 0);
  for (const [raw, tag] of normalized) {
    const exact = TAG_CATEGORY[tag];
    if (exact) return { category: exact, rate: schedule.rates[exact], matchedTag: raw };
  }
  for (const [raw, tag] of normalized) {
    for (const alias of TAG_ALIASES) {
      if (tag.includes(alias.pattern))
        return { category: alias.category, rate: schedule.rates[alias.category], matchedTag: raw };
    }
  }
  return { category: null, rate: schedule.defaultRate, matchedTag: null };
}

export type FeeRateSource =
  | "clob_fee_free" // CLOB taker_base_fee = 0 → no fee regardless of category
  | "category" // rate from the category table (or its env override)
  | "default"; // fee-enabled but no tag matched, or the tag mapped to a 0 bucket

export interface MarketFeeParams {
  // Raw CLOB signals (taker_base_fee / maker_base_fee, bps). takerBps is the
  // fee-free gate only — never a rate. makerBps is informational: makers pay 0.
  takerBps: number;
  makerBps: number;
  tickSize: number;
  // Effective taker rate (fraction of C × p × (1 − p)); 0 on fee-free markets.
  feeRate: number;
  // Resolved bucket (null = no tag matched) + where feeRate came from.
  category: FeeCategory | null;
  rateSource: FeeRateSource;
}

// Fallback when the CLOB is unreachable at entry: assumes fee-free. Callers
// must log that they fell back — never present it as live truth.
export const DEFAULT_FEES: MarketFeeParams = {
  takerBps: 0,
  makerBps: 0,
  tickSize: 0.01,
  feeRate: 0,
  category: null,
  rateSource: "clob_fee_free"
};

// fee = C × rate × p × (1 − p). Zero outside (0, 1): p(1 − p) is 0 at the
// bounds and there is nothing to charge on a non-positive size or rate.
export function feeUsd(shares: number, price: number, feeRate: number): number {
  if (!(shares > 0) || !(price > 0) || !(price < 1) || !(feeRate > 0)) return 0;
  return shares * feeRate * price * (1 - price);
}

export function takerFeeUsd(shares: number, price: number, fees: MarketFeeParams): number {
  return feeUsd(shares, price, fees.feeRate);
}

// Makers never pay (their rebates are ignored). The signature mirrors
// takerFeeUsd so fill code reads symmetrically at the call site.
export function makerFeeUsd(_shares: number, _price: number, _fees: MarketFeeParams): number {
  return 0;
}

export interface ClobFeeFields {
  takerBps: number;
  makerBps: number;
  tickSize: number;
}

// Combine the CLOB gate with the category rate. Pure — unit-tested without
// the network; fetchMarketFees is the thin fetcher around it.
export function buildFeeParams(
  clob: ClobFeeFields,
  tags: readonly string[],
  schedule: FeeSchedule = DEFAULT_FEE_SCHEDULE
): MarketFeeParams {
  const match = resolveFeeCategory(tags, schedule);
  if (!(clob.takerBps > 0)) return { ...clob, feeRate: 0, category: match.category, rateSource: "clob_fee_free" };
  if (match.category !== null && match.rate > 0)
    return { ...clob, feeRate: match.rate, category: match.category, rateSource: "category" };
  return { ...clob, feeRate: schedule.defaultRate, category: match.category, rateSource: "default" };
}

function finiteOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Back-compat for portfolio.json rows: positions opened before fee params
// lived on positions (undefined) and rows from the pre-2026-09 bps model
// (takerBps/makerBps/tickSize but no feeRate). A legacy fee-enabled row gets
// the default rate until the next evaluation cycle's refreshFees resolves its
// tags; a legacy fee-free row stays free.
export function normalizeFeeParams(
  raw: Partial<MarketFeeParams> | null | undefined,
  schedule: FeeSchedule = DEFAULT_FEE_SCHEDULE
): MarketFeeParams {
  if (!raw) return DEFAULT_FEES;
  const clob: ClobFeeFields = {
    takerBps: finiteOr(raw.takerBps, 0),
    makerBps: finiteOr(raw.makerBps, 0),
    tickSize: finiteOr(raw.tickSize, 0) > 0 ? Number(raw.tickSize) : 0.01
  };
  if (typeof raw.feeRate === "number" && Number.isFinite(raw.feeRate) && raw.rateSource) {
    return { ...clob, feeRate: raw.feeRate, category: raw.category ?? null, rateSource: raw.rateSource };
  }
  return buildFeeParams(clob, raw.category ? [raw.category] : [], schedule);
}

// Human-readable provenance for logs / CLI output, e.g.
//   "crypto 7.00% (category)" · "fee-free (CLOB taker_base_fee=0)" ·
//   "no tag matched → default 5.00%".
export function describeFees(fees: MarketFeeParams): string {
  if (fees.rateSource === "clob_fee_free")
    return `fee-free (CLOB taker_base_fee=0${fees.category ? `, ${fees.category}` : ""})`;
  const pct = `${(fees.feeRate * 100).toFixed(2)}%`;
  if (fees.rateSource === "category") return `${fees.category} ${pct} (category)`;
  return fees.category
    ? `${fees.category} maps to 0 but CLOB is fee-enabled → default ${pct}`
    : `no tag matched → default ${pct}`;
}

// Live per-market fee metadata from the CLOB (`/markets/<conditionId>` →
// taker_base_fee / maker_base_fee in bps, minimum_tick_size), combined with
// the category resolved from `tags` (see polymarket.marketFeeTags). Returns
// null on any failure so the caller can decide how to fall back.
export async function fetchMarketFees(
  conditionId: string,
  tags: readonly string[] = [],
  schedule: FeeSchedule = loadFeeSchedule()
): Promise<MarketFeeParams | null> {
  if (!conditionId) return null;
  try {
    const res = await fetch(`https://clob.polymarket.com/markets/${encodeURIComponent(conditionId)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000)
    });
    if (!res.ok) return null;
    const m = (await res.json()) as { taker_base_fee?: number; maker_base_fee?: number; minimum_tick_size?: number };
    return buildFeeParams(
      {
        takerBps: Number.isFinite(m.taker_base_fee) ? Number(m.taker_base_fee) : 0,
        makerBps: Number.isFinite(m.maker_base_fee) ? Number(m.maker_base_fee) : 0,
        tickSize:
          Number.isFinite(m.minimum_tick_size) && Number(m.minimum_tick_size) > 0 ? Number(m.minimum_tick_size) : 0.01
      },
      tags,
      schedule
    );
  } catch {
    return null;
  }
}
