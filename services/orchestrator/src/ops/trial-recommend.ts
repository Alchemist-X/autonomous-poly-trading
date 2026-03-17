import { randomUUID } from "node:crypto";
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
import { loadConfig } from "../config.js";
import { createTerminalProgressReporter } from "../lib/terminal-progress.js";
import { generatePulseSnapshot } from "../pulse/market-pulse.js";
import { resumeRuntimeExecutionFromOutputFile } from "../runtime/provider-runtime.js";
import { createAgentRuntime } from "../runtime/runtime-factory.js";
import { resolveProviderSkillSettings } from "../runtime/skill-settings.js";
import { guardDecisionSetForPaper, persistPaperRecommendation } from "./paper-trading.js";
import {
  checkpointAbsolutePath,
  loadTrialRecommendCheckpoint,
  saveTrialRecommendCheckpoint
} from "./trial-recommend-checkpoint.js";

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
  droppedDecisionCount?: number;
  decisions: Array<{
    action: string;
    market_slug: string;
    notional_usd: number;
    bankroll_ratio: number;
    thesis_md: string;
  }>;
}) {
  const printer = createTerminalPrinter();
  printer.section("Recommendation Summary", `execution mode ${output.executionMode}`);
  printer.table([
    ["Status", output.status],
    ["Run ID", output.runId ?? "-"],
    ["Local State File", output.localStateFile ?? "-"],
    ["Dropped Opens", String(output.droppedDecisionCount ?? 0)]
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
  checkpointPath: string;
  localStateFile: string | null;
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
    ["Checkpoint", input.checkpointPath],
    ["Local State File", input.localStateFile ?? "-"],
    ["Provider Temp", input.providerTempDir ?? "-"],
    ["Provider Output", input.providerOutputPath ?? "-"],
    ["Provider Prompt", input.providerPromptPath ?? "-"],
    ["Provider Schema", input.providerSchemaPath ?? "-"]
  ]);
  printer.list([
    `Resume this run: pnpm trial:recommend -- --resume-run-id ${input.runId}`,
    "Resume latest failed run: pnpm trial:recommend -- --resume-latest"
  ], "warn");
}

export async function runTrialRecommendCli(options?: { forceJson?: boolean }) {
  const args = parseArgs();
  const config = loadConfig();
  const reporter = createTerminalProgressReporter({
    enabled: !(options?.forceJson || args.json),
    stream: options?.forceJson || args.json ? process.stderr : process.stdout
  });
  const runtime = createAgentRuntime(config);
  const settings = resolveProviderSkillSettings(config, config.runtimeProvider);
  reporter.info("Flow: 1) load portfolio 2) fetch pulse markets 3) enrich candidates 4) render full pulse 5) run decision runtime 6) apply guards 7) persist paper recommendation");
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
  const pulse = resumeCheckpoint?.pulse ?? await generatePulseSnapshot({
    config,
    provider: config.runtimeProvider,
    locale: settings.locale,
    runId,
    mode: "full",
    progress: reporter
  });
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
      pulse,
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
    detail: `${pulse.selectedCandidates} candidates | risk flags ${pulse.riskFlags.length}`
  });
  let result;
  try {
    result = resumeCheckpoint?.stage === "provider_output_captured" && resumeCheckpoint.providerOutputPath
      ? await resumeRuntimeExecutionFromOutputFile({
          config,
          provider: config.runtimeProvider,
          context: {
            runId,
            mode: "full",
            overview,
            positions,
            pulse,
            progress: reporter
          },
          outputPath: resumeCheckpoint.providerOutputPath
        })
      : await runtime.run({
          runId,
          mode: "full",
          overview,
          positions,
          pulse,
          progress: reporter
        });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const tempDirMatch = message.match(/temp preserved at (.+)$/m);
    const providerTempDir = tempDirMatch?.[1]?.trim() ?? null;
    const providerOutputPath = providerTempDir ? `${providerTempDir}/provider-output.json` : null;
    const providerPromptPath = providerTempDir ? `${providerTempDir}/provider-prompt.txt` : null;
    const providerSchemaPath = providerTempDir ? `${providerTempDir}/trade-decision-set.schema.json` : null;
    const checkpointPath = await saveTrialRecommendCheckpoint(config, {
      runId,
      stage: providerOutputPath ? "provider_output_captured" : "pulse_ready",
      mode: "full",
      provider: config.runtimeProvider,
      executionMode,
      localStateFile,
      overview,
      positions,
      pulse,
      providerTempDir,
      providerOutputPath,
      providerPromptPath,
      providerSchemaPath
    });
    reporter.fail(`Checkpoint updated after failure | ${checkpointPath}`);
    if (!(options?.forceJson || args.json)) {
      printFailureGuidance({
        runId,
        checkpointPath,
        localStateFile,
        providerTempDir,
        providerOutputPath,
        providerPromptPath,
        providerSchemaPath
      });
    }
    throw error;
  }
  reporter.stage({
    percent: 92,
    label: "Decision runtime finished",
    detail: `${result.decisionSet.decisions.length} raw decisions returned`
  });
  const guarded = guardDecisionSetForPaper({
    decisionSet: result.decisionSet,
    overview,
    positions,
    config
  });
  reporter.stage({
    percent: 96,
    label: "Applied paper guardrails",
    detail: `${guarded.decisionSet.decisions.length} executable decisions | dropped ${guarded.droppedDecisionCount}`
  });

  if (executionMode === "paper") {
    await updateLocalAppState((state) => persistPaperRecommendation({
      state,
      promptSummary: result.promptSummary,
      reasoningMd: result.reasoningMd,
      logsMd: result.logsMd,
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
    pulse,
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
    pulseMarkdownPath: path.join(config.artifactStorageRoot, pulse.relativeMarkdownPath),
    pulseJsonPath: path.join(config.artifactStorageRoot, pulse.relativeJsonPath),
    runtimeLogPath: guarded.decisionSet.artifacts.find((artifact) => artifact.kind === "runtime-log")
      ? path.join(
          config.artifactStorageRoot,
          guarded.decisionSet.artifacts.find((artifact) => artifact.kind === "runtime-log")!.path
        )
      : null,
    providerTempDir: resumeCheckpoint?.providerTempDir ?? null,
    providerOutputPath: resumeCheckpoint?.providerOutputPath ?? null,
    droppedDecisionCount: guarded.droppedDecisionCount,
    pulse: {
      title: pulse.title,
      tradeable: pulse.tradeable,
      riskFlags: pulse.riskFlags,
      relativeMarkdownPath: pulse.relativeMarkdownPath,
      relativeJsonPath: pulse.relativeJsonPath
    },
    promptSummary: result.promptSummary,
    reasoningMd: result.reasoningMd,
    decisions: guarded.decisionSet.decisions.map((decision) => ({
      action: decision.action,
      market_slug: decision.market_slug,
      notional_usd: decision.notional_usd,
      bankroll_ratio: guarded.decisionSet.bankroll_usd > 0 ? decision.notional_usd / guarded.decisionSet.bankroll_usd : 0,
      thesis_md: decision.thesis_md
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
