// Per-run + per-user artifact writer for the managed-pulse bridge.
//
// Layout (under `runtime-artifacts/managed-pulse/<runBatchTs>-<runBatchId>/`):
//
//     run-summary.md                aggregate across users
//     run-summary.json              same data in machine form (handy for ops)
//     <userId>/decisions.json       full per-user RunResult + decisions
//     <userId>/summary.md           human-readable per-user summary
//
// All writes are best-effort: per CLAUDE.md §6 a write failure logs
// (caller's logger) but does NOT abort the dispatch. Re-running the
// bridge with the same `runBatchId` overwrites the archive (idempotent).

import { promises as fs } from "node:fs";
import path from "node:path";
import type { RunResult } from "../services/managed-trading/src/dispatcher.ts";

export interface ArchiveInput {
  readonly artifactRoot: string; // e.g. <repo>/runtime-artifacts
  readonly runBatchId: string; // ULID-ish id; embeds the timestamp prefix
  readonly mode: "paper" | "live";
  readonly recommendationPath: string;
  readonly recommendationRunId: string | null;
  readonly proposedDecisionCount: number;
  readonly unmappableCount: number;
  readonly perUser: ReadonlyArray<RunResult>;
}

export interface ArchivePaths {
  readonly runDir: string;
  readonly runSummaryMd: string;
  readonly runSummaryJson: string;
  readonly userPaths: ReadonlyArray<{
    readonly userId: string;
    readonly decisionsJson: string;
    readonly summaryMd: string;
  }>;
}

export interface ArchiveLogger {
  (level: "INFO" | "WARN" | "ERR", message: string): void;
}

// Build the `<runBatchTs>-<runBatchId>` directory name. The caller passes
// a `runBatchId` already containing a timestamp prefix, so we just join
// to the artifact root + a stable subdir name.
function runDirFor(input: ArchiveInput): string {
  return path.join(input.artifactRoot, "managed-pulse", input.runBatchId);
}

function userDirFor(runDir: string, userId: string): string {
  return path.join(runDir, userId);
}

// Aggregate counts (kept / skipped / failed) across users. Used for the
// top-level run-summary.md.
function aggregate(perUser: ReadonlyArray<RunResult>): {
  total: number;
  completed: number;
  skipped: number;
  failed: number;
  totalKept: number;
  totalSkippedDecisions: number;
  totalNotionalUsd: number;
  failedUserIds: string[];
} {
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  let totalKept = 0;
  let totalSkippedDecisions = 0;
  // We don't currently see per-decision notional in RunResult; the
  // accurate notional view is the dispatcher's `managed_decisions` rows.
  // Aggregate `bankrollUsd × bankrollRatio` would also need decision
  // detail. For the top-level Md we report counts only and link the
  // per-user files for richer context.
  const totalNotionalUsd = 0;
  const failedUserIds: string[] = [];
  for (const r of perUser) {
    if (r.status === "completed") {
      completed += 1;
      totalKept += r.keptCount;
      totalSkippedDecisions += r.skippedCount;
    } else if (r.status === "skipped") {
      skipped += 1;
    } else if (r.status === "failed") {
      failed += 1;
      failedUserIds.push(r.userId);
    }
  }
  return {
    total: perUser.length,
    completed,
    skipped,
    failed,
    totalKept,
    totalSkippedDecisions,
    totalNotionalUsd,
    failedUserIds
  };
}

function bankrollLine(bankrollUsd: number | null): string {
  if (bankrollUsd == null) return "n/a";
  return `$${bankrollUsd.toFixed(2)}`;
}

function userSummaryMarkdown(
  result: RunResult,
  meta: Pick<ArchiveInput, "runBatchId" | "mode" | "recommendationPath">
): string {
  const lines: string[] = [];
  lines.push(`# managed-pulse user summary — ${result.userId}`);
  lines.push("");
  lines.push(`- runBatchId: \`${meta.runBatchId}\``);
  lines.push(`- mode: \`${meta.mode}\``);
  lines.push(`- pulse input: \`${meta.recommendationPath}\``);
  lines.push(`- status: \`${result.status}\``);
  lines.push(`- runId: \`${result.runId ?? "n/a"}\``);
  lines.push(`- bankroll: ${bankrollLine(result.bankrollUsd)}`);
  lines.push(`- kept decisions: ${result.keptCount}`);
  lines.push(`- skipped decisions: ${result.skippedCount}`);
  if (result.skippedReason) {
    lines.push(`- skipped reason: \`${result.skippedReason}\``);
  }
  if (result.errorMessage) {
    lines.push("");
    lines.push("## Error");
    lines.push("");
    lines.push("```");
    lines.push(result.errorMessage);
    lines.push("```");
  }
  lines.push("");
  lines.push(
    "Detailed decisions: see `decisions.json` in this directory. " +
      "Per-decision DB rows live in `managed_decisions` filtered by `run_id`."
  );
  lines.push("");
  return lines.join("\n");
}

function runSummaryMarkdown(input: ArchiveInput): string {
  const agg = aggregate(input.perUser);
  const lines: string[] = [];
  lines.push("# managed-pulse run summary");
  lines.push("");
  lines.push(`- runBatchId: \`${input.runBatchId}\``);
  lines.push(`- mode: \`${input.mode}\``);
  lines.push(`- pulse input: \`${input.recommendationPath}\``);
  lines.push(`- pulse runId: \`${input.recommendationRunId ?? "n/a"}\``);
  lines.push(`- proposed decisions: ${input.proposedDecisionCount}`);
  lines.push(`- unmappable: ${input.unmappableCount}`);
  lines.push("");
  lines.push("## Users");
  lines.push("");
  lines.push(`- total: ${agg.total}`);
  lines.push(`- completed: ${agg.completed}`);
  lines.push(`- skipped: ${agg.skipped}`);
  lines.push(`- failed: ${agg.failed}`);
  lines.push(`- aggregated kept decisions: ${agg.totalKept}`);
  lines.push(`- aggregated skipped decisions: ${agg.totalSkippedDecisions}`);
  if (agg.failedUserIds.length > 0) {
    lines.push("");
    lines.push("## Failed users");
    lines.push("");
    for (const userId of agg.failedUserIds) {
      lines.push(`- ${userId}`);
    }
  }
  lines.push("");
  lines.push("## Per-user breakdown");
  lines.push("");
  lines.push("| User | Status | Bankroll | Kept | Skipped | Reason / Error |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of input.perUser) {
    const reason =
      r.status === "failed"
        ? r.errorMessage ?? ""
        : r.status === "skipped"
          ? r.skippedReason ?? ""
          : "";
    const safeReason = reason.replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(
      `| ${r.userId} | ${r.status} | ${bankrollLine(r.bankrollUsd)} | ${r.keptCount} | ${r.skippedCount} | ${safeReason} |`
    );
  }
  lines.push("");
  return lines.join("\n");
}

// Write the full archive. Returns the resolved paths so the caller can
// echo them back to the user (per CLAUDE.md §7).
export async function writeManagedPulseArchive(
  input: ArchiveInput,
  log: ArchiveLogger = () => {}
): Promise<ArchivePaths> {
  const runDir = runDirFor(input);
  await fs.mkdir(runDir, { recursive: true });

  const runSummaryMd = path.join(runDir, "run-summary.md");
  const runSummaryJson = path.join(runDir, "run-summary.json");
  const userPaths: Array<{
    readonly userId: string;
    readonly decisionsJson: string;
    readonly summaryMd: string;
  }> = [];

  // Per-user artifacts. We catch per-user failures so one bad write
  // doesn't lose the others.
  for (const result of input.perUser) {
    try {
      const userDir = userDirFor(runDir, result.userId);
      await fs.mkdir(userDir, { recursive: true });
      const decisionsJson = path.join(userDir, "decisions.json");
      const summaryMd = path.join(userDir, "summary.md");
      const decisionsPayload = {
        runBatchId: input.runBatchId,
        mode: input.mode,
        recommendationPath: input.recommendationPath,
        recommendationRunId: input.recommendationRunId,
        result
      };
      await fs.writeFile(
        decisionsJson,
        JSON.stringify(decisionsPayload, null, 2) + "\n",
        "utf8"
      );
      await fs.writeFile(
        summaryMd,
        userSummaryMarkdown(result, input),
        "utf8"
      );
      userPaths.push({
        userId: result.userId,
        decisionsJson,
        summaryMd
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(
        "WARN",
        `Per-user archive write failed for ${result.userId}: ${message}`
      );
    }
  }

  try {
    await fs.writeFile(runSummaryMd, runSummaryMarkdown(input), "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("WARN", `run-summary.md write failed: ${message}`);
  }

  try {
    const aggSummary = aggregate(input.perUser);
    await fs.writeFile(
      runSummaryJson,
      JSON.stringify(
        {
          runBatchId: input.runBatchId,
          mode: input.mode,
          recommendationPath: input.recommendationPath,
          recommendationRunId: input.recommendationRunId,
          proposedDecisionCount: input.proposedDecisionCount,
          unmappableCount: input.unmappableCount,
          aggregate: aggSummary,
          perUser: input.perUser
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("WARN", `run-summary.json write failed: ${message}`);
  }

  return {
    runDir,
    runSummaryMd,
    runSummaryJson,
    userPaths
  };
}

// Build a stable runBatchId. ISO-ish timestamp first so directories
// sort lexicographically by run time; uuid suffix to disambiguate runs
// that happen in the same millisecond (e.g. a manual re-trigger from
// cron).
export function makeRunBatchId(now: Date, suffix: string): string {
  // 2026-05-04T12-30-15Z-<8charSuffix>
  const iso = now.toISOString().replace(/[:.]/g, "-").replace(/-\d{3}Z$/, "Z");
  const shortSuffix = suffix.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 8) || "00000000";
  return `${iso}-${shortSuffix}`;
}
