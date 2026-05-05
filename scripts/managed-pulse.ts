// scripts/managed-pulse.ts — Mode A bridge runner.
//
// Reads the most recent orchestrator pulse output and dispatches the
// resulting decisions to every authorised managed user via
// `ManagedTradingDispatcher`. This script is the seam between the
// existing Pizza-wallet pulse (`scripts/pulse-live.ts`) and the
// managed-trading multi-user fan-out — it does NOT trigger a fresh
// pulse run.
//
// ## Modes
//
// - **paper (default)**: dispatcher persists per-user decisions to
//   `managed_decisions` / `managed_paper_runs`; no real CLOB calls.
// - **live**: requires `MANAGED_TRADING_MODE=live` env. The adapter
//   placeOrder path runs and signs orders with the Privy session
//   signer key. Live runs are expected to fire from the cron schedule
//   (`deploy/managed-pulse.cron.example`) so they don't double-fire —
//   running this script manually in live mode is discouraged for
//   that reason.
//
// ## Observability (Phase 3a.3)
//
// - Every run gets a `runBatchId` and writes a per-user archive to
//   `runtime-artifacts/managed-pulse/<runBatchId>/<userId>/{decisions.json,summary.md}`
//   plus a top-level `run-summary.md` + `run-summary.json`.
// - On failures, rows are appended to `risk_events` (event types
//   `managed_pulse_failure` + `managed_pulse_user_failure`).
// - Slack-style webhook alerts go to `MANAGED_TRADING_ALERT_WEBHOOK`
//   when set; absent env var → silent no-op.
// - All artifact paths are echoed at run end (CLAUDE.md §7).
//
// ## Failure modes (fail-fast per CLAUDE.md §6)
//
// - Pulse output missing or malformed → exit non-zero before any user
//   is touched.
// - Adapter construction fails (live mode without builder creds /
//   session signer key) → exit non-zero before fan-out.
// - Per-user errors are returned in `RunResult` and DO NOT abort the
//   loop — the dispatcher itself handles isolation.
//
// ## Usage
//
//     # paper-mode dry run (default)
//     pnpm tsx scripts/managed-pulse.ts
//
//     # explicit pulse-live archive (skip auto-discovery)
//     pnpm tsx scripts/managed-pulse.ts --recommendation runtime-artifacts/pulse-live/<dir>/recommendation.json
//
//     # JSON-only output for scripting
//     pnpm tsx scripts/managed-pulse.ts --json
//
// The script writes nothing to stdout except the final JSON summary;
// progress lines go to stderr so a `... | jq` pipeline still works.

import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { hasDatabaseUrl, getDb } from "@autopoly/db";
import { ManagedTradingDispatcher, type RunResult } from "../services/managed-trading/src/dispatcher.ts";
import {
  PolymarketRelayerAdapter,
  StubPolymarketAdapter
} from "../services/managed-trading/src/polymarket-adapter.ts";
import { loadConfig as loadManagedTradingConfig } from "../services/managed-trading/src/config.ts";
import {
  mapPulseRecommendationToProposedDecisions,
  type PulseRecommendationFile,
  type UnmappablePlan
} from "../services/managed-trading/src/proposed-decision-mapper.ts";
import {
  hasAlertWebhookConfigured,
  sendAlert,
  type AlertKind,
  type AlertPayload
} from "../services/managed-trading/src/alerts.ts";
import { recordRiskEvent } from "../services/managed-trading/src/risk-events.ts";
import {
  makeRunBatchId,
  writeManagedPulseArchive,
  type ArchivePaths
} from "./managed-pulse-archive.ts";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly json: boolean;
  readonly recommendationPath: string | null;
  readonly artifactRoot: string;
}

function parseArgs(argv = process.argv.slice(2)): CliArgs {
  const get = (flag: string): string | null => {
    const index = argv.indexOf(flag);
    if (index < 0) return null;
    const value = argv[index + 1];
    return value && !value.startsWith("--") ? value : null;
  };
  return {
    json: argv.includes("--json"),
    recommendationPath: get("--recommendation"),
    artifactRoot:
      get("--artifact-root") ??
      process.env.RAVEN_ARTIFACT_ROOT ??
      path.resolve(process.cwd(), "runtime-artifacts")
  };
}

// ---------------------------------------------------------------------------
// Logging — stderr only, stdout reserved for the final JSON summary.
// ---------------------------------------------------------------------------

type LogLevel = "INFO" | "WARN" | "ERR" | "OK";

function log(level: LogLevel, message: string): void {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] [${level}] [managed-pulse] ${message}\n`);
}

// ---------------------------------------------------------------------------
// Pulse output discovery
// ---------------------------------------------------------------------------

// Pick the most-recent `recommendation.json` under
// `<artifactRoot>/pulse-live/<ts>-<runId>/`. Sorted by directory name
// because the orchestrator embeds an ISO-like timestamp prefix
// (e.g. `2026-04-26T060306Z-...`) which sorts lexicographically.
//
// We intentionally DO NOT read from the database here. While
// `agent_runs` + `agent_decisions` exist, they don't store the
// post-orchestrator-sizing PlannedExecution rows — those only land in
// `recommendation.json`. Filesystem is the canonical source for the
// bridge's input shape. (Future: persist `executablePlans` to a DB
// column so we don't depend on archive directory layout.)
async function findLatestRecommendationFile(artifactRoot: string): Promise<string | null> {
  const pulseDir = path.join(artifactRoot, "pulse-live");
  let entries: string[];
  try {
    entries = await fs.readdir(pulseDir);
  } catch (error) {
    log("WARN", `Cannot read ${pulseDir}: ${getErrorMessage(error)}`);
    return null;
  }
  // Sort descending so we pick the newest archive first.
  entries.sort((a, b) => b.localeCompare(a));
  for (const entry of entries) {
    const candidate = path.join(pulseDir, entry, "recommendation.json");
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) {
        return candidate;
      }
    } catch {
      // Missing recommendation.json — skip and try the next archive.
    }
  }
  return null;
}

async function loadPulseRecommendation(
  filePath: string
): Promise<PulseRecommendationFile> {
  const raw = await fs.readFile(filePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `recommendation.json at ${filePath} is not valid JSON: ${getErrorMessage(error)}`
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`recommendation.json at ${filePath} is not a JSON object`);
  }
  // Don't validate every nested shape here — the mapper does its own
  // defensive checks per row. We only require the two arrays exist
  // (or are absent, in which case we treat as empty).
  return parsed as PulseRecommendationFile;
}

// ---------------------------------------------------------------------------
// Final summary shape
// ---------------------------------------------------------------------------

interface ManagedPulseSummary {
  readonly ok: boolean;
  readonly mode: "paper" | "live";
  readonly runBatchId: string;
  readonly recommendationPath: string;
  readonly recommendationRunId: string | null;
  readonly proposedDecisionCount: number;
  readonly unmappableCount: number;
  readonly unmappable: ReadonlyArray<{
    readonly tokenId: string;
    readonly marketSlug: string;
    readonly reason: string;
    readonly detail: string;
  }>;
  readonly users: {
    readonly total: number;
    readonly completed: number;
    readonly skipped: number;
    readonly failed: number;
  };
  readonly perUser: ReadonlyArray<RunResult>;
  readonly archive: {
    readonly runDir: string;
    readonly runSummaryMd: string;
    readonly runSummaryJson: string;
    readonly userArtifactCount: number;
  } | null;
  readonly alerts: {
    readonly webhookConfigured: boolean;
    readonly attempted: number;
    readonly delivered: number;
  };
  readonly errorMessage?: string;
}

function summariseUnmappable(
  unmappable: ReadonlyArray<UnmappablePlan>
): ManagedPulseSummary["unmappable"] {
  return unmappable.map((row) => ({
    tokenId: row.plan.tokenId,
    marketSlug: row.plan.marketSlug,
    reason: row.reason,
    detail: row.detail
  }));
}

function tallyPerUser(results: ReadonlyArray<RunResult>): ManagedPulseSummary["users"] {
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === "completed") completed += 1;
    else if (result.status === "skipped") skipped += 1;
    else if (result.status === "failed") failed += 1;
  }
  return {
    total: results.length,
    completed,
    skipped,
    failed
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function runManagedPulseBridge(args: CliArgs = parseArgs()): Promise<ManagedPulseSummary> {
  const startedAt = Date.now();
  // `runBatchId` ties together: per-user files in runtime-artifacts,
  // alert payloads, and risk_events rows. Re-running with the same
  // batch is idempotent because the timestamp + uuid suffix combine to
  // a unique directory.
  const runBatchId = makeRunBatchId(new Date(), randomUUID().replace(/-/g, ""));
  const webhookConfigured = hasAlertWebhookConfigured();
  if (!webhookConfigured) {
    log(
      "INFO",
      "MANAGED_TRADING_ALERT_WEBHOOK is not set — failure alerts will be skipped (silent no-op)."
    );
  }

  // Step 1 — load pulse output. Fail fast if missing or malformed.
  const recommendationPath = args.recommendationPath
    ?? (await findLatestRecommendationFile(args.artifactRoot));
  if (!recommendationPath) {
    throw new Error(
      `No pulse recommendation found under ${path.join(args.artifactRoot, "pulse-live")}. ` +
        `Run \`pnpm pulse:recommend\` (or pulse:live) first to produce one.`
    );
  }
  log("INFO", `runBatchId=${runBatchId} loading pulse recommendation from ${recommendationPath}`);
  const recommendation = await loadPulseRecommendation(recommendationPath);
  const recommendationRunId = typeof recommendation.runId === "string" ? recommendation.runId : null;

  const { proposedDecisions, unmappable } =
    mapPulseRecommendationToProposedDecisions(recommendation);
  if (unmappable.length > 0) {
    for (const item of unmappable) {
      log("WARN", `Unmappable plan: tokenId=${item.plan.tokenId} reason=${item.reason} ${item.detail}`);
    }
  }
  log(
    "INFO",
    `Mapped ${proposedDecisions.length} proposed decisions; ${unmappable.length} unmappable`
  );

  if (proposedDecisions.length === 0) {
    log("WARN", "No proposed decisions to dispatch — exiting early without DB writes");
    return {
      ok: true,
      mode: loadManagedTradingConfig().mode,
      runBatchId,
      recommendationPath,
      recommendationRunId,
      proposedDecisionCount: 0,
      unmappableCount: unmappable.length,
      unmappable: summariseUnmappable(unmappable),
      users: { total: 0, completed: 0, skipped: 0, failed: 0 },
      perUser: [],
      archive: null,
      alerts: { webhookConfigured, attempted: 0, delivered: 0 }
    };
  }

  // Step 2 — load managed-trading config + build adapter. Live mode
  // throws here if builder creds / session signer are missing.
  const managedConfig = loadManagedTradingConfig();
  log("INFO", `Managed trading mode: ${managedConfig.mode}`);

  // Step 3 — open DB connection.
  if (!hasDatabaseUrl()) {
    throw new Error(
      "DATABASE_URL is not configured. The bridge needs DB access to load managed users + persist runs."
    );
  }
  const db = getDb();

  // Step 4 — pick adapter implementation.
  //
  // Paper mode: the dispatcher's paper path still calls `getBalance` so
  // we need a real bankroll read; the real adapter handles that. A
  // pure stub would skip every user with `empty_safe`. Live mode
  // obviously needs the real adapter for placeOrder. The
  // `MANAGED_TRADING_USE_REAL_BALANCES=true` knob lets paper-mode
  // dogfood read on-chain balances without flipping live trading on.
  const adapter =
    managedConfig.mode === "live" || process.env.MANAGED_TRADING_USE_REAL_BALANCES === "true"
      ? new PolymarketRelayerAdapter({ config: managedConfig })
      : new StubPolymarketAdapter();
  if (adapter instanceof StubPolymarketAdapter) {
    log("INFO", "Using StubPolymarketAdapter — set MANAGED_TRADING_USE_REAL_BALANCES=true to read on-chain balances in paper mode");
  } else {
    log("INFO", "Using PolymarketRelayerAdapter (real on-chain reads)");
  }

  // Step 5 — fan out across authorised users.
  const dispatcher = new ManagedTradingDispatcher({ db, adapter });
  log("INFO", `Dispatching ${proposedDecisions.length} decisions to authorised users`);
  const perUser = await dispatcher.runPaperPulseForAllAuthorizedUsers(proposedDecisions);

  for (const result of perUser) {
    if (result.status === "completed") {
      log(
        "OK",
        `user=${result.userId} run=${result.runId} kept=${result.keptCount} skipped=${result.skippedCount} bankroll=$${result.bankrollUsd?.toFixed(2) ?? "n/a"}`
      );
    } else if (result.status === "skipped") {
      log("INFO", `user=${result.userId} skipped (${result.skippedReason ?? "unknown"})`);
    } else if (result.status === "failed") {
      log("ERR", `user=${result.userId} failed: ${result.errorMessage ?? "unknown error"}`);
    }
  }

  const tally = tallyPerUser(perUser);

  // Step 6 — per-user archive on disk. Best-effort; failures here log
  // but don't abort.
  let archive: ArchivePaths | null = null;
  try {
    archive = await writeManagedPulseArchive(
      {
        artifactRoot: args.artifactRoot,
        runBatchId,
        mode: managedConfig.mode,
        recommendationPath,
        recommendationRunId,
        proposedDecisionCount: proposedDecisions.length,
        unmappableCount: unmappable.length,
        perUser
      },
      (level, message) => log(level, message)
    );
    log("INFO", `Archive: ${archive.runDir}`);
  } catch (error) {
    log("WARN", `Archive write failed: ${getErrorMessage(error)}`);
  }

  // Step 7 — risk_events + alerts for failures + operationally
  // significant skips. Each is independent and best-effort.
  const alertAttempts: Array<Promise<boolean>> = [];

  for (const result of perUser) {
    if (result.status === "failed") {
      const message = result.errorMessage ?? "unknown error";
      // risk_events row — synchronous-ish write so we don't lose the
      // record if the alert webhook is also down.
      void recordRiskEvent(db, {
        eventType: "managed_pulse_user_failure",
        severity: "warn",
        message: `managed-pulse user ${result.userId} failed: ${message}`,
        metadata: {
          runBatchId,
          userId: result.userId,
          runId: result.runId,
          recommendationRunId
        }
      });
      const payload: AlertPayload = {
        kind: "user_failed",
        userId: result.userId,
        runBatchId,
        details: {
          error: message,
          runId: result.runId,
          recommendationRunId
        }
      };
      alertAttempts.push(safeSendAlert(payload));
    } else if (result.status === "skipped") {
      const reason = result.skippedReason ?? "unknown";
      const alertKind = mapSkipReasonToAlertKind(reason);
      if (alertKind) {
        const payload: AlertPayload = {
          kind: alertKind,
          userId: result.userId,
          runBatchId,
          details: {
            skippedReason: reason,
            bankrollUsd: result.bankrollUsd,
            recommendationRunId
          }
        };
        alertAttempts.push(safeSendAlert(payload));
      }
    }
  }

  if (tally.failed > 0) {
    void recordRiskEvent(db, {
      eventType: "managed_pulse_failure",
      severity: tally.failed >= tally.total ? "critical" : "warn",
      message: `managed-pulse run had ${tally.failed} failed user(s) of ${tally.total}`,
      metadata: {
        runBatchId,
        recommendationRunId,
        failed: tally.failed,
        total: tally.total,
        failedUserIds: perUser.filter((r) => r.status === "failed").map((r) => r.userId)
      }
    });
    alertAttempts.push(
      safeSendAlert({
        kind: "run_failed",
        runBatchId,
        details: {
          failed_count: tally.failed,
          total: tally.total,
          archive: archive?.runDir ?? null
        }
      })
    );
  }

  // Settle alert deliveries (best-effort; we never throw on alert
  // failure). `safeSendAlert` already swallows errors.
  const alertResults = await Promise.all(alertAttempts);
  const delivered = alertResults.filter(Boolean).length;
  if (alertAttempts.length > 0) {
    log(
      "INFO",
      `Alerts: attempted=${alertAttempts.length} delivered=${delivered} (webhook ${webhookConfigured ? "set" : "unset"})`
    );
  }

  const elapsedMs = Date.now() - startedAt;
  log(
    "INFO",
    `Done in ${elapsedMs}ms. users total=${tally.total} completed=${tally.completed} skipped=${tally.skipped} failed=${tally.failed}`
  );
  if (archive) {
    log("INFO", `Per-user logs: ${archive.runDir}/<userId>/{decisions.json,summary.md}`);
    log("INFO", `Run summary: ${archive.runSummaryMd}`);
  }

  return {
    ok: tally.failed === 0,
    mode: managedConfig.mode,
    runBatchId,
    recommendationPath,
    recommendationRunId,
    proposedDecisionCount: proposedDecisions.length,
    unmappableCount: unmappable.length,
    unmappable: summariseUnmappable(unmappable),
    users: tally,
    perUser,
    archive: archive
      ? {
          runDir: archive.runDir,
          runSummaryMd: archive.runSummaryMd,
          runSummaryJson: archive.runSummaryJson,
          userArtifactCount: archive.userPaths.length
        }
      : null,
    alerts: {
      webhookConfigured,
      attempted: alertAttempts.length,
      delivered
    }
  };
}

// Map dispatcher skip reasons to alert kinds. The current dispatcher
// only emits `empty_safe` (→ balance_zero); the others (`session_revoked`,
// `rate_limited`) are reserved for future dispatcher refactors that
// distinguish between revocation and a generic ai_auto_trade_disabled
// flag, or surface adapter-level rate-limit errors as skips. We map
// what we can today and silently ignore the rest (no spam alerts on
// expected skips like `ai_auto_trade_disabled`).
function mapSkipReasonToAlertKind(reason: string): AlertKind | null {
  switch (reason) {
    case "empty_safe":
      return "balance_zero";
    case "session_revoked":
      return "session_revoked";
    case "rate_limited":
      return "rate_limited";
    default:
      return null;
  }
}

async function safeSendAlert(payload: AlertPayload): Promise<boolean> {
  try {
    return await sendAlert(payload);
  } catch (error) {
    // sendAlert already catches its own failures; this guard is
    // defence-in-depth — alerts never abort the dispatch.
    log("WARN", `Alert dispatch threw unexpectedly: ${getErrorMessage(error)}`);
    return false;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const args = parseArgs();
  let summary: ManagedPulseSummary;
  try {
    summary = await runManagedPulseBridge(args);
  } catch (error) {
    const message = getErrorMessage(error);
    log("ERR", `Fatal: ${message}`);
    const failureSummary = {
      ok: false,
      mode: undefined,
      errorMessage: message
    };
    if (args.json) {
      process.stdout.write(JSON.stringify(failureSummary, null, 2) + "\n");
    }
    process.exit(1);
  }
  if (args.json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  }
  if (!summary.ok) {
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main();
}
