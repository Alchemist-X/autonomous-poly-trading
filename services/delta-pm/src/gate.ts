// M1 — materiality gate (gate 1) + priced-in classification (gate 2).
// PRD §5. Category-first, never sentiment-first; priced-in compares the
// realized excess move at t_eval against an event-class reaction-fraction
// curve, normalized by elapsed time Δt (this is what reconciles a 2h
// reaction window with a ~15min decision budget).

import { createHash } from "node:crypto";
import { z } from "zod";
import {
  IMPACT_BAND_PCT,
  materialitySchema,
  type Materiality,
  type NewsItem,
  type NewsSignal,
  type PricedIn,
  type UniverseEntry
} from "@autopoly/delta-pm-contracts";
import { config } from "./config.js";
import { candles1m, computeExcessMove, computeVolumeZ, sessionBucketOf, type BetaResult } from "./m0.js";
import { read1mRange } from "./market.js";
import { callJson, type ProviderResult } from "./providers.js";

// --- universe matching (rules prefilter) -----------------------------------

export function matchUniverse(item: NewsItem, universe: UniverseEntry[]): UniverseEntry[] {
  const text = `${item.title}\n${item.teaser}`.toLowerCase();
  const hits: UniverseEntry[] = [];
  for (const entry of universe) {
    const names = [entry.ticker.toLowerCase(), entry.company.toLowerCase(), ...entry.aliases.map((a) => a.toLowerCase())];
    if (names.some((n) => (/^[a-z0-9 .\-]+$/.test(n) ? new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(text) : text.includes(n)))) {
      hits.push(entry);
    }
  }
  return hits;
}

// --- gate 1: LLM judgment with rules fallback ------------------------------

const gate1OutputSchema = z.object({
  tradeable: z.boolean(),
  score: z.number().min(0).max(100),
  eventType: materialitySchema.shape.eventType,
  factLevel: z.enum(["fact", "forecast", "opinion"]),
  tickers: z.array(z.string()).max(3),
  expectedDirection: z.enum(["bullish", "bearish", "mixed"]),
  coarseImpactBand: z.enum(["small", "medium", "large"]),
  surpriseNote: z.string().min(1),
  reason: z.string().min(1),
  fingerprintEntities: z.array(z.string()).min(1).max(6),
  fingerprintMagnitudes: z.array(z.string()).max(6)
});
export type Gate1Output = z.infer<typeof gate1OutputSchema>;

const GATE1_SYSTEM = `You are the materiality gate of an event-driven US-equity trading desk. Judge ONE news item. Category first, sentiment never:
1) tradeable event categories: earnings_guidance, order_contract, mna, product_tech, regulatory_legal, management, supply_chain, macro_direct. Ratings/price-target chatter and pure opinion are NOT tradeable alone.
2) factLevel: fact > forecast > opinion. Opinion is never tradeable.
3) tickers: ONLY symbols from the provided universe where the company is a headline actor of this news (max 3). Empty list if none.
4) surprise: score what is BEYOND the provided consensus baseline (or state "baseline missing" and judge novelty conservatively). Never score the absolute size of a number.
5) coarseImpactBand: |excess move| the news could justify — small 0.5-2%, medium 2-6%, large 6-20%.
6) fingerprintEntities/Magnitudes: canonical entities (companies/products/people) and key magnitudes ("$6B", "20% capacity cut") for repeat-detection hashing.
Return ONLY JSON matching the schema described by the user message.`;

function gate1Rules(item: NewsItem, matched: UniverseEntry[]): Gate1Output {
  // Deliberately conservative: without an LLM the gate only lets through
  // clearly-typed hard-news patterns; everything else is archived.
  const text = `${item.title} ${item.teaser}`.toLowerCase();
  const typed: Array<[Gate1Output["eventType"], RegExp]> = [
    ["earnings_guidance", /\b(earnings|guidance|revenue|eps|forecast(s)? (raised|cut)|quarterly)\b/],
    ["mna", /\b(acquire|acquisition|merger|buyout|takeover|to buy)\b/],
    ["order_contract", /\b(order|contract|deal|agreement|to pay|supply deal|purchase)\b/],
    ["regulatory_legal", /\b(antitrust|lawsuit|regulator|ban|export control|tariff|probe|investigation)\b/],
    ["management", /\b(ceo|cfo|resign|appoint|step(s)? down)\b/],
    ["supply_chain", /\b(supply|capacity|shortage|production (cut|halt)|fab)\b/],
    ["product_tech", /\b(launch|unveil|chip|model|product|release)\b/]
  ];
  const hit = typed.find(([, re]) => re.test(text));
  const bearishHit = /\b(cut|halt|ban|lawsuit|probe|shortage|delay|recall|down|miss)\b/.test(text);
  return {
    tradeable: Boolean(hit && matched.length > 0),
    score: hit && matched.length ? 55 : 10,
    eventType: hit?.[0] ?? "other",
    factLevel: /\b(reportedly|rumor|may|could|considering)\b/.test(text) ? "forecast" : "fact",
    tickers: matched.slice(0, 3).map((m) => m.ticker),
    expectedDirection: bearishHit ? "bearish" : "bullish",
    coarseImpactBand: "small",
    surpriseNote: "rules fallback: no consensus comparison performed",
    reason: hit ? `rules fallback matched category ${hit[0]}` : "rules fallback: no tradeable category pattern",
    fingerprintEntities: matched.length ? matched.map((m) => m.ticker) : ["unmatched"],
    fingerprintMagnitudes: (item.title.match(/\$?\d+(?:\.\d+)?\s*(?:%|billion|million|b\b|m\b)/gi) ?? []).slice(0, 6)
  };
}

export async function runGate1(item: NewsItem, universe: UniverseEntry[]): Promise<ProviderResult<Gate1Output>> {
  const matched = matchUniverse(item, universe);
  if (!matched.length) {
    // No universe entity — archive without spending an LLM call.
    return { value: { ...gate1Rules(item, []), tradeable: false, reason: "no universe ticker matched" }, engine: "rules", fallbackReason: null };
  }
  const baselines = matched
    .map((m) => `${m.ticker}: ${m.consensusBaseline ? `${m.consensusBaseline.text} (as of ${m.consensusBaseline.asOfUtc})` : "baseline missing"}`)
    .join("\n");
  const user = `News (source ${item.source}, kind ${item.kind}, published ${item.publishedUtc}, title prefix ${item.prefix}):
TITLE: ${item.title}
BODY: ${item.fullText ?? item.teaser ?? "(no body — headline only)"}

Universe candidates and consensus baselines:
${baselines}

Schema: {"tradeable":bool,"score":0-100,"eventType":"earnings_guidance|order_contract|mna|product_tech|regulatory_legal|management|supply_chain|macro_direct|other","factLevel":"fact|forecast|opinion","tickers":["..."],"expectedDirection":"bullish|bearish|mixed","coarseImpactBand":"small|medium|large","surpriseNote":"...","reason":"...","fingerprintEntities":["..."],"fingerprintMagnitudes":["..."]}`;
  const result = await callJson(GATE1_SYSTEM, user, gate1OutputSchema, () => gate1Rules(item, matched));
  if (result.value) {
    // Harness never trusts model ticker claims: intersect with actual matches.
    const allowed = new Set(matched.map((m) => m.ticker));
    result.value.tickers = result.value.tickers.filter((t) => allowed.has(t.toUpperCase())).map((t) => t.toUpperCase());
    if (!result.value.tickers.length) result.value.tradeable = false;
  }
  return result;
}

// --- fingerprint + staleness ----------------------------------------------

export function fingerprintOf(g: Gate1Output): string {
  const canonical = [
    [...g.fingerprintEntities].map((e) => e.toLowerCase().trim()).sort().join("|"),
    g.eventType,
    [...g.fingerprintMagnitudes].map((m) => m.toLowerCase().replace(/\s+/g, "")).sort().join("|")
  ].join("::");
  return createHash("sha1").update(canonical).digest("hex").slice(0, 16);
}

export function tokenJaccard(a: string, b: string): number {
  const tok = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9一-鿿]{2,}/g) ?? []);
  const ta = tok(a);
  const tb = tok(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

// --- gate 2: priced-in classification --------------------------------------

// Reaction-fraction priors by event class: what share of the ultimate
// reaction is typically realized Δt minutes after t0. Coarse cold-start
// values; Phase 0 calibrates from our own logged (Δt, realized) pairs.
const FAST_TYPES = new Set(["earnings_guidance", "mna"]);

export function reactionFraction(eventType: Materiality["eventType"], deltaTMinutes: number): number {
  const horizon = FAST_TYPES.has(eventType) ? 30 : 240; // minutes to ~full pricing
  return Math.min(1, Math.max(0.05, deltaTMinutes / horizon));
}

export interface Gate2Inputs {
  entry: UniverseEntry;
  benchmark1h: import("./hyperliquid.js").Candle[] | null;
  beta: BetaResult | null;
  dailyVolPct: number; // e.g. 0.02
  t0Ms: number;
  nowMs: number;
  expectedDirection: "bullish" | "bearish" | "mixed";
  coarseImpactBand: "small" | "medium" | "large";
  eventType: Materiality["eventType"];
}

export async function classifyPricedIn(inp: Gate2Inputs): Promise<PricedIn> {
  const { entry, t0Ms, nowMs } = inp;
  const coin = entry.hlSymbol;
  const deltaTMinutes = Math.max(0, (nowMs - t0Ms) / 60_000);
  const bucket = sessionBucketOf(nowMs);
  const benchName = entry.benchmark ?? "none";

  const asset = await candles1m(coin, t0Ms - 30 * 60_000, nowMs);
  const bench =
    entry.benchmark && inp.benchmark1h
      ? inp.benchmark1h.filter((c) => c.t >= t0Ms - 2 * 3600_000 && c.t <= nowMs)
      : null;
  // For β-adjustment inside short windows we need minute closeness on the
  // benchmark too; fetch benchmark 1m only when an asset series exists.
  let benchmark1m: import("./hyperliquid.js").Candle[] | null = null;
  if (entry.benchmark && asset.length) {
    benchmark1m = await candles1m(`${coin.split(":")[0]}:${entry.benchmark}`, t0Ms - 30 * 60_000, nowMs);
  }
  void bench;

  const beta = entry.benchmark === null ? 0 : inp.beta?.quality === "ok" ? inp.beta.beta : inp.beta?.quality === "weak_fit" ? inp.beta.beta : 1;
  const realized = asset.length
    ? computeExcessMove(asset, entry.benchmark ? benchmark1m : null, beta, t0Ms, nowMs)
    : null;

  if (realized === null) {
    return {
      status: "awaiting_market",
      tEvalUtc: new Date(nowMs).toISOString(),
      deltaTMinutes,
      realizedExcessPct: null,
      volumeZ: null,
      dataBasis: "hl_perp",
      sessionBucket: bucket,
      benchmarkUsed: benchName,
      betaUsed: null,
      confidence: "low",
      note: "no usable price series around t0 yet; re-evaluate at first classifiable moment"
    };
  }

  // Volume z from the archive (needs ≥5 same-bucket baseline days; null while young).
  const baselineDays: import("./hyperliquid.js").Candle[][] = [];
  for (let d = 1; d <= 30 && baselineDays.length < 15; d++) {
    const dayStart = t0Ms - d * 86_400_000;
    const cs = read1mRange(coin, dayStart - (dayStart % 86_400_000), dayStart - (dayStart % 86_400_000) + 86_399_000);
    if (cs.length) baselineDays.push(cs);
  }
  const volumeZ = computeVolumeZ(asset, baselineDays, t0Ms, nowMs);

  const dirSign = inp.expectedDirection === "bearish" ? -1 : 1;
  const signedRealized = realized * dirSign; // >0 = moved with the news
  const band = IMPACT_BAND_PCT[inp.coarseImpactBand];
  const bandMid = ((band.min + band.max) / 2) / 100;
  const expectedNow = bandMid * reactionFraction(inp.eventType, deltaTMinutes);

  // Leak check: excess drift over the 5 trading days BEFORE t0.
  const pre = await candles1m(coin, t0Ms - 30 * 60_000, t0Ms); // minute t0 anchor
  let leaked = false;
  if (pre.length) {
    const preStart = t0Ms - 5 * 86_400_000;
    const preSeries = await candles1m(coin, preStart - 30 * 60_000, t0Ms);
    const preBench = entry.benchmark ? await candles1m(`${coin.split(":")[0]}:${entry.benchmark}`, preStart - 30 * 60_000, t0Ms) : null;
    const preDrift = preSeries.length ? computeExcessMove(preSeries, preBench, beta, preStart, t0Ms) : null;
    if (preDrift !== null && inp.expectedDirection !== "mixed" && preDrift * dirSign >= 1.5 * inp.dailyVolPct) leaked = true;
  }

  let status: PricedIn["status"];
  if (inp.expectedDirection !== "mixed" && signedRealized <= -inp.dailyVolPct * config.adverseDriftVolFraction) {
    status = "reverse";
  } else if (Math.abs(realized) >= 0.9 * bandMid) {
    status = "full";
  } else if (leaked) {
    status = "leaked";
  } else if (Math.abs(realized) >= 0.7 * expectedNow) {
    status = "partial";
  } else {
    status = "none";
  }

  let confidence: PricedIn["confidence"] = bucket === "rth" ? "high" : bucket === "offhours" ? "medium" : "low";
  if (inp.beta && inp.beta.quality !== "ok" && entry.benchmark !== null && confidence !== "low") {
    confidence = confidence === "high" ? "medium" : "low";
  }

  return {
    status,
    tEvalUtc: new Date(nowMs).toISOString(),
    deltaTMinutes,
    realizedExcessPct: realized * 100,
    volumeZ,
    dataBasis: "hl_perp",
    sessionBucket: bucket,
    benchmarkUsed: benchName,
    betaUsed: entry.benchmark === null ? null : beta,
    confidence,
    note:
      `realized ${(realized * 100).toFixed(2)}% vs band-mid ${(bandMid * 100).toFixed(1)}% ` +
      `(expected-by-now ${(expectedNow * 100).toFixed(2)}% at Δt=${deltaTMinutes.toFixed(0)}min` +
      `${inp.beta && inp.beta.quality !== "ok" ? `; β ${inp.beta.quality}` : ""}` +
      `${volumeZ === null ? "; volume baseline too young" : `; volZ ${volumeZ.toFixed(1)}`}` +
      `${leaked ? "; pre-t0 drift → leak suspected" : ""})`
  };
}

// --- signal assembly -------------------------------------------------------

export function buildSignal(
  item: NewsItem,
  gate1: Gate1Output,
  fingerprint: string,
  pricedIn: PricedIn | null,
  baselineAsOf: string | null
): NewsSignal {
  return {
    id: `sig-${fingerprint}-${Date.now().toString(36)}`,
    newsId: item.id,
    fingerprint,
    // "Reportedly" items restate another outlet — published is NOT first-seen.
    firstSeenUtc: item.prefix === "reportedly" ? null : item.publishedUtc,
    firstSeenBasis:
      item.prefix === "reportedly"
        ? "aggregated report ('Reportedly'): original ran earlier elsewhere; t0 uses published as an upper bound (Phase 0 simplification — online first-seen verification arrives with the claude-cli engine)"
        : `The Information ${item.prefix === "exclusive" ? "exclusive" : "item"} — published timestamp equals first public appearance (feed <published> verified against sitemap publication_date)`,
    expectedDirection: gate1.expectedDirection,
    coarseImpactBand: gate1.coarseImpactBand,
    consensusBaselineAsOf: baselineAsOf,
    materiality: {
      tradeable: gate1.tradeable,
      score: gate1.score,
      eventType: gate1.eventType,
      factLevel: gate1.factLevel,
      tickers: gate1.tickers,
      surpriseNote: gate1.surpriseNote,
      reason: gate1.reason
    },
    pricedIn,
    createdAtUtc: new Date().toISOString()
  };
}
