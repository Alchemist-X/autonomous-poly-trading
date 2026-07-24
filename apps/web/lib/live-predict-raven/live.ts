// Live data path for /live-predict-raven: server-side fetch of the Tokyo VM's
// forecast-api /paper/snapshot (written after every evaluation cycle), decoded
// and decorated into the page's PaperSnapshot shape. Any failure — network,
// timeout, auth, shape drift — returns null and the caller falls back to the
// baked snapshot, so the page never breaks when the VM is unreachable.

import { tradeNote, shortUtc, zhExitReason, zhExitStyle, zhQuestion } from "./labels";
import type { ClosedTrade, OpenPosition, PaperSnapshot } from "./snapshot";

const DEFAULT_UPSTREAM = "http://34.85.97.32:8787";
const FETCH_TIMEOUT_MS = 5000;

function upstreamUrl(): string {
  const base = process.env.LIVE_PREDICT_RAVEN_UPSTREAM?.trim() || DEFAULT_UPSTREAM;
  return `${base.replace(/\/+$/, "")}/paper/snapshot`;
}

function upstreamToken(): string {
  // The page's own invite code doubles as the API credential (accepted by the
  // endpoint alongside the main API token) — no extra secret to provision.
  return process.env.LIVE_PREDICT_RAVEN_UPSTREAM_TOKEN?.trim() || "raven-labs";
}

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function toSide(v: unknown): "YES" | "NO" {
  return str(v).toUpperCase() === "YES" ? "YES" : "NO";
}

function toExitReason(v: unknown): ClosedTrade["exitReason"] {
  return str(v).startsWith("stop_loss") ? "stop_loss" : "negative_edge";
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
    if (shares === null || pnlUsd === null) return [];
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
        costUsd: num(t.costUsd) ?? 0,
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
    evalCycles: num(json.evalCycles) ?? 0,
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

export async function fetchLiveSnapshot(): Promise<PaperSnapshot | null> {
  try {
    const res = await fetch(upstreamUrl(), {
      headers: { authorization: `Bearer ${upstreamToken()}` },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!res.ok) return null;
    return parseLivePayload(await res.json());
  } catch {
    return null;
  }
}
