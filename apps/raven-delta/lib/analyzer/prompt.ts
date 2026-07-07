// Prompt for the LLM engines. Philosophy: the prompt GUIDES the analyst's
// thinking; the machine contract is enforced by zod in provider.ts — so this
// text avoids over-constraining the reasoning and instead states the desk
// context, the increment-first doctrine, and the output surface.

import type { EngineId, NewsInput } from "./schema";
import { universePromptTable, getUniverse } from "./universe";
import { LONGPORT_SERVER_NAME, resolveLongport } from "./longport-mcp";

// Guidance injected ONLY for the claude-cli engine when LongPort market data is
// wired in — deepseek/rules have no MCP tools, so telling them to call quotes
// would be a lie. The analyst grounds its numbers on the live price/recent move
// but must NOT treat a quote as evidence about the NEWS itself (freshness is
// still established by web search).
function marketDataSection(engine: EngineId | undefined): string {
  if (engine !== "claude-cli" || !resolveLongport().enabled) return "";
  const p = `mcp__${LONGPORT_SERVER_NAME}__`;
  return `
LIVE MARKET DATA (LongPort, read-only) — you have MCP tools for real US/HK market data:
- \`${p}quote\` (real-time price), \`${p}candlesticks\` / \`${p}history_candlesticks_by_date\` (recent move), \`${p}intraday\`, \`${p}depth\`, \`${p}trading_session\` / \`${p}market_status\` (is the market open?), \`${p}valuation\` / \`${p}financial_report_latest\` (fundamentals).
- Use them to GROUND each impacted stock: check the actual last price and how far it has already moved TODAY before you state a direction and expectedMovePct — a 4% pop that already happened is priced in, and belongs in risks, not upside.
- Record what you pulled as evidence: put the price / % move / quote timestamp in the stock's evidence[] with source "LongPort". Never invent a quote you did not fetch.
- These tools are market data ONLY. You cannot and must not place, cancel, or size any order, or read account/portfolio data — that is out of scope for this desk.
- If a tool call fails or the market is closed, say so in limitations and fall back to reasoning from the news; do not block the analysis on it.
`;
}

const OUTPUT_SPEC = `Return EXACTLY ONE JSON object (no markdown fences, no prose outside it) with this shape:
{
  "attention": {
    "worthAttention": boolean,        // should a US-equity desk act on this NOW?
    "score": number,                  // 0-100 attention score
    "verdict": string,                // one or two sentences: why it is / is not worth attention
    "newsType": string,               // short catalyst class, e.g. "AI capex", "antitrust", "rates", "M&A"
    "credibilityNote": string         // YOUR verification read: who actually reported this, is it confirmed?
  },
  "timing": {
    "firstSeenUtc": string | null,    // ISO timestamp of the EARLIEST public appearance you can establish; null if you cannot
    "basis": string                   // how you established it (search trace / provided timestamp / "cannot verify")
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

export function buildAnalysisPrompt(news: NewsInput, engine?: EngineId): string {
  const universe = getUniverse();
  const lang =
    news.locale === "zh"
      ? "Write every human-readable string field in Simplified Chinese. Keep JSON keys, enum values, tickers, and URLs in ASCII."
      : "Write every human-readable string field in English.";

  return `You are the news-impact analyst behind Raven Delta, Raven Labs' real-time news engine for US equities.
${marketDataSection(engine)}

Doctrine — trade the increment, not the level:
- A static "will this stock go up" probability is not the product. The question is what THIS headline changes relative to the pre-news baseline: which cash flows, multiples, or risk premia get repriced, and for whom.
- VERIFY, never trust: the caller gives you raw pasted text (optionally a URL) and no source claim. Establish yourself — with web search when available — whether the story is real, who first reported it, and WHEN it first appeared anywhere public (firstSeenUtc). Freshness is the whole game: a 5-minute-old story and a 3-day-old story are different products. If you cannot verify, say so plainly in timing.basis and credibilityNote — never fabricate a timestamp.
- First triage: is this news worth a desk's attention at all? Consider credibility, novelty (is it plausibly already priced in / widely reported earlier?), and materiality. If it is not worth attention, say so and return an EMPTY impactedStocks list — that is a valid, valuable answer.
- Then map exposure: direct subjects of the news first, then second-order exposure (suppliers, customers, competitors, sector baskets). Anchor on the maintained universe below; you may include an out-of-universe ticker when the news demands it (flag inUniverse=false).
- 0 to 5 impacted stocks. Include a name only when you can state a concrete repricing mechanism and evidence. Do not pad to 5.
- Evidence discipline: quote or paraphrase specifics from the provided headline/body for each claim; attach source/url only when you are confident it is real. Never invent quotes, numbers, or URLs.
- Calibration: expectedMovePct is a range; wider when uncertain. Brevity is not confidence — do not narrow ranges for style. Note in risks when the move may already be priced in (pre-market gap risk).
- Actions are event-response hypotheses for a professional desk, not retail advice; sizing/liquidity/borrow checks stay out of scope and belong in limitations.

Maintained stock universe (version ${universe.version}):
${universePromptTable()}

${lang}

News item to analyze (raw paste — no source claim; verify it yourself):
TEXT:
${news.text}

URL: ${news.url ?? "(none provided)"}
CALLER_TIMESTAMP_UTC: ${news.publishedAtUtc ?? "(none — establish first appearance yourself)"}

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
