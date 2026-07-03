// Operator CLI for the paper book.
//
//   pnpm --filter @autopoly/paper-agent paper status
//   pnpm --filter @autopoly/paper-agent paper buy -- <slug> <YES|NO> <usd>
//   pnpm --filter @autopoly/paper-agent paper cycle        # run one evaluation cycle now
//   pnpm --filter @autopoly/paper-agent paper tick         # run one fill/resolution tick now
//   pnpm --filter @autopoly/paper-agent paper reflect      # write a reflection report

import { simulateMarketBuy } from "./book-sim";
import { loadPaperConfig } from "./config";
import { feeParamsFor } from "./fees";
import { applyBuy, loadPortfolio, positionId, savePortfolio, type PaperPosition } from "./portfolio";
import { fetchBook, fetchMarket } from "./polymarket";
import { writeReflectionReport } from "./reflect";
import { runEvaluationCycle, runFillTick } from "./run-cycle";
import { appendLedger } from "./store";

async function cmdBuy(slug: string, sideRaw: string, usdRaw: string): Promise<void> {
  const side = sideRaw.toUpperCase() === "NO" ? 1 : 0;
  const usd = Number(usdRaw);
  if (!Number.isFinite(usd) || usd <= 0) throw new Error(`bad notional: ${usdRaw}`);
  const market = await fetchMarket(slug);
  if (market.closed) throw new Error(`market ${slug} is closed`);
  if (market.outcomes.length !== 2 || market.tokenIds.length !== 2) {
    throw new Error(`phase 1 supports binary markets only (got ${market.outcomes.length} outcomes)`);
  }
  const portfolio = loadPortfolio();
  const id = positionId(slug, side);
  if (portfolio.positions.some((p) => p.id === id)) throw new Error(`position ${id} already open`);
  if (portfolio.cashUsd < usd) throw new Error(`insufficient paper cash (${portfolio.cashUsd.toFixed(2)} < ${usd})`);
  const book = await fetchBook(market.tokenIds[side]!);
  const fees = feeParamsFor(market.category, market.negRisk);
  const fill = simulateMarketBuy(book, usd, fees);
  if (fill.shares <= 0) throw new Error("no ask liquidity to fill against");
  const pos: PaperPosition = {
    id,
    slug,
    conditionId: market.conditionId,
    question: market.question,
    category: market.category,
    negRisk: market.negRisk,
    outcomeIndex: side,
    outcomeLabel: market.outcomes[side] ?? (side === 0 ? "Yes" : "No"),
    tokenId: market.tokenIds[side]!,
    shares: fill.shares,
    avgEntryPrice: fill.avgPrice,
    entryFeeUsd: fill.feeUsd,
    openedAtUtc: new Date().toISOString()
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
    reason: "manual_seed"
  });
  process.stdout.write(
    `bought ${fill.shares.toFixed(2)} ${pos.outcomeLabel} @ ${fill.avgPrice.toFixed(3)} (fee $${fill.feeUsd.toFixed(3)}${fill.liquidityExhausted ? ", book thinner than budget" : ""})\n`
  );
}

function cmdStatus(): void {
  const p = loadPortfolio();
  process.stdout.write(`cash $${p.cashUsd.toFixed(2)} · realized PnL $${p.realizedPnlUsd.toFixed(2)} · fees $${p.totalFeesUsd.toFixed(2)}\n`);
  if (!p.positions.length) {
    process.stdout.write("(no open positions)\n");
  }
  for (const pos of p.positions) {
    const ev = pos.lastEval
      ? ` · last eval ${pos.lastEval.ts.slice(0, 16)}: P=${(pos.lastEval.agentProb * 100).toFixed(1)}% edge=${pos.lastEval.netEdgePp?.toFixed(1) ?? "–"}pp → ${pos.lastEval.decision}`
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
