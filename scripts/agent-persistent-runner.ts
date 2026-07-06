import path from "node:path";
import { pathToFileURL } from "node:url";
import { open, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { Queue } from "bullmq";
import { QUEUES } from "@autopoly/contracts";
import {
  createTerminalPrinter,
  formatDuration,
  formatUsd,
  getErrorMessage,
  printErrorSummary
} from "@autopoly/terminal-ui";
import { Wallet } from "ethers";
import { loadConfig as loadExecutorConfig } from "../services/executor/src/config.ts";
import { fetchRemotePositions, resolvePolymarketSigningIdentity, type PolymarketSigningIdentity } from "../services/executor/src/lib/polymarket.ts";
import { loadConfig as loadOrchestratorConfig } from "../services/orchestrator/src/config.ts";
import {
  buildExecutionDispatchPlan,
  dispatchExecutionPlanToQueue,
  markExecutionDispatchPlanMocked,
  type ExecutionDispatchPlan,
  type ExecutionDispatchRecommendation
} from "../services/orchestrator/src/runtime/execution-dispatch.ts";
import {
  probeCollateralBalanceUsd,
  probeDbHealth,
  probeRedisHealth
} from "./live-preflight-probes.ts";
import {
  ensureDirectory,
  formatTimestampToken,
  maskAddressForDisplay,
  writeJsonArtifact
} from "./live-run-common.ts";
import { runPulseLive } from "./pulse-live.ts";
import {
  buildCredentialsCheck,
  buildEnvFileCheck,
  buildExecutionModeCheck,
  buildSignerFunderCheck,
  getPreflightBlockingReason
} from "./preflight-checks.ts";

interface Args {
  json: boolean;
  mockExecutor: boolean;
  durationMinutes: number;
  intervalMinutes: number;
  maxIterations: number;
  archiveRoot: string;
  pulseJsonPath: string | null;
  pulseMarkdownPath: string | null;
}

interface RunnerPreflightCheck {
  key: string;
  ok: boolean;
  blocking: boolean;
  summary: string;
}

interface RunnerPreflightReport {
  ok: boolean;
  blockingReason: string | null;
  executionMode: string;
  decisionStrategy: string;
  envFilePath: string | null;
  redisUrl: string;
  archiveRoot: string;
  wallet: {
    funderAddress: string;
    signerAddress: string;
    signerMatchesFunder: boolean | null;
  };
  collateral: {
    effectiveUsd: number | null;
    source: string;
    reportedUsd: number | null;
    onchainUsd: number | null;
    probeError: string | null;
  };
  remotePositionCount: number;
  checks: RunnerPreflightCheck[];
}

interface RunnerIterationSummary {
  iteration: number;
  startedAtUtc: string;
  finishedAtUtc: string;
  pulseLiveArchiveDir: string | null;
  recommendationPath: string | null;
  dispatchPlanPath: string;
  readyOrders: number;
  queuedOrders: number;
  mockedOrders: number;
  skippedOrders: number;
  failedOrders: number;
}

function readNumberArg(argv: string[], flag: string, fallback: number): number {
  const index = argv.indexOf(flag);
  const raw = index >= 0 ? argv[index + 1] : null;
  if (!raw || raw.startsWith("--")) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readStringArg(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  const raw = index >= 0 ? argv[index + 1] : null;
  return raw && !raw.startsWith("--") ? raw : null;
}

export function parseArgs(argv = process.argv.slice(2)): Args {
  return {
    json: argv.includes("--json"),
    mockExecutor: argv.includes("--mock-executor"),
    durationMinutes: readNumberArg(argv, "--duration-minutes", 60),
    intervalMinutes: readNumberArg(argv, "--interval-minutes", 15),
    maxIterations: Math.max(1, Math.trunc(readNumberArg(argv, "--max-iterations", 1))),
    archiveRoot: path.resolve(readStringArg(argv, "--archive-root") ?? "runtime-artifacts/raven-agent"),
    pulseJsonPath: readStringArg(argv, "--pulse-json"),
    pulseMarkdownPath: readStringArg(argv, "--pulse-markdown")
  };
}

function deriveSignerAddress(privateKey: string) {
  if (!privateKey) {
    return "";
  }
  try {
    return new Wallet(privateKey).address;
  } catch {
    return "";
  }
}

async function probeCheck(key: string, blocking: boolean, run: () => Promise<string>): Promise<RunnerPreflightCheck> {
  try {
    return {
      key,
      ok: true,
      blocking,
      summary: await run()
    };
  } catch (error) {
    return {
      key,
      ok: false,
      blocking,
      summary: getErrorMessage(error)
    };
  }
}

async function runRunnerPreflight(input: {
  args: Args;
  sessionDir: string;
  executorConfig: ReturnType<typeof loadExecutorConfig>;
  orchestratorConfig: ReturnType<typeof loadOrchestratorConfig>;
}): Promise<RunnerPreflightReport> {
  // Resolve the signing identity the same way pulse-live does, so the
  // credentials/signer gates handle the onchainos wallet (this path used to
  // only understand PRIVATE_KEY + FUNDER_ADDRESS — the drift the shared
  // preflight builders close).
  const usesOnchainOsWallet = input.executorConfig.walletProvider === "onchainos";
  let walletIdentity: PolymarketSigningIdentity | null = null;
  let walletIdentityError: string | null = null;
  try {
    if (usesOnchainOsWallet || input.executorConfig.privateKey || input.executorConfig.funderAddress) {
      walletIdentity = await resolvePolymarketSigningIdentity(input.executorConfig);
    }
  } catch (error) {
    walletIdentityError = getErrorMessage(error);
  }
  const signerAddress = walletIdentity?.signerAddress ?? deriveSignerAddress(input.executorConfig.privateKey);
  const funderAddress = walletIdentity?.funderAddress ?? input.executorConfig.funderAddress;
  const signerMatchesFunder = signerAddress && funderAddress
    ? signerAddress.toLowerCase() === funderAddress.toLowerCase()
    : null;
  const collateralProbe = await probeCollateralBalanceUsd(input.executorConfig);
  const remotePositions = await fetchRemotePositions(input.executorConfig).catch(() => []);
  const hasWalletInventory = (collateralProbe.balanceUsd ?? 0) > 0 || remotePositions.length > 0;
  const liveDispatch = !input.args.mockExecutor;

  const checks: RunnerPreflightCheck[] = [
    buildExecutionModeCheck(process.env.AUTOPOLY_EXECUTION_MODE),
    buildEnvFileCheck(input.orchestratorConfig.envFilePath ?? input.executorConfig.envFilePath, "persistent live runs"),
    buildCredentialsCheck({
      usesOnchainOsWallet,
      walletIdentity,
      walletIdentityError,
      hasPrivateKey: Boolean(input.executorConfig.privateKey),
      hasFunderAddress: Boolean(input.executorConfig.funderAddress),
      blocking: liveDispatch
    }),
    buildSignerFunderCheck({
      usesOnchainOsWallet,
      walletIdentity,
      signerAddress,
      funderAddress: funderAddress ?? "",
      signerMatchesFunder: signerMatchesFunder === true
    }),
    {
      key: "wallet-inventory",
      blocking: liveDispatch,
      ok: !liveDispatch || hasWalletInventory,
      summary: hasWalletInventory
        ? `Wallet inventory available: collateral ${formatUsd(collateralProbe.balanceUsd ?? 0)} (${collateralProbe.source}) | remote positions ${remotePositions.length}.`
        : liveDispatch
          ? `No tradable collateral and no remote positions found. ${collateralProbe.errorMessage ?? ""}`.trim()
          : `No wallet inventory found; mock executor mode continues. ${collateralProbe.errorMessage ?? ""}`.trim()
    },
    await probeCheck("redis", liveDispatch, async () => {
      const ok = await probeRedisHealth(input.orchestratorConfig.redisUrl);
      if (!ok) {
        throw new Error("Redis ping did not return PONG.");
      }
      return `Redis is reachable at ${input.orchestratorConfig.redisUrl}.`;
    }),
    await probeCheck("database", liveDispatch, async () => {
      await probeDbHealth();
      return "Database health probe passed.";
    }),
    {
      key: "executor-dispatch",
      blocking: false,
      ok: true,
      summary: liveDispatch
        ? `Ready orders will be queued to ${QUEUES.execution}.`
        : "Mock executor enabled; ready orders will be marked mocked and will not be queued."
    }
  ];

  return {
    ok: checks.every((check) => check.ok || !check.blocking),
    blockingReason: getPreflightBlockingReason(checks),
    executionMode: process.env.AUTOPOLY_EXECUTION_MODE ?? "live",
    decisionStrategy: input.orchestratorConfig.decisionStrategy,
    envFilePath: input.orchestratorConfig.envFilePath ?? input.executorConfig.envFilePath,
    redisUrl: input.orchestratorConfig.redisUrl,
    archiveRoot: input.args.archiveRoot,
    wallet: {
      funderAddress,
      signerAddress,
      signerMatchesFunder
    },
    collateral: {
      effectiveUsd: collateralProbe.balanceUsd,
      source: collateralProbe.source,
      reportedUsd: collateralProbe.reportedBalanceUsd,
      onchainUsd: collateralProbe.onchainBalanceUsd,
      probeError: collateralProbe.errorMessage
    },
    remotePositionCount: remotePositions.length,
    checks
  };
}

export async function acquireRunnerLock(lockPath: string, sessionDir: string) {
  const handle = await open(lockPath, "wx");
  await handle.writeFile(JSON.stringify({
    pid: process.pid,
    sessionDir,
    startedAtUtc: new Date().toISOString()
  }, null, 2));
  await handle.close();

  return async () => {
    await rm(lockPath, { force: true });
  };
}

async function readRecommendation(filePath: string): Promise<ExecutionDispatchRecommendation> {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as Partial<ExecutionDispatchRecommendation>;
  if (!raw.runId || !Array.isArray(raw.decisions) || !Array.isArray(raw.executablePlans)) {
    throw new Error(`Recommendation artifact is missing runId, decisions, or executablePlans: ${filePath}`);
  }
  return {
    runId: raw.runId,
    decisions: raw.decisions,
    executablePlans: raw.executablePlans,
    skipped: Array.isArray(raw.skipped) ? raw.skipped : []
  };
}

async function writeDispatchPlan(filePath: string, plan: ExecutionDispatchPlan) {
  await writeJsonArtifact(filePath, plan);
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runIteration(input: {
  args: Args;
  sessionDir: string;
  iteration: number;
  queue: Queue | null;
}): Promise<RunnerIterationSummary> {
  const startedAtUtc = new Date().toISOString();
  const iterationDir = path.join(input.sessionDir, `iteration-${String(input.iteration).padStart(4, "0")}`);
  await ensureDirectory(iterationDir);

  const pulseResult = await runPulseLive({
    json: true,
    recommendOnly: true,
    pulseJsonPath: input.args.pulseJsonPath,
    pulseMarkdownPath: input.args.pulseMarkdownPath,
    filters: {
      category: null,
      tag: null,
      minProb: null,
      maxProb: null,
      minLiquidity: null
    }
  });

  if (!pulseResult.ok || !pulseResult.recommendationPath) {
    throw new Error(`pulse-live recommend-only failed before dispatch planning. Archive: ${pulseResult.archiveDir}`);
  }

  const recommendation = await readRecommendation(pulseResult.recommendationPath);
  const initialPlan = buildExecutionDispatchPlan({
    recommendation,
    sourceRecommendationPath: pulseResult.recommendationPath,
    mode: input.args.mockExecutor ? "mock" : "live"
  });
  const dispatchPlanPath = path.join(iterationDir, "execution-dispatch-plan.json");
  await writeDispatchPlan(dispatchPlanPath, initialPlan);

  const finalPlan = input.args.mockExecutor
    ? markExecutionDispatchPlanMocked({ plan: initialPlan })
    : await dispatchExecutionPlanToQueue({
        plan: initialPlan,
        executionQueue: input.queue!,
        recordSubmittedEvents: true
      });
  await writeDispatchPlan(dispatchPlanPath, finalPlan);

  const summary = {
    iteration: input.iteration,
    startedAtUtc,
    finishedAtUtc: new Date().toISOString(),
    pulseLiveArchiveDir: pulseResult.archiveDir ?? null,
    recommendationPath: pulseResult.recommendationPath,
    dispatchPlanPath,
    readyOrders: initialPlan.summary.ready,
    queuedOrders: finalPlan.summary.queued,
    mockedOrders: finalPlan.summary.mocked,
    skippedOrders: finalPlan.summary.skipped,
    failedOrders: finalPlan.summary.failed
  } satisfies RunnerIterationSummary;
  await writeJsonArtifact(path.join(iterationDir, "iteration-summary.json"), summary);
  return summary;
}

export async function runPersistentAgent(args: Args = parseArgs()) {
  process.env.ENV_FILE = process.env.ENV_FILE?.trim() || ".env.pizza";
  process.env.AUTOPOLY_EXECUTION_MODE = process.env.AUTOPOLY_EXECUTION_MODE?.trim() || "live";
  process.env.AGENT_DECISION_STRATEGY = process.env.AGENT_DECISION_STRATEGY?.trim() || "pulse-direct";

  const printer = createTerminalPrinter();
  const timestamp = formatTimestampToken();
  await mkdir(args.archiveRoot, { recursive: true });
  const sessionDir = path.join(args.archiveRoot, timestamp);
  await ensureDirectory(sessionDir);
  const lockPath = path.join(args.archiveRoot, "runner.lock");
  const releaseLock = await acquireRunnerLock(lockPath, sessionDir).catch((error) => {
    throw new Error(`Persistent runner refused to start; runner.lock already exists at ${lockPath}. ${getErrorMessage(error)}`);
  });

  let queue: Queue | null = null;
  const summaries: RunnerIterationSummary[] = [];
  const startedMs = Date.now();
  const timeoutMs = args.durationMinutes * 60_000;

  try {
    const orchestratorConfig = loadOrchestratorConfig();
    const executorConfig = loadExecutorConfig();
    const preflight = await runRunnerPreflight({
      args,
      sessionDir,
      executorConfig,
      orchestratorConfig
    });
    const preflightPath = path.join(sessionDir, "runner-preflight.json");
    await writeJsonArtifact(preflightPath, preflight);

    printer.section("Raven Agent Persistent Runner", args.mockExecutor ? "mock executor" : "live executor dispatch");
    printer.table([
      ["Execution Mode", preflight.executionMode],
      ["Decision Strategy", preflight.decisionStrategy],
      ["Env File", preflight.envFilePath ?? "-"],
      ["Wallet", maskAddressForDisplay(preflight.wallet.funderAddress)],
      ["Collateral", preflight.collateral.effectiveUsd == null ? "-" : formatUsd(preflight.collateral.effectiveUsd)],
      ["Archive Dir", sessionDir],
      ["Preflight", preflightPath]
    ]);
    for (const check of preflight.checks) {
      printer.note(check.ok ? "success" : check.blocking ? "error" : "warn", check.key, check.summary);
    }
    if (!preflight.ok) {
      throw new Error(preflight.blockingReason ?? "Persistent runner preflight failed.");
    }

    if (!args.mockExecutor) {
      queue = new Queue(QUEUES.execution, {
        connection: {
          url: orchestratorConfig.redisUrl,
          maxRetriesPerRequest: null
        }
      });
    }

    for (let iteration = 1; iteration <= args.maxIterations; iteration += 1) {
      const elapsedMs = Date.now() - startedMs;
      if (iteration > 1 && timeoutMs > 0 && elapsedMs >= timeoutMs) {
        printer.note("warn", "duration limit reached", `elapsed ${formatDuration(elapsedMs)} / limit ${formatDuration(timeoutMs)}`);
        break;
      }

      printer.progress({
        percent: Math.round((iteration - 1) / args.maxIterations * 100),
        label: `Iteration ${iteration}/${args.maxIterations}`,
        detail: args.mockExecutor ? "building dispatch artifacts only" : `queueing ready orders to ${QUEUES.execution}`,
        elapsedMs,
        timeoutMs
      });
      const summary = await runIteration({
        args,
        sessionDir,
        iteration,
        queue
      });
      summaries.push(summary);
      printer.note(
        args.mockExecutor ? "info" : "success",
        `iteration ${iteration} dispatch`,
        `ready ${summary.readyOrders} | queued ${summary.queuedOrders} | mocked ${summary.mockedOrders} | skipped ${summary.skippedOrders} | failed ${summary.failedOrders}`
      );

      if (iteration < args.maxIterations) {
        await sleep(args.intervalMinutes * 60_000);
      }
    }

    const runSummary = {
      ok: true,
      mode: args.mockExecutor ? "mock" : "live",
      archiveDir: sessionDir,
      iterations: summaries.length,
      summaries
    };
    await writeJsonArtifact(path.join(sessionDir, "runner-summary.json"), runSummary);
    printer.note("success", "Persistent runner completed", sessionDir);
    if (args.json) {
      console.log(JSON.stringify(runSummary, null, 2));
    }
    return runSummary;
  } catch (error) {
    const errorPath = path.join(sessionDir, "error.json");
    await writeJsonArtifact(errorPath, {
      ok: false,
      message: getErrorMessage(error),
      archiveDir: sessionDir,
      summaries
    });
    if (args.json) {
      console.log(JSON.stringify({
        ok: false,
        archiveDir: sessionDir,
        errorPath,
        message: getErrorMessage(error)
      }, null, 2));
    } else {
      printErrorSummary(printer, {
        title: "Raven Agent Persistent Runner Failed",
        stage: "runner",
        error,
        artifactDir: sessionDir,
        nextSteps: [
          "Inspect runner-preflight.json, execution-dispatch-plan.json, and error.json in the archive.",
          "Fix the blocking preflight or queue failure before retrying."
        ]
      });
    }
    return {
      ok: false,
      archiveDir: sessionDir,
      errorPath,
      message: getErrorMessage(error)
    };
  } finally {
    if (queue) {
      await queue.close();
    }
    await releaseLock();
  }
}

async function main() {
  const result = await runPersistentAgent(parseArgs());
  if (!result.ok) {
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main().catch((error) => {
    printErrorSummary(createTerminalPrinter(), {
      title: "Raven Agent Persistent Runner Failed",
      stage: "bootstrap",
      error,
      nextSteps: ["Inspect the stack trace above and retry after fixing the bootstrap error."]
    });
    process.exit(1);
  });
}
