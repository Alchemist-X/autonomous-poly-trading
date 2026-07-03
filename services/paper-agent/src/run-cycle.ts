// One evaluation cycle (runs 3×/day) and the fast tick (resting-limit fills +
// resolution sweep). All fills are simulated; every step is ledgered.

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { simulateMarketBuy, simulateMarketSell, limitSellFilled } from "./book-sim";
import type { PaperConfig } from "./config";
import { evaluateMarket, makeEventId, probForOutcome } from "./evaluator";
import { feeParamsFor } from "./fees";
import { log } from "./log";
import {
  applyBuy,
  applyResolution,
  applySell,
  findPosition,
  loadPortfolio,
  positionId,
  savePortfolio,
  type PaperPosition,
  type Portfolio,
  type RestingLimit
} from "./portfolio";
import { decideEntry, decideExit, planHybridExit } from "./policy";
import { fetchBook, fetchMarket, type MarketInfo, type OrderBook } from "./polymarket";
import { appendLedger } from "./store";

function nowIso(): string {
  return new Date().toISOString();
}

async function marketAndBook(pos: PaperPosition): Promise<{ market: MarketInfo; book: OrderBook }> {
  const market = await fetchMarket(pos.slug);
  const book = await fetchBook(pos.tokenId);
  return { market, book };
}

// Execute the exit for one position against a fresh book snapshot. Hybrid
// 50/50 exists to soften taker-fee friction on model-driven exits; a
// STOP-LOSS demands immediacy, so it always goes 100% market (a resting limit
// priced off a still-bullish model would never fill on a collapsing book).
function executeHybridExit(
  cfg: PaperConfig,
  portfolio: Portfolio,
  pos: PaperPosition,
  book: OrderBook,
  agentProb: number,
  reason: string
): Portfolio {
  const fees = feeParamsFor(pos.category, pos.negRisk);
  const effective = reason === "stop_loss" ? { ...cfg, hybridMarketRatio: 1 } : cfg;
  const plan = planHybridExit(effective, pos.shares, agentProb, book);
  let next = portfolio;

  if (plan.marketShares > 0) {
    const fill = simulateMarketSell(book, plan.marketShares, fees);
    next = applySell(next, pos.id, fill.shares, fill.avgPrice, fill.feeUsd);
    appendLedger({
      type: "trade",
      side: "sell",
      style: "market",
      positionId: pos.id,
      slug: pos.slug,
      outcome: pos.outcomeLabel,
      shares: fill.shares,
      avgPrice: fill.avgPrice,
      feeUsd: fill.feeUsd,
      liquidityExhausted: fill.liquidityExhausted,
      reason
    });
  }

  const stillHeld = findPosition(next, pos.id);
  if (plan.limitShares > 0 && stillHeld) {
    const limit: RestingLimit = {
      id: randomUUID().slice(0, 8),
      positionId: pos.id,
      shares: Math.min(plan.limitShares, stillHeld.shares),
      limitPrice: plan.limitPrice,
      placedAtUtc: nowIso(),
      expiresAtUtc: new Date(Date.now() + cfg.limitTtlHours * 3600_000).toISOString(),
      reason
    };
    next = { ...next, restingLimits: [...next.restingLimits, limit] };
    appendLedger({
      type: "limit_placed",
      positionId: pos.id,
      slug: pos.slug,
      limitId: limit.id,
      shares: limit.shares,
      limitPrice: limit.limitPrice,
      expiresAtUtc: limit.expiresAtUtc,
      reason
    });
  }
  return next;
}

async function settleIfResolved(portfolio: Portfolio, pos: PaperPosition, market: MarketInfo): Promise<Portfolio | null> {
  if (!market.closed || market.resolvedOutcomeIndex === null) return null;
  const won = market.resolvedOutcomeIndex === pos.outcomeIndex;
  const next = applyResolution(portfolio, pos.id, won);
  appendLedger({
    type: "resolution",
    positionId: pos.id,
    slug: pos.slug,
    outcome: pos.outcomeLabel,
    won,
    shares: pos.shares,
    avgEntryPrice: pos.avgEntryPrice
  });
  log.info(`settled ${pos.id}: ${won ? "WON" : "LOST"} (${pos.shares.toFixed(1)} shares)`);
  return next;
}

// ---- The 3×/day evaluation cycle -------------------------------------------

export async function runEvaluationCycle(cfg: PaperConfig): Promise<void> {
  let portfolio = loadPortfolio();
  appendLedger({ type: "cycle_start", positions: portfolio.positions.length, cashUsd: portfolio.cashUsd });
  let evals = 0;

  for (const pos of [...portfolio.positions]) {
    if (evals >= cfg.maxEvalsPerCycle) {
      log.warn(`eval cap (${cfg.maxEvalsPerCycle}) reached — remaining positions keep their last decision`);
      break;
    }
    try {
      const { market, book } = await marketAndBook(pos);
      const settled = await settleIfResolved(portfolio, pos, market);
      if (settled) {
        portfolio = settled;
        savePortfolio(portfolio);
        continue;
      }
      evals += 1;
      const evaluation = await evaluateMarket(market, cfg.evalMaxRounds);
      const agentProb = probForOutcome(evaluation.probYes, pos.outcomeIndex);
      const fees = feeParamsFor(pos.category, pos.negRisk);
      const decision = decideExit(cfg, agentProb, pos.avgEntryPrice, book, pos.shares, fees);

      appendLedger({
        type: "evaluation",
        positionId: pos.id,
        slug: pos.slug,
        outcome: pos.outcomeLabel,
        forecastId: evaluation.forecastId,
        engineRounds: evaluation.rounds,
        evidenceCount: evaluation.evidenceCount,
        agentProbOutcome: agentProb,
        probYes: evaluation.probYes,
        bestBid: decision.mark,
        netEdgePp: decision.netEdgePp,
        action: decision.action,
        reason: decision.reason,
        detail: decision.detail
      });

      portfolio = {
        ...portfolio,
        positions: portfolio.positions.map((x) =>
          x.id === pos.id
            ? {
                ...x,
                lastEval: {
                  ts: nowIso(),
                  agentProb,
                  mark: decision.mark,
                  netEdgePp: decision.netEdgePp,
                  decision: `${decision.action}:${decision.reason}`,
                  forecastId: evaluation.forecastId
                }
              }
            : x
        )
      };

      if (decision.action === "exit") {
        // Cancel any prior resting limits for this position before replanning.
        portfolio = {
          ...portfolio,
          restingLimits: portfolio.restingLimits.filter((l) => l.positionId !== pos.id)
        };
        portfolio = executeHybridExit(cfg, portfolio, findPosition(portfolio, pos.id) ?? pos, book, agentProb, decision.reason);
        log.info(`EXIT ${pos.id} (${decision.reason}): ${decision.detail}`);
      } else {
        log.info(`HOLD ${pos.id}: ${decision.detail}`);
      }
      savePortfolio(portfolio);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`evaluation failed for ${pos.id}: ${message}`);
      appendLedger({ type: "evaluation_error", positionId: pos.id, slug: pos.slug, error: message });
    }
  }

  if (cfg.watchlistPath) {
    try {
      portfolio = await scanWatchlist(cfg, portfolio, evals);
    } catch (error) {
      log.error(`watchlist scan failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  appendLedger({
    type: "cycle_end",
    positions: portfolio.positions.length,
    cashUsd: portfolio.cashUsd,
    realizedPnlUsd: portfolio.realizedPnlUsd,
    totalFeesUsd: portfolio.totalFeesUsd
  });
}

// ---- Watchlist entries ------------------------------------------------------

async function scanWatchlist(cfg: PaperConfig, portfolio: Portfolio, evalsUsed: number): Promise<Portfolio> {
  if (!cfg.watchlistPath || !existsSync(cfg.watchlistPath)) return portfolio;
  const slugs = readFileSync(cfg.watchlistPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  let evals = evalsUsed;
  let next = portfolio;

  for (const slug of slugs) {
    if (next.positions.length >= cfg.maxPositions) break;
    if (evals >= cfg.maxEvalsPerCycle) break;
    if (next.positions.some((p) => p.slug === slug)) continue;
    if (next.cashUsd < cfg.entryNotionalUsd) break;
    try {
      const market = await fetchMarket(slug);
      if (market.closed || market.outcomes.length !== 2 || market.tokenIds.length !== 2) continue;
      evals += 1;
      const evaluation = await evaluateMarket(market, cfg.evalMaxRounds);
      const yesBook = await fetchBook(market.tokenIds[0]!);
      const noBook = await fetchBook(market.tokenIds[1]!);
      const fees = feeParamsFor(market.category, market.negRisk);
      const entry = decideEntry(cfg, evaluation.probYes, yesBook, noBook, fees);
      appendLedger({
        type: "watchlist_eval",
        slug,
        forecastId: evaluation.forecastId,
        probYes: evaluation.probYes,
        enter: entry.enter,
        outcomeIndex: entry.outcomeIndex,
        edgePp: entry.edgePp,
        detail: entry.detail
      });
      if (!entry.enter) continue;

      const book = entry.outcomeIndex === 0 ? yesBook : noBook;
      const fill = simulateMarketBuy(book, cfg.entryNotionalUsd, fees);
      if (fill.shares <= 0) continue;
      const pos: PaperPosition = {
        id: positionId(slug, entry.outcomeIndex),
        slug,
        conditionId: market.conditionId,
        question: market.question,
        category: market.category,
        negRisk: market.negRisk,
        outcomeIndex: entry.outcomeIndex,
        outcomeLabel: market.outcomes[entry.outcomeIndex] ?? (entry.outcomeIndex === 0 ? "Yes" : "No"),
        tokenId: market.tokenIds[entry.outcomeIndex]!,
        shares: fill.shares,
        avgEntryPrice: fill.avgPrice,
        entryFeeUsd: fill.feeUsd,
        openedAtUtc: nowIso()
      };
      next = applyBuy(next, pos, fill.notionalUsd, fill.feeUsd);
      savePortfolio(next);
      appendLedger({
        type: "trade",
        side: "buy",
        style: "market",
        positionId: pos.id,
        slug,
        outcome: pos.outcomeLabel,
        shares: fill.shares,
        avgPrice: fill.avgPrice,
        feeUsd: fill.feeUsd,
        reason: "watchlist_entry",
        edgePp: entry.edgePp
      });
      log.info(`ENTER ${pos.id}: ${fill.shares.toFixed(1)} shares @ ${fill.avgPrice.toFixed(3)} (${entry.detail})`);
    } catch (error) {
      log.error(`watchlist entry failed for ${slug}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return next;
}

// ---- Fast tick: resting-limit fills, TTL fallbacks, resolution sweep --------

export async function runFillTick(cfg: PaperConfig): Promise<void> {
  let portfolio = loadPortfolio();
  if (!portfolio.restingLimits.length && !portfolio.positions.length) return;

  for (const limit of [...portfolio.restingLimits]) {
    const pos = findPosition(portfolio, limit.positionId);
    if (!pos) {
      portfolio = { ...portfolio, restingLimits: portfolio.restingLimits.filter((l) => l.id !== limit.id) };
      continue;
    }
    try {
      const { market, book } = await marketAndBook(pos);
      const settled = await settleIfResolved(portfolio, pos, market);
      if (settled) {
        portfolio = settled;
        savePortfolio(portfolio);
        continue;
      }
      const fees = feeParamsFor(pos.category, pos.negRisk);
      const fill = limitSellFilled(book, limit.limitPrice, Math.min(limit.shares, pos.shares), fees, cfg.makerFeeFactor);
      if (fill) {
        portfolio = applySell(portfolio, pos.id, fill.shares, fill.avgPrice, fill.feeUsd);
        const remaining = limit.shares - fill.shares;
        portfolio = {
          ...portfolio,
          restingLimits:
            remaining > 0.0001 && findPosition(portfolio, pos.id)
              ? portfolio.restingLimits.map((l) => (l.id === limit.id ? { ...l, shares: remaining } : l))
              : portfolio.restingLimits.filter((l) => l.id !== limit.id)
        };
        appendLedger({
          type: "trade",
          side: "sell",
          style: "limit",
          positionId: pos.id,
          slug: pos.slug,
          limitId: limit.id,
          shares: fill.shares,
          avgPrice: fill.avgPrice,
          feeUsd: fill.feeUsd,
          reason: limit.reason
        });
        log.info(`limit filled ${pos.id}: ${fill.shares.toFixed(1)} @ ${limit.limitPrice}`);
      } else if (nowIso() > limit.expiresAtUtc) {
        // TTL expired — finish the job as a taker so exits never dangle.
        const mkt = simulateMarketSell(book, Math.min(limit.shares, pos.shares), fees);
        portfolio = applySell(portfolio, pos.id, mkt.shares, mkt.avgPrice, mkt.feeUsd);
        portfolio = { ...portfolio, restingLimits: portfolio.restingLimits.filter((l) => l.id !== limit.id) };
        appendLedger({
          type: "trade",
          side: "sell",
          style: "market",
          positionId: pos.id,
          slug: pos.slug,
          limitId: limit.id,
          shares: mkt.shares,
          avgPrice: mkt.avgPrice,
          feeUsd: mkt.feeUsd,
          reason: `${limit.reason}:limit_ttl_fallback`
        });
        log.info(`limit TTL fallback ${pos.id}: ${mkt.shares.toFixed(1)} @ ~${mkt.avgPrice.toFixed(3)} (taker)`);
      }
      savePortfolio(portfolio);
    } catch (error) {
      log.error(`fill tick failed for ${limit.positionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
