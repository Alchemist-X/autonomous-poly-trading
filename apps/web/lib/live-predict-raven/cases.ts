// Case walk-throughs for /live-predict-raven: the VM's /paper/cases endpoint,
// which pairs the book's biggest winners and losers with the engine dossier
// behind them (research rounds, sources, the final synthesis) and the decision
// timeline the harness recorded.
//
// Same failure policy as live.ts: any failure returns null and the page simply
// omits the section — there is no baked fallback for case data, because a
// stale walk-through would misrepresent decisions the agent has since revised.

import { zhQuestion } from "./labels";

const DEFAULT_UPSTREAM = "http://34.85.97.32:8787";
const FETCH_TIMEOUT_MS = 8000;
const SUCCESS_TTL_MS = 60_000;
const FAILURE_BACKOFF_MS = 60_000;

export interface CaseSource {
  url: string;
  title: string;
  deltaPp: number;
  explanation: string;
  verified: boolean;
  kind: string;
  sourceType: string;
  credibility: string;
  excluded: string | null;
}

export interface CaseRound {
  round: number;
  ts: string;
  priorProb: number;
  postProb: number;
  netPp: number;
  dominantTitle: string | null;
  dominantUrl: string | null;
  newSourceCount: number;
  confidence: string;
  reasoning: string;
  searchQueries: readonly string[];
  sources: readonly CaseSource[];
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

export interface CaseDossier {
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
  keyFactorsYes: readonly string[];
  keyFactorsNo: readonly string[];
  mainUncertainties: string | null;
  beliefCurve: ReadonlyArray<{ round: number; ts: string; prob: number }>;
  keyRounds: readonly CaseRound[];
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
  dossier: CaseDossier | null;
  timeline: readonly CaseTimelineEvent[];
  marketCurve: ReadonlyArray<{ ts: string; price: number; agentProb: number | null }>;
}

export interface PaperCases {
  generatedAtUtc: string;
  winners: readonly PaperCase[];
  losers: readonly PaperCase[];
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strList = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : [];

function parseSources(raw: unknown): CaseSource[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((s) => {
    if (!isRec(s)) return [];
    const url = str(s.url);
    if (!url) return [];
    return [
      {
        url,
        title: str(s.title),
        deltaPp: num(s.deltaPp) ?? 0,
        explanation: str(s.explanation),
        verified: s.verified === true,
        kind: str(s.kind),
        sourceType: str(s.sourceType),
        credibility: str(s.credibility),
        excluded: typeof s.excluded === "string" ? s.excluded : null
      }
    ];
  });
}

function parseRounds(raw: unknown): CaseRound[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    if (!isRec(r)) return [];
    const round = num(r.round);
    if (round === null) return [];
    return [
      {
        round,
        ts: str(r.ts),
        priorProb: num(r.priorProb) ?? 0,
        postProb: num(r.postProb) ?? 0,
        netPp: num(r.netPp) ?? 0,
        dominantTitle: typeof r.dominantTitle === "string" ? r.dominantTitle : null,
        dominantUrl: typeof r.dominantUrl === "string" ? r.dominantUrl : null,
        newSourceCount: num(r.newSourceCount) ?? 0,
        confidence: str(r.confidence),
        reasoning: str(r.reasoning),
        searchQueries: strList(r.searchQueries, 12),
        sources: parseSources(r.sources),
        anchor: r.anchor === "first" || r.anchor === "last" ? r.anchor : null
      }
    ];
  });
}

function parseDossier(raw: unknown): CaseDossier | null {
  if (!isRec(raw)) return null;
  const forecastId = str(raw.forecastId);
  if (!forecastId) return null;
  const blind = isRec(raw.marketBlind) ? raw.marketBlind : null;
  return {
    forecastId,
    normalizedQuestion: typeof raw.normalizedQuestion === "string" ? raw.normalizedQuestion : null,
    resolutionCriteria: typeof raw.resolutionCriteria === "string" ? raw.resolutionCriteria : null,
    rounds: num(raw.rounds) ?? 0,
    evidenceCount: num(raw.evidenceCount) ?? 0,
    status: str(raw.status),
    saturatedAt: typeof raw.saturatedAt === "string" ? raw.saturatedAt : null,
    marketBlind: blind
      ? {
          enabled: blind.enabled === true,
          blockedCount: num(blind.blockedCount) ?? 0,
          priorSuspect: blind.priorSuspect === true
        }
      : null,
    provider: typeof raw.provider === "string" ? raw.provider : null,
    verdict: typeof raw.verdict === "string" ? raw.verdict : null,
    whySentence: typeof raw.whySentence === "string" ? raw.whySentence : null,
    keyFactorsYes: strList(raw.keyFactorsYes, 6),
    keyFactorsNo: strList(raw.keyFactorsNo, 6),
    mainUncertainties: typeof raw.mainUncertainties === "string" ? raw.mainUncertainties : null,
    beliefCurve: Array.isArray(raw.beliefCurve)
      ? raw.beliefCurve.flatMap((p) => {
          if (!isRec(p)) return [];
          const prob = num(p.prob);
          return prob === null ? [] : [{ round: num(p.round) ?? 0, ts: str(p.ts), prob }];
        })
      : [],
    keyRounds: parseRounds(raw.keyRounds)
  };
}

function parseCase(raw: unknown): PaperCase | null {
  if (!isRec(raw)) return null;
  const slug = str(raw.slug);
  const shares = num(raw.shares);
  const entryPrice = num(raw.entryPrice);
  if (!slug || shares === null || entryPrice === null) return null;
  return {
    rank: num(raw.rank) ?? 0,
    bucket: raw.bucket === "loser" ? "loser" : "winner",
    positionId: str(raw.positionId),
    slug,
    question: zhQuestion(slug, str(raw.question)),
    side: str(raw.side).toUpperCase(),
    status: raw.status === "open" ? "open" : "closed",
    openedUtc: str(raw.openedUtc),
    closedUtc: typeof raw.closedUtc === "string" ? raw.closedUtc : null,
    pnlUsd: num(raw.pnlUsd),
    entryAlphaUsd: num(raw.entryAlphaUsd),
    exitAlphaUsd: num(raw.exitAlphaUsd),
    entryPrice,
    exitPrice: num(raw.exitPrice),
    benchmarkPrice: num(raw.benchmarkPrice),
    benchmarkSource: str(raw.benchmarkSource),
    shares,
    entryEdgePp: num(raw.entryEdgePp),
    exitReason: typeof raw.exitReason === "string" ? raw.exitReason : null,
    dossier: parseDossier(raw.dossier),
    timeline: Array.isArray(raw.timeline)
      ? raw.timeline.flatMap((t) => {
          if (!isRec(t)) return [];
          const ts = str(t.ts);
          return ts
            ? [
                {
                  ts,
                  kind: str(t.kind),
                  label: str(t.label),
                  detail: typeof t.detail === "string" ? t.detail : null,
                  agentProb: num(t.agentProb),
                  marketPrice: num(t.marketPrice),
                  netEdgePp: num(t.netEdgePp)
                }
              ]
            : [];
        })
      : [],
    marketCurve: Array.isArray(raw.marketCurve)
      ? raw.marketCurve.flatMap((p) => {
          if (!isRec(p)) return [];
          const price = num(p.price);
          return price === null ? [] : [{ ts: str(p.ts), price, agentProb: num(p.agentProb) }];
        })
      : []
  };
}

export function parseCasesPayload(json: unknown): PaperCases | null {
  if (!isRec(json)) return null;
  const winners = Array.isArray(json.winners) ? json.winners.flatMap((c) => parseCase(c) ?? []) : [];
  const losers = Array.isArray(json.losers) ? json.losers.flatMap((c) => parseCase(c) ?? []) : [];
  if (winners.length === 0 && losers.length === 0) return null;
  return { generatedAtUtc: str(json.generatedAtUtc), winners, losers };
}

function upstreamUrl(): string {
  const base = process.env.LIVE_PREDICT_RAVEN_UPSTREAM?.trim() || DEFAULT_UPSTREAM;
  return `${base.replace(/\/+$/, "")}/paper/cases`;
}

// SECURITY: same wire as live.ts — plain HTTP to a bare-IP VM. Only the invite
// code may travel it, never FORECAST_API_TOKEN / RAVEN_ACCESS_TOKEN.
function upstreamToken(): string {
  return process.env.LIVE_PREDICT_RAVEN_UPSTREAM_TOKEN?.trim() || "raven-labs";
}

let successMemo: { at: number; cases: PaperCases } | null = null;
let lastFailureAt = 0;

export async function fetchPaperCases(nowMs: number = Date.now()): Promise<PaperCases | null> {
  if (successMemo && nowMs - successMemo.at < SUCCESS_TTL_MS) return successMemo.cases;
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
    const cases = parseCasesPayload(await res.json());
    if (cases) {
      successMemo = { at: nowMs, cases };
    } else {
      lastFailureAt = nowMs;
    }
    return cases;
  } catch {
    lastFailureAt = nowMs;
    return null;
  }
}
