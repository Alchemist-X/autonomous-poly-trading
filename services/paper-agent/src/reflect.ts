// Reflection = the backtest loop for a live paper book. Instead of replaying
// history against a strategy, we grade every decision the agent actually made:
//  1. EXIT ALPHA — for each exit, fetch the price path AFTER the exit and
//     compare realized proceeds vs "what if we had held" (to now/resolution).
//  2. CALIBRATION — Brier score of the agent's probabilities against resolved
//     outcomes (the honest long-run test of the evaluator).
//  3. FEE DRAG — total friction paid, split by taker/maker.
//  4. HYBRID QUALITY — limit-half fill rate + price improvement vs the
//     market-half of the same exits.
// Output: reports/<ts>-reflection.{json,md} — the artifacts to review daily.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { log } from "./log";
import { loadPortfolio } from "./portfolio";
import { fetchBook, fetchMarket, fetchPriceHistory } from "./polymarket";
import { readLedger, reportsDir } from "./store";

interface TradeEvent {
  ts: string;
  type: string;
  side?: string;
  style?: string;
  positionId?: string;
  slug?: string;
  shares?: number;
  avgPrice?: number;
  feeUsd?: number;
  limitId?: string;
  reason?: string;
  agentProbOutcome?: number;
  kind?: string;
  outcome?: string;
}

export interface Reflection {
  generatedAtUtc: string;
  book: {
    cashUsd: number;
    openPositions: number;
    realizedPnlUsd: number;
    totalFeesUsd: number;
    equityUsd: number | null;
  };
  exits: Array<{
    positionId: string;
    ts: string;
    style: string;
    shares: number;
    exitPrice: number;
    feeUsd: number;
    priceNow: number | null;
    exitAlphaUsd: number | null; // proceeds − hold-counterfactual value
    reason: string;
  }>;
  exitAlphaTotalUsd: number;
  calibration: { n: number; brier: number | null; note: string };
  fees: { takerUsd: number; makerUsd: number; totalUsd: number };
  hybrid: {
    limitPlaced: number;
    limitFilled: number;
    limitFillRate: number | null;
    avgLimitPrice: number | null;
    avgMarketPrice: number | null;
    limitImprovementPp: number | null;
  };
}

export async function buildReflection(): Promise<Reflection> {
  const ledger = readLedger() as unknown as TradeEvent[];
  const portfolio = loadPortfolio();

  const sells = ledger.filter((e) => e.type === "trade" && e.side === "sell");
  const buys = ledger.filter((e) => e.type === "trade" && e.side === "buy");
  const resolutions = ledger.filter((e) => e.type === "resolution");
  const evaluations = ledger.filter((e) => e.type === "evaluation" || e.type === "watchlist_eval");

  // 1. Exit alpha: realized proceeds vs price now (or settlement) had we held.
  const exits: Reflection["exits"] = [];
  let exitAlphaTotal = 0;
  const priceNowCache = new Map<string, number | null>();
  for (const sell of sells) {
    if (!sell.positionId || !sell.slug || !sell.shares || sell.avgPrice === undefined) continue;
    let priceNow = priceNowCache.get(sell.positionId) ?? null;
    if (!priceNowCache.has(sell.positionId)) {
      priceNow = null;
      const idx = Number(sell.positionId.split(":").pop());
      try {
        // Live market state first: covers exits whose market resolved AFTER
        // we sold (prices-history 404s post-close — review finding).
        const market = await fetchMarket(sell.slug);
        if (market.resolution === "resolved") priceNow = market.resolvedOutcomeIndex === idx ? 1 : 0;
        else if (market.resolution === "voided") priceNow = 0.5;
        else if (market.tokenIds[idx]) {
          const nowSec = Date.now() / 1000;
          const hist = await fetchPriceHistory(market.tokenIds[idx]!, nowSec - 6 * 3600, nowSec);
          priceNow = hist.length ? hist[hist.length - 1]!.p : null;
        }
      } catch {
        priceNow = null;
      }
      // A ledgered settlement of OUR position is authoritative regardless.
      const res = resolutions.find((r) => r.positionId === sell.positionId);
      if (res && res.kind !== "voided") priceNow = res.kind === "won" ? 1 : 0;
      else if (res) priceNow = 0.5;
      priceNowCache.set(sell.positionId, priceNow);
    }
    const proceeds = sell.shares * sell.avgPrice - (sell.feeUsd ?? 0);
    const alpha = priceNow === null ? null : proceeds - sell.shares * priceNow;
    if (alpha !== null) exitAlphaTotal += alpha;
    exits.push({
      positionId: sell.positionId,
      ts: sell.ts,
      style: sell.style ?? "market",
      shares: sell.shares,
      exitPrice: sell.avgPrice,
      feeUsd: sell.feeUsd ?? 0,
      priceNow,
      exitAlphaUsd: alpha,
      reason: sell.reason ?? ""
    });
  }

  // 2. Calibration: last pre-resolution agent prob per resolved position.
  let brier: number | null = null;
  let calN = 0;
  {
    let sum = 0;
    for (const res of resolutions) {
      if (res.kind === "voided") continue;
      const evalsFor = evaluations.filter(
        (e) => e.positionId === res.positionId && typeof e.agentProbOutcome === "number" && e.ts < res.ts
      );
      const last = evalsFor[evalsFor.length - 1];
      if (!last) continue;
      const outcome = res.kind === "won" ? 1 : 0;
      sum += Math.pow((last.agentProbOutcome ?? 0) - outcome, 2);
      calN += 1;
    }
    brier = calN ? sum / calN : null;
  }

  // 3. Fees.
  const takerUsd = ledger
    .filter((e) => e.type === "trade" && e.style === "market")
    .reduce((s, e) => s + (e.feeUsd ?? 0), 0);
  const makerUsd = ledger
    .filter((e) => e.type === "trade" && e.style === "limit")
    .reduce((s, e) => s + (e.feeUsd ?? 0), 0);

  // 4. Hybrid quality.
  const limitPlaced = ledger.filter((e) => e.type === "limit_placed").length;
  const limitFills = sells.filter((s) => s.style === "limit");
  const marketExitFills = sells.filter((s) => s.style === "market" && s.reason === "negative_edge");
  const limitFillsComparable = limitFills.filter((s) => (s.reason ?? "").startsWith("negative_edge"));
  const avg = (rows: TradeEvent[]): number | null => {
    const tot = rows.reduce((s, r) => s + (r.shares ?? 0), 0);
    if (!tot) return null;
    return rows.reduce((s, r) => s + (r.avgPrice ?? 0) * (r.shares ?? 0), 0) / tot;
  };
  const avgLimit = avg(limitFillsComparable);
  const avgMarket = avg(marketExitFills);

  // Equity = cash + freshly marked open positions (fall back to the last
  // eval's mark when the book is unreachable; null only if neither exists).
  let equity: number | null = portfolio.cashUsd;
  for (const pos of portfolio.positions) {
    let mark: number | null = null;
    try {
      const book = await fetchBook(pos.tokenId);
      mark = book.bids[0]?.price ?? null;
    } catch {
      mark = null;
    }
    mark = mark ?? pos.lastEval?.mark ?? null;
    if (mark === null) {
      equity = null;
      break;
    }
    equity += pos.shares * mark;
  }

  return {
    generatedAtUtc: new Date().toISOString(),
    book: {
      cashUsd: portfolio.cashUsd,
      openPositions: portfolio.positions.length,
      realizedPnlUsd: portfolio.realizedPnlUsd,
      totalFeesUsd: portfolio.totalFeesUsd,
      equityUsd: equity
    },
    exits,
    exitAlphaTotalUsd: exitAlphaTotal,
    calibration: {
      n: calN,
      brier,
      note: calN ? "Brier of last pre-resolution agent prob vs outcome (0=perfect, 0.25=coin flip)" : "no resolved positions yet"
    },
    fees: { takerUsd, makerUsd, totalUsd: takerUsd + makerUsd },
    hybrid: {
      limitPlaced,
      limitFilled: limitFills.length,
      limitFillRate: limitPlaced ? limitFills.length / limitPlaced : null,
      avgLimitPrice: avgLimit,
      avgMarketPrice: avgMarket,
      limitImprovementPp: avgLimit !== null && avgMarket !== null ? (avgLimit - avgMarket) * 100 : null
    }
  };
}

function fmtUsd(v: number | null): string {
  return v === null ? "–" : `$${v.toFixed(2)}`;
}

export function renderReflectionMd(r: Reflection): string {
  const lines: string[] = [];
  lines.push(`# Paper agent reflection — ${r.generatedAtUtc}`);
  lines.push("");
  lines.push(`## Book`);
  lines.push(`cash ${fmtUsd(r.book.cashUsd)} · open positions ${r.book.openPositions} · realized PnL ${fmtUsd(r.book.realizedPnlUsd)} · fees paid ${fmtUsd(r.book.totalFeesUsd)} · equity ${fmtUsd(r.book.equityUsd)}`);
  lines.push("");
  lines.push(`## Exit alpha (realized vs hold-counterfactual): ${fmtUsd(r.exitAlphaTotalUsd)}`);
  lines.push("");
  lines.push("| position | when | style | shares | exit | now | alpha | reason |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const e of r.exits.slice(-30)) {
    lines.push(
      `| ${e.positionId} | ${e.ts.slice(0, 16)} | ${e.style} | ${e.shares.toFixed(1)} | ${e.exitPrice.toFixed(3)} | ${e.priceNow === null ? "–" : e.priceNow.toFixed(3)} | ${e.exitAlphaUsd === null ? "–" : fmtUsd(e.exitAlphaUsd)} | ${e.reason} |`
    );
  }
  lines.push("");
  lines.push(`## Calibration`);
  lines.push(`n=${r.calibration.n} · Brier ${r.calibration.brier === null ? "–" : r.calibration.brier.toFixed(3)} — ${r.calibration.note}`);
  lines.push("");
  lines.push(`## Fees`);
  lines.push(`taker ${fmtUsd(r.fees.takerUsd)} · maker ${fmtUsd(r.fees.makerUsd)} · total ${fmtUsd(r.fees.totalUsd)}`);
  lines.push("");
  lines.push(`## Hybrid execution`);
  lines.push(
    `limits placed ${r.hybrid.limitPlaced} · filled ${r.hybrid.limitFilled} (${r.hybrid.limitFillRate === null ? "–" : Math.round(r.hybrid.limitFillRate * 100) + "%"}) · avg limit ${r.hybrid.avgLimitPrice?.toFixed(3) ?? "–"} vs avg market ${r.hybrid.avgMarketPrice?.toFixed(3) ?? "–"} · improvement ${r.hybrid.limitImprovementPp === null ? "–" : r.hybrid.limitImprovementPp.toFixed(1) + "pp"}`
  );
  lines.push("");
  lines.push("_Simulated book — no real orders. Fees per the repo's calibrated category model._");
  return lines.join("\n") + "\n";
}

export async function writeReflectionReport(): Promise<string> {
  const reflection = await buildReflection();
  mkdirSync(reportsDir(), { recursive: true });
  const stamp = reflection.generatedAtUtc.replace(/[:]/g, "").slice(0, 15);
  const jsonPath = path.join(reportsDir(), `${stamp}-reflection.json`);
  const mdPath = path.join(reportsDir(), `${stamp}-reflection.md`);
  writeFileSync(jsonPath, JSON.stringify(reflection, null, 2), "utf8");
  writeFileSync(mdPath, renderReflectionMd(reflection), "utf8");
  log.info(`reflection written: ${mdPath}`);
  return mdPath;
}
