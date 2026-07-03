// One evaluation cycle (runs 3×/day) and the fast tick (stop-loss sweep,
// resting-limit fills, resolution sweep). All fills are simulated; every step
// is ledgered.
//
// Per-position cycle order (hardened 2026-07-03):
//   1. market lookup (two-step, closed-inclusive) → settle/skip if closed
//   2. pre-LLM stop-loss check on a fresh book — the stop-loss must fire even
//      when the model is down, and without waiting for it
//   3. isolated LLM evaluation (minutes)
//   4. RE-FETCH the book (the pre-eval snapshot is stale by design)
//   5. decide + execute against the fresh snapshot
// The fast tick additionally sweeps ALL positions every few minutes for
// stop-loss breaches and resolutions, so neither waits for the 8-hour cycle.

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { limitSellFilled, simulateMarketBuy, simulateMarketSell } from "./book-sim";
import type { PaperConfig } from "./config";
import { evaluateMarket, isYesNoMarket, makeEventId, probForOutcome } from "./evaluator";
import { fetchMarketFees, DEFAULT_FEES } from "./fees";
import { log } from "./log";
import {
  applyBuy,
  applySettlement,
  applySell,
  findPosition,
  loadPortfolio,
  positionId,
  savePortfolio,
  type PaperPosition,
  type Portfolio,
  type RestingLimit
} from "./portfolio";
import { decideEntry, decideExit, planHybridExit, stopLossBreached } from "./policy";
import { fetchBook, fetchMarket, type MarketInfo, type OrderBook } from "./polymarket";
import { appendLedger } from "./store";

function nowIso(): string {
  return new Date().toISOString();
}

// Refresh live fee/tick params onto the position (best-effort).
async function refreshFees(pos: PaperPosition): Promise<PaperPosition> {
  const live = await fetchMarketFees(pos.conditionId);
  return live ? { ...pos, fees: live } : pos;
}

// ---- Settlement --------------------------------------------------------------

// Returns the updated portfolio when the position reached a terminal state
// (settled or voided); null when still live or still awaiting resolution.
function settleFromMarket(portfolio: Portfolio, pos: PaperPosition, market: MarketInfo): Portfolio | null {
  if (market.resolution === "resolved") {
    const won = market.resolvedOutcomeIndex === pos.outcomeIndex;
    const next = applySettlement(portfolio, pos.id, won ? "won" : "lost");
    appendLedger({ type: "resolution", positionId: pos.id, slug: pos.slug, kind: won ? "won" : "lost", shares: pos.shares, avgEntryPrice: pos.avgEntryPrice });
    log.info(`settled ${pos.id}: ${won ? "WON" : "LOST"} (${pos.shares.toFixed(1)} shares)`);
    return next;
  }
  if (market.resolution === "voided") {
    const next = applySettlement(portfolio, pos.id, "voided");
    appendLedger({ type: "resolution", positionId: pos.id, slug: pos.slug, kind: "voided", shares: pos.shares, avgEntryPrice: pos.avgEntryPrice });
    log.info(`settled ${pos.id}: VOIDED at $0.50 (${pos.shares.toFixed(1)} shares)`);
    return next;
  }
  return null;
}

// ---- Exit execution ----------------------------------------------------------

// Execute an exit against a fresh book snapshot. Hybrid 50/50 softens
// taker-fee friction on model-driven exits; a STOP-LOSS demands immediacy and
// goes 100% market. Any unfilled market remainder (thin book) rolls into the
// resting limit so nothing silently dangles.
function executeExit(
  cfg: PaperConfig,
  portfolio: Portfolio,
  pos: PaperPosition,
  book: OrderBook,
  agentProb: number,
  reason: string
): Portfolio {
  const effective = reason === "stop_loss" ? { ...cfg, hybridMarketRatio: 1 } : cfg;
  const plan = planHybridExit(effective, pos.shares, agentProb, book, pos.fees.tickSize);
  let next = portfolio;
  let unfilledMarketShares = 0;

  if (plan.marketShares > 0) {
    const fill = simulateMarketSell(book, plan.marketShares, pos.fees);
    unfilledMarketShares = plan.marketShares - fill.shares;
    if (fill.shares > 0) {
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
  }

  const stillHeld = findPosition(next, pos.id);
  const limitShares = Math.min(plan.limitShares + unfilledMarketShares, stillHeld?.shares ?? 0);
  if (limitShares > 0.0001 && stillHeld) {
    const limit: RestingLimit = {
      id: randomUUID().slice(0, 8),
      positionId: pos.id,
      shares: limitShares,
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
      rolledFromMarket: unfilledMarketShares > 0.0001 ? unfilledMarketShares : undefined,
      reason
    });
  }
  return next;
}

// ---- The 3×/day evaluation cycle ----------------------------------------------

export async function runEvaluationCycle(cfg: PaperConfig): Promise<void> {
  let portfolio = loadPortfolio();
  appendLedger({ type: "cycle_start", positions: portfolio.positions.length, cashUsd: portfolio.cashUsd });
  let evals = 0;

  for (const stale of [...portfolio.positions]) {
    const posId = stale.id;
    try {
      const current = findPosition(portfolio, posId);
      if (!current) continue;
      const market = await fetchMarket(current.slug);

      if (market.closed) {
        const settled = settleFromMarket(portfolio, current, market);
        if (settled) {
          portfolio = settled;
          savePortfolio(portfolio);
        } else {
          // Closed but not yet UMA-resolved: no book, no LLM — just wait.
          appendLedger({ type: "awaiting_resolution", positionId: posId, slug: current.slug });
        }
        continue;
      }

      let pos = await refreshFees(current);
      portfolio = { ...portfolio, positions: portfolio.positions.map((x) => (x.id === posId ? pos : x)) };

      // Pre-LLM stop-loss: the rule that outranks the model must not wait for
      // (or depend on) the model.
      const preBook = await fetchBook(pos.tokenId);
      if (stopLossBreached(cfg, pos.avgEntryPrice, preBook)) {
        portfolio = { ...portfolio, restingLimits: portfolio.restingLimits.filter((l) => l.positionId !== posId) };
        portfolio = executeExit(cfg, portfolio, pos, preBook, 0, "stop_loss");
        savePortfolio(portfolio);
        appendLedger({ type: "stop_loss_pre_eval", positionId: posId, slug: pos.slug, bestBid: preBook.bids[0]?.price ?? null });
        log.info(`STOP-LOSS (pre-eval) ${posId}`);
        continue;
      }

      if (evals >= cfg.maxEvalsPerCycle) {
        appendLedger({ type: "eval_capped", positionId: posId });
        continue;
      }
      evals += 1;
      const evaluation = await evaluateMarket(market, cfg.evalMaxRounds);
      if (evaluation.unforecastable) {
        appendLedger({ type: "evaluation_unforecastable", positionId: posId, slug: pos.slug, forecastId: evaluation.forecastId });
        continue;
      }
      const agentProb = probForOutcome(evaluation.probYes, pos.outcomeIndex);

      // The pre-eval snapshot is minutes old by now — decide and execute
      // against a fresh one.
      const book = await fetchBook(pos.tokenId);
      const decision = decideExit(cfg, agentProb, pos.avgEntryPrice, book, pos.fees);

      appendLedger({
        type: "evaluation",
        positionId: posId,
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
          x.id === posId
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
      pos = findPosition(portfolio, posId) ?? pos;

      if (decision.action === "exit") {
        portfolio = { ...portfolio, restingLimits: portfolio.restingLimits.filter((l) => l.positionId !== posId) };
        portfolio = executeExit(cfg, portfolio, pos, book, agentProb, decision.reason);
        log.info(`EXIT ${posId} (${decision.reason}): ${decision.detail}`);
      } else {
        log.info(`HOLD ${posId}: ${decision.detail}`);
      }
      savePortfolio(portfolio);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`evaluation failed for ${posId}: ${message}`);
      appendLedger({ type: "evaluation_error", positionId: posId, slug: stale.slug, error: message });
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

// ---- Watchlist entries ---------------------------------------------------------

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
    try {
      const market = await fetchMarket(slug);
      if (market.closed || !isYesNoMarket(market.outcomes) || market.tokenIds.length !== 2) continue;
      const fees = (await fetchMarketFees(market.conditionId)) ?? DEFAULT_FEES;
      // Entry budget must cover notional + fee.
      const budget = cfg.entryNotionalUsd;
      if (next.cashUsd < budget) break;
      evals += 1;
      const evaluation = await evaluateMarket(market, cfg.evalMaxRounds);
      if (evaluation.unforecastable) continue;
      const yesBook = await fetchBook(market.tokenIds[0]!);
      const noBook = await fetchBook(market.tokenIds[1]!);
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
      const fill = simulateMarketBuy(book, budget, fees);
      if (fill.shares <= 0) continue;
      const pos: PaperPosition = {
        id: positionId(slug, entry.outcomeIndex),
        slug,
        conditionId: market.conditionId,
        question: market.question,
        outcomeIndex: entry.outcomeIndex,
        outcomeLabel: market.outcomes[entry.outcomeIndex] ?? (entry.outcomeIndex === 0 ? "Yes" : "No"),
        tokenId: market.tokenIds[entry.outcomeIndex]!,
        shares: fill.shares,
        avgEntryPrice: fill.avgPrice,
        entryFeePerShare: fill.shares > 0 ? fill.feeUsd / fill.shares : 0,
        openedAtUtc: nowIso(),
        fees
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

// ---- Fast tick: stop-loss sweep, resting-limit fills, resolution sweep ---------

export async function runFillTick(cfg: PaperConfig): Promise<void> {
  let portfolio = loadPortfolio();
  if (!portfolio.positions.length) return;

  for (const stale of [...portfolio.positions]) {
    const posId = stale.id;
    try {
      const pos = findPosition(portfolio, posId);
      if (!pos) continue;
      const market = await fetchMarket(pos.slug);

      if (market.closed) {
        const settled = settleFromMarket(portfolio, pos, market);
        if (settled) {
          portfolio = settled;
          savePortfolio(portfolio);
        }
        continue;
      }

      const book = await fetchBook(pos.tokenId);
      const limits = portfolio.restingLimits.filter((l) => l.positionId === posId);

      // 1. Resting-limit fills / TTL fallback.
      for (const limit of limits) {
        const held = findPosition(portfolio, posId);
        if (!held) break;
        const fill = limitSellFilled(book, limit.limitPrice, Math.min(limit.shares, held.shares), held.fees);
        if (fill) {
          portfolio = applySell(portfolio, posId, fill.shares, fill.avgPrice, fill.feeUsd);
          const remaining = limit.shares - fill.shares;
          portfolio = {
            ...portfolio,
            restingLimits:
              remaining > 0.0001 && findPosition(portfolio, posId)
                ? portfolio.restingLimits.map((l) => (l.id === limit.id ? { ...l, shares: remaining } : l))
                : portfolio.restingLimits.filter((l) => l.id !== limit.id)
          };
          appendLedger({
            type: "trade",
            side: "sell",
            style: "limit",
            positionId: posId,
            slug: pos.slug,
            limitId: limit.id,
            shares: fill.shares,
            avgPrice: fill.avgPrice,
            feeUsd: fill.feeUsd,
            reason: limit.reason
          });
          log.info(`limit filled ${posId}: ${fill.shares.toFixed(1)} @ ${limit.limitPrice}`);
        } else if (nowIso() > limit.expiresAtUtc) {
          const held2 = findPosition(portfolio, posId);
          if (!held2) break;
          const mkt = simulateMarketSell(book, Math.min(limit.shares, held2.shares), held2.fees);
          if (mkt.shares > 0) {
            portfolio = applySell(portfolio, posId, mkt.shares, mkt.avgPrice, mkt.feeUsd);
            appendLedger({
              type: "trade",
              side: "sell",
              style: "market",
              positionId: posId,
              slug: pos.slug,
              limitId: limit.id,
              shares: mkt.shares,
              avgPrice: mkt.avgPrice,
              feeUsd: mkt.feeUsd,
              reason: `${limit.reason}:limit_ttl_fallback`
            });
            log.info(`limit TTL fallback ${posId}: ${mkt.shares.toFixed(1)} @ ~${mkt.avgPrice.toFixed(3)} (taker)`);
          }
          const soldAll = mkt.shares >= limit.shares - 0.0001 || !findPosition(portfolio, posId);
          portfolio = {
            ...portfolio,
            restingLimits: soldAll
              ? portfolio.restingLimits.filter((l) => l.id !== limit.id)
              : // Empty/partial market fallback (no bids): keep the remainder
                // resting and extend the TTL one hour so it retries instead of
                // dangling with no order at all.
                portfolio.restingLimits.map((l) =>
                  l.id === limit.id
                    ? { ...l, shares: limit.shares - mkt.shares, expiresAtUtc: new Date(Date.now() + 3600_000).toISOString() }
                    : l
                )
          };
        }
        savePortfolio(portfolio);
      }

      // 2. Model-free stop-loss sweep (only for shares not already exiting).
      const held = findPosition(portfolio, posId);
      if (held && !portfolio.restingLimits.some((l) => l.positionId === posId) && stopLossBreached(cfg, held.avgEntryPrice, book)) {
        portfolio = executeExit(cfg, portfolio, held, book, 0, "stop_loss");
        savePortfolio(portfolio);
        appendLedger({ type: "stop_loss_tick", positionId: posId, slug: pos.slug, bestBid: book.bids[0]?.price ?? null });
        log.info(`STOP-LOSS (tick) ${posId}`);
      }
    } catch (error) {
      log.error(`fill tick failed for ${posId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
