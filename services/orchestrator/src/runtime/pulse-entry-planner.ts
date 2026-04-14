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

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
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

function parseRecommendationSections(markdown: string) {
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
  // Allow any characters (e.g. Chinese annotations) between Yes/No and the next pipe
  const regex = /^\|\s*(Yes|No)[^|]*\|\s*([0-9.]+)%\s*\|\s*([0-9.]+)%\s*(?:\|.*)?$/gim;
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

function buildOpenDecision(input: {
  positionStopLossPct: number;
  eventSlug: string;
  marketSlug: string;
  tokenId: string;
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

export function buildPulseEntryPlans(input: {
  context: RuntimeExecutionContext;
  positionStopLossPct: number;
  maxPlans?: number;
  batchCapPct?: number;
  nowMs?: number;
}): PulseEntryPlan[] {
  const context = input.context;
  const sections = parseRecommendationSections(context.pulse.markdown);
  const plans: PulseEntryPlan[] = [];

  for (const section of sections) {
    const link = extractLabeledValue(section.body, ["链接", "Link"]);
    const candidate = context.pulse.candidates.find(
      (item) =>
        normalizeText(item.question) === normalizeText(section.title) ||
        (link !== null && item.url === link)
    );
    if (!candidate) {
      continue;
    }

    const direction = extractTableValue(section.body, ["方向", "Direction"])
      ?? extractLabeledValue(section.body, ["方向", "Direction"]);
    const suggestedRow = extractTableValue(section.body, ["建议仓位", "仓位建议", "Suggested Size", "Position Size", "Sizing"])
      ?? extractLabeledValue(section.body, ["建议仓位", "仓位建议", "Suggested Size", "Position Size", "Sizing"]);
    const liquidityCapRow = extractTableValue(section.body, ["流动性上限", "Liquidity Cap"])
      ?? extractLabeledValue(section.body, ["流动性上限", "Liquidity Cap"]);
    const confidenceRaw = extractTableValue(section.body, ["置信度", "Confidence"])
      ?? extractLabeledValue(section.body, ["置信度", "Confidence"]);
    const thesisMd = extractReasoning(section.body)
      ?? "Pulse entry planner reused the pulse probabilities and recomputed quarter Kelly in code without an additional model pass.";
    const resolvedLink = link ?? candidate.url;

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

    const probabilities = extractProbabilities(section.body);
    const chosenProbabilities = probabilities.get(outcomeLabel.toLowerCase());
    const marketProb = chosenProbabilities?.marketProb ?? candidate.outcomePrices[outcomeIndex] ?? 0.5;
    const aiProb = chosenProbabilities?.aiProb ?? marketProb;
    const reportedSuggestedPct = extractPercentValue(suggestedRow);
    const liquidityCapUsd = extractCurrencyValue(liquidityCapRow);
    const kellySizing = calculateQuarterKelly({
      aiProb,
      marketProb,
      bankrollUsd: context.overview.total_equity_usd
    });
    if (!(kellySizing.quarterKellyUsd > 0)) {
      continue;
    }
    const suggestedPct = roundPct(kellySizing.quarterKellyPct);
    const sources: TradeDecision["sources"] = [
      {
        title: "Pulse market source",
        url: resolvedLink,
        retrieved_at_utc: context.pulse.generatedAtUtc
      }
    ];

    const categorySlug = candidate.categorySlug ?? null;
    const feeParams = lookupCategoryFeeParams(categorySlug, {
      negRisk: candidate.negRisk,
      feesEnabled: candidate.feesEnabled,
      feeSchedule: candidate.feeSchedule
    });
    const grossEdge = aiProb - marketProb;
    const entryFeePct = roundPct(calculateFeePct(marketProb, feeParams));
    const roundTripFee = roundPct(calculateRoundTripFeePct(marketProb, marketProb, feeParams));
    const netEdge = roundPct(calculateNetEdge(grossEdge, marketProb, feeParams));

    const { monthlyReturn, daysToResolution, resolutionSource } = calculateMonthlyReturn({
      aiProb,
      marketProb,
      endDate: candidate.endDate,
      nowMs: input.nowMs,
      edgeOverride: netEdge
    });

    plans.push({
      eventSlug: candidate.eventSlug,
      marketSlug: candidate.marketSlug,
      tokenId: candidate.clobTokenIds[outcomeIndex]!,
      outcomeLabel,
      side: "BUY",
      suggestedPct,
      fullKellyPct: kellySizing.fullKellyPct,
      quarterKellyPct: kellySizing.quarterKellyPct,
      reportedSuggestedPct,
      liquidityCapUsd,
      aiProb,
      marketProb,
      monthlyReturn,
      daysToResolution,
      resolutionSource,
      entryFeePct,
      roundTripFeePct: roundTripFee,
      netEdge,
      categorySlug,
      confidence: normalizeConfidence(confidenceRaw ?? "low"),
      thesisMd,
      sources,
      decision: buildOpenDecision({
        positionStopLossPct: input.positionStopLossPct,
        eventSlug: candidate.eventSlug,
        marketSlug: candidate.marketSlug,
        tokenId: candidate.clobTokenIds[outcomeIndex]!,
        side: "BUY",
        quarterKellyUsd: kellySizing.quarterKellyUsd,
        fullKellyPct: kellySizing.fullKellyPct,
        quarterKellyPct: kellySizing.quarterKellyPct,
        reportedSuggestedPct,
        liquidityCapUsd,
        aiProb,
        marketProb,
        confidence: normalizeConfidence(confidenceRaw ?? "low"),
        thesisMd,
        sources
      })
    });
  }

  const ranked = rankByMonthlyReturn(plans, input.maxPlans);
  return applyBatchCap(
    ranked,
    context.overview.total_equity_usd,
    input.batchCapPct
  );
}
