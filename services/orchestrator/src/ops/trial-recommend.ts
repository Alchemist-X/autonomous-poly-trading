import { randomUUID } from "node:crypto";
import type { OverviewResponse, PublicPosition } from "@autopoly/contracts";
import {
  getConfiguredLocalStateFilePath,
  getExecutionMode,
  updateLocalAppState
} from "@autopoly/db";
import {
  createTerminalPrinter,
  formatRatioPercent,
  formatUsd,
  type Tone
} from "@autopoly/terminal-ui";
import { getOverview, getPublicPositions } from "@autopoly/db";
import path from "node:path";
import { loadConfig as loadExecutorConfig } from "../../../executor/src/config.js";
import { readBook } from "../../../executor/src/lib/polymarket.js";
import { loadConfig } from "../config.js";
import { ensureDailyPulseSnapshot, runDailyPulseCore } from "../jobs/daily-pulse-core.js";
import { buildExecutionPlan, shouldWarnSkippedDecision } from "../lib/execution-planning.js";
import { createTerminalProgressReporter, type ProgressReporter } from "../lib/terminal-progress.js";
import type { PulseSnapshot } from "../pulse/market-pulse.js";
import { resumeRuntimeExecutionFromOutputFile } from "../runtime/provider-runtime.js";
import { createAgentRuntime } from "../runtime/runtime-factory.js";
import { finalizePaperDecisionSet, persistPaperRecommendation } from "./paper-trading.js";
import {
  checkpointAbsolutePath,
  errorArtifactAbsolutePath,
  loadTrialRecommendCheckpoint,
  saveTrialRecommendErrorArtifact,
  saveTrialRecommendCheckpoint
} from "./trial-recommend-checkpoint.js";

const TRIAL_RECOMMEND_HEARTBEAT_INTERVAL_MS = 5000;

function parseArgs() {
  const args = process.argv.slice(2);
  const resumeRunIdIndex = args.indexOf("--resume-run-id");
  const resumeRunId = resumeRunIdIndex >= 0 ? args[resumeRunIdIndex + 1] ?? null : null;
  return {
    json: args.includes("--json"),
    resumeLatest: args.includes("--resume-latest"),
    resumeRunId
  };
}

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

function decisionTone(action: string): Tone {
  switch (action) {
    case "open":
      return "success";
    case "close":
    case "reduce":
      return "warn";
    case "hold":
      return "info";
    case "skip":
      return "muted";
    default:
      return "accent";
  }
}

function printHumanSummary(output: {
  executionMode: string;
  localStateFile: string | null;
  status: string;
  runId: string | null;
  checkpointPath?: string;
  pulseMarkdownPath?: string;
  pulseJsonPath?: string;
  runtimeLogPath?: string | null;
  providerTempDir?: string | null;
  providerOutputPath?: string | null;
  promptSummary?: string;
  reasoningMd?: string;
  blockedDecisionCount?: number;
  decisions: Array<{
    action: string;
    market_slug: string;
    notional_usd: number;
    bankroll_ratio: number;
    thesis_md: string;
  }>;
  blockedItems?: Array<{
    market_slug: string;
    reason: string;
  }>;
}) {
  const printer = createTerminalPrinter();
  printer.section("Recommendation Summary", `execution mode ${output.executionMode}`);
  printer.table([
    ["Status", output.status],
    ["Run ID", output.runId ?? "-"],
    ["Local State File", output.localStateFile ?? "-"],
    ["Blocked Decisions", String(output.blockedDecisionCount ?? 0)]
  ]);
  if (output.promptSummary) {
    printer.keyValue("Prompt Summary", output.promptSummary, "info");
  }
  if (output.reasoningMd) {
    printer.keyValue("Reasoning Summary", output.reasoningMd.replaceAll("\n", " | "), "muted");
  }
  if (output.decisions.length === 0) {
    printer.blank();
    printer.note("warn", "No executable recommendations were produced");
    return;
  }

  printer.section("Executable Decisions", `${output.decisions.length} recommendation(s)`);
  for (const [index, decision] of output.decisions.entries()) {
    printer.note(
      decisionTone(decision.action),
      `${index + 1}. ${formatAction(decision.action)} ${decision.market_slug}`,
      `${formatUsd(decision.notional_usd)} | ${formatRatioPercent(decision.bankroll_ratio)} bankroll`
    );
    printer.line(`    ${decision.thesis_md}`);
  }

  if ((output.blockedItems?.length ?? 0) > 0) {
    printer.section("Blocked Decisions", `${output.blockedItems!.length} blocked item(s)`);
    for (const item of output.blockedItems!) {
      printer.note(shouldWarnSkippedDecision(item.reason) ? "warn" : "muted", item.market_slug, item.reason);
    }
  }

  printer.section("Verify", output.runId ? `run ${output.runId}` : undefined);
  printer.table([
    ["Checkpoint", output.checkpointPath ?? "-"],
    ["Pulse Markdown", output.pulseMarkdownPath ?? "-"],
    ["Pulse JSON", output.pulseJsonPath ?? "-"],
    ["Runtime Log", output.runtimeLogPath ?? "-"],
    ["Provider Temp", output.providerTempDir ?? "-"],
    ["Provider Output", output.providerOutputPath ?? "-"]
  ]);

  const commands = [
    output.checkpointPath ? `Inspect checkpoint: ${output.checkpointPath}` : null,
    output.localStateFile ? `Inspect local state: ${output.localStateFile}` : null,
    output.status === "awaiting-approval" && output.runId
      ? `Approve this recommendation: pnpm trial:approve -- --run-id ${output.runId}`
      : null,
    output.status === "awaiting-approval"
      ? "Approve latest recommendation: pnpm trial:approve -- --latest"
      : null
  ].filter((value): value is string => Boolean(value));
  printer.list(commands, "info");
}

function printFailureGuidance(input: {
  runId: string;
  checkpointPath: string | null;
  errorArtifactPath: string;
  localStateFile: string | null;
  pulseTempDir: string | null;
  pulsePromptPath: string | null;
  pulseOutputPath: string | null;
  providerTempDir: string | null;
  providerOutputPath: string | null;
  providerPromptPath: string | null;
  providerSchemaPath: string | null;
}) {
  const printer = createTerminalPrinter({
    stream: process.stderr
  });
  printer.section("Failure Recovery", `run ${input.runId}`);
  printer.table([
    ["Checkpoint", input.checkpointPath ?? "-"],
    ["Error Artifact", input.errorArtifactPath],
    ["Local State File", input.localStateFile ?? "-"],
    ["Pulse Temp", input.pulseTempDir ?? "-"],
    ["Pulse Prompt", input.pulsePromptPath ?? "-"],
    ["Pulse Output", input.pulseOutputPath ?? "-"],
    ["Provider Temp", input.providerTempDir ?? "-"],
    ["Provider Output", input.providerOutputPath ?? "-"],
    ["Provider Prompt", input.providerPromptPath ?? "-"],
    ["Provider Schema", input.providerSchemaPath ?? "-"]
  ]);
  const commands = [
    `Inspect error artifact: ${input.errorArtifactPath}`,
    input.checkpointPath ? `Resume this run: pnpm trial:recommend -- --resume-run-id ${input.runId}` : null,
    input.checkpointPath ? "Resume latest failed run: pnpm trial:recommend -- --resume-latest" : null
  ].filter((value): value is string => Boolean(value));
  printer.list(commands, "warn");
}

function parsePreservedTempDir(message: string, label: "Pulse render" | "Decision runtime"): string | null {
  const match = message.match(new RegExp(`${label} temp preserved at (.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

function buildPulseFailurePaths(tempDir: string | null) {
  return {
    pulseTempDir: tempDir,
    pulsePromptPath: tempDir ? path.join(tempDir, "full-pulse-prompt.txt") : null,
    pulseOutputPath: tempDir ? path.join(tempDir, "full-pulse-report.md") : null
  };
}

function buildProviderFailurePaths(tempDir: string | null) {
  return {
    providerTempDir: tempDir,
    providerOutputPath: tempDir ? path.join(tempDir, "provider-output.json") : null,
    providerPromptPath: tempDir ? path.join(tempDir, "provider-prompt.txt") : null,
    providerSchemaPath: tempDir ? path.join(tempDir, "trade-decision-set.schema.json") : null
  };
}

async function withStageHeartbeat<T>(input: {
  reporter: ProgressReporter;
  percent: number;
  label: string;
  detail: string;
  timeoutMs?: number;
  task: () => Promise<T>;
}): Promise<T> {
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    input.reporter.heartbeat({
      percent: input.percent,
      label: input.label,
      detail: input.detail,
      elapsedMs: Date.now() - startedAt,
      timeoutMs: input.timeoutMs
    });
  }, TRIAL_RECOMMEND_HEARTBEAT_INTERVAL_MS);
  try {
    return await input.task();
  } finally {
    clearInterval(heartbeat);
  }
}

async function recordTrialRecommendFailure(input: {
  config: ReturnType<typeof loadConfig>;
  reporter: ProgressReporter;
  runId: string;
  stage: string;
  executionMode: string;
  localStateFile: string | null;
  overview: OverviewResponse;
  positions: PublicPosition[];
  pulse: PulseSnapshot | null;
  providerTempDir: string | null;
  jsonMode: boolean;
  error: unknown;
}) {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const pulseFailurePaths = buildPulseFailurePaths(parsePreservedTempDir(message, "Pulse render"));
  const providerFailurePaths = buildProviderFailurePaths(
    parsePreservedTempDir(message, "Decision runtime") ?? input.providerTempDir
  );

  let checkpointPath: string | null = null;
  if (input.pulse) {
    checkpointPath = await saveTrialRecommendCheckpoint(input.config, {
      runId: input.runId,
      stage: providerFailurePaths.providerOutputPath ? "provider_output_captured" : "pulse_ready",
      mode: "full",
      provider: input.config.runtimeProvider,
      executionMode: input.executionMode,
      localStateFile: input.localStateFile,
      overview: input.overview,
      positions: input.positions,
      pulse: input.pulse,
      providerTempDir: providerFailurePaths.providerTempDir,
      providerOutputPath: providerFailurePaths.providerOutputPath,
      providerPromptPath: providerFailurePaths.providerPromptPath,
      providerSchemaPath: providerFailurePaths.providerSchemaPath
    });
    input.reporter.fail(`Checkpoint updated after failure | ${checkpointPath}`);
  }

  const errorArtifactPath = await saveTrialRecommendErrorArtifact(input.config, {
    runId: input.runId,
    stage: input.stage,
    executionMode: input.executionMode,
    localStateFile: input.localStateFile,
    message,
    pulseTempDir: pulseFailurePaths.pulseTempDir,
    pulsePromptPath: pulseFailurePaths.pulsePromptPath,
    pulseOutputPath: pulseFailurePaths.pulseOutputPath,
    providerTempDir: providerFailurePaths.providerTempDir,
    providerOutputPath: providerFailurePaths.providerOutputPath,
    providerPromptPath: providerFailurePaths.providerPromptPath,
    providerSchemaPath: providerFailurePaths.providerSchemaPath
  });
  input.reporter.fail(`Error artifact saved | ${errorArtifactPath}`);

  if (!input.jsonMode) {
    printFailureGuidance({
      runId: input.runId,
      checkpointPath,
      errorArtifactPath,
      localStateFile: input.localStateFile,
      pulseTempDir: pulseFailurePaths.pulseTempDir,
      pulsePromptPath: pulseFailurePaths.pulsePromptPath,
      pulseOutputPath: pulseFailurePaths.pulseOutputPath,
      providerTempDir: providerFailurePaths.providerTempDir,
      providerOutputPath: providerFailurePaths.providerOutputPath,
      providerPromptPath: providerFailurePaths.providerPromptPath,
      providerSchemaPath: providerFailurePaths.providerSchemaPath
    });
  }

  return {
    checkpointPath,
    errorArtifactPath,
    ...pulseFailurePaths,
    ...providerFailurePaths
  };
}

export async function runTrialRecommendCli(options?: { forceJson?: boolean }) {
  const args = parseArgs();
  const config = loadConfig();
  const executorConfig = loadExecutorConfig();
  const reporter = createTerminalProgressReporter({
    enabled: !(options?.forceJson || args.json),
    stream: options?.forceJson || args.json ? process.stderr : process.stdout
  });
  const runtime = createAgentRuntime(config);
  reporter.info("Flow: 1) load portfolio 2) fetch pulse markets 3) enrich candidates 4) render full pulse 5) run decision runtime 6) apply shared execution planning 7) persist paper recommendation");
  const executionMode = getExecutionMode();
  const localStateFile = getConfiguredLocalStateFilePath();
  const requestedCheckpoint = await loadTrialRecommendCheckpoint({
    config,
    runId: args.resumeRunId ?? undefined,
    latest: args.resumeLatest
  });
  const resumeCheckpoint = requestedCheckpoint?.stage === "completed" ? null : requestedCheckpoint;
  if (requestedCheckpoint?.stage === "completed") {
    reporter.info(
      `Checkpoint already completed | ${checkpointAbsolutePath(config, requestedCheckpoint.runId)} | starting fresh run with current state`
    );
  }
  const [overview, positions] = resumeCheckpoint
    ? [resumeCheckpoint.overview, resumeCheckpoint.positions]
    : await Promise.all([getOverview(), getPublicPositions()]);
  const runId = resumeCheckpoint?.runId ?? randomUUID();
  reporter.stage({
    percent: 5,
    label: resumeCheckpoint ? "Loaded checkpoint context" : "Loaded portfolio context",
    detail: `${positions.length} positions | bankroll $${overview.total_equity_usd.toFixed(2)} | mode ${executionMode}${resumeCheckpoint ? ` | resume ${resumeCheckpoint.stage}` : ""}`
  });

  if (overview.status !== "running") {
    const output = {
      executionMode,
      localStateFile,
      status: "skipped",
      reason: `system status is ${overview.status}`,
      runId: null,
      decisions: []
    };
    if (options?.forceJson || args.json) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    console.log(output.reason);
    return;
  }
  let pulse = resumeCheckpoint?.pulse ?? null;
  if (!pulse) {
    reporter.stage({
      percent: 18,
      label: "Building pulse snapshot",
      detail: `run ${runId} | mode full | provider ${config.runtimeProvider}`
    });
    try {
      pulse = await withStageHeartbeat({
        reporter,
        percent: 18,
        label: "Building pulse snapshot",
        detail: `stage pulse_snapshot | run ${runId} | mode full | provider ${config.runtimeProvider}`,
        timeoutMs: config.pulse.reportTimeoutSeconds > 0 ? config.pulse.reportTimeoutSeconds * 1000 : undefined,
        task: () => ensureDailyPulseSnapshot({
          config,
          runId,
          mode: "full",
          progress: reporter
        })
      });
    } catch (error) {
      const failure = await recordTrialRecommendFailure({
        config,
        reporter,
        runId,
        stage: "pulse_snapshot",
        executionMode,
        localStateFile,
        overview,
        positions,
        pulse: null,
        providerTempDir: resumeCheckpoint?.providerTempDir ?? null,
        jsonMode: options?.forceJson || args.json,
        error
      });
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n\nTrial recommend error artifact: ${failure.errorArtifactPath}`,
        { cause: error }
      );
    }
  }
  if (!pulse) {
    throw new Error(
      `Pulse snapshot missing after recovery. Inspect ${checkpointAbsolutePath(config, runId)} or ${errorArtifactAbsolutePath(config, runId)}.`
    );
  }
  const resolvedPulse = pulse;
  if (!resumeCheckpoint) {
    const checkpointPath = await saveTrialRecommendCheckpoint(config, {
      runId,
      stage: "pulse_ready",
      mode: "full",
      provider: config.runtimeProvider,
      executionMode,
      localStateFile,
      overview,
      positions,
      pulse: resolvedPulse,
      providerTempDir: null,
      providerOutputPath: null,
      providerPromptPath: null,
      providerSchemaPath: null
    });
    reporter.info(`Checkpoint saved | ${checkpointPath}`);
    reporter.info(`Resume command | pnpm trial:recommend -- --resume-run-id ${runId}`);
  } else {
    reporter.info(`Resuming from checkpoint | ${checkpointAbsolutePath(config, runId)}`);
    reporter.info(`Resume command | pnpm trial:recommend -- --resume-run-id ${runId}`);
  }
  reporter.stage({
    percent: 70,
    label: "Pulse snapshot ready",
    detail: `${resolvedPulse.selectedCandidates} candidates | risk flags ${resolvedPulse.riskFlags.length}`
  });
  let runtimeResult;
  try {
    runtimeResult = resumeCheckpoint?.stage === "provider_output_captured" && resumeCheckpoint.providerOutputPath
      ? await withStageHeartbeat({
          reporter,
          percent: 76,
          label: "Resuming captured provider output",
          detail: `stage provider_output_resume | run ${runId} | output ${resumeCheckpoint.providerOutputPath}`,
          task: () => resumeRuntimeExecutionFromOutputFile({
            config,
            provider: config.runtimeProvider,
            context: {
              runId,
              mode: "full",
              overview,
              positions,
              pulse: resolvedPulse,
              progress: reporter
            },
            outputPath: resumeCheckpoint.providerOutputPath!
          })
        })
      : undefined;
  } catch (error) {
    const failure = await recordTrialRecommendFailure({
      config,
      reporter,
      runId,
      stage: "provider_output_resume",
      executionMode,
      localStateFile,
      overview,
      positions,
      pulse: resolvedPulse,
      providerTempDir: resumeCheckpoint?.providerTempDir ?? null,
      jsonMode: options?.forceJson || args.json,
      error
    });
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n\nTrial recommend error artifact: ${failure.errorArtifactPath}`,
      { cause: error }
    );
  }
  reporter.stage({
    percent: 78,
    label: runtimeResult == null ? "Running decision runtime" : "Finalizing from captured provider output",
    detail: `run ${runId} | provider ${config.runtimeProvider} | pulse candidates ${resolvedPulse.selectedCandidates}`
  });
  let coreResult;
  try {
    coreResult = await withStageHeartbeat({
      reporter,
      percent: 78,
      label: runtimeResult == null ? "Running decision runtime" : "Finalizing from captured provider output",
      detail: `stage ${runtimeResult == null ? "decision_runtime" : "provider_output_finalize"} | run ${runId} | provider ${config.runtimeProvider} | pulse candidates ${resolvedPulse.selectedCandidates}`,
      timeoutMs: config.providerTimeoutSeconds > 0 ? config.providerTimeoutSeconds * 1000 : undefined,
      task: () => runtimeResult == null
        ? runDailyPulseCore({
            config,
            runtime,
            runId,
            mode: "full",
            overview,
            positions,
            progress: reporter,
            pulse: resolvedPulse
          })
        : runDailyPulseCore({
            config,
            runtime,
            runId,
            mode: "full",
            overview,
            positions,
            progress: reporter,
            pulse: resolvedPulse,
            runtimeResult
          })
    });
  } catch (error) {
    const failure = await recordTrialRecommendFailure({
      config,
      reporter,
      runId,
      stage: runtimeResult == null ? "decision_runtime" : "provider_output_finalize",
      executionMode,
      localStateFile,
      overview,
      positions,
      pulse: resolvedPulse,
      providerTempDir: resumeCheckpoint?.providerTempDir ?? null,
      jsonMode: options?.forceJson || args.json,
      error
    });
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n\nTrial recommend error artifact: ${failure.errorArtifactPath}`,
      { cause: error }
    );
  }
  reporter.stage({
    percent: 92,
    label: "Decision runtime finished",
    detail: `${coreResult.decisionSet.decisions.length} raw decisions returned`
  });
  const planning = await buildExecutionPlan({
    decisions: coreResult.decisionSet.decisions,
    positions,
    overview,
    config,
    minTradeUsd: config.minTradeUsd,
    pulseCandidates: resolvedPulse?.candidates,
    readBook: async (tokenId) => {
      const book = await readBook(executorConfig, tokenId);
      if (!book) {
        return null;
      }
      return {
        bestAsk: book.bestAsk ?? null,
        bestBid: book.bestBid ?? null,
        minOrderSize: book.minOrderSize ?? null
      };
    }
  });
  const guarded = finalizePaperDecisionSet({
    decisionSet: coreResult.decisionSet,
    plans: planning.plans,
    skippedDecisions: planning.skipped
  });
  reporter.stage({
    percent: 96,
    label: "Applied shared execution planning",
    detail: `${planning.plans.length} executable decisions | blocked ${guarded.blockedDecisionCount}`
  });

  if (executionMode === "paper") {
    const planningLogsMd = [
      coreResult.result.logsMd,
      "",
      "paper_execution_planning",
      JSON.stringify({
        executablePlans: planning.plans,
        blockedDecisions: planning.skipped
      }, null, 2)
    ].join("\n");
    await updateLocalAppState((state) => persistPaperRecommendation({
      state,
      promptSummary: coreResult.result.promptSummary,
      reasoningMd: coreResult.result.reasoningMd,
      logsMd: planningLogsMd,
      decisionSet: guarded.decisionSet
    }));
    reporter.stage({
      percent: 99,
      label: "Persisted paper recommendation",
      detail: localStateFile ?? "local state file unavailable"
    });
  }
  const completedCheckpointPath = await saveTrialRecommendCheckpoint(config, {
    runId,
    stage: "completed",
    mode: "full",
    provider: config.runtimeProvider,
    executionMode,
    localStateFile,
    overview,
    positions,
    pulse: resolvedPulse,
    providerTempDir: resumeCheckpoint?.providerTempDir ?? null,
    providerOutputPath: resumeCheckpoint?.providerOutputPath ?? null,
    providerPromptPath: resumeCheckpoint?.providerPromptPath ?? null,
    providerSchemaPath: resumeCheckpoint?.providerSchemaPath ?? null
  });

  const output = {
    executionMode,
    localStateFile,
    status: executionMode === "paper" ? "awaiting-approval" : "preview",
    runId: guarded.decisionSet.run_id,
    checkpointPath: completedCheckpointPath,
    pulseMarkdownPath: path.join(config.artifactStorageRoot, resolvedPulse.relativeMarkdownPath),
    pulseJsonPath: path.join(config.artifactStorageRoot, resolvedPulse.relativeJsonPath),
    runtimeLogPath: guarded.decisionSet.artifacts.find((artifact) => artifact.kind === "runtime-log")
      ? path.join(
          config.artifactStorageRoot,
          guarded.decisionSet.artifacts.find((artifact) => artifact.kind === "runtime-log")!.path
        )
      : null,
    providerTempDir: resumeCheckpoint?.providerTempDir ?? null,
    providerOutputPath: resumeCheckpoint?.providerOutputPath ?? null,
    blockedDecisionCount: guarded.blockedDecisionCount,
    pulse: {
      title: resolvedPulse.title,
      tradeable: resolvedPulse.tradeable,
      riskFlags: resolvedPulse.riskFlags,
      relativeMarkdownPath: resolvedPulse.relativeMarkdownPath,
      relativeJsonPath: resolvedPulse.relativeJsonPath
    },
    promptSummary: coreResult.result.promptSummary,
    reasoningMd: coreResult.result.reasoningMd,
    decisions: guarded.decisionSet.decisions.map((decision) => ({
      action: decision.action,
      market_slug: decision.market_slug,
      notional_usd: decision.notional_usd,
      bankroll_ratio: guarded.decisionSet.bankroll_usd > 0 ? decision.notional_usd / guarded.decisionSet.bankroll_usd : 0,
      thesis_md: decision.thesis_md
    })),
    blockedItems: guarded.skippedDecisions.map((decision) => ({
      market_slug: decision.marketSlug,
      reason: decision.reason
    })),
    artifacts: guarded.decisionSet.artifacts.map((artifact) => ({
      kind: artifact.kind,
      title: artifact.title,
      path: artifact.path
    }))
  };

  if (options?.forceJson || args.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  reporter.done("Recommendation flow completed");
  printHumanSummary(output);
}

await runTrialRecommendCli();
