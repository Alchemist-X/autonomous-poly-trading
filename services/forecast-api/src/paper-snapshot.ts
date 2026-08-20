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
import { buildPaperCases, type PaperCasesPayload } from "./paper-cases";
import { buildDecisionQuality, type DecisionQuality } from "./paper-decisions";
import { readLedger, type PaperLedgerEvent } from "./paper-ledger";
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
  config: PaperConfigView;
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
    rows: Array<{
      question: string;
      agentProb: number;
      marketProb: number;
      happened: boolean;
      resolvedUtc: string;
      horizonDays: number | null;
    }>;
    /**
     * Fairness views written by the daily reflection (services/paper-agent).
     * Null on books whose latest report predates them.
     */
    horizon: {
      atEntry: BrierBlockView | null;
      atLast: BrierBlockView | null;
      buckets: Array<BrierBlockView & { label: string; minDays: number; maxDays: number | null }>;
      weighted: { exponent: number; skill: number | null; n: number } | null;
    } | null;
    clusters: {
      effectiveN: number;
      rows: Array<{ eventSlug: string; label: string; n: number; skill: number | null }>;
    } | null;
    pending: Array<{
      question: string;
      slug: string;
      side: string | null;
      agentProb: number;
      marketProb: number;
      horizonDays: number | null;
      unrealizedUsd: number | null;
    }>;
  };
  /** Entry-vs-exit contribution split; null when the ledger has no episodes. */
  decisionQuality: DecisionQuality | null;
}

export interface BrierBlockView {
  n: number;
  brierAgent: number | null;
  brierMarket: number | null;
  skill: number | null;
  medianHorizonDays: number | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

export interface PaperConfigView {
  bankrollUsd: number;
  evalTimesUtc: string[];
  entryNotionalUsd: number;
  entryEdgePp: number;
  exitEdgePp: number;
  stopLossPct: number;
  maxPositions: number;
  maxPerEvent: number;
  maxEvalsPerCycle: number;
  evalMaxRounds: number;
  evalProvider: string;
  categories: string[];
  scanMinLiquidityUsd: number;
  scanMinVolume24hUsd: number;
  scanPerCategory: number;
  hybridMarketRatio: number;
  limitTtlHours: number;
  fillCheckMinutes: number;
  saturatedHoldEnabled: boolean;
}

function envNum(name: string, fallback: number, min = 0): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

// MIRROR of services/paper-agent/src/config.ts loadPaperConfig — every
// container shares deploy/raven/.env, so reading the same env with the same
// defaults yields the paper-agent's effective config. Keep the two in sync
// when a new PAPER_* knob lands.
export function readPaperConfigView(): PaperConfigView {
  const times = (process.env.PAPER_EVAL_TIMES_UTC ?? "00:10,08:10,16:10")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^\d{2}:\d{2}$/.test(t));
  return {
    bankrollUsd: envNum("PAPER_BANKROLL_USD", 1000, 1),
    evalTimesUtc: times.length ? times : ["00:10", "08:10", "16:10"],
    entryNotionalUsd: envNum("PAPER_ENTRY_NOTIONAL_USD", 50, 1),
    entryEdgePp: envNum("PAPER_ENTRY_EDGE_PP", 8, 0.5),
    exitEdgePp: envNum("PAPER_EXIT_EDGE_PP", 0),
    stopLossPct: envNum("PAPER_STOP_LOSS_PCT", 0.35, 0.01),
    maxPositions: envNum("PAPER_MAX_POSITIONS", 10, 1),
    maxPerEvent: envNum("PAPER_MAX_PER_EVENT", 1, 1),
    maxEvalsPerCycle: envNum("PAPER_MAX_EVALS_PER_CYCLE", 12, 1),
    evalMaxRounds: envNum("PAPER_EVAL_MAX_ROUNDS", 1, 1),
    evalProvider: process.env.PAPER_EVAL_PROVIDER?.trim() === "deepseek" ? "deepseek" : "claude",
    categories: (process.env.PAPER_CATEGORIES ?? "")
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean),
    scanMinLiquidityUsd: envNum("PAPER_SCAN_MIN_LIQUIDITY_USD", 5000, 0),
    scanMinVolume24hUsd: envNum("PAPER_SCAN_MIN_VOLUME24H_USD", 10000, 0),
    scanPerCategory: envNum("PAPER_SCAN_PER_CATEGORY", 8, 1),
    hybridMarketRatio: Math.min(1, envNum("PAPER_HYBRID_MARKET_RATIO", 0.5)),
    limitTtlHours: envNum("PAPER_LIMIT_TTL_HOURS", 8, 0.1),
    fillCheckMinutes: envNum("PAPER_FILL_CHECK_MINUTES", 10, 1),
    saturatedHoldEnabled: !["0", "false", "off", "no"].includes(
      (process.env.PAPER_SATURATED_HOLD ?? "").trim().toLowerCase()
    )
  };
}

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
  // costUsd tracks notional (shares × price) so entryPrice stays the true fill
  // price; buyFeesUsd is carried separately and folded into the reported cost
  // basis and pnl at close time, so per-round pnl sums to the book's realized
  // PnL even on fee-bearing markets (entry fees went unbooked before).
  const open = new Map<
    string,
    { shares: number; costUsd: number; buyFeesUsd: number; proceedsUsd: number; soldShares: number; openedUtc: string; side: string; lastSellUtc: string; lastReason: string }
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
        costUsd: round2(cur.costUsd + cur.buyFeesUsd),
        pnlUsd: round2(proceedsUsd - cur.costUsd - cur.buyFeesUsd),
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
        buyFeesUsd: 0,
        proceedsUsd: 0,
        soldShares: 0,
        openedUtc: String(t.ts ?? ""),
        side: String(t.outcome ?? ""),
        lastSellUtc: "",
        lastReason: ""
      };
      open.set(id, {
        ...cur,
        shares: cur.shares + shares,
        costUsd: cur.costUsd + shares * price,
        buyFeesUsd: cur.buyFeesUsd + Number(t.feeUsd ?? 0)
      });
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
          costUsd: round2(next.costUsd + next.buyFeesUsd),
          pnlUsd: round2(next.proceedsUsd - next.costUsd - next.buyFeesUsd),
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
  positions?: Array<Record<string, unknown>>;
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

  // Decision-quality split. Benchmarks come from the same two places the rest
  // of the page uses: the portfolio's live marks for open positions and the
  // reflection's hold-counterfactual prices for positions already sold.
  const markPrices = new Map<string, number>();
  for (const p of positions) {
    const lastEval = (p.lastEval ?? null) as Record<string, unknown> | null;
    const id = String(p.id ?? "");
    if (id && typeof lastEval?.mark === "number") markPrices.set(id, lastEval.mark);
  }
  const livePrices = new Map<string, number>();
  for (const e of exits) {
    const id = String(e.positionId ?? "");
    if (id && typeof e.priceNow === "number") livePrices.set(id, e.priceNow);
  }
  const questions = new Map<string, string>();
  for (const p of positions) {
    const id = String(p.id ?? "");
    const q = String(p.question ?? "");
    if (id && q) questions.set(id, q);
    if (p.slug && q) questions.set(String(p.slug), q);
  }
  for (const e of exits) {
    const id = String(e.positionId ?? "");
    const q = String(e.question ?? "");
    if (id && q && !questions.has(id)) questions.set(id, q);
  }
  // Positions that settled without ever being sold have no exit episode, so
  // their question text comes from the reflection's own position snapshot (and
  // from its pending-calibration rows, which carry slug + question together).
  for (const p of reflection?.positions ?? []) {
    const id = String(p.positionId ?? "");
    const q = String(p.question ?? "");
    if (id && q && !questions.has(id)) questions.set(id, q);
  }
  const pendingRows = Array.isArray(calibration.pending) ? (calibration.pending as Array<Record<string, unknown>>) : [];
  for (const r of pendingRows) {
    const slug = String(r.slug ?? "");
    const q = String(r.label ?? "");
    if (slug && q && !questions.has(slug)) questions.set(slug, q);
  }
  const decisionQuality = buildDecisionQuality(
    // The FULL ledger (minus the dropped fill), not just fills: entry context
    // comes from the watchlist_eval that opened each position and the first
    // review after it.
    ledger.filter((e) => !isDroppedFill(e)),
    {
      livePrices,
      markPrices,
      questions,
      benchmarkAsOfUtc: reflection?.generatedAtUtc ?? null
    },
    // Reconcile the CLOSED half against the book's own realized PnL — the one
    // number both paths compute independently, so a replay bug shows up as a
    // non-zero delta. (The open half cannot be reconciled the same way: the
    // book's unrealized figure excludes entry fees, the decomposition doesn't.)
    Number(portfolio.realizedPnlUsd ?? 0)
  );

  return {
    generatedAtUtc: new Date().toISOString(),
    config: readPaperConfigView(),
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
        resolvedUtc: typeof r.ts === "string" ? r.ts.slice(0, 10) : "",
        horizonDays: typeof r.horizonDays === "number" ? r.horizonDays : null
      })),
      horizon: readHorizonViews(calibration.horizon),
      clusters: readClusters(calibration.clusters),
      pending: readPending(calibration.pending)
    },
    decisionQuality: decisionQuality.episodes.length > 0 ? decisionQuality : null
  };
}

const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function readBrierBlock(raw: unknown): BrierBlockView | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const n = numOrNull(r.n);
  if (n === null) return null;
  return {
    n,
    brierAgent: numOrNull(r.brierAgent),
    brierMarket: numOrNull(r.brierMarket),
    skill: numOrNull(r.skill),
    medianHorizonDays: numOrNull(r.medianHorizonDays)
  };
}

function readHorizonViews(raw: unknown): PaperSnapshotPayload["brier"]["horizon"] {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const bucketsRaw = Array.isArray(r.buckets) ? r.buckets : [];
  const weightedRaw = (typeof r.weighted === "object" && r.weighted !== null ? r.weighted : null) as Record<
    string,
    unknown
  > | null;
  return {
    atEntry: readBrierBlock(r.atEntry),
    atLast: readBrierBlock(r.atLast),
    buckets: bucketsRaw.flatMap((b) => {
      const block = readBrierBlock(b);
      if (!block) return [];
      const rec = b as Record<string, unknown>;
      return [
        {
          ...block,
          label: String(rec.label ?? ""),
          minDays: numOrNull(rec.minDays) ?? 0,
          maxDays: numOrNull(rec.maxDays)
        }
      ];
    }),
    weighted: weightedRaw
      ? {
          exponent: numOrNull(weightedRaw.exponent) ?? 1.5,
          skill: numOrNull(weightedRaw.skill),
          n: numOrNull(weightedRaw.n) ?? 0
        }
      : null
  };
}

function readClusters(raw: unknown): PaperSnapshotPayload["brier"]["clusters"] {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const rows = Array.isArray(r.rows) ? r.rows : [];
  return {
    effectiveN: numOrNull(r.effectiveN) ?? rows.length,
    rows: rows.map((x) => {
      const rec = x as Record<string, unknown>;
      return {
        eventSlug: String(rec.eventSlug ?? ""),
        label: String(rec.label ?? ""),
        n: numOrNull(rec.n) ?? 0,
        skill: numOrNull(rec.skill)
      };
    })
  };
}

function readPending(raw: unknown): PaperSnapshotPayload["brier"]["pending"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    const rec = x as Record<string, unknown>;
    return {
      question: String(rec.label ?? ""),
      slug: String(rec.slug ?? ""),
      side: typeof rec.direction === "string" ? rec.direction : null,
      agentProb: numOrNull(rec.agentProb) ?? 0,
      marketProb: numOrNull(rec.marketProb) ?? 0,
      horizonDays: numOrNull(rec.horizonDays),
      unrealizedUsd: numOrNull(rec.unrealizedUsd)
    };
  });
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
  cachedCases = null;
}

// ---------------------------------------------------------------------------
// Case walk-throughs (biggest winners / losers, with their research trail).
// Kept behind its own cache: reading dossiers is far heavier than the snapshot
// and only the case endpoint needs it.
// ---------------------------------------------------------------------------

export function buildPaperCasesPayload(rootDir: string = paperRoot(), perBucket = 2): PaperCasesPayload {
  const snapshot = buildPaperSnapshot(rootDir);
  const ledger = readLedger(path.join(rootDir, "ledger.jsonl")).filter((e) => !isDroppedFill(e));
  return buildPaperCases(snapshot.decisionQuality?.episodes ?? [], ledger, rootDir, perBucket);
}

let cachedCases: { at: number; perBucket: number; payload: PaperCasesPayload } | null = null;

export function getPaperCases(perBucket = 2, nowMs: number = Date.now()): PaperCasesPayload {
  if (cachedCases && cachedCases.perBucket === perBucket && nowMs - cachedCases.at < CACHE_TTL_MS) {
    return cachedCases.payload;
  }
  const payload = buildPaperCasesPayload(paperRoot(), perBucket);
  cachedCases = { at: nowMs, perBucket, payload };
  return payload;
}
