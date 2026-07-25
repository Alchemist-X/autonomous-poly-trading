// Live data path for /live-predict-raven: server-side fetch of the Tokyo VM's
// forecast-api /paper/snapshot (written after every evaluation cycle), decoded
// and decorated into the page's PaperSnapshot shape. Any failure — network,
// timeout, auth, shape drift — returns null and the caller falls back to the
// baked snapshot, so the page never breaks when the VM is unreachable.

import { tradeNote, shortUtc, zhExitReason, zhExitStyle, zhQuestion } from "./labels";
import type { ClosedTrade, ExitReasonKind, OpenPosition, PaperSnapshot } from "./snapshot";

const DEFAULT_UPSTREAM = "http://34.85.97.32:8787";
const FETCH_TIMEOUT_MS = 5000;
// Warm-instance memos: a short success TTL keeps repeat views off the VM, and
// a failure backoff stops every view from paying the full timeout while the
// VM is down (deploys, instance stop — SYNs are silently dropped there).
const SUCCESS_TTL_MS = 15_000;
const FAILURE_BACKOFF_MS = 30_000;

function upstreamUrl(): string {
  const base = process.env.LIVE_PREDICT_RAVEN_UPSTREAM?.trim() || DEFAULT_UPSTREAM;
  return `${base.replace(/\/+$/, "")}/paper/snapshot`;
}

function upstreamToken(): string {
  // The page's own invite code doubles as the API credential (accepted by the
  // endpoint alongside the main API token) — no extra secret to provision.
  // SECURITY: this header crosses the public internet as plain HTTP (bare-IP
  // VM, no TLS yet). NEVER configure the real FORECAST_API_TOKEN /
  // RAVEN_ACCESS_TOKEN in this slot — the invite code is the only credential
  // that may travel this wire until the VM endpoint is fronted by TLS.
  return process.env.LIVE_PREDICT_RAVEN_UPSTREAM_TOKEN?.trim() || "raven-labs";
}

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function toSide(v: unknown): "YES" | "NO" {
  return str(v).toUpperCase() === "YES" ? "YES" : "NO";
}

const EXIT_REASONS: ReadonlySet<ExitReasonKind> = new Set([
  "negative_edge",
  "stop_loss",
  "settled_won",
  "settled_lost",
  "settled_voided"
]);

function toExitReason(v: unknown): ExitReasonKind {
  const raw = str(v);
  if (EXIT_REASONS.has(raw as ExitReasonKind)) return raw as ExitReasonKind;
  return raw.startsWith("stop_loss") ? "stop_loss" : "negative_edge";
}

function isIsoTimestamp(v: unknown): v is string {
  return typeof v === "string" && Number.isFinite(Date.parse(v));
}

// Strict on the numbers the headline tiles divide by; lenient elsewhere.
export function parseLivePayload(json: unknown): PaperSnapshot | null {
  if (!isRec(json)) return null;
  const bankrollUsd = num(json.bankrollUsd);
  const cashUsd = num(json.cashUsd);
  const equityUsd = num(json.equityUsd);
  const curveRaw = Array.isArray(json.equityCurve) ? json.equityCurve : null;
  const positionsRaw = Array.isArray(json.openPositions) ? json.openPositions : null;
  const tradesRaw = Array.isArray(json.closedTrades) ? json.closedTrades : null;
  if (bankrollUsd === null || bankrollUsd <= 0 || cashUsd === null || equityUsd === null) return null;
  if (!curveRaw || curveRaw.length < 2 || !positionsRaw || !tradesRaw) return null;
  // Degraded-but-parsable payloads (ledger rotated/unreadable on the VM) must
  // fall back to the baked snapshot rather than render "NaN 天" / "第 0 个周期".
  if (!isIsoTimestamp(json.startedUtc) || !isIsoTimestamp(json.lastEvalCycleUtc)) return null;
  const evalCycles = num(json.evalCycles);
  if (evalCycles === null || evalCycles < 1) return null;

  const equityCurve = curveRaw.flatMap((p) => {
    if (!isRec(p)) return [];
    const value = num(p.equityUsd);
    return value === null ? [] : [{ date: str(p.date), equityUsd: value }];
  });
  if (equityCurve.length < 2) return null;

  const openPositions: OpenPosition[] = positionsRaw.flatMap((p) => {
    if (!isRec(p)) return [];
    const shares = num(p.shares);
    const entryPrice = num(p.entryPrice);
    if (shares === null || entryPrice === null) return [];
    const flag = p.flag === "saturated" || p.flag === "contaminated" ? p.flag : null;
    return [
      {
        question: zhQuestion(str(p.slug), str(p.question)),
        slug: str(p.slug),
        side: toSide(p.side),
        openedUtc: str(p.openedUtc),
        shares,
        entryPrice,
        markPrice: num(p.markPrice) ?? entryPrice,
        unrealizedUsd: num(p.unrealizedUsd) ?? 0,
        agentProb: num(p.agentProb) ?? 0,
        flag,
        saturatedHold: p.saturatedHold === true
      }
    ];
  });

  const closedTrades: ClosedTrade[] = tradesRaw.flatMap((t) => {
    if (!isRec(t)) return [];
    const shares = num(t.shares);
    const pnlUsd = num(t.pnlUsd);
    const costUsd = num(t.costUsd);
    // costUsd feeds the 收益率 division — a row without a positive cost basis
    // would render Infinity%/NaN%, so it is dropped rather than coerced.
    if (shares === null || pnlUsd === null || costUsd === null || costUsd <= 0) return [];
    const slug = str(t.slug);
    const closedUtc = str(t.closedUtc);
    return [
      {
        question: zhQuestion(slug, slug),
        slug,
        side: toSide(t.side),
        openedUtc: str(t.openedUtc),
        closedUtc,
        entryPrice: num(t.entryPrice) ?? 0,
        exitPrice: num(t.exitPrice) ?? 0,
        shares,
        costUsd,
        pnlUsd,
        exitReason: toExitReason(t.exitReason),
        note: tradeNote(slug, closedUtc)
      }
    ];
  });

  const exitAlphaRec = isRec(json.exitAlpha) ? json.exitAlpha : {};
  const exitRows = Array.isArray(exitAlphaRec.rows) ? exitAlphaRec.rows : [];
  const brierRec = isRec(json.brier) ? json.brier : {};
  const brierRows = Array.isArray(brierRec.rows) ? brierRec.rows : [];
  const quality = isRec(json.engineQuality) ? json.engineQuality : {};

  return {
    generatedAtUtc: str(json.generatedAtUtc),
    reflectionReportUtc: str(json.reflectionReportUtc),
    lastEvalCycleUtc: str(json.lastEvalCycleUtc),
    startedUtc: str(json.startedUtc),
    bankrollUsd,
    cashUsd,
    realizedPnlUsd: num(json.realizedPnlUsd) ?? 0,
    equityUsd,
    feesUsd: num(json.feesUsd) ?? 0,
    fills: {
      total: num(isRec(json.fills) ? json.fills.total : null) ?? 0,
      buys: num(isRec(json.fills) ? json.fills.buys : null) ?? 0,
      sells: num(isRec(json.fills) ? json.fills.sells : null) ?? 0
    },
    droppedBuyFills: num(json.droppedBuyFills) ?? 0,
    evalCycles,
    saturatedHolds: num(json.saturatedHolds) ?? 0,
    equityCurve,
    closedTrades,
    openPositions,
    exitAlpha: {
      totalUsd: num(exitAlphaRec.totalUsd) ?? 0,
      rows: exitRows.flatMap((r) => {
        if (!isRec(r)) return [];
        return [
          {
            question: zhQuestion(str(r.question), str(r.question)),
            side: toSide(r.side),
            soldUtc: shortUtc(str(r.soldUtc)),
            exitStyle: zhExitStyle(str(r.exitStyle)),
            avgExitPrice: num(r.avgExitPrice) ?? 0,
            priceNow: num(r.priceNow) ?? 0,
            alphaUsd: num(r.alphaUsd) ?? 0,
            reason: zhExitReason(str(r.reason))
          }
        ];
      })
    },
    brier: {
      n: num(brierRec.n) ?? 0,
      agentScore: num(brierRec.agentScore) ?? 0,
      marketScore: num(brierRec.marketScore) ?? 0,
      skillScore: num(brierRec.skillScore) ?? 0,
      rows: brierRows.flatMap((r) => {
        if (!isRec(r)) return [];
        return [
          {
            question: zhQuestion(str(r.question), str(r.question)),
            agentProb: num(r.agentProb) ?? 0,
            marketProb: num(r.marketProb) ?? 0,
            happened: r.happened === true,
            resolvedUtc: str(r.resolvedUtc)
          }
        ];
      })
    },
    engineQuality: {
      evaluations: num(quality.evaluations) ?? 0,
      saturated: num(quality.saturated) ?? 0,
      contaminated: num(quality.contaminated) ?? 0,
      evalErrors: num(quality.evalErrors) ?? 0,
      limitOrdersPlaced: num(quality.limitOrdersPlaced) ?? 0,
      limitFills: num(quality.limitFills) ?? 0,
      limitVsMarketPp: num(quality.limitVsMarketPp)
    }
  };
}

let successMemo: { at: number; snapshot: PaperSnapshot } | null = null;
let lastFailureAt = 0;

export async function fetchLiveSnapshot(nowMs: number = Date.now()): Promise<PaperSnapshot | null> {
  if (successMemo && nowMs - successMemo.at < SUCCESS_TTL_MS) return successMemo.snapshot;
  if (nowMs - lastFailureAt < FAILURE_BACKOFF_MS) return null;
  try {
    const res = await fetch(upstreamUrl(), {
      headers: { authorization: `Bearer ${upstreamToken()}` },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!res.ok) {
      lastFailureAt = nowMs;
      return null;
    }
    const snapshot = parseLivePayload(await res.json());
    if (snapshot) {
      successMemo = { at: nowMs, snapshot };
    } else {
      lastFailureAt = nowMs;
    }
    return snapshot;
  } catch {
    lastFailureAt = nowMs;
    return null;
  }
}
