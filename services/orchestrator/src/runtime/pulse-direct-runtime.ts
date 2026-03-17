import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Artifact, TradeDecisionSet } from "@autopoly/contracts";
import type { OrchestratorConfig } from "../config.js";
import { buildArtifactRelativePath, writeStoredArtifact } from "../lib/artifacts.js";
import type { AgentRuntime, RuntimeExecutionContext, RuntimeExecutionResult } from "./agent-runtime.js";

interface ParsedPulseRecommendation {
  eventSlug: string;
  marketSlug: string;
  tokenId: string;
  side: "BUY";
  suggestedPct: number;
  aiProb: number;
  marketProb: number;
  confidence: "low" | "medium" | "medium-high" | "high";
  thesisMd: string;
  sources: Array<{
    title: string;
    url: string;
    retrieved_at_utc: string;
  }>;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 24)}\n\n... truncated ...\n`;
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(4));
}

function normalizeConfidence(raw: string) {
  const value = raw.trim().toLowerCase();
  if (value.includes("高") && value.includes("中")) {
    return "medium-high" as const;
  }
  if (value.includes("high")) {
    return "high" as const;
  }
  if (value.includes("medium-high")) {
    return "medium-high" as const;
  }
  if (value.includes("medium")) {
    return "medium" as const;
  }
  if (value.includes("中")) {
    return "medium" as const;
  }
  return "low" as const;
}

function parseRecommendationSections(markdown: string) {
  const sections: Array<{ title: string; body: string }> = [];
  const matches = [...markdown.matchAll(/^##\s+\d+\.\s+(.+)$/gm)];
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

function extractTableValue(body: string, label: string) {
  const regex = new RegExp(
    String.raw`^\|\s*(?:\*\*)?${label}(?:\*\*)?\s*\|\s*(.+?)\s*\|?$`,
    "m"
  );
  const match = body.match(regex);
  return match?.[1]?.trim() ?? null;
}

function extractReasoning(body: string) {
  const match = body.match(/### 推理逻辑\s+([\s\S]*?)(?=\n### |\n---|\n##\s+\d+\.)/);
  return match?.[1]?.trim() ?? null;
}

function extractProbabilities(body: string) {
  const result = new Map<string, { marketProb: number; aiProb: number }>();
  const regex = /^\|\s*(Yes|No)\s*\|\s*([0-9.]+)%\s*\|\s*([0-9.]+)%\s*\|/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    result.set(match[1]!.toLowerCase(), {
      marketProb: Number(match[2]) / 100,
      aiProb: Number(match[3]) / 100
    });
  }
  return result;
}

function buildRuntimeLogArtifact(
  config: OrchestratorConfig,
  context: RuntimeExecutionContext,
  decisions: TradeDecisionSet["decisions"]
): Promise<Artifact> {
  const publishedAtUtc = new Date().toISOString();
  const relativePath = buildArtifactRelativePath({
    kind: "runtime-log",
    publishedAtUtc,
    runtime: context.mode === "full" ? "codex" : "openclaw",
    mode: context.mode,
    runId: context.runId,
    extension: "md"
  });
  const content = truncate(
    [
      "# Pulse 直连决策日志",
      "",
      `决策策略：pulse-direct`,
      `市场脉冲标题：${context.pulse.title}`,
      `市场脉冲候选数：${context.pulse.selectedCandidates}`,
      `当前持仓数：${context.positions.length}`,
      "",
      "## 最终决策",
      "",
      "```json",
      JSON.stringify(decisions, null, 2),
      "```"
    ].join("\n"),
    config.pulse.maxMarkdownChars
  );
  return writeStoredArtifact(config.artifactStorageRoot, relativePath, content).then(() => ({
    kind: "runtime-log",
    title: `Pulse direct runtime log ${publishedAtUtc}`,
    path: relativePath,
    content,
    published_at_utc: publishedAtUtc
  }));
}

function parsePulseDirectRecommendations(context: RuntimeExecutionContext): ParsedPulseRecommendation[] {
  const sections = parseRecommendationSections(context.pulse.markdown);
  const recommendations: ParsedPulseRecommendation[] = [];

  for (const section of sections) {
    const link = extractSectionValue(section.body, /\*\*链接：\*\*\s*(\S+)/);
    const candidate = context.pulse.candidates.find(
      (item) =>
        normalizeText(item.question) === normalizeText(section.title) ||
        (link !== null && item.url === link)
    );
    if (!candidate) {
      continue;
    }

    const direction = extractTableValue(section.body, "方向");
    const suggestedRow = extractTableValue(section.body, "建议仓位");
    const confidenceRaw = extractSectionValue(section.body, /\*\*置信度：\*\*\s*([^\n]+)/);
    const thesisMd = extractReasoning(section.body) ?? "Pulse direct runtime reused the pulse recommendation without an additional model pass.";
    const resolvedLink = link ?? candidate.url;
    const suggestedPctRaw = suggestedRow?.match(/([0-9.]+)%/)?.[1] ?? null;

    if (!direction || !suggestedPctRaw) {
      continue;
    }

    const outcomeLabel = /买入\s*No|Buy\s*No/i.test(direction) ? "No" : /买入\s*Yes|Buy\s*Yes/i.test(direction) ? "Yes" : null;
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
    const suggestedPct = Number(suggestedPctRaw) / 100;
    recommendations.push({
      eventSlug: candidate.eventSlug,
      marketSlug: candidate.marketSlug,
      tokenId: candidate.clobTokenIds[outcomeIndex]!,
      side: "BUY",
      suggestedPct,
      aiProb,
      marketProb,
      confidence: normalizeConfidence(confidenceRaw ?? "low"),
      thesisMd,
      sources: [
        {
          title: "Pulse market source",
          url: resolvedLink,
          retrieved_at_utc: context.pulse.generatedAtUtc
        }
      ]
    });
  }

  return recommendations;
}

export class PulseDirectRuntime implements AgentRuntime {
  readonly name = "pulse-direct-runtime";

  constructor(private readonly config: OrchestratorConfig) {}

  async run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const recommendations = parsePulseDirectRecommendations(context);
    const decisions: TradeDecisionSet["decisions"] = [];

    for (const position of context.positions) {
      decisions.push({
        action: "hold",
        event_slug: position.event_slug,
        market_slug: position.market_slug,
        token_id: position.token_id,
        side: position.side,
        notional_usd: Math.max(0.01, position.current_value_usd),
        order_type: "FOK",
        ai_prob: position.current_price,
        market_prob: position.current_price,
        edge: 0,
        confidence: "low",
        thesis_md: "Pulse-direct decision mode keeps existing positions unchanged unless a dedicated exit engine is added.",
        sources: [
          {
            title: "Current position context",
            url: `runtime-context://positions/${position.id}`,
            retrieved_at_utc: new Date().toISOString()
          }
        ],
        stop_loss_pct: position.stop_loss_pct,
        resolution_track_required: true
      });
    }

    for (const recommendation of recommendations) {
      decisions.push({
        action: "open",
        event_slug: recommendation.eventSlug,
        market_slug: recommendation.marketSlug,
        token_id: recommendation.tokenId,
        side: recommendation.side,
        notional_usd: roundCurrency(context.overview.total_equity_usd * recommendation.suggestedPct),
        order_type: "FOK",
        ai_prob: recommendation.aiProb,
        market_prob: recommendation.marketProb,
        edge: roundCurrency(recommendation.aiProb - recommendation.marketProb),
        confidence: recommendation.confidence,
        thesis_md: recommendation.thesisMd,
        sources: recommendation.sources,
        stop_loss_pct: this.config.positionStopLossPct,
        resolution_track_required: true
      });
    }

    if (decisions.length === 0) {
      const candidate = context.pulse.candidates[0];
      if (candidate) {
        decisions.push({
          action: "skip",
          event_slug: candidate.eventSlug,
          market_slug: candidate.marketSlug,
          token_id: candidate.clobTokenIds[0] ?? candidate.marketSlug,
          side: "BUY",
          notional_usd: 0.01,
          order_type: "FOK",
          ai_prob: candidate.outcomePrices[0] ?? 0.5,
          market_prob: candidate.outcomePrices[0] ?? 0.5,
          edge: 0,
          confidence: "low",
          thesis_md: "Pulse-direct mode could not parse any executable recommendation from the pulse report, so no trade is taken.",
          sources: [
            {
              title: "Pulse market source",
              url: candidate.url,
              retrieved_at_utc: context.pulse.generatedAtUtc
            }
          ],
          stop_loss_pct: 0,
          resolution_track_required: false
        });
      }
    }

    const runtimeLogArtifact = await buildRuntimeLogArtifact(this.config, context, decisions);
    const pulseArtifact: Artifact = {
      kind: "pulse-report",
      title: context.pulse.title,
      path: context.pulse.relativeMarkdownPath,
      content: context.pulse.markdown,
      published_at_utc: context.pulse.generatedAtUtc
    };

    return {
      decisionSet: {
        run_id: context.runId,
        runtime: this.name,
        generated_at_utc: new Date().toISOString(),
        bankroll_usd: context.overview.total_equity_usd,
        mode: context.mode,
        decisions,
        artifacts: [pulseArtifact, runtimeLogArtifact]
      },
      promptSummary: `Pulse direct runtime reused the pulse report and converted its position suggestions into executable decisions.`,
      reasoningMd: [
        "决策策略：pulse-direct",
        `市场脉冲可交易：${context.pulse.tradeable ? "是" : "否"}`,
        `Pulse 推荐解析数：${recommendations.length}`,
        `最终决策数：${decisions.length}`,
        "后续仅由服务层风控裁剪仓位，不再经过第二个模型做开仓判断。"
      ].join("\n"),
      logsMd: JSON.stringify(decisions, null, 2)
    };
  }
}
