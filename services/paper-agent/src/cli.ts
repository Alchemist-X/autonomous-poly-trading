// Operator CLI for the paper book.
//
//   pnpm --filter @autopoly/paper-agent paper status
//   pnpm --filter @autopoly/paper-agent paper buy -- <slug> <YES|NO> <usd>
//   pnpm --filter @autopoly/paper-agent paper cycle        # run one evaluation cycle now
//   pnpm --filter @autopoly/paper-agent paper tick         # run one fill/resolution tick now
//   pnpm --filter @autopoly/paper-agent paper reflect      # write a reflection report

import { simulateMarketBuy } from "./book-sim";
import { loadPaperConfig } from "./config";
import { isYesNoMarket } from "./evaluator";
import { DEFAULT_FEES, describeFees, fetchMarketFees } from "./fees";
import { log } from "./log";
import { applyBuy, loadPortfolio, positionId, savePortfolio, type PaperPosition } from "./portfolio";
import { fetchBook, fetchMarket, marketFeeTags } from "./polymarket";
import { writeReflectionReport } from "./reflect";
import { runEvaluationCycle, runFillTick } from "./run-cycle";
import { acquireBookLock, appendLedger, releaseBookLock } from "./store";

async function cmdBuy(slug: string, sideRaw: string, usdRaw: string): Promise<void> {
  const side = sideRaw.toUpperCase() === "NO" ? 1 : 0;
  const usd = Number(usdRaw);
  if (!Number.isFinite(usd) || usd <= 0) throw new Error(`bad notional: ${usdRaw}`);
  const market = await fetchMarket(slug);
  if (market.closed) throw new Error(`market ${slug} is closed`);
  if (!isYesNoMarket(market.outcomes) || market.tokenIds.length !== 2) {
    throw new Error(`phase 1 supports Yes/No binary markets only (got outcomes: ${market.outcomes.join("/")})`);
  }
  if (!acquireBookLock()) throw new Error("book is locked by a running cycle/tick — try again in a moment");
  try {
    await seedBuy(slug, side, usd, market);
  } finally {
    releaseBookLock();
  }
}

async function seedBuy(slug: string, side: number, usd: number, market: Awaited<ReturnType<typeof fetchMarket>>): Promise<void> {
  const portfolio = loadPortfolio();
  const id = positionId(slug, side);
  if (portfolio.positions.some((p) => p.id === id)) throw new Error(`position ${id} already open`);
  if (portfolio.cashUsd < usd) throw new Error(`insufficient paper cash (${portfolio.cashUsd.toFixed(2)} < ${usd})`);
  const book = await fetchBook(market.tokenIds[side]!);
  const liveFees = await fetchMarketFees(market.conditionId, await marketFeeTags(market));
  if (!liveFees) log.warn(`fee lookup failed for ${slug} — falling back to ${describeFees(DEFAULT_FEES)}`);
  const fees = liveFees ?? DEFAULT_FEES;
  const fill = simulateMarketBuy(book, usd, fees);
  if (fill.shares <= 0) throw new Error("no ask liquidity to fill against");
  const pos: PaperPosition = {
    id,
    slug,
    eventSlug: market.eventSlug,
    conditionId: market.conditionId,
    question: market.question,
    outcomeIndex: side,
    outcomeLabel: market.outcomes[side] ?? (side === 0 ? "Yes" : "No"),
    tokenId: market.tokenIds[side]!,
    shares: fill.shares,
    avgEntryPrice: fill.avgPrice,
    entryFeePerShare: fill.shares > 0 ? fill.feeUsd / fill.shares : 0,
    openedAtUtc: new Date().toISOString(),
    fees
  };
  savePortfolio(applyBuy(portfolio, pos, fill.notionalUsd, fill.feeUsd));
  appendLedger({
    type: "trade",
    side: "buy",
    style: "market",
    positionId: id,
    slug,
    outcome: pos.outcomeLabel,
    shares: fill.shares,
    avgPrice: fill.avgPrice,
    feeUsd: fill.feeUsd,
    feeRate: fees.feeRate,
    feeCategory: fees.category,
    feeRateSource: fees.rateSource,
    reason: "manual_seed"
  });
  process.stdout.write(
    `bought ${fill.shares.toFixed(2)} ${pos.outcomeLabel} @ ${fill.avgPrice.toFixed(3)} (fee $${fill.feeUsd.toFixed(3)} — ${describeFees(fees)}${fill.liquidityExhausted ? "; book thinner than budget" : ""})\n`
  );
}

function cmdStatus(): void {
  const p = loadPortfolio();
  process.stdout.write(`cash $${p.cashUsd.toFixed(2)} · realized PnL $${p.realizedPnlUsd.toFixed(2)} · fees $${p.totalFeesUsd.toFixed(2)}\n`);
  if (!p.positions.length) {
    process.stdout.write("(no open positions)\n");
  }
  for (const pos of p.positions) {
    const flags = pos.lastEval
      ? `${pos.lastEval.saturatedAt ? " ⚠saturated" : ""}${pos.lastEval.contaminated ? " ⛔contaminated" : ""}`
      : "";
    const ev = pos.lastEval
      ? ` · last eval ${pos.lastEval.ts.slice(0, 16)}: P=${(pos.lastEval.agentProb * 100).toFixed(1)}%${flags} edge=${pos.lastEval.netEdgePp?.toFixed(1) ?? "–"}pp → ${pos.lastEval.decision}`
      : " · not yet evaluated";
    process.stdout.write(
      `${pos.id}: ${pos.shares.toFixed(1)} ${pos.outcomeLabel} @ ${pos.avgEntryPrice.toFixed(3)}${ev}\n`
    );
  }
  for (const l of p.restingLimits) {
    process.stdout.write(`  resting limit ${l.id}: ${l.shares.toFixed(1)} @ ${l.limitPrice} (expires ${l.expiresAtUtc.slice(0, 16)})\n`);
  }
}

async function main(): Promise<void> {
  // pnpm forwards a literal "--" separator — drop it.
  const [cmd, ...rest] = process.argv.slice(2).filter((a) => a !== "--");
  const cfg = loadPaperConfig();
  if (cmd === "buy" && rest.length >= 3) return cmdBuy(rest[0]!, rest[1]!, rest[2]!);
  if (cmd === "status") return cmdStatus();
  if (cmd === "cycle") return runEvaluationCycle(cfg);
  if (cmd === "tick") return runFillTick(cfg);
  if (cmd === "reflect") {
    await writeReflectionReport();
    return;
  }
  process.stderr.write("usage: paper <status | buy <slug> <YES|NO> <usd> | cycle | tick | reflect>\n");
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`paper: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
