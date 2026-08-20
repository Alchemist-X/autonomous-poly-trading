// Case walk-throughs for the /live-predict-raven review page: for the book's
// biggest winners and biggest losers, the full chain from "what the engine
// read" to "what the harness did about it".
//
// Two independent records are joined per case:
//   the DOSSIER  <paper>/engine/forecasts/<forecastId>/state.json — the belief
//                trail: every research round, the sources it found, how many
//                percentage points each one moved P(YES), and the final synthesis
//   the LEDGER   the decision trail: the watchlist screen that opened the
//                position, each review's hold/sell verdict and net edge, the
//                fills, the stop-loss, the settlement
//
// Dossiers run to 145 rounds / 1.4 MB, so rounds are selected (biggest movers
// plus the first and last) and long prose is trimmed. Nothing is paraphrased:
// every string is verbatim from the artifact, and every source keeps its URL
// so a reader can check the citation.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DecisionEpisode } from "./paper-decisions";
import type { PaperLedgerEvent } from "./paper-ledger";

const MAX_KEY_ROUNDS = 8;
const MAX_SOURCES_PER_ROUND = 5;
const MAX_REASONING_CHARS = 900;
const MAX_EXPLANATION_CHARS = 320;
const MAX_VERDICT_CHARS = 1200;
const MAX_TIMELINE_EVENTS = 60;
const MAX_BELIEF_POINTS = 160;

export interface CaseSource {
  url: string;
  title: string;
  deltaPp: number;
  explanation: string;
  verified: boolean;
  kind: string;
  sourceType: string;
  credibility: string;
  /** Set when market-blind mode zero-weighted this source (kept for the audit trail). */
  excluded: string | null;
}

export interface CaseRound {
  round: number;
  ts: string;
  priorProb: number;
  postProb: number;
  netPp: number;
  upPp: number | null;
  downPp: number | null;
  dominantTitle: string | null;
  dominantUrl: string | null;
  newSourceCount: number;
  confidence: string;
  reasoning: string;
  searchQueries: string[];
  sources: CaseSource[];
  /** True when this round was picked for being the first/last rather than a big mover. */
  anchor: "first" | "last" | null;
}

export interface CaseTimelineEvent {
  ts: string;
  kind: string;
  label: string;
  detail: string | null;
  agentProb: number | null;
  marketPrice: number | null;
  netEdgePp: number | null;
}

export interface PaperCase {
  rank: number;
  bucket: "winner" | "loser";
  positionId: string;
  slug: string;
  question: string;
  side: string;
  status: "open" | "closed";
  openedUtc: string;
  closedUtc: string | null;
  pnlUsd: number | null;
  entryAlphaUsd: number | null;
  exitAlphaUsd: number | null;
  entryPrice: number;
  exitPrice: number | null;
  benchmarkPrice: number | null;
  benchmarkSource: string;
  shares: number;
  entryEdgePp: number | null;
  exitReason: string | null;
  /** Engine dossier context; null when the dossier is missing on this host. */
  dossier: {
    forecastId: string;
    normalizedQuestion: string | null;
    resolutionCriteria: string | null;
    rounds: number;
    evidenceCount: number;
    status: string;
    saturatedAt: string | null;
    marketBlind: { enabled: boolean; blockedCount: number; priorSuspect: boolean } | null;
    provider: string | null;
    verdict: string | null;
    whySentence: string | null;
    keyFactorsYes: string[];
    keyFactorsNo: string[];
    mainUncertainties: string | null;
    /** P(YES) after every round — the belief curve behind the position. */
    beliefCurve: Array<{ round: number; ts: string; prob: number }>;
    keyRounds: CaseRound[];
  } | null;
  /** What the harness did, in order: screen → fills → reviews → exit. */
  timeline: CaseTimelineEvent[];
  /** Market bid for the held outcome at each review — the price side of the chart. */
  marketCurve: Array<{ ts: string; price: number; agentProb: number | null }>;
}

const trim = (s: unknown, max: number): string => {
  const text = typeof s === "string" ? s.trim() : "";
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

interface DossierState {
  eventId?: string;
  framing?: { normalizedQuestion?: string; resolutionCriteria?: string };
  round?: number;
  status?: string;
  provider?: string;
  saturatedAt?: string | null;
  marketBlind?: { enabled?: boolean; blockedCount?: number; priorSuspect?: boolean };
  evidenceLedger?: unknown[];
  roundHistory?: Array<Record<string, unknown>>;
  summary?: Record<string, unknown> | null;
}

function readDossier(root: string, forecastId: string): DossierState | null {
  const file = path.join(root, "engine", "forecasts", forecastId, "state.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as DossierState;
  } catch {
    return null;
  }
}

function toSources(raw: unknown): CaseSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      const r = s as Record<string, unknown>;
      return {
        url: String(r.url ?? ""),
        title: trim(r.title, 160),
        deltaPp: num(r.deltaPp) ?? 0,
        explanation: trim(r.explanation, MAX_EXPLANATION_CHARS),
        verified: r.verified === true,
        kind: String(r.kind ?? "evidence"),
        sourceType: String(r.sourceType ?? ""),
        credibility: String(r.credibility ?? ""),
        excluded: typeof r.excluded === "string" ? r.excluded : null
      };
    })
    .filter((s) => s.url.length > 0)
    .sort((a, b) => Math.abs(b.deltaPp) - Math.abs(a.deltaPp))
    .slice(0, MAX_SOURCES_PER_ROUND);
}

function toRound(raw: Record<string, unknown>, anchor: CaseRound["anchor"]): CaseRound {
  const why = (raw.whyChanged ?? null) as Record<string, unknown> | null;
  const prior = num(raw.priorProb) ?? 0;
  const post = num(raw.postProb) ?? 0;
  return {
    round: num(raw.round) ?? 0,
    ts: String(raw.ts ?? ""),
    priorProb: round4(prior),
    postProb: round4(post),
    netPp: num(why?.netPp) ?? Math.round((post - prior) * 10000) / 100,
    upPp: num(why?.upPp),
    downPp: num(why?.downPp),
    dominantTitle: why?.dominantTitle ? trim(why.dominantTitle, 160) : null,
    dominantUrl: typeof why?.dominantUrl === "string" ? why.dominantUrl : null,
    newSourceCount: num(raw.newSourceCount) ?? 0,
    confidence: String(raw.confidence ?? ""),
    reasoning: trim(raw.reasoning, MAX_REASONING_CHARS),
    searchQueries: Array.isArray(raw.searchQueries)
      ? raw.searchQueries.filter((q): q is string => typeof q === "string").slice(0, 12)
      : [],
    sources: toSources(raw.perSourceUpdates),
    anchor
  };
}

/**
 * Rounds worth showing: the opening round, the closing round, and the biggest
 * movers in between. A 145-round dossier is mostly no-ops (the engine re-reads
 * a quiet market three times a day); the moves are where the decision was made.
 */
function selectRounds(history: Array<Record<string, unknown>>): CaseRound[] {
  if (history.length === 0) return [];
  const first = history[0];
  const last = history[history.length - 1];
  const anchors = new Set<number>();
  if (first) anchors.add(num(first.round) ?? 0);
  if (last) anchors.add(num(last.round) ?? 0);
  const movers = [...history]
    .filter((r) => !anchors.has(num(r.round) ?? -1))
    .sort((a, b) => {
      const moveOf = (x: Record<string, unknown>): number => {
        const why = (x.whyChanged ?? null) as Record<string, unknown> | null;
        const net = num(why?.netPp);
        if (net !== null) return Math.abs(net);
        return Math.abs((num(x.postProb) ?? 0) - (num(x.priorProb) ?? 0)) * 100;
      };
      return moveOf(b) - moveOf(a);
    })
    .slice(0, Math.max(0, MAX_KEY_ROUNDS - anchors.size));
  const picked = [
    ...(first ? [toRound(first, "first")] : []),
    ...movers.map((r) => toRound(r, null)),
    ...(last && last !== first ? [toRound(last, "last")] : [])
  ];
  return picked.sort((a, b) => a.round - b.round);
}

function buildTimeline(events: readonly PaperLedgerEvent[], positionId: string, slug: string): CaseTimelineEvent[] {
  const out: CaseTimelineEvent[] = [];
  for (const e of events) {
    const ts = String(e.ts ?? "");
    if (!ts) continue;
    const matchesPosition = e.positionId === positionId;
    const matchesSlug = e.slug === slug;
    if (e.type === "watchlist_eval" && matchesSlug) {
      out.push({
        ts,
        kind: e.enter === true ? "screen_enter" : "screen_pass",
        label: e.enter === true ? "选中建仓" : "扫描后放弃",
        detail: trim(e.detail, 200) || null,
        agentProb: num(e.probYes),
        marketPrice: num(e.marketProbYes),
        netEdgePp: num(e.edgePp)
      });
      continue;
    }
    if (!matchesPosition) continue;
    if (e.type === "trade") {
      const side = e.side === "buy" ? "买入" : "卖出";
      const style = e.style === "limit" ? "限价" : "市价";
      out.push({
        ts,
        kind: e.side === "buy" ? "buy" : "sell",
        label: `${style}${side} ${(num(e.shares) ?? 0).toFixed(1)} 股 @ ${(num(e.avgPrice) ?? 0).toFixed(3)}`,
        detail: e.reason ? String(e.reason) : null,
        agentProb: null,
        marketPrice: num(e.avgPrice),
        netEdgePp: num(e.edgePp)
      });
      continue;
    }
    if (e.type === "evaluation") {
      out.push({
        ts,
        kind: e.action === "sell" ? "review_sell" : "review_hold",
        label: e.action === "sell" ? "复审：卖出" : "复审：继续持有",
        detail: trim(e.detail, 200) || null,
        agentProb: num(e.agentProbOutcome),
        marketPrice: num(e.bestBid),
        netEdgePp: num(e.netEdgePp)
      });
      continue;
    }
    if (e.type === "stop_loss_tick" || e.type === "stop_loss_pre_eval") {
      out.push({
        ts,
        kind: "stop_loss",
        label: "触发止损",
        detail: `最优买价 ${String(e.bestBid ?? "—")}`,
        agentProb: null,
        marketPrice: num(e.bestBid),
        netEdgePp: null
      });
      continue;
    }
    if (e.type === "resolution") {
      out.push({
        ts,
        kind: "resolution",
        label: `市场结算：${e.kind === "won" ? "我方获胜" : e.kind === "lost" ? "我方判负" : "作废退款"}`,
        detail: null,
        agentProb: null,
        marketPrice: e.kind === "won" ? 1 : e.kind === "lost" ? 0 : 0.5,
        netEdgePp: null
      });
      continue;
    }
    if (e.type === "evaluation_error") {
      out.push({
        ts,
        kind: "error",
        label: "评估失败（安全默认持有）",
        detail: trim(e.error, 160) || null,
        agentProb: null,
        marketPrice: null,
        netEdgePp: null
      });
    }
  }
  const sorted = out.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  // Keep both ends when a long-held position has more reviews than the cap:
  // the opening decisions and the exit are what a reader came for.
  if (sorted.length <= MAX_TIMELINE_EVENTS) return sorted;
  const head = sorted.slice(0, Math.floor(MAX_TIMELINE_EVENTS / 2));
  const tail = sorted.slice(-Math.ceil(MAX_TIMELINE_EVENTS / 2));
  return [...head, ...tail];
}

function buildCase(
  episode: DecisionEpisode,
  bucket: PaperCase["bucket"],
  rank: number,
  events: readonly PaperLedgerEvent[],
  rootDir: string
): PaperCase {
  // The forecastId is recorded on the position's own evaluations — no need to
  // re-derive the engine's question hash (and no risk of drifting from it).
  const forecastId =
    events.find((e) => e.positionId === episode.positionId && typeof e.forecastId === "string")?.forecastId ??
    events.find((e) => e.slug === episode.slug && typeof e.forecastId === "string")?.forecastId ??
    null;
  const state = forecastId ? readDossier(rootDir, forecastId) : null;
  const summary = (state?.summary ?? null) as Record<string, unknown> | null;
  const history = Array.isArray(state?.roundHistory) ? state.roundHistory : [];
  const beliefAll = history.flatMap((r) => {
    const prob = num(r.postProb);
    return prob === null ? [] : [{ round: num(r.round) ?? 0, ts: String(r.ts ?? ""), prob: round4(prob) }];
  });
  // Long dossiers get evenly thinned rather than truncated, so the curve keeps
  // its shape (and its endpoints) instead of stopping halfway.
  const stride = Math.ceil(beliefAll.length / MAX_BELIEF_POINTS);
  const beliefCurve =
    stride > 1
      ? beliefAll.filter((_, i) => i % stride === 0 || i === beliefAll.length - 1)
      : beliefAll;

  const timeline = buildTimeline(events, episode.positionId, episode.slug);
  const marketCurve = events.flatMap((e) => {
    if (e.type !== "evaluation" || e.positionId !== episode.positionId) return [];
    const price = num(e.bestBid);
    return price === null ? [] : [{ ts: String(e.ts ?? ""), price, agentProb: num(e.agentProbOutcome) }];
  });

  return {
    rank,
    bucket,
    positionId: episode.positionId,
    slug: episode.slug,
    question: episode.question,
    side: episode.side,
    status: episode.status,
    openedUtc: episode.openedUtc,
    closedUtc: episode.closedUtc,
    pnlUsd: episode.pnlUsd,
    entryAlphaUsd: episode.entryAlphaUsd,
    exitAlphaUsd: episode.exitAlphaUsd,
    entryPrice: episode.entryPrice,
    exitPrice: episode.exitPrice,
    benchmarkPrice: episode.benchmarkPrice,
    benchmarkSource: episode.benchmarkSource,
    shares: episode.shares,
    entryEdgePp: episode.entryEdgePp,
    exitReason: episode.exitReason,
    dossier:
      state && forecastId
        ? {
            forecastId,
            normalizedQuestion: state.framing?.normalizedQuestion
              ? trim(state.framing.normalizedQuestion, 400)
              : null,
            resolutionCriteria: state.framing?.resolutionCriteria
              ? trim(state.framing.resolutionCriteria, 700)
              : null,
            rounds: num(state.round) ?? history.length,
            evidenceCount: Array.isArray(state.evidenceLedger) ? state.evidenceLedger.length : 0,
            status: String(state.status ?? ""),
            saturatedAt: typeof state.saturatedAt === "string" ? state.saturatedAt : null,
            marketBlind: state.marketBlind
              ? {
                  enabled: state.marketBlind.enabled === true,
                  blockedCount: num(state.marketBlind.blockedCount) ?? 0,
                  priorSuspect: state.marketBlind.priorSuspect === true
                }
              : null,
            provider: typeof state.provider === "string" ? state.provider : null,
            verdict: summary ? trim(summary.verdict, MAX_VERDICT_CHARS) || null : null,
            whySentence: summary ? trim(summary.whySentence, 300) || null : null,
            keyFactorsYes: Array.isArray(summary?.keyFactorsYes)
              ? summary.keyFactorsYes.filter((x): x is string => typeof x === "string").slice(0, 6)
              : [],
            keyFactorsNo: Array.isArray(summary?.keyFactorsNo)
              ? summary.keyFactorsNo.filter((x): x is string => typeof x === "string").slice(0, 6)
              : [],
            mainUncertainties: summary ? trim(summary.mainUncertainties, 600) || null : null,
            beliefCurve,
            keyRounds: selectRounds(history)
          }
        : null,
    timeline,
    marketCurve
  };
}

export interface PaperCasesPayload {
  generatedAtUtc: string;
  /** How many of each bucket were requested. */
  perBucket: number;
  winners: PaperCase[];
  losers: PaperCase[];
}

/**
 * Pick the extremes by realised+unrealised PnL. Open positions are eligible —
 * the book's best call is currently an open one, and excluding it would repeat
 * exactly the survivorship problem the calibration section warns about.
 */
export function buildPaperCases(
  episodes: readonly DecisionEpisode[],
  events: readonly PaperLedgerEvent[],
  rootDir: string,
  perBucket = 2,
  nowIso: string = new Date().toISOString()
): PaperCasesPayload {
  const ranked = episodes
    .filter((e) => e.pnlUsd !== null)
    .sort((a, b) => (b.pnlUsd ?? 0) - (a.pnlUsd ?? 0));
  const winners = ranked.slice(0, perBucket).map((e, i) => buildCase(e, "winner", i + 1, events, rootDir));
  const losers = ranked
    .slice(-perBucket)
    .reverse()
    .map((e, i) => buildCase(e, "loser", i + 1, events, rootDir));
  return { generatedAtUtc: nowIso, perBucket, winners, losers };
}
