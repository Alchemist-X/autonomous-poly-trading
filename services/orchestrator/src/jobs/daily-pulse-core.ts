import {
  tradeDecisionSetSchema,
  type PublicPosition,
  type RunMode,
  type OverviewResponse,
  type TradeDecisionSet
} from "@autopoly/contracts";
import type { OrchestratorConfig } from "../config.js";
import { buildPortfolioReportArtifacts } from "../lib/portfolio-report-artifacts.js";
import type { ProgressReporter } from "../lib/terminal-progress.js";
import { generatePulseSnapshot, type PulseSnapshot } from "../pulse/market-pulse.js";
import type { PulseFilterArgs } from "../pulse/pulse-filters.js";
import type { AgentRuntime, RuntimeExecutionResult } from "../runtime/agent-runtime.js";
import type { PositionResearchSnapshot } from "../runtime/decision-metadata.js";
import { resolveProviderSkillSettings } from "../runtime/skill-settings.js";

function sanitizeDecisionSet(decisionSet: TradeDecisionSet): TradeDecisionSet {
  return tradeDecisionSetSchema.parse(decisionSet);
}

function dedupeArtifacts(artifacts: TradeDecisionSet["artifacts"]): TradeDecisionSet["artifacts"] {
  const seen = new Set<string>();
  const next: TradeDecisionSet["artifacts"] = [];
  for (const artifact of artifacts) {
    const key = `${artifact.kind}:${artifact.path}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(artifact);
  }
  return next;
}

export interface DailyPulseCoreInput {
  config: OrchestratorConfig;
  runtime: AgentRuntime;
  runId: string;
  mode: RunMode;
  overview: OverviewResponse;
  positions: PublicPosition[];
  progress?: ProgressReporter;
  pulse?: PulseSnapshot;
  positionResearch?: PositionResearchSnapshot[];
  reviewPositionsOnly?: boolean;
  runtimeResult?: RuntimeExecutionResult;
}

export interface DailyPulseCoreResult {
  overview: OverviewResponse;
  positions: PublicPosition[];
  pulse: PulseSnapshot;
  result: RuntimeExecutionResult;
  decisionSet: TradeDecisionSet;
}

export async function ensureDailyPulseSnapshot(input: {
  config: OrchestratorConfig;
  runId: string;
  mode: RunMode;
  progress?: ProgressReporter;
  filters?: PulseFilterArgs;
}) {
  const skillSettings = resolveProviderSkillSettings(input.config, input.config.runtimeProvider);
  return generatePulseSnapshot({
    config: input.config,
    provider: input.config.runtimeProvider,
    locale: skillSettings.locale,
    runId: input.runId,
    mode: input.mode,
    progress: input.progress,
    filters: input.filters
  });
}

export async function runDailyPulseCore(input: DailyPulseCoreInput): Promise<DailyPulseCoreResult> {
  const pulse = input.pulse ?? await ensureDailyPulseSnapshot({
    config: input.config,
    runId: input.runId,
    mode: input.mode,
    progress: input.progress
  });

  const runtimeResult = input.runtimeResult ?? await input.runtime.run({
    runId: input.runId,
    mode: input.mode,
    overview: input.overview,
    positions: input.positions,
    pulse,
    positionResearch: input.positionResearch,
    reviewPositionsOnly: input.reviewPositionsOnly,
    progress: input.progress
  });

  const baseDecisionSet = sanitizeDecisionSet(runtimeResult.decisionSet);
  const reportArtifacts = await buildPortfolioReportArtifacts({
    config: input.config,
    overview: input.overview,
    positions: input.positions,
    pulse,
    decisionSet: baseDecisionSet,
    promptSummary: runtimeResult.promptSummary,
    reasoningMd: runtimeResult.reasoningMd,
    positionReviews: runtimeResult.positionReviews,
    entryPlans: runtimeResult.entryPlans
  });
  const decisionSet = {
    ...baseDecisionSet,
    artifacts: dedupeArtifacts([...baseDecisionSet.artifacts, ...reportArtifacts])
  } satisfies TradeDecisionSet;

  return {
    overview: input.overview,
    positions: input.positions,
    pulse,
    result: {
      ...runtimeResult,
      decisionSet
    },
    decisionSet
  };
}
