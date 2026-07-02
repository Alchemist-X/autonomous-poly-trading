import type { TradeDecision } from "@autopoly/contracts";
import {
  calculateFeePct,
  calculateNetEdge,
  calculateRoundTripFeePct,
  lookupCategoryFeeParams
} from "../lib/fees.js";
import { calculateQuarterKelly } from "../lib/risk.js";
import type { RuntimeExecutionContext } from "./agent-runtime.js";
import type { PulseEntryPlan } from "./decision-metadata.js";

type PulseCandidate = RuntimeExecutionContext["pulse"]["candidates"][number];

/**
 * Minimal candidate shape needed to bind a report section to a market.
 * PulseCandidate (runtime context) and the archive-JSON candidates both
 * satisfy it structurally, so the parseability gate can reuse the exact
 * matching logic the planner runs.
 */
export interface PulseSectionMatchCandidate {
  question: string;
  url: string;
  endDate?: string | null;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeTitleForMatch(text: string) {
  return normalizeText(text)
    .replace(/^\d+\.\s*/, "")
    .replace(/^will\s+/, "")
    .replace(/[“”"']/g, "")
    .replace(/[?!.,:;()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMatchNumbers(text: string) {
  return [...text.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((match) => match[0]);
}

function candidateMatchText(candidate: PulseSectionMatchCandidate) {
  const endYear = candidate.endDate ? new Date(candidate.endDate).getUTCFullYear() : null;
  return [
    candidate.question,
    Number.isFinite(endYear) && endYear ? String(endYear) : ""
  ].join(" ");
}

function scoreCandidateTitleMatch(sectionTitle: string, candidate: PulseSectionMatchCandidate) {
  const normalizedTitle = normalizeTitleForMatch(sectionTitle);
  const normalizedCandidate = normalizeTitleForMatch(candidateMatchText(candidate));
  if (!normalizedTitle || !normalizedCandidate) {
    return 0;
  }
  if (normalizedTitle === normalizedCandidate) {
    return 1;
  }

  const titleNumbers = extractMatchNumbers(normalizedTitle);
  const candidateNumbers = new Set(extractMatchNumbers(normalizedCandidate));
  if (titleNumbers.length > 0 && !titleNumbers.every((value) => candidateNumbers.has(value))) {
    return 0;
  }

  const titleTokens = normalizedTitle
    .split(/\s+/)
    .filter((token) => token.length >= 3 || /^\d/.test(token));
  const candidateTokens = new Set(normalizedCandidate.split(/\s+/));
  if (titleTokens.length === 0) {
    return 0;
  }
  const overlap = titleTokens.filter((token) => candidateTokens.has(token)).length;
  return overlap / titleTokens.length;
}

function pickBestTitleMatch<T extends PulseSectionMatchCandidate>(sectionTitle: string, candidates: readonly T[]) {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidateTitleMatch(sectionTitle, candidate)
    }))
    .filter((item) => item.score >= 0.6)
    .sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best) {
    return null;
  }
  // An exact question match is unambiguous even when a sibling strike of the
  // same event scores close behind (e.g. "September" vs "October" variants
  // overlap on every other token) — only tie against another exact match.
  if (best.score === 1) {
    return second?.score === 1 ? null : best.candidate;
  }
  if (second && best.score - second.score < 0.15) {
    return null;
  }
  return best.candidate;
}

function resolveCandidateForSection<T extends PulseSectionMatchCandidate>(input: {
  title: string;
  link: string | null;
  candidates: readonly T[];
}) {
  const titleMatch = pickBestTitleMatch(input.title, input.candidates);
  if (titleMatch) {
    return titleMatch;
  }

  if (!input.link) {
    return null;
  }

  const linkMatches = input.candidates.filter((item) => item.url === input.link);
  if (linkMatches.length === 1) {
    return linkMatches[0]!;
  }
  if (linkMatches.length > 1) {
    // Polymarket multi-market events often share the same event URL across
    // strikes/outcomes. In that case, URL alone is unsafe; require title match.
    return pickBestTitleMatch(input.title, linkMatches);
  }
  return null;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(4));
}

function roundPct(value: number): number {
  return Number(value.toFixed(6));
}

function normalizeConfidence(raw: string) {
  const value = raw.trim().toLowerCase();
  if (value.includes("medium-high")) {
    return "medium-high" as const;
  }
  if (value.includes("高") && value.includes("中")) {
    return "medium-high" as const;
  }
  if (value.includes("medium")) {
    return "medium" as const;
  }
  if (value.includes("中")) {
    return "medium" as const;
  }
  if (value.includes("high") || value.includes("高")) {
    return "high" as const;
  }
  return "low" as const;
}

export function parseRecommendationSections(markdown: string) {
  const sections: Array<{ title: string; body: string }> = [];
  const matches = [...markdown.matchAll(/^##\s+(?:\d+\.\s+)?(.+)$/gm)];
  for (const [index, match] of matches.entries()) {
    const sectionStart = match.index ?? 0;
    const title = match[1]?.trim();
    const bodyStart = sectionStart + match[0].length + 1;
    const nextSectionStart = matches[index + 1]?.index ?? markdown.length;
    if (!title) {
      continue;
    }
    sections.push({
      title,
      body: markdown.slice(bodyStart, nextSectionStart).trim()
    });
  }
  return sections;
}

function extractSectionValue(body: string, pattern: RegExp) {
  const match = body.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function extractTableValue(body: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(
      String.raw`^\|\s*(?:\*\*)?${escapeRegExp(label)}(?:\*\*)?\s*[:：]?\s*\|\s*(.+?)\s*\|?$`,
      "gmi"
    );
    const match = regex.exec(body);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return null;
}

function cleanExtractedValue(value: string) {
  return value.replace(/^\*+\s*/, "").replace(/\s*\*+$/, "").trim();
}

function extractLabeledValue(body: string, labels: string[]) {
  for (const label of labels) {
    const escaped = escapeRegExp(label);
    const patterns = [
      new RegExp(String.raw`\*\*(?:${escaped})\s*[:：]\*\*\s*([^\n|]+)`, "i"),
      new RegExp(String.raw`\*\*(?:${escaped})\*\*\s*[:：]\s*([^\n|]+)`, "i"),
      new RegExp(String.raw`(?:^|\|)\s*(?:\*\*)?${escaped}(?:\*\*)?\s*[:：]\s*([^|\n]+)`, "mi")
    ];
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match?.[1]?.trim()) {
        return cleanExtractedValue(match[1]);
      }
    }
  }
  return null;
}

function extractReasoning(body: string) {
  const match = body.match(/###\s+(?:推理逻辑|Reasoning)\s+([\s\S]*?)(?=\n### |\n---|\n##\s+(?:\d+\.\s+)?|\s*$)/i);
  return match?.[1]?.trim() ?? null;
}

function extractPercentValue(value: string | null) {
  if (!value) {
    return null;
  }
  const match = value.match(/([0-9.]+)%/);
  return match?.[1] ? Number(match[1]) / 100 : null;
}

function extractCurrencyValue(value: string | null) {
  if (!value) {
    return null;
  }
  const match = value.match(/\$([0-9][0-9,]*(?:\.[0-9]+)?)/);
  if (!match?.[1]) {
    return null;
  }
  const normalized = match[1].replace(/,/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function extractProbabilities(body: string) {
  const result = new Map<string, { marketProb: number; aiProb: number }>();
  // Allow any characters (e.g. Chinese annotations) between Yes/No and the next
  // pipe, and tolerate markdown bold (**) around the label and the percentages —
  // real archived reports emphasize the recommended row (`| **No** | **94.5%** |`),
  // and rejecting that shape silently dropped the trade.
  const regex = /^\|\s*\**\s*(Yes|No)[^|]*\|\s*\**\s*([0-9.]+)\s*%\s*\**\s*\|\s*\**\s*([0-9.]+)\s*%\s*\**\s*(?:\|.*)?$/gim;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    result.set(match[1]!.toLowerCase(), {
      marketProb: Number(match[2]) / 100,
      aiProb: Number(match[3]) / 100
    });
  }
  return result;
}

function inferOutcomeLabel(direction: string) {
  // Allow markdown bold markers (**) between the verb and outcome label
  if (/买入\s*\**\s*No|Buy\s*\**\s*No/i.test(direction)) {
    return "No";
  }
  if (/买入\s*\**\s*Yes|Buy\s*\**\s*Yes/i.test(direction)) {
    return "Yes";
  }
  return null;
}

const MS_PER_DAY = 86_400_000;
const FALLBACK_DAYS = 180;
const DEFAULT_MAX_PLANS = 4;
const DEFAULT_BATCH_CAP_PCT = 0.2;
const DIRECTION_LABELS = [
  "方向",
  "Direction",
  "模型当前更支持的一侧",
  "当前更支持的一侧",
  "AI 倾向",
  "Current favored side",
  "Favored side"
];

export const PULSE_NO_TRADE_MARKER = "NO-TRADE";

// Anchored to its own line (optionally bold), exactly as the render prompt
// instructs. A prose mention ("this is not a NO-TRADE round") must NOT count,
// or a malformed report could bypass the fail-closed render gate.
const NO_TRADE_LINE_REGEX = new RegExp(String.raw`^\s*\**${PULSE_NO_TRADE_MARKER}\**\s*$`, "m");

export function hasPulseNoTradeMarker(markdown: string): boolean {
  return NO_TRADE_LINE_REGEX.test(markdown);
}

export interface PulseReportParseability {
  sectionCount: number;
  /** Sections with at least one regex-parseable `| Yes/No | market% | ai% |` row. */
  probabilityRowSectionCount: number;
  /** Sections that would survive scan-mode extraction: a recognizable direction whose probability row exists. */
  entryReadySectionCount: number;
  hasNoTradeMarker: boolean;
}

/**
 * Deterministic render-time gate for pulse reports. Reuses the exact extraction
 * helpers the trading path runs, so a report that fails here is guaranteed to
 * extract nothing downstream (aiProb silently falls back to marketProb, edge 0,
 * every plan dropped). Callers decide whether a zero count is fatal:
 * market-scan reports must either contain one entry-ready section or the
 * explicit PULSE_NO_TRADE_MARKER; position-review reports degrade to
 * code-level stale-hold logic and only warrant a warning.
 */
export function assessPulseReportParseability(
  markdown: string,
  candidates?: readonly PulseSectionMatchCandidate[]
): PulseReportParseability {
  const sections = parseRecommendationSections(markdown);
  let probabilityRowSectionCount = 0;
  let entryReadySectionCount = 0;

  for (const section of sections) {
    const probabilities = extractProbabilities(section.body);
    if (probabilities.size === 0) {
      continue;
    }
    probabilityRowSectionCount += 1;

    const direction = extractTableValue(section.body, DIRECTION_LABELS)
      ?? extractLabeledValue(section.body, DIRECTION_LABELS);
    const outcomeLabel = direction ? inferOutcomeLabel(direction) : null;
    if (!outcomeLabel) {
      continue;
    }
    const row = probabilities.get(outcomeLabel.toLowerCase());
    if (!row) {
      continue;
    }
    // Mirror the planner's Kelly drop: a recommended side with no positive
    // edge produces quarterKellyUsd <= 0 and the plan is discarded.
    if (!(row.aiProb > row.marketProb)) {
      continue;
    }
    // When candidates are supplied, also mirror the planner's section-to-
    // candidate binding — a perfectly formatted section that matches no
    // candidate still trades nothing.
    if (candidates) {
      const link = extractLabeledValue(section.body, ["链接", "Link"]);
      const candidate = resolveCandidateForSection({
        title: section.title,
        link,
        candidates
      });
      if (!candidate) {
        continue;
      }
    }
    entryReadySectionCount += 1;
  }

  return {
    sectionCount: sections.length,
    probabilityRowSectionCount,
    entryReadySectionCount,
    hasNoTradeMarker: hasPulseNoTradeMarker(markdown)
  };
}

export function calculateMonthlyReturn(input: {
  aiProb: number;
  marketProb: number;
  endDate: string;
  nowMs?: number;
  edgeOverride?: number;
}): { monthlyReturn: number; daysToResolution: number; resolutionSource: "market" | "estimated" } {
  const edge = input.edgeOverride ?? (input.aiProb - input.marketProb);
  const nowMs = input.nowMs ?? Date.now();
  const endMs = new Date(input.endDate).getTime();
  const hasValidEndDate = Number.isFinite(endMs) && endMs > 0;
  const daysToResolution = hasValidEndDate
    ? Math.max((endMs - nowMs) / MS_PER_DAY, 1)
    : FALLBACK_DAYS;
  const monthsToResolution = daysToResolution / 30;
  return {
    monthlyReturn: edge / monthsToResolution,
    daysToResolution: Number(daysToResolution.toFixed(4)),
    resolutionSource: hasValidEndDate ? "market" : "estimated"
  };
}

export function rankByMonthlyReturn(
  plans: readonly PulseEntryPlan[],
  maxPlans: number = DEFAULT_MAX_PLANS
): PulseEntryPlan[] {
  return [...plans]
    .sort((a, b) => b.monthlyReturn - a.monthlyReturn)
    .slice(0, maxPlans);
}

export function applyBatchCap(
  plans: readonly PulseEntryPlan[],
  bankrollUsd: number,
  batchCapPct: number = DEFAULT_BATCH_CAP_PCT
): PulseEntryPlan[] {
  const cap = bankrollUsd * batchCapPct;
  const totalNotional = plans.reduce(
    (sum, plan) => sum + plan.decision.notional_usd,
    0
  );
  if (totalNotional <= cap) {
    return [...plans];
  }
  const scaleFactor = cap / totalNotional;
  return plans.map((plan) => {
    const scaledNotional = roundCurrency(plan.decision.notional_usd * scaleFactor);
    return {
      ...plan,
      decision: {
        ...plan.decision,
        notional_usd: scaledNotional
      }
    };
  });
}

function applyFixedNotional(
  plans: readonly PulseEntryPlan[],
  fixedNotionalUsd: number | null | undefined
): PulseEntryPlan[] {
  if (!(fixedNotionalUsd != null && fixedNotionalUsd > 0)) {
    return [...plans];
  }
  const notionalUsd = roundCurrency(fixedNotionalUsd);
  return plans.map((plan) => ({
    ...plan,
    decision: {
      ...plan.decision,
      notional_usd: notionalUsd
    }
  }));
}

function buildOpenDecision(input: {
  positionStopLossPct: number;
  eventSlug: string;
  marketSlug: string;
  tokenId: string;
  outcomeLabel: string;
  side: "BUY";
  quarterKellyUsd: number;
  fullKellyPct: number;
  quarterKellyPct: number;
  reportedSuggestedPct: number | null;
  liquidityCapUsd: number | null;
  aiProb: number;
  marketProb: number;
  confidence: TradeDecision["confidence"];
  thesisMd: string;
  sources: TradeDecision["sources"];
}) {
  return {
    action: "open",
    event_slug: input.eventSlug,
    market_slug: input.marketSlug,
    token_id: input.tokenId,
    outcome_label: input.outcomeLabel,
    side: input.side,
    notional_usd: roundCurrency(input.quarterKellyUsd),
    order_type: "FOK",
    ai_prob: input.aiProb,
    market_prob: input.marketProb,
    edge: roundCurrency(input.aiProb - input.marketProb),
    confidence: input.confidence,
    thesis_md: input.thesisMd,
    sources: input.sources,
    full_kelly_pct: roundPct(input.fullKellyPct),
    quarter_kelly_pct: roundPct(input.quarterKellyPct),
    reported_suggested_pct: input.reportedSuggestedPct,
    liquidity_cap_usd: input.liquidityCapUsd,
    stop_loss_pct: input.positionStopLossPct,
    resolution_track_required: true
  } satisfies TradeDecision;
}

function buildPlanForOutcome(input: {
  context: RuntimeExecutionContext;
  candidate: PulseCandidate;
  outcomeLabel: string;
  outcomeIndex: number;
  aiProb: number;
  marketProb: number;
  reportedSuggestedPct: number | null;
  liquidityCapUsd: number | null;
  confidenceRaw: string | null;
  thesisMd: string;
  resolvedLink: string;
  positionStopLossPct: number;
  nowMs?: number;
  allowZeroSize: boolean;
}): PulseEntryPlan | null {
  const tokenId = input.candidate.clobTokenIds[input.outcomeIndex];
  if (!tokenId) {
    return null;
  }

  const kellySizing = calculateQuarterKelly({
    aiProb: input.aiProb,
    marketProb: input.marketProb,
    bankrollUsd: input.context.overview.total_equity_usd
  });
  if (!input.allowZeroSize && !(kellySizing.quarterKellyUsd > 0)) {
    return null;
  }

  const confidence = normalizeConfidence(input.confidenceRaw ?? "low");
  const suggestedPct = roundPct(kellySizing.quarterKellyPct);
  const sources: TradeDecision["sources"] = [
    {
      title: "Pulse market source",
      url: input.resolvedLink,
      retrieved_at_utc: input.context.pulse.generatedAtUtc
    }
  ];

  const categorySlug = input.candidate.categorySlug ?? null;
  const feeParams = lookupCategoryFeeParams(categorySlug, {
    negRisk: input.candidate.negRisk,
    feesEnabled: input.candidate.feesEnabled,
    feeSchedule: input.candidate.feeSchedule
  });
  const grossEdge = input.aiProb - input.marketProb;
  const entryFeePct = roundPct(calculateFeePct(input.marketProb, feeParams));
  const roundTripFee = roundPct(calculateRoundTripFeePct(input.marketProb, input.marketProb, feeParams));
  const netEdge = roundPct(calculateNetEdge(grossEdge, input.marketProb, feeParams));

  const { monthlyReturn, daysToResolution, resolutionSource } = calculateMonthlyReturn({
    aiProb: input.aiProb,
    marketProb: input.marketProb,
    endDate: input.candidate.endDate,
    nowMs: input.nowMs,
    edgeOverride: netEdge
  });

  return {
    eventSlug: input.candidate.eventSlug,
    marketSlug: input.candidate.marketSlug,
    tokenId,
    outcomeLabel: input.outcomeLabel,
    side: "BUY",
    suggestedPct,
    fullKellyPct: kellySizing.fullKellyPct,
    quarterKellyPct: kellySizing.quarterKellyPct,
    reportedSuggestedPct: input.reportedSuggestedPct,
    liquidityCapUsd: input.liquidityCapUsd,
    aiProb: input.aiProb,
    marketProb: input.marketProb,
    monthlyReturn,
    daysToResolution,
    resolutionSource,
    entryFeePct,
    roundTripFeePct: roundTripFee,
    netEdge,
    categorySlug,
    confidence,
    thesisMd: input.thesisMd,
    sources,
    decision: buildOpenDecision({
      positionStopLossPct: input.positionStopLossPct,
      eventSlug: input.candidate.eventSlug,
      marketSlug: input.candidate.marketSlug,
      tokenId,
      outcomeLabel: input.outcomeLabel,
      side: "BUY",
      quarterKellyUsd: kellySizing.quarterKellyUsd,
      fullKellyPct: kellySizing.fullKellyPct,
      quarterKellyPct: kellySizing.quarterKellyPct,
      reportedSuggestedPct: input.reportedSuggestedPct,
      liquidityCapUsd: input.liquidityCapUsd,
      aiProb: input.aiProb,
      marketProb: input.marketProb,
      confidence,
      thesisMd: input.thesisMd,
      sources
    })
  };
}

export function buildPulseEntryPlans(input: {
  context: RuntimeExecutionContext;
  positionStopLossPct: number;
  maxPlans?: number;
  batchCapPct?: number;
  fixedNotionalUsd?: number | null;
  nowMs?: number;
}): PulseEntryPlan[] {
  const context = input.context;
  const positionReviewMode = context.reviewPositionsOnly === true;
  // An explicit NO-TRADE declaration wins over any leftover formatted
  // sections: never build new entry plans from a report that declared the
  // round untradeable (the marker was previously write-only, so a NO-TRADE
  // report with one well-formed section would still have opened live BUYs).
  if (!positionReviewMode && hasPulseNoTradeMarker(context.pulse.markdown)) {
    return [];
  }
  const sections = parseRecommendationSections(context.pulse.markdown);
  const plans: PulseEntryPlan[] = [];

  for (const section of sections) {
    const link = extractLabeledValue(section.body, ["链接", "Link"]);
    const candidate = resolveCandidateForSection({
      title: section.title,
      link,
      candidates: context.pulse.candidates
    });
    if (!candidate) {
      continue;
    }

    const direction = extractTableValue(section.body, DIRECTION_LABELS)
      ?? extractLabeledValue(section.body, DIRECTION_LABELS);
    const suggestedRow = extractTableValue(section.body, ["建议仓位", "仓位建议", "Suggested Size", "Position Size", "Sizing"])
      ?? extractLabeledValue(section.body, ["建议仓位", "仓位建议", "Suggested Size", "Position Size", "Sizing"]);
    const liquidityCapRow = extractTableValue(section.body, ["流动性上限", "Liquidity Cap"])
      ?? extractLabeledValue(section.body, ["流动性上限", "Liquidity Cap"]);
    const confidenceRaw = extractTableValue(section.body, ["置信度", "Confidence"])
      ?? extractLabeledValue(section.body, ["置信度", "Confidence"]);
    const thesisMd = extractReasoning(section.body)
      ?? "Pulse entry planner reused the pulse probabilities and recomputed quarter Kelly in code without an additional model pass.";
    const resolvedLink = link ?? candidate.url;
    const probabilities = extractProbabilities(section.body);
    const reportedSuggestedPct = extractPercentValue(suggestedRow);
    const liquidityCapUsd = extractCurrencyValue(liquidityCapRow);

    if (positionReviewMode && probabilities.size > 0) {
      for (const outcomeLabel of candidate.outcomes) {
        const outcomeIndex = candidate.outcomes.findIndex((outcome) => outcome.toLowerCase() === outcomeLabel.toLowerCase());
        const chosenProbabilities = probabilities.get(outcomeLabel.toLowerCase());
        if (outcomeIndex < 0 || !chosenProbabilities) {
          continue;
        }
        const plan = buildPlanForOutcome({
          context,
          candidate,
          outcomeLabel,
          outcomeIndex,
          aiProb: chosenProbabilities.aiProb,
          marketProb: chosenProbabilities.marketProb,
          reportedSuggestedPct,
          liquidityCapUsd,
          confidenceRaw,
          thesisMd,
          resolvedLink,
          positionStopLossPct: input.positionStopLossPct,
          nowMs: input.nowMs,
          allowZeroSize: true
        });
        if (plan) {
          plans.push(plan);
        }
      }
      continue;
    }

    if (!direction) {
      continue;
    }

    const outcomeLabel = inferOutcomeLabel(direction);
    if (!outcomeLabel) {
      continue;
    }
    const outcomeIndex = candidate.outcomes.findIndex((outcome) => outcome.toLowerCase() === outcomeLabel.toLowerCase());
    if (outcomeIndex < 0) {
      continue;
    }

    const chosenProbabilities = probabilities.get(outcomeLabel.toLowerCase());
    const marketProb = chosenProbabilities?.marketProb ?? candidate.outcomePrices[outcomeIndex] ?? 0.5;
    const aiProb = chosenProbabilities?.aiProb ?? marketProb;
    const plan = buildPlanForOutcome({
      context,
      candidate,
      outcomeLabel,
      outcomeIndex,
      aiProb,
      marketProb,
      reportedSuggestedPct,
      liquidityCapUsd,
      confidenceRaw,
      thesisMd,
      resolvedLink,
      positionStopLossPct: input.positionStopLossPct,
      nowMs: input.nowMs,
      allowZeroSize: false
    });
    if (plan) {
      plans.push(plan);
    }
  }

  if (positionReviewMode) {
    return plans;
  }

  const ranked = rankByMonthlyReturn(plans, input.maxPlans);
  const capped = applyBatchCap(
    ranked,
    context.overview.total_equity_usd,
    input.batchCapPct
  );
  return applyFixedNotional(capped, input.fixedNotionalUsd);
}
