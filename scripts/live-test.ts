import path from "node:path";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Job, Queue, QueueEvents, type Worker } from "bullmq";
import Redis from "ioredis";
import { asc, eq, isNull, sql } from "drizzle-orm";
import {
  executionEvents,
  getDb,
  getOverview,
  getPublicPositions,
  getPublicRunDetail,
  getPublicTrades,
  positions
} from "@autopoly/db";
import {
  createTerminalPrinter,
  formatRatioPercent,
  formatUsd,
  getErrorMessage,
  printErrorSummary,
  shouldUseHumanOutput
} from "@autopoly/terminal-ui";
import { JOBS, QUEUES } from "@autopoly/contracts";
import { loadConfig as loadExecutorConfig } from "../services/executor/src/config.ts";
import { fetchRemotePositions, getCollateralBalanceAllowance } from "../services/executor/src/lib/polymarket.ts";
import { createQueueWorker } from "../services/executor/src/workers/queue-worker.ts";
import { loadConfig as loadOrchestratorConfig } from "../services/orchestrator/src/config.ts";
import { runAgentCycle, queueTradeExecution, type ExecutableTradePlan } from "../services/orchestrator/src/jobs/agent-cycle.ts";
import { setSystemStatus, writePortfolioSnapshot } from "../services/orchestrator/src/lib/state.ts";
import { createAgentRuntime } from "../services/orchestrator/src/runtime/runtime-factory.ts";
import {
  LIVE_TEST_BANKROLL_USD,
  LIVE_TEST_MAX_EVENT_EXPOSURE_PCT,
  LIVE_TEST_MAX_TRADE_PCT,
  buildLiveTestDirectoryName,
  evaluateLiveTestPreflight,
  type LiveTestPreflightInput,
  type LiveTestPreflightReport
} from "./live-test-helpers.ts";
import {
  mapOverviewToSummarySnapshot,
  writeRunSummaryArtifacts
} from "./live-run-summary.ts";

interface LiveTestArgs {
  json: boolean;
}

interface LiveTestErrorShape {
  stage: string;
  message: string;
  rawSummary?: string;
  context?: Array<[string, string]>;
  nextSteps?: string[];
  haltSystem: boolean;
}

interface LiveTestResult {
  ok: boolean;
  archiveDir: string;
  runId: string | null;
  preflight: LiveTestPreflightReport;
  recommendationPath: string | null;
  executionSummaryPath: string | null;
  errorPath: string | null;
}

class LiveTestError extends Error {
  constructor(
    readonly shape: LiveTestErrorShape,
    options?: { cause?: unknown }
  ) {
    super(shape.message, options);
    this.name = "LiveTestError";
  }
}

function parseArgs(argv = process.argv.slice(2)): LiveTestArgs {
  return {
    json: argv.includes("--json")
  };
}

function formatTimestampToken(now = new Date()): string {
  return now.toISOString().replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function maskValue(value: string): string {
  if (!value) {
    return "-";
  }
  if (value.length <= 10) {
    return `${value.slice(0, 3)}***`;
  }
  return `${value.slice(0, 6)}***${value.slice(-4)}`;
}

async function ensureDirectory(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

async function writeJsonArtifact(filePath: string, value: unknown) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function createArchiveDir(root: string, timestamp: string) {
  const dirPath = path.join(root, buildLiveTestDirectoryName(timestamp, null));
  await ensureDirectory(dirPath);
  return dirPath;
}

async function finalizeArchiveDir(currentDir: string, timestamp: string, runId: string) {
  const nextDir = path.join(path.dirname(currentDir), buildLiveTestDirectoryName(timestamp, runId));
  if (nextDir === currentDir) {
    return currentDir;
  }
  await rename(currentDir, nextDir);
  return nextDir;
}

function toContextRows(input: {
  envFilePath: string | null;
  archiveDir: string;
  funderAddress: string;
  runId?: string | null;
  marketSlug?: string;
  tokenId?: string;
  requestedUsd?: number | null;
}) {
  return [
    ["Env File", input.envFilePath ?? "-"],
    ["Archive Dir", input.archiveDir],
    ["Wallet", maskValue(input.funderAddress)],
    ["Run ID", input.runId ?? "-"],
    ["Market", input.marketSlug ?? "-"],
    ["Token", input.tokenId ?? "-"],
    ["Requested USD", input.requestedUsd == null ? "-" : formatUsd(input.requestedUsd)]
  ];
}

function buildFailure(input: LiveTestErrorShape, cause?: unknown): LiveTestError {
  return new LiveTestError(input, cause == null ? undefined : { cause });
}

async function collectPreflight(input: {
  executorConfig: ReturnType<typeof loadExecutorConfig>;
  orchestratorConfig: ReturnType<typeof loadOrchestratorConfig>;
}): Promise<LiveTestPreflightReport> {
  const db = getDb();
  let dbOk = false;
  let redisOk = false;
  let clobOk = false;
  let usdcBalance = 0;

  await db.execute(sql`select 1`);
  dbOk = true;

  const redis = new Redis(input.executorConfig.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true
  });

  try {
    await redis.connect();
    redisOk = (await redis.ping()) === "PONG";
  } finally {
    redis.disconnect();
  }

  const balance = await getCollateralBalanceAllowance(input.executorConfig);
  if (balance) {
    clobOk = true;
    usdcBalance = Number((balance as any)?.balance ?? 0) / 1e6;
  }

  const [remotePositions, localOpenPositions] = await Promise.all([
    fetchRemotePositions(input.executorConfig),
    db.query.positions.findMany({
      where: isNull(positions.closedAt)
    })
  ]);

  return evaluateLiveTestPreflight({
    executionMode: process.env.AUTOPOLY_EXECUTION_MODE ?? "live",
    envFilePath: input.orchestratorConfig.envFilePath ?? input.executorConfig.envFilePath,
    hasPrivateKey: Boolean(input.executorConfig.privateKey),
    hasFunderAddress: Boolean(input.executorConfig.funderAddress),
    dbOk,
    redisOk,
    clobOk,
    remotePositionCount: remotePositions.length,
    localOpenPositionCount: localOpenPositions.length,
    initialBankrollUsd: input.orchestratorConfig.initialBankrollUsd,
    maxTradePct: input.orchestratorConfig.maxTradePct,
    maxEventExposurePct: input.orchestratorConfig.maxEventExposurePct,
    usdcBalance
  });
}

async function initializeLiveTestState(bankrollUsd: number) {
  await setSystemStatus("running", `Live test initialized with ${bankrollUsd.toFixed(2)} USD bankroll.`);
  await writePortfolioSnapshot({
    cashBalanceUsd: bankrollUsd,
    totalEquityUsd: bankrollUsd,
    highWaterMarkUsd: bankrollUsd,
    drawdownPct: 0,
    openPositions: 0,
    halted: false
  });
}

async function waitForJob(queue: Queue, queueEvents: QueueEvents, jobId: string) {
  const job = await Job.fromId(queue, jobId);
  if (!job) {
    throw new Error(`Queue job ${jobId} could not be loaded.`);
  }
  return job.waitUntilFinished(queueEvents);
}

async function buildExecutionSummary(runId: string) {
  const db = getDb();
  const [overview, positionsView, tradesView, runDetail, events] = await Promise.all([
    getOverview(),
    getPublicPositions(),
    getPublicTrades(),
    getPublicRunDetail(runId),
    db.query.executionEvents.findMany({
      where: eq(executionEvents.runId, runId),
      orderBy: asc(executionEvents.timestampUtc)
    })
  ]);

  return {
    runId,
    overview,
    positions: positionsView,
    recentTrades: tradesView.filter((trade) => trade.timestamp_utc >= (runDetail?.generated_at_utc ?? "")),
    executionEvents: events.map((event) => ({
      id: event.id,
      decisionId: event.decisionId,
      marketSlug: event.marketSlug,
      tokenId: event.tokenId,
      side: event.side,
      status: event.status,
      requestedNotionalUsd: Number(event.requestedNotionalUsd),
      filledNotionalUsd: Number(event.filledNotionalUsd),
      avgPrice: event.avgPrice == null ? null : Number(event.avgPrice),
      orderId: event.orderId,
      timestampUtc: event.timestampUtc.toISOString()
    })),
    artifacts: runDetail?.artifacts ?? []
  };
}

async function haltSystem(message: string) {
  await setSystemStatus("halted", message);
}

async function closeResources(input: {
  worker: Worker | null;
  queueEvents: QueueEvents | null;
  queue: Queue | null;
}) {
  await Promise.allSettled([
    input.worker?.close(),
    input.queueEvents?.close(),
    input.queue?.close()
  ]);
}

function renderPreflight(printer: ReturnType<typeof createTerminalPrinter>, preflight: LiveTestPreflightReport) {
  printer.section("Preflight");
  printer.table([
    ["Execution Mode", preflight.executionMode],
    ["Env File", preflight.envFilePath ?? "-"],
    ["Bankroll", formatUsd(preflight.bankrollUsd)],
    ["Max Trade", formatRatioPercent(preflight.maxTradePct)],
    ["Max Event", formatRatioPercent(preflight.maxEventExposurePct)],
    ["Remote Positions", String(preflight.remotePositionCount)],
    ["Local Open Positions", String(preflight.localOpenPositionCount)],
    ["USDC Allowance", formatUsd(preflight.usdcBalance)]
  ]);
  for (const check of preflight.checks) {
    printer.note(check.ok ? "success" : "error", check.key, check.detail);
  }
}

function renderRecommendation(printer: ReturnType<typeof createTerminalPrinter>, trades: ExecutableTradePlan[], bankrollUsd: number) {
  printer.section("Executable Decisions", `${trades.length} queued trade(s)`);
  if (trades.length === 0) {
    printer.note("warn", "No executable trades", "Run completed without open/close/reduce jobs.");
    return;
  }
  for (const [index, trade] of trades.entries()) {
    const ratio = bankrollUsd > 0 ? trade.decision.notional_usd / bankrollUsd : 0;
    printer.note(
      trade.decision.action === "open" ? "success" : "info",
      `${index + 1}. ${trade.decision.action} ${trade.decision.market_slug}`,
      `${formatUsd(trade.decision.notional_usd)} | ${formatRatioPercent(ratio)} bankroll`
    );
  }
}

function buildFailurePayload(input: {
  stage: string;
  error: unknown;
  archiveDir: string;
  envFilePath: string | null;
  funderAddress: string;
  runId: string | null;
  rawSummary?: string;
  context?: Array<[string, string]>;
  marketSlug?: string;
  tokenId?: string;
  requestedUsd?: number | null;
}) {
  return {
    stage: input.stage,
    message: getErrorMessage(input.error),
    rawSummary: input.rawSummary ?? null,
    archiveDir: input.archiveDir,
    envFilePath: input.envFilePath,
    funderAddress: maskValue(input.funderAddress),
    runId: input.runId,
    context: input.context ?? [],
    marketSlug: input.marketSlug ?? null,
    tokenId: input.tokenId ?? null,
    requestedUsd: input.requestedUsd ?? null
  };
}

export async function runLiveTest(args: LiveTestArgs = parseArgs()): Promise<LiveTestResult> {
  process.env.ENV_FILE = process.env.ENV_FILE?.trim() || ".env.pizza";

  const printer = createTerminalPrinter();
  const useHumanOutput = !args.json && shouldUseHumanOutput(process.stdout);
  const timestamp = formatTimestampToken();
  let archiveDir = path.join(path.resolve(process.cwd(), "runtime-artifacts", "live-test"), buildLiveTestDirectoryName(timestamp, null));
  let preflightPath: string | null = null;
  let recommendationPath: string | null = null;
  let executionSummaryPath: string | null = null;
  let errorPath: string | null = null;
  let runId: string | null = null;
  let runDetail: Awaited<ReturnType<typeof getPublicRunDetail>> = null;
  let executableTrades: ExecutableTradePlan[] = [];
  let blockedItems: Array<{ action?: "open" | "close" | "reduce" | "hold" | "skip"; marketSlug: string; tokenId?: string | null; reason: string }> = [];
  let promptSummary: string | null = null;
  let reasoningMd: string | null = null;
  let pulseMarkdownPath: string | null = null;
  let runtimeLogPath: string | null = null;
  let preflight: LiveTestPreflightReport = {
    ok: false,
    checks: [],
    envFilePath: null,
    executionMode: process.env.AUTOPOLY_EXECUTION_MODE ?? "live",
    bankrollUsd: LIVE_TEST_BANKROLL_USD,
    maxTradePct: LIVE_TEST_MAX_TRADE_PCT,
    maxEventExposurePct: LIVE_TEST_MAX_EVENT_EXPOSURE_PCT,
    remotePositionCount: 0,
    localOpenPositionCount: 0,
    usdcBalance: 0
  };
  let orchestratorConfig: ReturnType<typeof loadOrchestratorConfig> | null = null;
  let executorConfig: ReturnType<typeof loadExecutorConfig> | null = null;

  let worker: Worker | null = null;
  let queueEvents: QueueEvents | null = null;
  let queue: Queue | null = null;

  try {
    orchestratorConfig = loadOrchestratorConfig();
    executorConfig = loadExecutorConfig();
    archiveDir = await createArchiveDir(path.join(orchestratorConfig.artifactStorageRoot, "live-test"), timestamp);
    preflight = {
      ...preflight,
      envFilePath: orchestratorConfig.envFilePath ?? executorConfig.envFilePath,
      bankrollUsd: orchestratorConfig.initialBankrollUsd,
      maxTradePct: orchestratorConfig.maxTradePct,
      maxEventExposurePct: orchestratorConfig.maxEventExposurePct
    };

    if (useHumanOutput) {
      printer.section("Live Test", `env ${process.env.ENV_FILE}`);
      printer.table([
        ["Wallet", maskValue(executorConfig.funderAddress)],
        ["Artifact Dir", archiveDir],
        ["Bankroll", formatUsd(orchestratorConfig.initialBankrollUsd)],
        ["Max Trade", formatRatioPercent(orchestratorConfig.maxTradePct)],
        ["Max Event", formatRatioPercent(orchestratorConfig.maxEventExposurePct)]
      ]);
    }

    preflight = await collectPreflight({
      executorConfig,
      orchestratorConfig
    });
    preflightPath = path.join(archiveDir, "preflight.json");
    await writeJsonArtifact(preflightPath, preflight);

    if (useHumanOutput) {
      renderPreflight(printer, preflight);
    }
    if (!preflight.ok) {
      throw buildFailure({
        stage: "preflight",
        message: "Live test preflight failed.",
        context: toContextRows({
          envFilePath: preflight.envFilePath,
          archiveDir,
          funderAddress: executorConfig.funderAddress
        }),
        nextSteps: [
          "Fix the failing preflight checks in the dedicated live-test env file.",
          "Ensure the remote address is empty before retrying pnpm live:test."
        ],
        haltSystem: false
      });
    }

    await initializeLiveTestState(orchestratorConfig.initialBankrollUsd);
    if (useHumanOutput) {
      printer.note("success", "Portfolio state initialized", `${formatUsd(orchestratorConfig.initialBankrollUsd)} bankroll`);
    }

    const connection = {
      url: executorConfig.redisUrl,
      maxRetriesPerRequest: null
    };
    queue = new Queue(QUEUES.execution, { connection });
    queueEvents = new QueueEvents(QUEUES.execution, { connection });
    worker = createQueueWorker(executorConfig, connection);

    await Promise.all([
      queue.waitUntilReady(),
      queueEvents.waitUntilReady(),
      worker.waitUntilReady()
    ]);

    const runtime = createAgentRuntime(orchestratorConfig);
    const cycle = await runAgentCycle({
      runtime,
      executionQueue: queue,
      config: orchestratorConfig,
      queueStrategy: "manual"
    });

    if (cycle.skipped || !cycle.runId) {
      throw buildFailure({
        stage: "recommend",
        message: cycle.skipped ? cycle.reason ?? "Agent cycle skipped." : "Agent cycle did not return a run id.",
        context: toContextRows({
          envFilePath: preflight.envFilePath,
          archiveDir,
          funderAddress: executorConfig.funderAddress
        }),
        nextSteps: ["Check system status and orchestrator runtime configuration before retrying."],
        haltSystem: true
      });
    }

    runId = cycle.runId;
    archiveDir = await finalizeArchiveDir(archiveDir, timestamp, runId);
    preflightPath = path.join(archiveDir, "preflight.json");
    recommendationPath = path.join(archiveDir, "recommendation.json");
    executableTrades = cycle.executableTrades ?? [];

    runDetail = await getPublicRunDetail(runId);
    promptSummary = runDetail?.prompt_summary ?? null;
    reasoningMd = runDetail?.reasoning_md ?? null;
    pulseMarkdownPath = runDetail?.artifacts.find((artifact) => artifact.kind === "pulse-report")?.path ?? null;
    runtimeLogPath = runDetail?.artifacts.find((artifact) => artifact.kind === "runtime-log")?.path ?? null;
    if (runDetail) {
      const executableKeys = new Set(
        executableTrades.map((trade) => `${trade.decision.market_slug}:${trade.decision.action}:${trade.decision.token_id}`)
      );
      blockedItems = runDetail.decisions
        .filter((decision) => ["open", "close", "reduce"].includes(decision.action))
        .filter((decision) => !executableKeys.has(`${decision.market_slug}:${decision.action}:${decision.token_id}`))
        .map((decision) => ({
          action: decision.action,
          marketSlug: decision.market_slug,
          tokenId: decision.token_id,
          reason: decision.action === "open"
            ? "removed before queueing (guardrails or exposure caps)"
            : "removed before queueing (no executable inventory or guard filters)"
        }));
    }
    await writeJsonArtifact(recommendationPath, {
      runId,
      preflight,
      runDetail,
      executableTrades
    });

    if (useHumanOutput) {
      printer.note("success", "Recommendation captured", `run ${runId}`);
      renderRecommendation(printer, executableTrades, orchestratorConfig.initialBankrollUsd);
    }

    for (const [index, trade] of executableTrades.entries()) {
      if (useHumanOutput) {
        printer.note(
          "warn",
          `Queueing live trade ${index + 1}/${executableTrades.length}`,
          `${trade.decision.action} ${trade.decision.market_slug} | ${formatUsd(trade.decision.notional_usd)}`
        );
      }
      const queued = await queueTradeExecution({
        executionQueue: queue,
        runId,
        decisionId: trade.decisionId,
        decision: trade.decision
      });

      try {
        await waitForJob(queue, queueEvents, queued.jobId);
      } catch (error) {
        throw buildFailure({
          stage: "execute",
          message: "A live trade job failed.",
          rawSummary: getErrorMessage(error),
          context: toContextRows({
            envFilePath: preflight.envFilePath,
            archiveDir,
            funderAddress: executorConfig.funderAddress,
            runId,
            marketSlug: trade.decision.market_slug,
            tokenId: trade.decision.token_id,
            requestedUsd: trade.decision.notional_usd
          }),
          nextSteps: [
            "Inspect error.json and execution-summary.json in the live-test archive.",
            "Check executor logs and the Polymarket response payload before retrying."
          ],
          haltSystem: true
        }, error);
      }
    }

    const syncJob = await queue.add(JOBS.syncPortfolio, {}, {
      removeOnComplete: true,
      removeOnFail: false
    });
    try {
      await waitForJob(queue, queueEvents, String(syncJob.id));
    } catch (error) {
      throw buildFailure({
        stage: "sync",
        message: "Portfolio sync job failed after trade execution.",
        rawSummary: getErrorMessage(error),
        context: toContextRows({
          envFilePath: preflight.envFilePath,
          archiveDir,
          funderAddress: executorConfig.funderAddress,
          runId
        }),
        nextSteps: [
          "Inspect the executor worker error output.",
          "Retry sync only after verifying Redis, DB, and Polymarket connectivity."
        ],
        haltSystem: true
      }, error);
    }

    const executionSummary = await buildExecutionSummary(runId);
    executionSummaryPath = path.join(archiveDir, "execution-summary.json");
    await writeJsonArtifact(executionSummaryPath, executionSummary);
    await writeRunSummaryArtifacts({
      mode: "live:test",
      executionMode: process.env.AUTOPOLY_EXECUTION_MODE ?? "live",
      strategy: orchestratorConfig.decisionStrategy,
      envFilePath: preflight.envFilePath,
      archiveDir,
      runId,
      status: "success",
      stage: "completed",
      promptSummary,
      reasoningMd,
      decisions: (runDetail?.decisions ?? []).map((decision) => ({
        action: decision.action,
        marketSlug: decision.market_slug,
        eventSlug: decision.event_slug,
        tokenId: decision.token_id,
        side: decision.side,
        notionalUsd: decision.notional_usd,
        thesisMd: decision.thesis_md
      })),
      executablePlans: executableTrades.map((trade) => ({
        action: trade.decision.action,
        marketSlug: trade.decision.market_slug,
        eventSlug: trade.decision.event_slug,
        tokenId: trade.decision.token_id,
        side: trade.decision.side,
        notionalUsd: trade.decision.notional_usd,
        bankrollRatio: orchestratorConfig.initialBankrollUsd > 0
          ? trade.decision.notional_usd / orchestratorConfig.initialBankrollUsd
          : 0,
        thesisMd: trade.decision.thesis_md
      })),
      executedOrders: executionSummary.executionEvents.map((event) => ({
        marketSlug: event.marketSlug,
        tokenId: event.tokenId,
        side: event.side,
        requestedNotionalUsd: event.requestedNotionalUsd,
        filledNotionalUsd: event.filledNotionalUsd,
        avgPrice: event.avgPrice,
        orderId: event.orderId,
        status: event.status,
        ok: event.status === "filled"
      })),
      blockedItems,
      portfolioBefore: {
        cashUsd: orchestratorConfig.initialBankrollUsd,
        equityUsd: orchestratorConfig.initialBankrollUsd,
        openPositions: 0,
        drawdownPct: 0
      },
      portfolioAfter: mapOverviewToSummarySnapshot(executionSummary.overview),
      artifacts: {
        preflightPath,
        recommendationPath,
        executionSummaryPath,
        pulseMarkdownPath,
        runtimeLogPath
      }
    });

    if (args.json) {
      console.log(JSON.stringify({
        ok: true,
        archiveDir,
        runId,
        preflight,
        recommendationPath,
        executionSummaryPath
      }, null, 2));
    } else if (useHumanOutput) {
      printer.section("Live Test Summary");
      printer.table([
        ["Run ID", runId],
        ["Archive Dir", archiveDir],
        ["Cash", formatUsd(executionSummary.overview.cash_balance_usd)],
        ["Equity", formatUsd(executionSummary.overview.total_equity_usd)],
        ["Open Positions", String(executionSummary.overview.open_positions)],
        ["Drawdown", formatRatioPercent(executionSummary.overview.drawdown_pct)]
      ]);
      printer.note("success", "Live test completed", executionSummaryPath);
    }

    return {
      ok: true,
      archiveDir,
      runId,
      preflight,
      recommendationPath,
      executionSummaryPath,
      errorPath
    };
  } catch (error) {
    const failure = error instanceof LiveTestError
      ? error
      : buildFailure({
          stage: "unknown",
          message: getErrorMessage(error),
          context: toContextRows({
            envFilePath: preflight.envFilePath,
            archiveDir,
            funderAddress: executorConfig?.funderAddress ?? "",
            runId
          }),
          nextSteps: [
            "Inspect error.json in the live-test archive.",
            "Retry after resolving the underlying runtime or infrastructure error."
          ],
          haltSystem: true
        }, error);

    if (failure.shape.haltSystem) {
      try {
        await haltSystem(`Live test halted during ${failure.shape.stage}: ${failure.shape.message}`);
      } catch (haltError) {
        failure.shape.rawSummary = [
          failure.shape.rawSummary,
          `halt write failed: ${getErrorMessage(haltError)}`
        ].filter(Boolean).join(" | ");
      }
    }

    await ensureDirectory(archiveDir);
    errorPath = path.join(archiveDir, "error.json");
    await writeJsonArtifact(errorPath, buildFailurePayload({
      stage: failure.shape.stage,
      error: failure,
      archiveDir,
      envFilePath: preflight.envFilePath,
      funderAddress: executorConfig?.funderAddress ?? "",
      runId,
      rawSummary: failure.shape.rawSummary,
      context: failure.shape.context
    }));
    await writeRunSummaryArtifacts({
      mode: "live:test",
      executionMode: process.env.AUTOPOLY_EXECUTION_MODE ?? "live",
      strategy: orchestratorConfig?.decisionStrategy ?? null,
      envFilePath: preflight.envFilePath,
      archiveDir,
      runId,
      status: "failed",
      stage: failure.shape.stage,
      promptSummary,
      reasoningMd,
      decisions: (runDetail?.decisions ?? []).map((decision) => ({
        action: decision.action,
        marketSlug: decision.market_slug,
        eventSlug: decision.event_slug,
        tokenId: decision.token_id,
        side: decision.side,
        notionalUsd: decision.notional_usd,
        thesisMd: decision.thesis_md
      })),
      executablePlans: executableTrades.map((trade) => ({
        action: trade.decision.action,
        marketSlug: trade.decision.market_slug,
        eventSlug: trade.decision.event_slug,
        tokenId: trade.decision.token_id,
        side: trade.decision.side,
        notionalUsd: trade.decision.notional_usd,
        bankrollRatio: orchestratorConfig && orchestratorConfig.initialBankrollUsd > 0
          ? trade.decision.notional_usd / orchestratorConfig.initialBankrollUsd
          : 0,
        thesisMd: trade.decision.thesis_md
      })),
      blockedItems,
      failure: {
        stage: failure.shape.stage,
        message: failure.shape.message,
        rawSummary: failure.shape.rawSummary,
        nextSteps: failure.shape.nextSteps
      },
      artifacts: {
        preflightPath,
        recommendationPath,
        executionSummaryPath,
        errorPath,
        pulseMarkdownPath,
        runtimeLogPath
      }
    });

    if (args.json) {
      console.log(JSON.stringify({
        ok: false,
        archiveDir,
        runId,
        preflight,
        errorPath,
        stage: failure.shape.stage,
        message: failure.shape.message
      }, null, 2));
    } else {
      printErrorSummary(printer, {
        title: "Live Test Failed",
        stage: failure.shape.stage,
        error: failure,
        context: failure.shape.context,
        artifactDir: archiveDir,
        rawSummary: failure.shape.rawSummary,
        nextSteps: failure.shape.nextSteps
      });
    }

    return {
      ok: false,
      archiveDir,
      runId,
      preflight,
      recommendationPath,
      executionSummaryPath,
      errorPath
    };
  } finally {
    await closeResources({
      worker,
      queueEvents,
      queue
    });
  }
}

async function main() {
  const result = await runLiveTest(parseArgs());
  if (!result.ok) {
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main().catch((error) => {
    printErrorSummary(createTerminalPrinter(), {
      title: "Live Test Failed",
      stage: "bootstrap",
      error,
      nextSteps: ["Inspect the stack trace above and retry after fixing the bootstrap error."]
    });
    process.exit(1);
  });
}
