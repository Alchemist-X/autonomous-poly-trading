// Read-only aggregation of the paper-agent book for the /live-predict-raven
// review page. Sources (all on the shared runtime-artifacts volume, written by
// the paper-agent after every evaluation cycle — so this endpoint is exactly
// "fresh as of the last review"):
//   portfolio.json            cash / realized PnL / open positions (+ lastEval marks)
//   ledger.jsonl              fills, cycle + evaluation counts, closed round trips
//   reports/*-reflection.json daily equity curve, exit alpha, Brier calibration
//
// The JSON shape mirrors apps/web/lib/live-predict-raven/snapshot.ts
// (PaperSnapshot) minus the Chinese labels/notes, which the web layer adds.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./repo";

// The 2026-07-03 book-lock race dropped this buy fill from the portfolio
// (cash was restored); it must not enter round-trip pairing.
const DROPPED_FILLS = [
  { positionId: "strait-of-hormuz-traffic-returns-to-normal-by-july-31:1", tsPrefix: "2026-07-03T07:36" }
];

const CACHE_TTL_MS = 60_000;

export interface ApiClosedTrade {
  slug: string;
  positionId: string;
  side: string;
  openedUtc: string;
  closedUtc: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  costUsd: number;
  pnlUsd: number;
  exitReason: string;
}

export interface PaperSnapshotPayload {
  generatedAtUtc: string;
  startedUtc: string | null;
  lastEvalCycleUtc: string | null;
  reflectionReportUtc: string | null;
  bankrollUsd: number;
  cashUsd: number;
  realizedPnlUsd: number;
  feesUsd: number;
  equityUsd: number;
  fills: { total: number; buys: number; sells: number };
  droppedBuyFills: number;
  evalCycles: number;
  evaluations: number;
  watchlistEvals: number;
  evalErrors: number;
  saturatedHolds: number;
  engineQuality: {
    evaluations: number;
    saturated: number;
    contaminated: number;
    evalErrors: number;
    limitOrdersPlaced: number;
    limitFills: number;
    limitVsMarketPp: number | null;
  };
  equityCurve: Array<{ date: string; equityUsd: number }>;
  openPositions: Array<{
    slug: string;
    question: string;
    side: string;
    openedUtc: string;
    shares: number;
    entryPrice: number;
    markPrice: number | null;
    unrealizedUsd: number | null;
    agentProb: number | null;
    lastEvalUtc: string | null;
    flag: "saturated" | "contaminated" | null;
    saturatedHold: boolean;
  }>;
  closedTrades: ApiClosedTrade[];
  exitAlpha: {
    totalUsd: number | null;
    rows: Array<{
      question: string;
      side: string;
      soldUtc: string;
      exitStyle: string;
      avgExitPrice: number;
      priceNow: number | null;
      alphaUsd: number | null;
      reason: string;
    }>;
  };
  brier: {
    n: number;
    agentScore: number | null;
    marketScore: number | null;
    skillScore: number | null;
    rows: Array<{ question: string; agentProb: number; marketProb: number; happened: boolean; resolvedUtc: string }>;
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

function paperRoot(): string {
  // Explicit override first (tests), then the ARTIFACT_STORAGE_ROOT convention
  // shared with the paper-agent's own store.ts, then the repo default —
  // keeping this endpoint pointed at the same files the agent writes.
  const explicit = process.env.PAPER_ARTIFACTS_ROOT?.trim();
  if (explicit) return explicit;
  const shared = process.env.ARTIFACT_STORAGE_ROOT?.trim();
  if (shared) return path.join(shared, "paper-agent");
  return path.join(repoRoot(), "runtime-artifacts", "paper-agent");
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readLedger(file: string): Array<Record<string, unknown>> {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
}

function isDroppedFill(e: Record<string, unknown>): boolean {
  return DROPPED_FILLS.some(
    (d) => e.positionId === d.positionId && typeof e.ts === "string" && e.ts.startsWith(d.tsPrefix)
  );
}

const SETTLEMENT_PER_SHARE: Record<string, number> = { won: 1, lost: 0, voided: 0.5 };

// Sequential replay per positionId over trade AND resolution events: a
// position closes when its share count returns to ~zero (sells) or when a
// resolution settles the remainder (won $1 / lost $0 / voided $0.50 — the
// hold-to-settlement path the saturated-hold guard exists for). The same id
// can round-trip more than once (MOU did), and a partial exit whose residual
// settles produces ONE episode with combined sell + settlement economics.
function pairClosedTrades(events: Array<Record<string, unknown>>): ApiClosedTrade[] {
  const open = new Map<
    string,
    { shares: number; costUsd: number; proceedsUsd: number; soldShares: number; openedUtc: string; side: string; lastSellUtc: string; lastReason: string }
  >();
  const closed: ApiClosedTrade[] = [];
  for (const t of events) {
    const id = String(t.positionId ?? "");
    if (!id) continue;
    if (t.type === "resolution") {
      const cur = open.get(id);
      const perShare = SETTLEMENT_PER_SHARE[String(t.kind ?? "")];
      if (!cur || perShare === undefined || cur.shares <= 0.01) {
        open.delete(id);
        continue;
      }
      const soldShares = cur.soldShares + cur.shares;
      const proceedsUsd = cur.proceedsUsd + cur.shares * perShare;
      closed.push({
        slug: String(t.slug ?? ""),
        positionId: id,
        side: cur.side,
        openedUtc: cur.openedUtc,
        closedUtc: String(t.ts ?? ""),
        entryPrice: round4(cur.costUsd / soldShares),
        exitPrice: round4(proceedsUsd / soldShares),
        shares: round2(soldShares),
        costUsd: round2(cur.costUsd),
        pnlUsd: round2(proceedsUsd - cur.costUsd),
        exitReason: `settled_${String(t.kind)}`
      });
      open.delete(id);
      continue;
    }
    const shares = Number(t.shares ?? 0);
    const price = Number(t.avgPrice ?? 0);
    if (!(shares > 0)) continue;
    if (t.side === "buy") {
      const cur = open.get(id) ?? {
        shares: 0,
        costUsd: 0,
        proceedsUsd: 0,
        soldShares: 0,
        openedUtc: String(t.ts ?? ""),
        side: String(t.outcome ?? ""),
        lastSellUtc: "",
        lastReason: ""
      };
      open.set(id, { ...cur, shares: cur.shares + shares, costUsd: cur.costUsd + shares * price });
    } else if (t.side === "sell") {
      const cur = open.get(id);
      if (!cur) continue;
      const next = {
        ...cur,
        shares: cur.shares - shares,
        proceedsUsd: cur.proceedsUsd + shares * price - Number(t.feeUsd ?? 0),
        soldShares: cur.soldShares + shares,
        lastSellUtc: String(t.ts ?? ""),
        lastReason: String(t.reason ?? "").split(":")[0] ?? ""
      };
      if (next.shares <= 0.01) {
        closed.push({
          slug: String(t.slug ?? ""),
          positionId: id,
          side: cur.side,
          openedUtc: cur.openedUtc,
          closedUtc: next.lastSellUtc,
          entryPrice: round4(next.costUsd / next.soldShares),
          exitPrice: round4(next.proceedsUsd / next.soldShares),
          shares: round2(next.soldShares),
          costUsd: round2(next.costUsd),
          pnlUsd: round2(next.proceedsUsd - next.costUsd),
          exitReason: next.lastReason
        });
        open.delete(id);
      } else {
        open.set(id, next);
      }
    }
  }
  return closed;
}

function equityCurve(reportsDir: string, bankrollUsd: number): Array<{ date: string; equityUsd: number }> {
  if (!existsSync(reportsDir)) return [];
  // Key by FULL date (year included) so a multi-year run never overwrites a
  // prior year's point in place; the MM-DD display label is derived after.
  const byDate = new Map<string, number>();
  const files = readdirSync(reportsDir)
    .filter((f) => f.endsWith("-reflection.json"))
    .sort();
  for (const f of files) {
    const j = readJson(path.join(reportsDir, f));
    const equity = (j?.book as Record<string, unknown> | undefined)?.equityUsd;
    const ts = typeof j?.generatedAtUtc === "string" ? j.generatedAtUtc : f;
    if (typeof equity === "number") byDate.set(ts.slice(0, 10), equity);
  }
  const points = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, equityUsd]) => ({ date: date.slice(5), equityUsd }));
  return [{ date: "起点", equityUsd: bankrollUsd }, ...points];
}

interface ReflectionLite {
  generatedAtUtc?: string;
  exitAlphaTotalUsd?: number | null;
  exits?: Array<Record<string, unknown>>;
  calibration?: Record<string, unknown>;
  hybrid?: Record<string, unknown>;
}

function latestReflection(reportsDir: string): ReflectionLite | null {
  if (!existsSync(reportsDir)) return null;
  const files = readdirSync(reportsDir)
    .filter((f) => f.endsWith("-reflection.json"))
    .sort();
  const last = files[files.length - 1];
  return last ? (readJson(path.join(reportsDir, last)) as ReflectionLite | null) : null;
}

export function buildPaperSnapshot(rootDir: string = paperRoot()): PaperSnapshotPayload {
  const portfolio = readJson(path.join(rootDir, "portfolio.json")) ?? {};
  const ledger = readLedger(path.join(rootDir, "ledger.jsonl"));
  const reportsDir = path.join(rootDir, "reports");

  const trades = ledger.filter((e) => e.type === "trade");
  const pairableEvents = ledger.filter(
    (e) => (e.type === "trade" || e.type === "resolution") && !isDroppedFill(e)
  );
  const droppedBuyFills = trades.filter((e) => isDroppedFill(e)).length;
  const buys = trades.filter((e) => e.side === "buy").length;
  const sells = trades.filter((e) => e.side === "sell").length;
  const evaluations = ledger.filter((e) => e.type === "evaluation");
  const cycleEnds = ledger.filter((e) => e.type === "cycle_end");
  const firstCycle = ledger.find((e) => e.type === "cycle_start");

  const positions = Array.isArray(portfolio.positions) ? (portfolio.positions as Array<Record<string, unknown>>) : [];
  const openPositions = positions.map((p) => {
    const lastEval = (p.lastEval ?? null) as Record<string, unknown> | null;
    const shares = Number(p.shares ?? 0);
    const entry = Number(p.avgEntryPrice ?? 0);
    const mark = typeof lastEval?.mark === "number" ? lastEval.mark : null;
    const contaminated = lastEval?.contaminated === true;
    const saturated = lastEval?.saturatedAt === "floor" || lastEval?.saturatedAt === "ceil";
    return {
      slug: String(p.slug ?? ""),
      question: String(p.question ?? ""),
      side: String(p.outcomeLabel ?? ""),
      openedUtc: String(p.openedAtUtc ?? ""),
      shares: round2(shares),
      entryPrice: entry,
      markPrice: mark,
      unrealizedUsd: mark === null ? null : round2(shares * (mark - entry)),
      agentProb: typeof lastEval?.agentProb === "number" ? lastEval.agentProb : null,
      lastEvalUtc: typeof lastEval?.ts === "string" ? lastEval.ts : null,
      flag: contaminated ? ("contaminated" as const) : saturated ? ("saturated" as const) : null,
      saturatedHold: lastEval?.saturatedHold === true
    };
  });

  const cashUsd = Number(portfolio.cashUsd ?? 0);
  const bankrollUsd = Number(portfolio.bankrollUsd ?? 0);
  const equityUsd = round2(
    cashUsd + openPositions.reduce((s, p) => s + p.shares * (p.markPrice ?? p.entryPrice), 0)
  );

  const reflection = latestReflection(reportsDir);
  const calibration = (reflection?.calibration ?? {}) as Record<string, unknown>;
  const calRows = Array.isArray(calibration.rows) ? (calibration.rows as Array<Record<string, unknown>>) : [];
  const exits = Array.isArray(reflection?.exits) ? (reflection?.exits as Array<Record<string, unknown>>) : [];

  return {
    generatedAtUtc: new Date().toISOString(),
    startedUtc: typeof firstCycle?.ts === "string" ? firstCycle.ts : null,
    lastEvalCycleUtc: (() => {
      const last = cycleEnds[cycleEnds.length - 1];
      return typeof last?.ts === "string" ? last.ts : null;
    })(),
    reflectionReportUtc: reflection?.generatedAtUtc ?? null,
    bankrollUsd,
    cashUsd,
    realizedPnlUsd: round2(Number(portfolio.realizedPnlUsd ?? 0)),
    feesUsd: round2(Number(portfolio.totalFeesUsd ?? 0)),
    equityUsd,
    fills: { total: trades.length, buys, sells },
    droppedBuyFills,
    evalCycles: cycleEnds.length,
    evaluations: evaluations.length,
    watchlistEvals: ledger.filter((e) => e.type === "watchlist_eval").length,
    evalErrors: ledger.filter((e) => e.type === "evaluation_error").length,
    saturatedHolds: evaluations.filter((e) => e.saturatedHold === true).length,
    engineQuality: {
      evaluations: evaluations.length,
      saturated: evaluations.filter((e) => e.saturatedAt === "floor" || e.saturatedAt === "ceil").length,
      contaminated: evaluations.filter((e) => e.contaminated === true).length,
      evalErrors: ledger.filter((e) => e.type === "evaluation_error").length,
      limitOrdersPlaced: ledger.filter((e) => e.type === "limit_placed").length,
      limitFills: trades.filter((e) => e.side === "sell" && e.style === "limit").length,
      limitVsMarketPp:
        typeof reflection?.hybrid?.limitImprovementPp === "number" ? reflection.hybrid.limitImprovementPp : null
    },
    equityCurve: [
      ...equityCurve(reportsDir, bankrollUsd),
      { date: "现在", equityUsd }
    ],
    openPositions,
    closedTrades: pairClosedTrades(pairableEvents),
    exitAlpha: {
      totalUsd: typeof reflection?.exitAlphaTotalUsd === "number" ? round2(reflection.exitAlphaTotalUsd) : null,
      rows: exits.map((e) => ({
        question: String(e.question ?? ""),
        side: String(e.direction ?? ""),
        soldUtc: String(e.ts ?? ""),
        exitStyle: String(e.style ?? ""),
        avgExitPrice: Number(e.exitPrice ?? 0),
        priceNow: typeof e.priceNow === "number" ? e.priceNow : null,
        alphaUsd: typeof e.exitAlphaUsd === "number" ? round2(e.exitAlphaUsd) : null,
        reason: String(e.reason ?? "")
      }))
    },
    brier: {
      n: typeof calibration.n === "number" ? calibration.n : calRows.length,
      agentScore: typeof calibration.brierAgent === "number" ? calibration.brierAgent : null,
      marketScore: typeof calibration.brierMarket === "number" ? calibration.brierMarket : null,
      skillScore: typeof calibration.skill === "number" ? calibration.skill : null,
      rows: calRows.map((r) => ({
        question: String(r.label ?? ""),
        agentProb: Number(r.agentProb ?? 0),
        marketProb: Number(r.marketProb ?? 0),
        happened: r.outcome === 1,
        resolvedUtc: typeof r.ts === "string" ? r.ts.slice(0, 10) : ""
      }))
    }
  };
}

let cached: { at: number; payload: PaperSnapshotPayload } | null = null;

export function getPaperSnapshot(nowMs: number = Date.now()): PaperSnapshotPayload {
  if (cached && nowMs - cached.at < CACHE_TTL_MS) return cached.payload;
  const payload = buildPaperSnapshot();
  cached = { at: nowMs, payload };
  return payload;
}

export function resetPaperSnapshotCache(): void {
  cached = null;
}
