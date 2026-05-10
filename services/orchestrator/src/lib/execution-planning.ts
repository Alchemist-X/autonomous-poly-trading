import type {
  OverviewResponse,
  PublicPosition,
  TradeDecision
} from "@autopoly/contracts";
import { inferPaperSellAmount } from "@autopoly/contracts";
import type { OrchestratorConfig } from "../config.js";
import { applyTradeGuardsDetailed, type TradeGuardResult } from "./risk.js";

export interface PlanningOrderBookLevel {
  price: number;
  size: number;
}

export interface PlanningOrderBookSnapshot {
  bestAsk: number | null;
  bestBid: number | null;
  minOrderSize: number | null;
  /** Ask-side depth sorted ascending, for BUY-side slippage sizing. */
  asks?: PlanningOrderBookLevel[];
  /** Bid-side depth sorted descending, for SELL-side slippage sizing. */
  bids?: PlanningOrderBookLevel[];
}

// ---------------------------------------------------------------------------
// Slippage-based order sizing
// ---------------------------------------------------------------------------

const DEFAULT_MAX_SLIPPAGE_PCT = 0.04;
const DEFAULT_BOOK_PREFETCH_CONCURRENCY = 4;

/**
 * Compute the maximum BUY notional (USD) that can fill on the current ask
 * book without exceeding a given price impact relative to best ask.
 *
 * Walks ask levels ascending by price, accumulating notional `price * size`
 * for each level whose price does not exceed `bestAsk * (1 + slippagePct)`.
 *
 * Returns 0 when the book is missing or the first level already exceeds the
 * allowed impact (shouldn't happen by definition, but defensive).
 */
export function computeMaxBuyNotionalWithinSlippage(
  asks: PlanningOrderBookLevel[] | null | undefined,
  slippagePct: number = DEFAULT_MAX_SLIPPAGE_PCT
): { maxNotionalUsd: number; worstPrice: number; levelsConsumed: number } {
  if (!asks || asks.length === 0) {
    return { maxNotionalUsd: 0, worstPrice: 0, levelsConsumed: 0 };
  }
  const bestAsk = asks[0]!.price;
  if (!(bestAsk > 0)) {
    return { maxNotionalUsd: 0, worstPrice: 0, levelsConsumed: 0 };
  }
  const priceCeiling = bestAsk * (1 + slippagePct);

  let maxNotional = 0;
  let worstPrice = bestAsk;
  let levelsConsumed = 0;

  for (const level of asks) {
    if (level.price > priceCeiling + 1e-9) {
      break;
    }
    maxNotional += level.price * level.size;
    worstPrice = level.price;
    levelsConsumed += 1;
  }

  return {
    maxNotionalUsd: Number(maxNotional.toFixed(4)),
    worstPrice,
    levelsConsumed
  };
}

export interface PlannedExecution {
  action: TradeDecision["action"];
  marketSlug: string;
  eventSlug: string;
  tokenId: string;
  outcomeLabel?: string | null;
  side: TradeDecision["side"];
  notionalUsd: number;
  bankrollRatio: number;
  executionAmount: number;
  unit: "usd" | "shares";
  thesisMd: string;
  bestAsk: number | null;
  bestBid: number | null;
  minOrderSize: number | null;
  exchangeMinNotionalUsd: number | null;
  orderType: "FOK" | "GTC";
  gtcLimitPrice: number | null;
  categorySlug: string | null;
  negRisk: boolean;
}

// ---------------------------------------------------------------------------
// GTC order type decision
// ---------------------------------------------------------------------------

const MAX_SPREAD_FOR_GTC = 0.05;

/**
 * Decide whether to use GTC (limit) or FOK (market) order.
 *
 * GTC is used when:
 * - The action is "open" (new position, no urgency)
 * - The market is fee-bearing
 * - The spread is reasonable (< 5%)
 *
 * FOK is used for everything else: close, reduce, stop-loss, fee-free
 * markets, or wide spreads.
 */
export function chooseOrderType(input: {
  action: TradeDecision["action"];
  side: TradeDecision["side"];
  bestBid: number | null;
  bestAsk: number | null;
  negRisk?: boolean;
  feesEnabled?: boolean;
  feeRate?: number;
}): { orderType: "FOK" | "GTC"; gtcLimitPrice: number | null } {
  // GTC disabled by default — set ENABLE_GTC_ORDERS=true to activate
  if (process.env.ENABLE_GTC_ORDERS !== "true") {
    return { orderType: "FOK", gtcLimitPrice: null };
  }

  // Always FOK for time-critical actions
  if (input.action === "close" || input.action === "reduce") {
    return { orderType: "FOK", gtcLimitPrice: null };
  }

  // Only consider GTC for opens (BUY side)
  if (input.action !== "open" || input.side !== "BUY") {
    return { orderType: "FOK", gtcLimitPrice: null };
  }

  // Fee-free markets: no savings from GTC
  const negRiskWithoutFees = input.negRisk && input.feesEnabled !== true;
  if (negRiskWithoutFees || (input.feeRate != null && input.feeRate === 0)) {
    return { orderType: "FOK", gtcLimitPrice: null };
  }

  const bid = input.bestBid;
  const ask = input.bestAsk;
  if (bid == null || ask == null || bid <= 0 || ask <= 0) {
    return { orderType: "FOK", gtcLimitPrice: null };
  }

  const spread = (ask - bid) / ask;
  if (spread > MAX_SPREAD_FOR_GTC) {
    return { orderType: "FOK", gtcLimitPrice: null };
  }

  // Calculate limit price based on spread width
  let limitPrice: number;
  if (spread <= 0.01) {
    // Tight spread: bid + 1 tick (aggressive, likely to fill quickly)
    limitPrice = bid + 0.001;
  } else if (spread <= 0.03) {
    // Normal spread: mid-price
    limitPrice = (bid + ask) / 2;
  } else {
    // Wide spread: bid + 30% of spread (conservative)
    limitPrice = bid + (ask - bid) * 0.3;
  }

  // Round to 3 decimal places (Polymarket tick size)
  limitPrice = Math.round(limitPrice * 1000) / 1000;

  return { orderType: "GTC", gtcLimitPrice: limitPrice };
}

export interface SkippedDecision {
  action: TradeDecision["action"] | null;
  marketSlug: string;
  tokenId: string | null;
  reason: string;
}

interface PulseCandidateForPlanning {
  eventSlug?: string | null;
  marketSlug?: string | null;
  question?: string | null;
  outcomes?: string[];
  outcomePrices?: number[];
  clobTokenIds: string[];
  categorySlug?: string | null;
  negRisk?: boolean;
  feesEnabled?: boolean;
}

interface CandidateTokenMeta {
  eventSlug: string | null;
  marketSlug: string | null;
  question: string | null;
  outcomeLabel: string | null;
  outcomePrice: number | null;
  categorySlug: string | null;
  negRisk: boolean;
  feesEnabled?: boolean;
}

function roundNotional(value: number): number {
  return Number(value.toFixed(4));
}

function roundExchangeCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatProb(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "-" : value.toFixed(4);
}

function relativeDiff(a: number, b: number) {
  return Math.abs(a - b) / Math.max(Math.abs(b), 0.01);
}

function validateOpenDecisionBinding(input: {
  decision: TradeDecision;
  candidate: CandidateTokenMeta | null;
  book?: PlanningOrderBookSnapshot | null;
}) {
  const { decision, candidate, book } = input;
  const errors: string[] = [];
  const warnings: string[] = [];
  const priceTolerancePct = 0.03;

  if (!candidate) {
    errors.push("token_id was not found in the current pulse candidate set");
    return { ok: false, reason: `blocked_by_market_binding:${errors.join("; ")}` };
  }

  if (candidate.marketSlug && candidate.marketSlug !== decision.market_slug) {
    errors.push(`marketSlug mismatch: decision=${decision.market_slug} candidate=${candidate.marketSlug}`);
  }
  if (candidate.eventSlug && candidate.eventSlug !== decision.event_slug) {
    errors.push(`eventSlug mismatch: decision=${decision.event_slug} candidate=${candidate.eventSlug}`);
  }

  const decisionOutcomeLabel = (decision as TradeDecision & { outcome_label?: string }).outcome_label ?? null;
  if (decisionOutcomeLabel && candidate.outcomeLabel && decisionOutcomeLabel.toLowerCase() !== candidate.outcomeLabel.toLowerCase()) {
    errors.push(`outcomeLabel mismatch: decision=${decisionOutcomeLabel} candidate=${candidate.outcomeLabel}`);
  }

  if (candidate.outcomePrice != null && Number.isFinite(candidate.outcomePrice)) {
    const diff = relativeDiff(decision.market_prob, candidate.outcomePrice);
    if (diff > priceTolerancePct) {
      errors.push(
        `decision market_prob ${formatProb(decision.market_prob)} differs from candidate outcome price ${formatProb(candidate.outcomePrice)} by ${(diff * 100).toFixed(2)}%`
      );
    }
  }

  const bookReference = decision.side === "BUY" ? book?.bestAsk : book?.bestBid;
  if (bookReference != null && Number.isFinite(bookReference) && bookReference > 0) {
    const diff = relativeDiff(bookReference, decision.market_prob);
    if (diff > priceTolerancePct) {
      errors.push(
        `${decision.side === "BUY" ? "bestAsk" : "bestBid"} ${formatProb(bookReference)} differs from decision market_prob ${formatProb(decision.market_prob)} by ${(diff * 100).toFixed(2)}%`
      );
    }
  } else if (book) {
    warnings.push("orderbook reference price unavailable for binding price tolerance check");
  }

  if (errors.length > 0) {
    return { ok: false, reason: `blocked_by_market_binding:${errors.join("; ")}` };
  }
  return {
    ok: true,
    reason: warnings.length > 0 ? warnings.join("; ") : null
  };
}

export function computeExchangeBuyMinNotionalUsd(input: {
  bestAsk: number | null;
  minOrderSize: number | null;
}) {
  if (!(input.bestAsk != null && input.bestAsk > 0) || !(input.minOrderSize != null && input.minOrderSize > 0)) {
    return null;
  }
  return roundExchangeCurrency(input.bestAsk * input.minOrderSize);
}

export function isBelowExchangeBuyMinimum(input: {
  notionalUsd: number;
  bestAsk: number | null;
  minOrderSize: number | null;
}) {
  const minNotionalUsd = computeExchangeBuyMinNotionalUsd({
    bestAsk: input.bestAsk,
    minOrderSize: input.minOrderSize
  });
  if (!(minNotionalUsd != null && minNotionalUsd > 0)) {
    return false;
  }
  return input.notionalUsd < minNotionalUsd;
}

export function isBelowExchangeSellMinimum(input: {
  size: number;
  minOrderSize: number | null;
}) {
  if (!(input.minOrderSize != null && input.minOrderSize > 0)) {
    return false;
  }
  return input.size < input.minOrderSize;
}

export function buildOpenExecutionFloorLabel(input: {
  configuredMinTradeUsd: number;
  exchangeMinNotionalUsd: number | null;
}) {
  const labels: string[] = [];
  if (input.configuredMinTradeUsd > 0) {
    labels.push(`internal minimum ${formatUsd(input.configuredMinTradeUsd)}`);
  }
  if (input.exchangeMinNotionalUsd != null && input.exchangeMinNotionalUsd > 0) {
    labels.push(`Polymarket minimum ${formatUsd(input.exchangeMinNotionalUsd)}`);
  }
  return labels.join(" + ");
}

export function formatRiskCapReason(input: {
  guardResult: TradeGuardResult;
  requestedUsd: number;
  bankrollUsd: number;
  totalExposureUsd: number;
  eventExposureUsd: number;
  openPositions: number;
  maxPositions: number;
}): string {
  const { guardResult } = input;
  const binding = guardResult.bindingConstraint;

  switch (binding) {
    case "max_positions":
      return `blocked_by_risk_cap:max_positions: already at ${input.openPositions}/${input.maxPositions} positions`;
    case "total_exposure": {
      const detail = guardResult.constraints.find((c) => c.label === "total_exposure");
      return `blocked_by_risk_cap:total_exposure: requested ${formatUsd(input.requestedUsd)} but total exposure headroom is ${formatUsd(detail?.headroom ?? 0)} (current ${formatUsd(input.totalExposureUsd)} / max ${formatUsd(detail?.limit ?? 0)})`;
    }
    case "event_exposure": {
      const detail = guardResult.constraints.find((c) => c.label === "event_exposure");
      return `blocked_by_risk_cap:event_exposure: event already at ${formatUsd(input.eventExposureUsd)} / max ${formatUsd(detail?.limit ?? 0)}`;
    }
    case "max_trade_pct": {
      const detail = guardResult.constraints.find((c) => c.label === "max_trade_pct");
      return `blocked_by_risk_cap:max_trade_pct: bankroll cap is ${formatUsd(detail?.limit ?? 0)} per trade (${((detail?.limit ?? 0) / Math.max(input.bankrollUsd, 1) * 100).toFixed(0)}% of ${formatUsd(input.bankrollUsd)})`;
    }
    case "liquidity_cap": {
      const detail = guardResult.constraints.find((c) => c.label === "liquidity_cap");
      return `blocked_by_risk_cap:liquidity_cap: market liquidity caps executable amount at ${formatUsd(detail?.headroom ?? 0)}`;
    }
    case "min_trade": {
      const detail = guardResult.constraints.find((c) => c.label === "min_trade");
      return `blocked_by_risk_cap:min_trade: post-guard amount is below minimum trade size ${formatUsd(detail?.limit ?? 0)}`;
    }
    default:
      return "blocked_by_risk_cap: reduced the maximum executable notional to zero";
  }
}

async function prefetchOrderBooks(input: {
  tokenIds: string[];
  readBook: (tokenId: string) => Promise<PlanningOrderBookSnapshot | null>;
  concurrency?: number;
}) {
  const result = new Map<string, PlanningOrderBookSnapshot | null>();
  const uniqueTokenIds = [...new Set(input.tokenIds.filter(Boolean))];
  if (uniqueTokenIds.length === 0) {
    return result;
  }

  const concurrency = Math.max(
    1,
    Math.min(input.concurrency ?? DEFAULT_BOOK_PREFETCH_CONCURRENCY, uniqueTokenIds.length)
  );
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < uniqueTokenIds.length) {
      const tokenId = uniqueTokenIds[cursor++]!;
      result.set(tokenId, await input.readBook(tokenId));
    }
  }));
  return result;
}

export function shouldWarnSkippedDecision(reason: string) {
  return reason.startsWith("blocked_by_risk_cap:")
    || reason.startsWith("blocked_by_strategy_min_trade:")
    || reason.startsWith("blocked_by_exchange_min:")
    || reason.startsWith("blocked_by_market_binding:");
}

export async function buildExecutionPlan(input: {
  decisions: TradeDecision[];
  positions: PublicPosition[];
  overview: OverviewResponse;
  config: Pick<
    OrchestratorConfig,
    "decisionStrategy" | "maxTradePct" | "maxTotalExposurePct" | "maxEventExposurePct" | "maxPositions"
  >;
  minTradeUsd: number;
  readBook: (tokenId: string) => Promise<PlanningOrderBookSnapshot | null>;
  bookPrefetchConcurrency?: number;
  /** Optional pulse candidates lookup for fee metadata (categorySlug + negRisk). */
  pulseCandidates?: PulseCandidateForPlanning[];
}) {
  // Build token_id → candidate map for fee metadata lookup
  const candidateByToken = new Map<string, CandidateTokenMeta>();
  for (const c of input.pulseCandidates ?? []) {
    for (const [index, tokenId] of (c.clobTokenIds ?? []).entries()) {
      candidateByToken.set(tokenId, {
        eventSlug: c.eventSlug ?? null,
        marketSlug: c.marketSlug ?? null,
        question: c.question ?? null,
        outcomeLabel: c.outcomes?.[index] ?? null,
        outcomePrice: c.outcomePrices?.[index] ?? null,
        categorySlug: c.categorySlug ?? null,
        negRisk: c.negRisk ?? false,
        feesEnabled: c.feesEnabled
      });
    }
  }
  const fallbackCandidateMeta: CandidateTokenMeta = {
    eventSlug: null,
    marketSlug: null,
    question: null,
    outcomeLabel: null,
    outcomePrice: null,
    categorySlug: null,
    negRisk: false
  };
  const feeMetaFor = (tokenId: string) => candidateByToken.get(tokenId) ?? fallbackCandidateMeta;
  const hasPulseCandidates = (input.pulseCandidates ?? []).length > 0;

  const plans: PlannedExecution[] = [];
  const skipped: SkippedDecision[] = [];
  const usePulseDirectEmptyPortfolioGuards =
    input.config.decisionStrategy === "pulse-direct" && input.positions.length === 0;
  let projectedTotalExposureUsd = input.positions.reduce((sum, position) => sum + position.current_value_usd, 0);
  let projectedOpenPositions = input.overview.open_positions;
  const eventExposureUsd = new Map<string, number>();
  for (const position of input.positions) {
    eventExposureUsd.set(
      position.event_slug,
      (eventExposureUsd.get(position.event_slug) ?? 0) + position.current_value_usd
    );
  }
  const bookByTokenId = await prefetchOrderBooks({
    tokenIds: input.decisions
      .filter((decision) => ["open", "close", "reduce"].includes(decision.action))
      .map((decision) => decision.token_id),
    readBook: input.readBook,
    concurrency: input.bookPrefetchConcurrency
  });
  const getBook = (tokenId: string) => bookByTokenId.get(tokenId) ?? null;

  for (const decision of input.decisions) {
    if (!["open", "close", "reduce"].includes(decision.action)) {
      continue;
    }

    if (decision.action === "open") {
      const book = getBook(decision.token_id);
      if (!(book?.bestAsk != null && book.bestAsk > 0)) {
        skipped.push({
          action: decision.action,
          marketSlug: decision.market_slug,
          tokenId: decision.token_id,
          reason: "blocked_by_orderbook_unavailable: no executable ask book is available from Polymarket"
        });
        continue;
      }
      if (hasPulseCandidates) {
        const binding = validateOpenDecisionBinding({
          decision,
          candidate: candidateByToken.get(decision.token_id) ?? null,
          book
        });
        if (!binding.ok) {
          skipped.push({
            action: decision.action,
            marketSlug: decision.market_slug,
            tokenId: decision.token_id,
            reason: binding.reason ?? "blocked_by_market_binding:unknown binding mismatch"
          });
          continue;
        }
      }
      const exchangeMinNotionalUsd = computeExchangeBuyMinNotionalUsd({
        bestAsk: book.bestAsk,
        minOrderSize: book.minOrderSize ?? null
      });
      const openExecutionFloorLabel = buildOpenExecutionFloorLabel({
        configuredMinTradeUsd: input.minTradeUsd,
        exchangeMinNotionalUsd
      });
      const currentEventExposureUsd = eventExposureUsd.get(decision.event_slug) ?? 0;
      const currentOpenPositions = usePulseDirectEmptyPortfolioGuards ? 0 : projectedOpenPositions;
      const currentTotalExposureUsd = usePulseDirectEmptyPortfolioGuards ? 0 : projectedTotalExposureUsd;
      const guardResult = applyTradeGuardsDetailed({
        requestedUsd: decision.notional_usd,
        bankrollUsd: input.overview.total_equity_usd,
        minTradeUsd: input.minTradeUsd,
        maxTradePct: input.config.maxTradePct,
        liquidityCapUsd: decision.liquidity_cap_usd ?? decision.notional_usd,
        totalExposureUsd: currentTotalExposureUsd,
        maxTotalExposurePct: usePulseDirectEmptyPortfolioGuards ? 1 : input.config.maxTotalExposurePct,
        eventExposureUsd: currentEventExposureUsd,
        maxEventExposurePct: input.config.maxEventExposurePct,
        openPositions: currentOpenPositions,
        maxPositions: usePulseDirectEmptyPortfolioGuards ? Number.MAX_SAFE_INTEGER : input.config.maxPositions
      });
      const rawGuardedNotionalUsd = guardResult.amount;
      if (!(rawGuardedNotionalUsd > 0)) {
        const belowConfiguredMinTrade = input.minTradeUsd > 0 && decision.notional_usd + 1e-9 < input.minTradeUsd;
        skipped.push({
          action: decision.action,
          marketSlug: decision.market_slug,
          tokenId: decision.token_id,
          reason: belowConfiguredMinTrade
            ? `blocked_by_strategy_min_trade: Kelly-sized order is ${formatUsd(roundNotional(decision.notional_usd))}, below internal minimum ${formatUsd(input.minTradeUsd)}`
            : formatRiskCapReason({
                guardResult,
                requestedUsd: decision.notional_usd,
                bankrollUsd: input.overview.total_equity_usd,
                totalExposureUsd: currentTotalExposureUsd,
                eventExposureUsd: currentEventExposureUsd,
                openPositions: currentOpenPositions,
                maxPositions: usePulseDirectEmptyPortfolioGuards ? Number.MAX_SAFE_INTEGER : input.config.maxPositions
              })
        });
        continue;
      }
      let plannedNotionalUsd = roundNotional(rawGuardedNotionalUsd);

      // Slippage cap: never let the fill price exceed bestAsk * (1 + DEFAULT_MAX_SLIPPAGE_PCT).
      // If the planned order would eat past the slippage ceiling, compress it to the
      // max notional that fits within the allowed price impact.
      const slippageCapResult = computeMaxBuyNotionalWithinSlippage(book.asks ?? null);
      let slippageCappedNotional: number | null = null;
      if (slippageCapResult.maxNotionalUsd > 0 && plannedNotionalUsd > slippageCapResult.maxNotionalUsd) {
        slippageCappedNotional = roundNotional(slippageCapResult.maxNotionalUsd);
        plannedNotionalUsd = slippageCappedNotional;
      }

      if (isBelowExchangeBuyMinimum({
        notionalUsd: plannedNotionalUsd,
        bestAsk: book.bestAsk,
        minOrderSize: book.minOrderSize ?? null
      })) {
        const wasCappedByRisk = plannedNotionalUsd + 1e-9 < roundNotional(decision.notional_usd);
        const wasCappedBySlippage = slippageCappedNotional != null;
        let reason: string;
        if (wasCappedBySlippage) {
          reason = `blocked_by_slippage_cap: order compressed to ${formatUsd(plannedNotionalUsd)} to stay within ${(DEFAULT_MAX_SLIPPAGE_PCT * 100).toFixed(0)}% slippage on ${book.asks?.length ?? 0} ask levels, but that is below Polymarket minimum ${formatUsd(exchangeMinNotionalUsd ?? 0)}`;
        } else if (wasCappedByRisk) {
          reason = `blocked_by_risk_cap:${guardResult.bindingConstraint}: risk limit (${guardResult.bindingConstraint}) caps this order at ${formatUsd(plannedNotionalUsd)}, but ${openExecutionFloorLabel || "the executable minimum"} is ${formatUsd(exchangeMinNotionalUsd ?? 0)} so the Polymarket order would fail`;
        } else {
          reason = `blocked_by_exchange_min: Kelly-sized order ${formatUsd(plannedNotionalUsd)} is below Polymarket minimum order size (${book.minOrderSize} shares @ ${formatUsd(book.bestAsk)} ask => ${formatUsd(exchangeMinNotionalUsd ?? 0)} minimum)`;
        }
        skipped.push({
          action: decision.action,
          marketSlug: decision.market_slug,
          tokenId: decision.token_id,
          reason
        });
        continue;
      }

      const feeMeta = feeMetaFor(decision.token_id);
      const orderDecision = chooseOrderType({
        action: decision.action,
        side: decision.side,
        bestBid: book.bestBid ?? null,
        bestAsk: book.bestAsk ?? null,
        negRisk: feeMeta.negRisk,
        feesEnabled: feeMeta.feesEnabled,
        feeRate: (decision as any).feeRate
      });

      plans.push({
        action: decision.action,
        marketSlug: decision.market_slug,
        eventSlug: decision.event_slug,
        tokenId: decision.token_id,
        outcomeLabel: (decision as TradeDecision & { outcome_label?: string }).outcome_label ?? feeMetaFor(decision.token_id).outcomeLabel ?? null,
        side: decision.side,
        notionalUsd: plannedNotionalUsd,
        bankrollRatio: input.overview.total_equity_usd > 0
          ? plannedNotionalUsd / input.overview.total_equity_usd
          : 0,
        executionAmount: plannedNotionalUsd,
        unit: "usd",
        thesisMd: decision.thesis_md,
        bestAsk: book.bestAsk ?? null,
        bestBid: book.bestBid ?? null,
        minOrderSize: book.minOrderSize ?? null,
        exchangeMinNotionalUsd,
        orderType: orderDecision.orderType,
        gtcLimitPrice: orderDecision.gtcLimitPrice,
        categorySlug: feeMeta.categorySlug,
        negRisk: feeMeta.negRisk
      });

      projectedTotalExposureUsd += plannedNotionalUsd;
      projectedOpenPositions += 1;
      eventExposureUsd.set(
        decision.event_slug,
        (eventExposureUsd.get(decision.event_slug) ?? 0) + plannedNotionalUsd
      );
      continue;
    }

    const currentPosition = input.positions.find((position) => position.token_id === decision.token_id) ?? null;
    const executionAmount = inferPaperSellAmount(currentPosition, decision);
    if (!(executionAmount > 0)) {
      skipped.push({
        action: decision.action,
        marketSlug: decision.market_slug,
        tokenId: decision.token_id,
        reason: "blocked_by_position_unavailable: no matching remote position is available to sell"
      });
      continue;
    }

    const book = getBook(decision.token_id);
    if (isBelowExchangeSellMinimum({
      size: executionAmount,
      minOrderSize: book?.minOrderSize ?? null
    })) {
      skipped.push({
        action: decision.action,
        marketSlug: decision.market_slug,
        tokenId: decision.token_id,
        reason: `blocked_by_exchange_min: below Polymarket minimum order size (${book?.minOrderSize ?? 0} shares)`
      });
      continue;
    }
    const sellFeeMeta = feeMetaFor(decision.token_id);
    plans.push({
      action: decision.action,
      marketSlug: decision.market_slug,
      eventSlug: decision.event_slug,
      tokenId: decision.token_id,
      side: decision.side,
      notionalUsd: roundNotional(decision.notional_usd),
      bankrollRatio: input.overview.total_equity_usd > 0
        ? decision.notional_usd / input.overview.total_equity_usd
        : 0,
      executionAmount,
      unit: "shares",
      thesisMd: decision.thesis_md,
      bestAsk: book?.bestAsk ?? null,
      bestBid: book?.bestBid ?? null,
      minOrderSize: book?.minOrderSize ?? null,
      exchangeMinNotionalUsd: null,
      orderType: "FOK",
      gtcLimitPrice: null,
      categorySlug: sellFeeMeta.categorySlug,
      negRisk: sellFeeMeta.negRisk
    });
  }

  return { plans, skipped };
}
