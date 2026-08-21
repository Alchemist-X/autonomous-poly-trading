// M2 — impact analysis (the "analyst"). PRD §6.
//
// Discipline: the valuation is BLIND to the post-t0 price reaction —
// otherwise the priced-in comparison in M3 is circular. Blindness here is
// text-level (prediction-market-style domain blocklists don't transfer to
// equities): ① scrub price-reaction phrases from the input, ② prompt ban,
// ③ contamination detector on the output (hard → veto in M3, soft →
// flagged). Contamination RATE is a Phase 0 calibration metric.

import { z } from "zod";
import { tradeThesisSchema, type NewsItem, type NewsSignal, type TradeThesis, type UniverseEntry } from "@autopoly/delta-pm-contracts";
import { callJson, type ProviderResult } from "./providers.js";

// Strip sentences that describe the market's reaction to the news (post-t0
// price/volume language). Conservative: only removes clauses that couple a
// price-move verb with shares/stock/% patterns.
const REACTION_PATTERNS = [
  /[^.。!?]*\b(shares?|stock|the name|株|股价|股價)\b[^.。!?]{0,120}\b(jump|surg|fell|fall|drop|plung|rall|ros[e]|climb|slid|sank|tumbl|gain|los[te])\w*[^.。!?]{0,60}[.。!?]/gi,
  /[^.。!?]*\b(up|down)\s+\d+(?:\.\d+)?%[^.。!?]*[.。!?]/gi,
  /[^.。!?]*\b(premarket|after-?hours|盘前|盘后)\b[^.。!?]{0,80}\d+(?:\.\d+)?%[^.。!?]*[.。!?]/gi
];

export function scrubPriceReactions(text: string): { scrubbed: string; removed: number } {
  let removed = 0;
  let scrubbed = text;
  for (const re of REACTION_PATTERNS) {
    scrubbed = scrubbed.replace(re, () => {
      removed++;
      return " [price-reaction sentence removed] ";
    });
  }
  return { scrubbed: scrubbed.replace(/\s{2,}/g, " ").trim(), removed };
}

// Output-side contamination detector: did the analyst anchor on the
// realized reaction anyway?
const HARD_CONTAMINATION = /\b(already (moved|priced|up|down)|current price reaction|since the news broke.*%|股价已(经)?(上涨|下跌))/i;
const SOFT_CONTAMINATION = /\b(market has|price action|the move|盘面反应)\b/i;

export function detectContamination(thesisText: string): "none" | "soft" | "hard" {
  if (HARD_CONTAMINATION.test(thesisText)) return "hard";
  if (SOFT_CONTAMINATION.test(thesisText)) return "soft";
  return "none";
}

const m2OutputSchema = tradeThesisSchema
  .omit({ id: true, signalId: true, createdAtUtc: true, provider: true, contamination: true, tradeType: true })
  .extend({
    // The model self-reports whether it could avoid reaction anchoring.
    selfReportedBlind: z.boolean()
  });
export type M2Output = z.infer<typeof m2OutputSchema>;

const M2_SYSTEM = `You are a fundamental equity analyst producing a price-reaction-BLIND fair-impact estimate for ONE news item on ONE stock.
HARD RULES:
- You know the pre-news baseline (market cap, forward P/E, consensus) but you must NOT use, estimate, or reference how the stock price has reacted since the news. If the input text mentions a reaction, ignore it. Set selfReportedBlind=false if you could not.
- Chain (show each step in impactPath, quantified with assumptions): news → affected line items (revenue/margin/opex/share count) → next-FY EPS revision % RELATIVE TO CONSENSUS → fair price move % (unchanged multiple ≈ EPS revision %; only re-rate the multiple when the news changes growth/risk perception, and say so). One-off items (fines/settlements/asset sales): fair move ≈ after-tax NPV / market cap.
- For a pre-IPO perp (no EPS): fair move ≈ event's valuation delta / last-round valuation.
- fairImpactPct is the EXCESS move vs the sector benchmark the news alone justifies: min = conservative, point = base case, max = aggressive. Direction long/short must be consistent with the sign of point.
- falsifiers: at least one condition checkable within a week from public information, price-independent.
- horizonHours: when the market should have fully digested this (event trades: hours to 2 weeks max).
- confidence: high only when the causal chain is direct and quantifiable.
Return ONLY JSON matching the schema in the user message.`;

function m2Rules(signal: NewsSignal, ticker: string): M2Output {
  // No-LLM fallback produces a deliberately unusable thesis (confidence low,
  // tiny band) — M3's entry threshold will reject it; the pipeline stays
  // alive and the degradation is visible.
  const dir = signal.expectedDirection === "bearish" ? "short" : "long";
  return {
    ticker,
    direction: dir,
    fairImpactPct: dir === "short" ? { min: -1, max: -0.2, point: -0.5 } : { min: 0.2, max: 1, point: 0.5 },
    impactPath: [{ step: "rules fallback — no analyst model available", value: "band placeholder from coarse impact band floor" }],
    evidence: [],
    horizonHours: 48,
    catalysts: [],
    falsifiers: ["rules fallback thesis — must not trade"],
    limitations: ["produced by rules fallback; entry threshold will reject"],
    confidence: "low",
    selfReportedBlind: true
  };
}

export interface M2Result {
  thesis: TradeThesis;
  provider: ProviderResult<M2Output>;
  scrubbedSentences: number;
}

export async function runM2(item: NewsItem, signal: NewsSignal, entry: UniverseEntry, ticker: string): Promise<M2Result> {
  const body = item.fullText ?? item.teaser ?? "";
  const { scrubbed, removed } = scrubPriceReactions(`${item.title}\n${body}`);
  const user = `Stock: ${ticker} (${entry.company}${entry.preIpo ? ", PRE-IPO perp — no EPS chain, use valuation-delta arithmetic" : ""})
Sector tags: ${entry.tags.join(", ")}
Consensus baseline: ${entry.consensusBaseline ? `${entry.consensusBaseline.text} (as of ${entry.consensusBaseline.asOfUtc})` : "MISSING — state assumptions explicitly"}
News published: ${item.publishedUtc} (event type: ${signal.materiality.eventType}; surprise: ${signal.materiality.surpriseNote})
News text (price-reaction sentences pre-removed):
${scrubbed}

Schema: {"ticker":"${ticker}","direction":"long|short","fairImpactPct":{"min":n,"max":n,"point":n},"impactPath":[{"step":"...","value":"..."}],"evidence":[{"point":"...","source":"...","url":null,"credibility":"high|medium|low"}],"horizonHours":n,"catalysts":["..."],"falsifiers":["..."],"limitations":["..."],"confidence":"high|medium|low","selfReportedBlind":bool}`;

  const provider = await callJson(M2_SYSTEM, user, m2OutputSchema, () => m2Rules(signal, ticker));
  const out = provider.value as M2Output;

  const allText = JSON.stringify(out.impactPath) + JSON.stringify(out.evidence) + out.limitations.join(" ");
  let contamination = detectContamination(allText);
  if (!out.selfReportedBlind && contamination === "none") contamination = "soft";

  const thesis: TradeThesis = {
    id: `th-${signal.fingerprint}-${ticker}-${Date.now().toString(36)}`,
    signalId: signal.id,
    ticker,
    direction: out.direction,
    tradeType: "event",
    fairImpactPct: out.fairImpactPct,
    impactPath: out.impactPath,
    evidence: out.evidence,
    contamination,
    horizonHours: out.horizonHours,
    catalysts: out.catalysts,
    falsifiers: out.falsifiers,
    limitations: out.limitations,
    confidence: out.confidence,
    provider: provider.engine,
    createdAtUtc: new Date().toISOString()
  };
  return { thesis, provider, scrubbedSentences: removed };
}
