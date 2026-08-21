// Local mirror of the Delta PM console status contract.
//
// Authoritative source: packages/delta-pm-contracts/src/index.ts
// (`RunStatus` + `StatusSnapshot` interfaces). This app deliberately does NOT
// import that workspace package (avoids the fresh-worktree prebuild footgun);
// instead we mirror the shape here and decode leniently — every field gets a
// default, unknown values are tolerated, and decoding never throws, so shape
// drift on the service side degrades gracefully instead of crashing the
// console. The upstream contract is declared additive-only.

export const RUN_STAGES = ["ingest", "gate1", "gate2", "analysis", "decision", "done"] as const;
export type RunStage = (typeof RUN_STAGES)[number];

export type StageStatus = "pending" | "running" | "done" | "skipped";

export interface RunStageEntry {
  stage: RunStage;
  status: StageStatus;
  note: string | null;
}

export interface RunStatus {
  runId: string;
  newsId: string;
  title: string;
  tickers: string[];
  stage: RunStage;
  stagePct: number; // 0-100 overall progress estimate
  outcome: string | null;
  startedAtUtc: string;
  updatedAtUtc: string;
  stages: RunStageEntry[];
}

export interface PositionRow {
  ticker: string;
  direction: "long" | "short";
  qty: number;
  entryPx: number;
  markPx: number | null;
  notionalUsd: number;
  unrealizedPnlUsd: number | null;
  unrealizedPnlPct: number | null;
  stopPx: number;
  hardFloorPx: number;
  horizonUtc: string;
  thesisId: string;
}

export interface SignalRow {
  signalId: string;
  // Not (yet) in the upstream StatusSnapshot; decoded leniently. The paste
  // seam needs a newsId — we fall back to signalId when the service omits it.
  newsId: string | null;
  title: string;
  tickers: string[];
  pricedInStatus: string | null;
  materialityScore: number;
  tradeable: boolean;
  createdAtUtc: string;
}

export interface StatusSnapshot {
  service: { name: string; version: string; mode: string; startedAtUtc: string; nowUtc: string };
  feed: { lastPollUtc: string | null; lastNewItemUtc: string | null; seenCount: number; lastError: string | null };
  market: { lastSweepUtc: string | null; archivedCoins: number; lastError: string | null };
  portfolio: {
    equityUsd: number;
    initialCapitalUsd: number;
    realizedPnlUsd: number;
    unrealizedPnlUsd: number;
    halted: boolean;
    haltedReason: string | null;
    positions: PositionRow[];
  };
  activeRuns: RunStatus[];
  recentRuns: RunStatus[];
  recentSignals: SignalRow[];
}

/** Envelope returned by GET /api/state. */
export interface StateResponse {
  ok: boolean;
  stale: boolean;
  fetchedAtUtc: string | null; // when the snapshot was last fetched successfully
  error: string | null;
  ingestConfigured: boolean; // DELTAPM_INGEST_TOKEN present (or mock mode)
  mock: boolean;
  snapshot: StatusSnapshot | null;
}

// ---------------------------------------------------------------------------
// Lenient decoding — never throw, always produce a usable snapshot.

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asObj(v: unknown): Record<string, unknown> {
  return isObj(v) ? v : {};
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function strArr(v: unknown): string[] {
  return arr(v).filter((x): x is string => typeof x === "string");
}

function decodeStage(v: unknown): RunStage {
  return typeof v === "string" && (RUN_STAGES as readonly string[]).includes(v) ? (v as RunStage) : "ingest";
}

const STAGE_STATUSES: readonly string[] = ["pending", "running", "done", "skipped"];
function decodeStageStatus(v: unknown): StageStatus {
  return typeof v === "string" && STAGE_STATUSES.includes(v) ? (v as StageStatus) : "pending";
}

function decodeRun(raw: unknown): RunStatus {
  const r = asObj(raw);
  return {
    runId: str(r.runId),
    newsId: str(r.newsId),
    title: str(r.title, "(无标题)"),
    tickers: strArr(r.tickers),
    stage: decodeStage(r.stage),
    stagePct: Math.max(0, Math.min(100, num(r.stagePct))),
    outcome: strOrNull(r.outcome),
    startedAtUtc: str(r.startedAtUtc),
    updatedAtUtc: str(r.updatedAtUtc),
    stages: arr(r.stages).map((s) => {
      const e = asObj(s);
      return { stage: decodeStage(e.stage), status: decodeStageStatus(e.status), note: strOrNull(e.note) };
    })
  };
}

function decodePosition(raw: unknown): PositionRow {
  const p = asObj(raw);
  return {
    ticker: str(p.ticker, "?"),
    direction: p.direction === "short" ? "short" : "long",
    qty: num(p.qty),
    entryPx: num(p.entryPx),
    markPx: numOrNull(p.markPx),
    notionalUsd: num(p.notionalUsd),
    unrealizedPnlUsd: numOrNull(p.unrealizedPnlUsd),
    unrealizedPnlPct: numOrNull(p.unrealizedPnlPct),
    stopPx: num(p.stopPx),
    hardFloorPx: num(p.hardFloorPx),
    horizonUtc: str(p.horizonUtc),
    thesisId: str(p.thesisId)
  };
}

function decodeSignal(raw: unknown): SignalRow {
  const s = asObj(raw);
  return {
    signalId: str(s.signalId),
    newsId: strOrNull(s.newsId),
    title: str(s.title, "(无标题)"),
    tickers: strArr(s.tickers),
    pricedInStatus: strOrNull(s.pricedInStatus),
    materialityScore: num(s.materialityScore),
    tradeable: bool(s.tradeable),
    createdAtUtc: str(s.createdAtUtc)
  };
}

export function decodeSnapshot(raw: unknown): StatusSnapshot {
  const root = asObj(raw);
  const service = asObj(root.service);
  const feed = asObj(root.feed);
  const market = asObj(root.market);
  const portfolio = asObj(root.portfolio);
  return {
    service: {
      name: str(service.name, "delta-pm"),
      version: str(service.version, "?"),
      mode: str(service.mode, "shadow"),
      startedAtUtc: str(service.startedAtUtc),
      nowUtc: str(service.nowUtc)
    },
    feed: {
      lastPollUtc: strOrNull(feed.lastPollUtc),
      lastNewItemUtc: strOrNull(feed.lastNewItemUtc),
      seenCount: num(feed.seenCount),
      lastError: strOrNull(feed.lastError)
    },
    market: {
      lastSweepUtc: strOrNull(market.lastSweepUtc),
      archivedCoins: num(market.archivedCoins),
      lastError: strOrNull(market.lastError)
    },
    portfolio: {
      equityUsd: num(portfolio.equityUsd),
      initialCapitalUsd: num(portfolio.initialCapitalUsd),
      realizedPnlUsd: num(portfolio.realizedPnlUsd),
      unrealizedPnlUsd: num(portfolio.unrealizedPnlUsd),
      halted: bool(portfolio.halted),
      haltedReason: strOrNull(portfolio.haltedReason),
      positions: arr(portfolio.positions).map(decodePosition)
    },
    activeRuns: arr(root.activeRuns).map(decodeRun),
    recentRuns: arr(root.recentRuns).map(decodeRun),
    recentSignals: arr(root.recentSignals).map(decodeSignal)
  };
}
