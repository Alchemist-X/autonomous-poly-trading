/**
 * Polymarket taker fee calculation utilities.
 *
 * Fee formula: fee_usdc = shares * price * feeRate * (price * (1 - price))^exponent
 *
 * Two fee resolution paths exist:
 *
 * 1. STATIC (default, sync) — `lookupCategoryFeeParams` reads a hardcoded
 *    schedule keyed by Polymarket category slug. Calibrated 2026-03-30.
 *    Used in the sync sizing path because it doesn't block on a network call.
 *
 * 2. DYNAMIC (V2-ready, async) — `fetchDynamicFeeParams` calls the V2 SDK's
 *    `getClobMarketInfo(conditionID)` and converts the returned FeeDetails
 *    {r, e, to} into FeeParams {feeRate, exponent}. Used post-cutover when
 *    the caller has a conditionId and can tolerate a small async lookup.
 *    Cached in-process with a 1-hour TTL so a batch of orders against the
 *    same market only pays one network round-trip.
 *
 * Both paths return the same FeeParams shape so downstream calculation
 * functions (calculateTakerFee, calculateNetEdge, etc.) work uniformly.
 *
 * Since V2 collects the real fee onchain at match time, the static estimate
 * is only used for pre-trade sizing — a few bps of inaccuracy translates to
 * cents of mis-sizing, never wrong direction. Hard risk caps are enforced
 * separately by the executor.
 */

export interface FeeParams {
  readonly feeRate: number;
  readonly exponent: number;
}

export interface NegRiskFeeOptions {
  negRisk?: boolean;
  feesEnabled?: boolean;
  feeSchedule?: FeeParams;
}

const CATEGORY_FEE_PARAMS: Readonly<Record<string, FeeParams>> = {
  geopolitics: { feeRate: 0, exponent: 0 },
  sports: { feeRate: 0.03, exponent: 1 },
  tech: { feeRate: 0.04, exponent: 1 },
  politics: { feeRate: 0.04, exponent: 1 },
  finance: { feeRate: 0.04, exponent: 1 },
  economics: { feeRate: 0.03, exponent: 0.5 },
  crypto: { feeRate: 0.072, exponent: 1 },
  culture: { feeRate: 0.05, exponent: 1 },
  weather: { feeRate: 0.025, exponent: 0.5 },
  other: { feeRate: 0.2, exponent: 2 },
  mentions: { feeRate: 0.25, exponent: 2 },
};

const DEFAULT_FEE_PARAMS: FeeParams = CATEGORY_FEE_PARAMS["other"]!;

/**
 * Partial-match rules that map common category slugs to a canonical key.
 * Evaluated in order; first match wins.
 */
const CATEGORY_ALIASES: ReadonlyArray<{ pattern: string; canonical: string }> = [
  { pattern: "politic", canonical: "politics" },
  { pattern: "trump", canonical: "politics" },
  { pattern: "election", canonical: "politics" },
  { pattern: "sport", canonical: "sports" },
  { pattern: "nba", canonical: "sports" },
  { pattern: "nfl", canonical: "sports" },
  { pattern: "mlb", canonical: "sports" },
  { pattern: "soccer", canonical: "sports" },
  { pattern: "football", canonical: "sports" },
  { pattern: "crypto", canonical: "crypto" },
  { pattern: "bitcoin", canonical: "crypto" },
  { pattern: "ethereum", canonical: "crypto" },
  { pattern: "defi", canonical: "crypto" },
  { pattern: "tech", canonical: "tech" },
  { pattern: "ai", canonical: "tech" },
  { pattern: "finance", canonical: "finance" },
  { pattern: "stock", canonical: "finance" },
  { pattern: "econ", canonical: "economics" },
  { pattern: "fed", canonical: "economics" },
  { pattern: "inflation", canonical: "economics" },
  { pattern: "gdp", canonical: "economics" },
  { pattern: "weather", canonical: "weather" },
  { pattern: "climate", canonical: "weather" },
  { pattern: "hurricane", canonical: "weather" },
  { pattern: "culture", canonical: "culture" },
  { pattern: "entertain", canonical: "culture" },
  { pattern: "movie", canonical: "culture" },
  { pattern: "music", canonical: "culture" },
  { pattern: "oscar", canonical: "culture" },
  { pattern: "mention", canonical: "mentions" },
  { pattern: "geopolitic", canonical: "geopolitics" },
  { pattern: "war", canonical: "geopolitics" },
  { pattern: "conflict", canonical: "geopolitics" },
];

/**
 * Resolve category fee parameters from a Polymarket category slug.
 *
 * Matching is case-insensitive.  If the slug does not exactly match a known
 * key, partial-match aliases are tried.  Falls back to "other" if nothing
 * matches.
 */
/**
 * Neg-risk (multi-outcome) markets often have 0% taker fees, but Gamma can
 * also return a real fee schedule for fee-enabled neg-risk markets.
 */
const NEG_RISK_FEE_PARAMS: FeeParams = { feeRate: 0, exponent: 0 };

export function lookupCategoryFeeParams(
  categorySlug: string | null | undefined,
  options?: NegRiskFeeOptions
): FeeParams {
  if (options?.negRisk) {
    if (options.feesEnabled && options.feeSchedule) {
      return options.feeSchedule;
    }
    return NEG_RISK_FEE_PARAMS;
  }

  if (!categorySlug) {
    return DEFAULT_FEE_PARAMS;
  }

  const lower = categorySlug.trim().toLowerCase();
  if (lower === "") {
    return DEFAULT_FEE_PARAMS;
  }

  const exact = CATEGORY_FEE_PARAMS[lower];
  if (exact) {
    return exact;
  }

  for (const alias of CATEGORY_ALIASES) {
    if (lower.includes(alias.pattern)) {
      return CATEGORY_FEE_PARAMS[alias.canonical]!;
    }
  }

  return DEFAULT_FEE_PARAMS;
}

/**
 * Calculate the taker fee for a single order.
 *
 * @param shares  Number of outcome shares being traded.
 * @param price   Price per share (0-1 probability range).
 * @param params  Fee schedule parameters for the market category.
 * @returns       Fee in USDC.
 */
export function calculateTakerFee(shares: number, price: number, params: FeeParams): number {
  if (params.feeRate === 0 || shares === 0) {
    return 0;
  }
  const variance = price * (1 - price);
  return shares * price * params.feeRate * Math.pow(variance, params.exponent);
}

/**
 * Calculate the fee percentage for a single entry at a given price.
 *
 * The percentage is relative to the notional (shares * price), so it
 * simplifies to: feeRate * (price * (1 - price))^exponent.
 */
export function calculateFeePct(price: number, params: FeeParams): number {
  if (params.feeRate === 0) {
    return 0;
  }
  const variance = price * (1 - price);
  return params.feeRate * Math.pow(variance, params.exponent);
}

/**
 * Calculate the round-trip (buy + sell) fee in USDC.
 */
export function calculateRoundTripFee(
  entryPrice: number,
  exitPrice: number,
  shares: number,
  params: FeeParams
): number {
  const entryFee = calculateTakerFee(shares, entryPrice, params);
  const exitFee = calculateTakerFee(shares, exitPrice, params);
  return entryFee + exitFee;
}

/**
 * Calculate the round-trip fee as a percentage of the entry notional.
 *
 * Useful for understanding total fee drag on a position that is entered
 * and exited at known prices.
 */
export function calculateRoundTripFeePct(
  entryPrice: number,
  exitPrice: number,
  params: FeeParams
): number {
  const entryFeePct = calculateFeePct(entryPrice, params);
  const exitFeePct = calculateFeePct(exitPrice, params);
  return entryFeePct + exitFeePct;
}

/**
 * Compute net edge after subtracting fee drag.
 *
 * For markets held to settlement the exit fee is zero (settlement is free).
 * For round-trip trades (buy then sell before settlement), both entry and
 * exit fees are deducted.
 *
 * @param grossEdge    Raw edge = aiProb - marketProb.
 * @param entryPrice   The buy price (marketProb for the chosen outcome).
 * @param params       Category fee parameters.
 * @param holdToSettlement  If true, only entry fee is deducted.  Default true.
 */
export function calculateNetEdge(
  grossEdge: number,
  entryPrice: number,
  params: FeeParams,
  holdToSettlement: boolean = true
): number {
  const entryFeePct = calculateFeePct(entryPrice, params);
  if (holdToSettlement) {
    return grossEdge - entryFeePct;
  }
  // Round-trip: also pay fee on exit.  Assume exit at current market price
  // (same as entry) as a conservative estimate.
  const exitFeePct = calculateFeePct(entryPrice, params);
  return grossEdge - entryFeePct - exitFeePct;
}

/**
 * Return the peak fee rate for a category -- the maximum fee that occurs
 * at price = 0.5 where variance p*(1-p) is maximized.
 *
 * Useful for display: "Category: Politics (1.0% peak fee)".
 */
export function peakFeePct(params: FeeParams): number {
  return calculateFeePct(0.5, params);
}

/**
 * Format a human-readable fee summary for terminal output.
 *
 * Example: "Edge: +15.0% (net +14.2% after 0.8% fee)"
 */
export function formatEdgeWithFee(grossEdge: number, netEdge: number, entryFeePct: number): string {
  const grossPct = (grossEdge * 100).toFixed(1);
  const netPct = (netEdge * 100).toFixed(1);
  const feePct = (entryFeePct * 100).toFixed(1);
  return `Edge: +${grossPct}% (net +${netPct}% after ${feePct}% fee)`;
}

/**
 * Format a human-readable category fee summary.
 *
 * Example: "Category: Politics (1.0% peak fee)"
 */
export function formatCategoryFee(categorySlug: string | null | undefined, params: FeeParams): string {
  const label = categorySlug?.trim() || "Unknown";
  const peak = (peakFeePct(params) * 100).toFixed(1);
  if (params.feeRate === 0) {
    return `Category: ${label} (0% fee)`;
  }
  return `Category: ${label} (${peak}% peak fee)`;
}

// ---------------------------------------------------------------------------
// Fee verification — compare estimated fee vs actual CLOB fee at execution
// ---------------------------------------------------------------------------

export interface FeeDiscrepancy {
  tokenId: string;
  marketSlug: string;
  categorySlug: string | null;
  estimatedFeeRate: number;
  actualBaseFee: number;
  mismatch: boolean;
  timestamp: string;
}

/**
 * Verify that our static fee estimate matches what the CLOB API reports.
 *
 * `actualBaseFee` comes from `GET /fee-rate?token_id=X` → `{ base_fee: N }`.
 * - base_fee = 0 means no fee (matches feeRate = 0)
 * - base_fee > 0 means fee is charged (matches feeRate > 0)
 *
 * A mismatch means either:
 * - We think it's free but CLOB says it's not (under-estimated → we lose money)
 * - We think it has a fee but CLOB says it's free (over-estimated → we miss opportunities)
 *
 * Discrepancies are returned for logging. The caller decides whether to
 * abort or just record.
 */
export function verifyFeeEstimate(input: {
  tokenId: string;
  marketSlug: string;
  categorySlug: string | null;
  actualBaseFee: number;
  negRisk?: boolean;
  feesEnabled?: boolean;
  feeSchedule?: FeeParams;
}): FeeDiscrepancy {
  const params = lookupCategoryFeeParams(input.categorySlug, {
    negRisk: input.negRisk,
    feesEnabled: input.feesEnabled,
    feeSchedule: input.feeSchedule
  });
  const estimatedHasFee = params.feeRate > 0;
  const actualHasFee = input.actualBaseFee > 0;

  return {
    tokenId: input.tokenId,
    marketSlug: input.marketSlug,
    categorySlug: input.categorySlug,
    estimatedFeeRate: params.feeRate,
    actualBaseFee: input.actualBaseFee,
    mismatch: estimatedHasFee !== actualHasFee,
    timestamp: new Date().toISOString()
  };
}

/**
 * Append a fee discrepancy to the log file for later review.
 * Only writes if there is a mismatch.
 */
export async function logFeeDiscrepancyIfNeeded(
  discrepancy: FeeDiscrepancy,
  logDir: string
): Promise<void> {
  if (!discrepancy.mismatch) {
    return;
  }
  const { existsSync, mkdirSync, appendFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  const logPath = join(logDir, "fee-discrepancies.jsonl");
  appendFileSync(logPath, JSON.stringify(discrepancy) + "\n");
}

// ---------------------------------------------------------------------------
// V2 dynamic fee resolution — fetch live FeeDetails from CLOB V2 SDK
// ---------------------------------------------------------------------------

interface DynamicFeeCacheEntry {
  params: FeeParams;
  expiresAt: number;
}

const dynamicFeeCache = new Map<string, DynamicFeeCacheEntry>();
const DYNAMIC_FEE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Convert V2 SDK FeeDetails {r?: number; e?: number; to: boolean} into the
 * FeeParams {feeRate, exponent} shape used everywhere else in this file.
 *
 * Missing rate/exponent default to 0 (no fee).
 */
export function feeDetailsToFeeParams(details: {
  r?: number;
  e?: number;
  to?: boolean;
} | null | undefined): FeeParams {
  if (!details) {
    return { feeRate: 0, exponent: 0 };
  }
  return {
    feeRate: typeof details.r === "number" ? details.r : 0,
    exponent: typeof details.e === "number" ? details.e : 0,
  };
}

/**
 * Fetch fee parameters for a market from the V2 SDK.
 *
 * Uses a 1-hour in-process cache so repeated lookups for the same market in
 * a single batch only hit the network once.
 *
 * Returns null on any failure (network, missing market, malformed response).
 * Callers should fall back to `lookupCategoryFeeParams` on null.
 *
 * @param client       A V2 ClobClient instance with `getClobMarketInfo` method.
 * @param conditionId  The market's conditionID (bytes32 hex string).
 */
export async function fetchDynamicFeeParams(
  client: { getClobMarketInfo: (conditionId: string) => Promise<{ fd?: { r?: number; e?: number; to?: boolean } }> },
  conditionId: string
): Promise<FeeParams | null> {
  if (!conditionId) {
    return null;
  }
  const now = Date.now();
  const cached = dynamicFeeCache.get(conditionId);
  if (cached && cached.expiresAt > now) {
    return cached.params;
  }
  try {
    const info = await client.getClobMarketInfo(conditionId);
    const params = feeDetailsToFeeParams(info?.fd);
    dynamicFeeCache.set(conditionId, {
      params,
      expiresAt: now + DYNAMIC_FEE_TTL_MS,
    });
    return params;
  } catch {
    return null;
  }
}

/**
 * Clear the dynamic fee cache. Mainly for tests; not normally needed.
 */
export function clearDynamicFeeCache(): void {
  dynamicFeeCache.clear();
}
