// Prompt for the LLM engines. Philosophy: the prompt GUIDES the analyst's
// thinking; the machine contract is enforced by zod in provider.ts — so this
// text avoids over-constraining the reasoning and instead states the desk
// context, the increment-first doctrine, and the output surface.

import type { NewsInput } from "./schema";
import { universePromptTable, getUniverse } from "./universe";

const OUTPUT_SPEC = `Return EXACTLY ONE JSON object (no markdown fences, no prose outside it) with this shape:
{
  "attention": {
    "worthAttention": boolean,        // should a US-equity desk act on this NOW?
    "score": number,                  // 0-100 attention score
    "verdict": string,                // one or two sentences: why it is / is not worth attention
    "newsType": string,               // short catalyst class, e.g. "AI capex", "antitrust", "rates", "M&A"
    "credibilityNote": string         // read on the source's credibility and confirmation status
  },
  "marketReadout": string,            // the mechanism: what this news CHANGES vs. pre-news baseline
  "impactedStocks": [                 // 0 to 5 entries. Fewer, higher-conviction entries beat padding.
    {
      "ticker": string,               // prefer universe tickers; out-of-universe allowed
      "company": string,
      "inUniverse": boolean,
      "direction": "bullish" | "bearish" | "mixed",
      "magnitude": "small" | "medium" | "large",
      "expectedMovePct": { "min": number, "max": number },   // a RANGE, e.g. {"min": 1.5, "max": 4} — never false precision
      "confidence": "high" | "medium" | "low",
      "horizon": string,              // e.g. "intraday", "1-5 trading days"
      "reasoning": string,            // the causal chain from the news to this stock's repricing
      "evidence": [ { "point": string, "source": string (optional), "url": string (optional) } ],
      "action": "buy" | "add" | "watch" | "trim" | "sell" | "hedge" | "avoid",
      "actionRationale": string,
      "risks": [ string ]             // what invalidates this call
    }
  ],
  "tradingPlan": string,              // the overall what-to-do summary a PM can read in 10 seconds
  "limitations": [ string ]           // at least one honest limitation of this analysis
}`;

export function buildAnalysisPrompt(news: NewsInput): string {
  const universe = getUniverse();
  const lang =
    news.locale === "zh"
      ? "Write every human-readable string field in Simplified Chinese. Keep JSON keys, enum values, tickers, and URLs in ASCII."
      : "Write every human-readable string field in English.";

  return `You are the news-impact analyst behind Raven Delta, Raven Labs' real-time news engine for US equities.

Doctrine — trade the increment, not the level:
- A static "will this stock go up" probability is not the product. The question is what THIS headline changes relative to the pre-news baseline: which cash flows, multiples, or risk premia get repriced, and for whom.
- First triage: is this news worth a desk's attention at all? Consider source credibility (is the stated source a credible primary outlet or filing?), novelty (is it plausibly already priced in / widely reported earlier?), and materiality. If it is not worth attention, say so and return an EMPTY impactedStocks list — that is a valid, valuable answer.
- Then map exposure: direct subjects of the news first, then second-order exposure (suppliers, customers, competitors, sector baskets). Anchor on the maintained universe below; you may include an out-of-universe ticker when the news demands it (flag inUniverse=false).
- 0 to 5 impacted stocks. Include a name only when you can state a concrete repricing mechanism and evidence. Do not pad to 5.
- Evidence discipline: quote or paraphrase specifics from the provided headline/body for each claim; attach source/url only when you are confident it is real. Never invent quotes, numbers, or URLs.
- Calibration: expectedMovePct is a range; wider when uncertain. Brevity is not confidence — do not narrow ranges for style. Note in risks when the move may already be priced in (pre-market gap risk).
- Actions are event-response hypotheses for a professional desk, not retail advice; sizing/liquidity/borrow checks stay out of scope and belong in limitations.

Maintained stock universe (version ${universe.version}):
${universePromptTable()}

${lang}

News item to analyze:
HEADLINE: ${news.headline}
${news.body ? `BODY: ${news.body}` : "BODY: (none provided)"}
SOURCE: ${news.source ?? "(unstated)"}
URL: ${news.url ?? "(none)"}
PUBLISHED_AT_UTC: ${news.publishedAtUtc ?? "(unstated — assume just now)"}

${OUTPUT_SPEC}`;
}

export function buildRepairPrompt(previousRaw: string, zodError: string): string {
  return `Your previous JSON answer failed schema validation.

Validation errors:
${zodError}

Previous answer:
${previousRaw.slice(0, 6000)}

Return the corrected JSON object only — same content, fixed to satisfy the schema. No prose.`;
}
