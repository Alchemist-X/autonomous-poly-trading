import { randomUUID } from "node:crypto";
import { getOverview, getPublicPositions } from "@autopoly/db";
import { loadConfig } from "../config.js";
import { generatePulseSnapshot } from "../pulse/market-pulse.js";
import { createAgentRuntime } from "../runtime/runtime-factory.js";
import { resolveProviderSkillSettings } from "../runtime/skill-settings.js";

function formatAction(action: string): string {
  switch (action) {
    case "open":
      return "开仓";
    case "close":
      return "平仓";
    case "reduce":
      return "减仓";
    case "hold":
      return "持有";
    case "skip":
      return "跳过";
    default:
      return action;
  }
}

async function main() {
  const config = loadConfig();
  const runtime = createAgentRuntime(config);
  const settings = resolveProviderSkillSettings(config, config.runtimeProvider);
  const [overview, positions] = await Promise.all([getOverview(), getPublicPositions()]);
  const runId = randomUUID();
  const pulse = await generatePulseSnapshot({
    config,
    provider: config.runtimeProvider,
    locale: settings.locale,
    runId,
    mode: "full"
  });
  const result = await runtime.run({
    runId,
    mode: "full",
    overview,
    positions,
    pulse
  });

  if (settings.locale === "zh") {
    console.log(JSON.stringify({
      运行时: config.runtimeProvider,
      市场脉冲: {
        标题: pulse.title,
        可交易: pulse.tradeable,
        风险标记: pulse.riskFlags,
        候选数量: pulse.selectedCandidates,
        Markdown路径: pulse.relativeMarkdownPath,
        JSON路径: pulse.relativeJsonPath
      },
      运行摘要: result.promptSummary,
      推理摘要: result.reasoningMd,
      决策: result.decisionSet.decisions.map((decision) => ({
        动作: formatAction(decision.action),
        市场: decision.market_slug,
        TokenId: decision.token_id,
        金额: decision.notional_usd,
        优势: decision.edge
      })),
      产物: result.decisionSet.artifacts.map((artifact) => ({
        类型: artifact.kind,
        标题: artifact.title,
        路径: artifact.path
      }))
    }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    provider: config.runtimeProvider,
    pulse: {
      title: pulse.title,
      tradeable: pulse.tradeable,
      riskFlags: pulse.riskFlags,
      selectedCandidates: pulse.selectedCandidates,
      relativeMarkdownPath: pulse.relativeMarkdownPath,
      relativeJsonPath: pulse.relativeJsonPath
    },
    promptSummary: result.promptSummary,
    reasoningMd: result.reasoningMd,
    decisions: result.decisionSet.decisions.map((decision) => ({
      action: decision.action,
      market_slug: decision.market_slug,
      token_id: decision.token_id,
      notional_usd: decision.notional_usd,
      edge: decision.edge
    })),
    artifacts: result.decisionSet.artifacts.map((artifact) => ({
      kind: artifact.kind,
      title: artifact.title,
      path: artifact.path
    }))
  }, null, 2));
}

await main();
