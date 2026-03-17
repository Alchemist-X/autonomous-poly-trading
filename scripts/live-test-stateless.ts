import path from "node:path";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import type { OverviewResponse, PublicPosition, TradeDecision } from "@autopoly/contracts";
import { inferPaperSellAmount } from "@autopoly/contracts";
import {
  createTerminalPrinter,
  formatRatioPercent,
  formatUsd,
  getErrorMessage,
  printErrorSummary,
  shouldUseHumanOutput
} from "@autopoly/terminal-ui";
import { Wallet } from "ethers";
import { loadConfig as loadExecutorConfig } from "../services/executor/src/config.ts";
import {
  computeAvgCost,
  executeMarketOrder,
  fetchRemotePositions,
  getCollateralBalanceAllowance,
  readBook,
  type RemotePosition
} from "../services/executor/src/lib/polymarket.ts";
import { loadConfig as loadOrchestratorConfig } from "../services/orchestrator/src/config.ts";
import { applyTradeGuards } from "../services/orchestrator/src/lib/risk.ts";
import { createTerminalProgressReporter } from "../services/orchestrator/src/lib/terminal-progress.ts";
import { generatePulseSnapshot } from "../services/orchestrator/src/pulse/market-pulse.ts";
import { createAgentRuntime } from "../services/orchestrator/src/runtime/runtime-factory.ts";
import { resolveProviderSkillSettings } from "../services/orchestrator/src/runtime/skill-settings.ts";
import { buildLiveTestDirectoryName } from "./live-test-helpers.ts";
import { loadPulseSnapshotFromArtifacts } from "./live-test-stateless-pulse.ts";
import {
  STATELESS_MAX_BUY_TOKENS,
  STATELESS_MIN_TRADE_USD,
  buildStatelessRunIdentityRows,
  buildStatelessOverview,
  calculatePositionPnlPct,
  calculatePositionValueUsd,
  capBuyNotionalToTokenLimit
} from "./live-test-stateless-helpers.ts";
import {
  mapOverviewToSummarySnapshot,
  writeRunSummaryArtifacts
} from "./live-run-summary.ts";

interface Args {
  json: boolean;
  recommendOnly: boolean;
  pulseJsonPath: string | null;
  pulseMarkdownPath: string | null;
}

interface PreflightReport {
  ok: boolean;
  envFilePath: string | null;
  executionMode: string;
  decisionStrategy: string;
  signerAddress: string;
  funderAddress: string;
  collateralBalanceUsd: number;
  collateralSource: "reported" | "onchain" | "fallback";
  reportedCollateralBalanceUsd: number | null;
  onchainUsdcBalanceUsd: number | null;
  collateralProbeError: string | null;
  remotePositionCount: number;
  bankrollCapUsd: number;
  minTradeUsd: number;
  statelessMinTradeUsd: number;
  maxTradePct: number;
  maxEventExposurePct: number;
  maxBuyTokens: number;
  checks: Array<{
    key: string;
    ok: boolean;
    detail: string;
  }>;
}

interface PlannedExecution {
  action: TradeDecision["action"];
  marketSlug: string;
  eventSlug: string;
  tokenId: string;
  side: TradeDecision["side"];
  notionalUsd: number;
  bankrollRatio: number;
  executionAmount: number;
  unit: "usd" | "shares";
  thesisMd: string;
  cappedByTokenLimit: boolean;
  bestAsk: number | null;
  bestBid: number | null;
}

interface ExecutedOrderSummary extends PlannedExecution {
  orderId: string | null;
  ok: boolean;
  avgPrice: number | null;
  filledNotionalUsd: number;
  rawResponse: unknown;
}

class StatelessLiveError extends Error {
  constructor(
    readonly stage: string,
    message: string,
    readonly context: Array<[string, string]> = [],
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "StatelessLiveError";
  }
}

function parseArgs(argv = process.argv.slice(2)): Args {
  const get = (flag: string) => {
    const index = argv.indexOf(flag);
    const value = index >= 0 ? argv[index + 1] : undefined;
    return value && !value.startsWith("--") ? value : null;
  };
  return {
    json: argv.includes("--json"),
    recommendOnly: argv.includes("--recommend-only"),
    pulseJsonPath: get("--pulse-json"),
    pulseMarkdownPath: get("--pulse-markdown")
  };
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(4));
}

function maskAddress(address: string) {
  return address ? `${address.slice(0, 6)}***${address.slice(-4)}` : "-";
}

function formatTimestampToken(now = new Date()) {
  return now.toISOString().replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

interface OnchainBalanceProbe {
  balanceUsd: number | null;
  errorMessage: string | null;
}

interface CollateralProbe {
  balanceUsd: number | null;
  source: "reported" | "onchain" | "fallback";
  reportedBalanceUsd: number | null;
  onchainBalanceUsd: number | null;
  errorMessage: string | null;
}

function parseHexToUsd(value: unknown): number | null {
  if (typeof value !== "string" || !value.startsWith("0x")) {
    return null;
  }
  try {
    return Number(BigInt(value)) / 1e6;
  } catch {
    return null;
  }
}

async function readOnchainUsdcBalanceUsd(address: string): Promise<OnchainBalanceProbe> {
  if (!address) {
    return {
      balanceUsd: null,
      errorMessage: "missing funder address"
    };
  }
  const rpcUrl = process.env.POLYGON_RPC_URL?.trim() || "https://polygon-bor-rpc.publicnode.com";
  const usdcContract = (process.env.POLYGON_USDC_CONTRACT?.trim() || "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
  const normalized = address.toLowerCase().replace(/^0x/, "");
  if (normalized.length !== 40) {
    return {
      balanceUsd: null,
      errorMessage: "invalid funder address length"
    };
  }
  const data = `0x70a08231${normalized.padStart(64, "0")}`;
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: usdcContract, data }, "latest"]
      })
    });
    if (!response.ok) {
      throw new Error(`rpc status ${response.status}`);
    }
    const payload = await response.json() as { result?: unknown; error?: { message?: string } };
    if (payload.error) {
      throw new Error(payload.error.message ?? "rpc returned error");
    }
    const parsed = parseHexToUsd(payload.result);
    if (parsed == null) {
      throw new Error("rpc payload missing hex result");
    }
    return {
      balanceUsd: parsed,
      errorMessage: null
    };
  } catch (error) {
    return {
      balanceUsd: null,
      errorMessage: getErrorMessage(error)
    };
  }
}

async function ensureDirectory(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath: string, value: unknown) {
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

function buildContextRows(input: {
  envFilePath: string | null;
  archiveDir: string;
  funderAddress: string;
  executionMode: string;
  decisionStrategy: string;
  runId?: string | null;
  marketSlug?: string;
  tokenId?: string;
  requestedUsd?: number | null;
}) {
  return [
    ["Env File", input.envFilePath ?? "-"],
    ...buildStatelessRunIdentityRows({
      executionMode: input.executionMode,
      decisionStrategy: input.decisionStrategy
    }),
    ["Archive Dir", input.archiveDir],
    ["Wallet", maskAddress(input.funderAddress)],
    ["Run ID", input.runId ?? "-"],
    ["Market", input.marketSlug ?? "-"],
    ["Token", input.tokenId ?? "-"],
    ["Requested USD", input.requestedUsd == null ? "-" : formatUsd(input.requestedUsd)]
  ];
}

async function readCollateralBalanceUsd(config: ReturnType<typeof loadExecutorConfig>): Promise<CollateralProbe> {
  let reportedBalanceUsd: number | null = null;
  let reportedError: string | null = null;

  try {
    const initialBalance = await getCollateralBalanceAllowance(config);
    if (!initialBalance) {
      throw new Error("No live Polymarket client available.");
    }
    const parsed = Number((initialBalance as any)?.balance ?? NaN);
    if (Number.isFinite(parsed)) {
      reportedBalanceUsd = parsed / 1e6;
    } else {
      throw new Error("Collateral payload did not contain numeric balance.");
    }
  } catch (error) {
    reportedError = getErrorMessage(error);
  }

  const onchainProbe = await readOnchainUsdcBalanceUsd(config.funderAddress);

  if ((reportedBalanceUsd ?? 0) > 0) {
    return {
      balanceUsd: reportedBalanceUsd,
      source: "reported",
      reportedBalanceUsd,
      onchainBalanceUsd: onchainProbe.balanceUsd,
      errorMessage: reportedError ?? onchainProbe.errorMessage
    };
  }

  if ((onchainProbe.balanceUsd ?? 0) > 0) {
    return {
      balanceUsd: onchainProbe.balanceUsd,
      source: "onchain",
      reportedBalanceUsd,
      onchainBalanceUsd: onchainProbe.balanceUsd,
      errorMessage: reportedError
    };
  }

  if (reportedBalanceUsd != null) {
    return {
      balanceUsd: reportedBalanceUsd,
      source: "reported",
      reportedBalanceUsd,
      onchainBalanceUsd: onchainProbe.balanceUsd,
      errorMessage: [reportedError, onchainProbe.errorMessage].filter(Boolean).join(" | ") || null
    };
  }

  return {
    balanceUsd: null,
    source: "fallback",
    reportedBalanceUsd: null,
    onchainBalanceUsd: onchainProbe.balanceUsd,
    errorMessage: [reportedError, onchainProbe.errorMessage].filter(Boolean).join(" | ") || null
  };
}

async function buildRemotePublicPositions(
  executorConfig: ReturnType<typeof loadExecutorConfig>,
  remotePositions: RemotePosition[],
  stopLossPct: number
): Promise<PublicPosition[]> {
  const timestamp = new Date().toISOString();
  return Promise.all(
    remotePositions.map(async (remote) => {
      const [avgCost, book] = await Promise.all([
        computeAvgCost(executorConfig, remote.tokenId),
        readBook(executorConfig, remote.tokenId)
      ]);
      const currentPrice = book?.bestBid ?? avgCost ?? 0.5;
      const normalizedAvgCost = avgCost ?? currentPrice;
      return {
        id: randomUUID(),
        event_slug: remote.eventSlug ?? remote.marketSlug ?? remote.tokenId,
        market_slug: remote.marketSlug ?? remote.eventSlug ?? remote.tokenId,
        token_id: remote.tokenId,
        side: "BUY",
        outcome_label: remote.outcome || "Unknown",
        size: remote.size,
        avg_cost: normalizedAvgCost,
        current_price: currentPrice,
        current_value_usd: calculatePositionValueUsd(remote.size, currentPrice),
        unrealized_pnl_pct: calculatePositionPnlPct(normalizedAvgCost, currentPrice),
        stop_loss_pct: stopLossPct,
        opened_at: timestamp,
        updated_at: timestamp
      } satisfies PublicPosition;
    })
  );
}

async function runPreflight(input: {
  executorConfig: ReturnType<typeof loadExecutorConfig>;
  orchestratorConfig: ReturnType<typeof loadOrchestratorConfig>;
  maxBuyTokens: number;
  minTradeUsd: number;
  recommendOnly: boolean;
}) {
  const remotePositions = await fetchRemotePositions(input.executorConfig);
  const collateralProbe = await readCollateralBalanceUsd(input.executorConfig);
  const signerAddress = input.executorConfig.privateKey
    ? (() => {
        try {
          return new Wallet(input.executorConfig.privateKey).address;
        } catch {
          return "";
        }
      })()
    : "";
  const signerMatchesFunder =
    signerAddress &&
    input.executorConfig.funderAddress &&
    signerAddress.toLowerCase() === input.executorConfig.funderAddress.toLowerCase();
  const effectiveCollateralBalanceUsd = roundCurrency(
    collateralProbe.balanceUsd ?? input.orchestratorConfig.initialBankrollUsd
  );
  const checks = [
    {
      key: "execution-mode",
      ok: process.env.AUTOPOLY_EXECUTION_MODE === "live",
      detail: process.env.AUTOPOLY_EXECUTION_MODE === "live"
        ? "AUTOPOLY_EXECUTION_MODE is live."
        : `AUTOPOLY_EXECUTION_MODE must be live. Received ${process.env.AUTOPOLY_EXECUTION_MODE ?? "-"}.`
    },
    {
      key: "env-file",
      ok: Boolean(input.orchestratorConfig.envFilePath ?? input.executorConfig.envFilePath),
      detail: (input.orchestratorConfig.envFilePath ?? input.executorConfig.envFilePath)
        ? `Using env file ${(input.orchestratorConfig.envFilePath ?? input.executorConfig.envFilePath)}.`
        : "ENV_FILE is required for stateless live runs."
    },
    {
      key: "credentials",
      ok: Boolean(input.executorConfig.privateKey && input.executorConfig.funderAddress),
      detail: input.executorConfig.privateKey && input.executorConfig.funderAddress
        ? "PRIVATE_KEY and FUNDER_ADDRESS are present."
        : "Missing PRIVATE_KEY or FUNDER_ADDRESS."
    },
    {
      key: "signer-funder",
      ok: true,
      detail: !signerAddress
        ? "Unable to derive signer address from PRIVATE_KEY."
        : !input.executorConfig.funderAddress
          ? "FUNDER_ADDRESS is missing."
          : signerMatchesFunder
            ? "Signer address matches FUNDER_ADDRESS."
            : `Signer ${signerAddress} does not match FUNDER_ADDRESS ${input.executorConfig.funderAddress}. Proceeding in non-blocking mode (proxy/funder setup may be intentional).`
    },
    {
      key: "collateral",
      ok: input.recommendOnly || collateralProbe.balanceUsd == null || collateralProbe.balanceUsd > 0 || remotePositions.length > 0,
      detail: input.recommendOnly && !(collateralProbe.balanceUsd == null || collateralProbe.balanceUsd > 0 || remotePositions.length > 0)
        ? "Recommend-only mode ignores zero collateral and continues without sending live orders."
        : collateralProbe.balanceUsd == null
          ? `Collateral probe unavailable; falling back to bankroll cap ${input.orchestratorConfig.initialBankrollUsd.toFixed(2)} USD. ${collateralProbe.errorMessage ?? ""}`.trim()
        : collateralProbe.balanceUsd > 0 || remotePositions.length > 0
          ? `Collateral ${collateralProbe.balanceUsd.toFixed(2)} USD (${collateralProbe.source}) | reported ${(collateralProbe.reportedBalanceUsd ?? 0).toFixed(2)} USD | onchain ${(collateralProbe.onchainBalanceUsd ?? 0).toFixed(2)} USD | remote positions ${remotePositions.length}.`
          : `No tradable collateral and no remote positions are available. reported ${(collateralProbe.reportedBalanceUsd ?? 0).toFixed(2)} USD | onchain ${(collateralProbe.onchainBalanceUsd ?? 0).toFixed(2)} USD.`
    },
    {
      key: "buy-token-cap",
      ok: input.maxBuyTokens > 0,
      detail: `Each buy order is capped to ${input.maxBuyTokens} token(s).`
    }
  ];

  return {
    report: {
      ok: checks.every((check) => check.ok),
      envFilePath: input.orchestratorConfig.envFilePath ?? input.executorConfig.envFilePath,
      executionMode: process.env.AUTOPOLY_EXECUTION_MODE ?? "live",
      decisionStrategy: input.orchestratorConfig.decisionStrategy,
      signerAddress,
      funderAddress: input.executorConfig.funderAddress,
      collateralBalanceUsd: effectiveCollateralBalanceUsd,
      collateralSource: collateralProbe.source,
      reportedCollateralBalanceUsd: collateralProbe.reportedBalanceUsd,
      onchainUsdcBalanceUsd: collateralProbe.onchainBalanceUsd,
      collateralProbeError: collateralProbe.errorMessage,
      remotePositionCount: remotePositions.length,
      bankrollCapUsd: input.orchestratorConfig.initialBankrollUsd,
      minTradeUsd: input.orchestratorConfig.minTradeUsd,
      statelessMinTradeUsd: input.minTradeUsd,
      maxTradePct: input.orchestratorConfig.maxTradePct,
      maxEventExposurePct: input.orchestratorConfig.maxEventExposurePct,
      maxBuyTokens: input.maxBuyTokens,
      checks
    } satisfies PreflightReport,
    remotePositions,
    collateralBalanceUsd: effectiveCollateralBalanceUsd
  };
}

async function buildExecutionPlan(input: {
  decisions: TradeDecision[];
  positions: PublicPosition[];
  overview: OverviewResponse;
  orchestratorConfig: ReturnType<typeof loadOrchestratorConfig>;
  executorConfig: ReturnType<typeof loadExecutorConfig>;
  maxBuyTokens: number;
  minTradeUsd: number;
}) {
  const plans: PlannedExecution[] = [];
  const skipped: Array<{ marketSlug: string; reason: string }> = [];
  const usePulseDirectEmptyPortfolioGuards =
    input.orchestratorConfig.decisionStrategy === "pulse-direct" && input.positions.length === 0;
  let projectedTotalExposureUsd = input.positions.reduce((sum, position) => sum + position.current_value_usd, 0);
  let projectedOpenPositions = input.overview.open_positions;
  const eventExposureUsd = new Map<string, number>();
  for (const position of input.positions) {
    eventExposureUsd.set(
      position.event_slug,
      (eventExposureUsd.get(position.event_slug) ?? 0) + position.current_value_usd
    );
  }

  for (const decision of input.decisions) {
    if (!["open", "close", "reduce"].includes(decision.action)) {
      continue;
    }

    if (decision.action === "open") {
      const guardedNotionalUsd = applyTradeGuards({
        requestedUsd: decision.notional_usd,
        bankrollUsd: input.overview.total_equity_usd,
        minTradeUsd: input.minTradeUsd,
        maxTradePct: input.orchestratorConfig.maxTradePct,
        liquidityCapUsd: decision.notional_usd,
        totalExposureUsd: usePulseDirectEmptyPortfolioGuards ? 0 : projectedTotalExposureUsd,
        maxTotalExposurePct: usePulseDirectEmptyPortfolioGuards ? 1 : input.orchestratorConfig.maxTotalExposurePct,
        eventExposureUsd: eventExposureUsd.get(decision.event_slug) ?? 0,
        maxEventExposurePct: input.orchestratorConfig.maxEventExposurePct,
        openPositions: usePulseDirectEmptyPortfolioGuards ? 0 : projectedOpenPositions,
        maxPositions: usePulseDirectEmptyPortfolioGuards ? Number.MAX_SAFE_INTEGER : input.orchestratorConfig.maxPositions,
        edge: decision.edge
      });

      if (!(guardedNotionalUsd > 0)) {
        skipped.push({
          marketSlug: decision.market_slug,
          reason: "guardrails removed the open decision"
        });
        continue;
      }

      const book = await readBook(input.executorConfig, decision.token_id);
      const cappedNotionalUsd = roundCurrency(
        capBuyNotionalToTokenLimit({
          requestedNotionalUsd: guardedNotionalUsd,
          bestAsk: book?.bestAsk ?? null,
          marketProb: decision.market_prob,
          maxTokens: input.maxBuyTokens
        })
      );

      if (!(cappedNotionalUsd >= input.minTradeUsd)) {
        skipped.push({
          marketSlug: decision.market_slug,
          reason: `1-token cap reduced notional below stateless minimum trade (${input.minTradeUsd})`
        });
        continue;
      }

      plans.push({
        action: decision.action,
        marketSlug: decision.market_slug,
        eventSlug: decision.event_slug,
        tokenId: decision.token_id,
        side: decision.side,
        notionalUsd: cappedNotionalUsd,
        bankrollRatio: input.overview.total_equity_usd > 0
          ? cappedNotionalUsd / input.overview.total_equity_usd
          : 0,
        executionAmount: cappedNotionalUsd,
        unit: "usd",
        thesisMd: decision.thesis_md,
        cappedByTokenLimit: cappedNotionalUsd < guardedNotionalUsd,
        bestAsk: book?.bestAsk ?? null,
        bestBid: book?.bestBid ?? null
      });

      projectedTotalExposureUsd += cappedNotionalUsd;
      projectedOpenPositions += 1;
      eventExposureUsd.set(
        decision.event_slug,
        (eventExposureUsd.get(decision.event_slug) ?? 0) + cappedNotionalUsd
      );
      continue;
    }

    const currentPosition = input.positions.find((position) => position.token_id === decision.token_id) ?? null;
    const executionAmount = inferPaperSellAmount(currentPosition, decision);
    if (!(executionAmount > 0)) {
      skipped.push({
        marketSlug: decision.market_slug,
        reason: "no matching remote position is available to sell"
      });
      continue;
    }

    const book = await readBook(input.executorConfig, decision.token_id);
    plans.push({
      action: decision.action,
      marketSlug: decision.market_slug,
      eventSlug: decision.event_slug,
      tokenId: decision.token_id,
      side: decision.side,
      notionalUsd: roundCurrency(decision.notional_usd),
      bankrollRatio: input.overview.total_equity_usd > 0
        ? decision.notional_usd / input.overview.total_equity_usd
        : 0,
      executionAmount,
      unit: "shares",
      thesisMd: decision.thesis_md,
      cappedByTokenLimit: false,
      bestAsk: book?.bestAsk ?? null,
      bestBid: book?.bestBid ?? null
    });
  }

  return { plans, skipped };
}

async function executePlans(input: {
  plans: PlannedExecution[];
  executorConfig: ReturnType<typeof loadExecutorConfig>;
  archiveDir: string;
  runId: string;
  envFilePath: string | null;
  executionMode: string;
  decisionStrategy: string;
}) {
  const executed: ExecutedOrderSummary[] = [];
  for (const plan of input.plans) {
    const result = await executeMarketOrder(input.executorConfig, {
      tokenId: plan.tokenId,
      side: plan.side,
      amount: plan.executionAmount
    });
    const summary: ExecutedOrderSummary = {
      ...plan,
      orderId: result.orderId ?? null,
      ok: result.ok,
      avgPrice: result.avgPrice ?? null,
      filledNotionalUsd: result.filledNotionalUsd,
      rawResponse: result.rawResponse
    };
    executed.push(summary);

    if (!result.ok) {
      throw new StatelessLiveError(
        "execute",
        `Order rejected for ${plan.marketSlug}.`,
        buildContextRows({
          envFilePath: input.envFilePath,
          archiveDir: input.archiveDir,
          funderAddress: input.executorConfig.funderAddress,
          executionMode: input.executionMode,
          decisionStrategy: input.decisionStrategy,
          runId: input.runId,
          marketSlug: plan.marketSlug,
          tokenId: plan.tokenId,
          requestedUsd: plan.notionalUsd
        }),
        { cause: result.rawResponse }
      );
    }
  }
  return executed;
}

async function buildFinalPortfolioState(input: {
  executorConfig: ReturnType<typeof loadExecutorConfig>;
  orchestratorConfig: ReturnType<typeof loadOrchestratorConfig>;
}) {
  const [remotePositions, collateralBalanceUsd] = await Promise.all([
    fetchRemotePositions(input.executorConfig),
    readCollateralBalanceUsd(input.executorConfig)
  ]);
  const positions = await buildRemotePublicPositions(
    input.executorConfig,
    remotePositions,
    input.orchestratorConfig.positionStopLossPct
  );
  const overview = buildStatelessOverview({
    collateralBalanceUsd: roundCurrency(collateralBalanceUsd.balanceUsd ?? input.orchestratorConfig.initialBankrollUsd),
    positions,
    bankrollCapUsd: input.orchestratorConfig.initialBankrollUsd
  });
  return {
    remotePositions,
    positions,
    overview,
    collateralBalanceUsd: roundCurrency(collateralBalanceUsd.balanceUsd ?? input.orchestratorConfig.initialBankrollUsd)
  };
}

function printRecommendationSummary(input: {
  executionMode: string;
  decisionStrategy: string;
  envFilePath: string | null;
  runId: string;
  archiveDir: string;
  collateralBalanceUsd: number;
  overview: OverviewResponse;
  plans: PlannedExecution[];
  skipped: Array<{ marketSlug: string; reason: string }>;
  pulseMarkdownPath: string;
  pulseJsonPath: string;
  runtimeLogPath: string | null;
}) {
  const printer = createTerminalPrinter();
  printer.section("Stateless Recommendation", "route live:test:stateless");
  printer.table([
    ["Run ID", input.runId],
    ["Env File", input.envFilePath ?? "-"],
    ...buildStatelessRunIdentityRows({
      executionMode: input.executionMode,
      decisionStrategy: input.decisionStrategy
    }),
    ["Wallet Collateral", formatUsd(input.collateralBalanceUsd)],
    ["Effective Bankroll", formatUsd(input.overview.total_equity_usd)],
    ["Archive Dir", input.archiveDir]
  ]);
  printer.section("Executable Decisions", `${input.plans.length} trade(s)`);
  if (input.plans.length === 0) {
    printer.note("warn", "No executable trades", "All open decisions were removed by guardrails or token caps.");
  } else {
    for (const [index, plan] of input.plans.entries()) {
      printer.note(
        plan.action === "open" ? "success" : "warn",
        `${index + 1}. ${plan.action} ${plan.marketSlug}`,
        `${formatUsd(plan.notionalUsd)} | ${formatRatioPercent(plan.bankrollRatio)} bankroll${plan.cappedByTokenLimit ? " | capped to 1 token" : ""}`
      );
      printer.line(`    ${plan.thesisMd}`);
    }
  }
  if (input.skipped.length > 0) {
    printer.section("Skipped Decisions");
    for (const item of input.skipped) {
      printer.note("muted", item.marketSlug, item.reason);
    }
  }
  printer.section("Artifacts");
  printer.table([
    ["Pulse Markdown", input.pulseMarkdownPath],
    ["Pulse JSON", input.pulseJsonPath],
    ["Runtime Log", input.runtimeLogPath ?? "-"]
  ]);
}

function printExecutionSummary(input: {
  executionMode: string;
  decisionStrategy: string;
  runId: string;
  archiveDir: string;
  overview: OverviewResponse;
  executed: ExecutedOrderSummary[];
}) {
  const printer = createTerminalPrinter();
  printer.section("Stateless Execution Summary", `run ${input.runId}`);
  printer.table([
    ...buildStatelessRunIdentityRows({
      executionMode: input.executionMode,
      decisionStrategy: input.decisionStrategy
    }),
    ["Archive Dir", input.archiveDir],
    ["Cash", formatUsd(input.overview.cash_balance_usd)],
    ["Equity", formatUsd(input.overview.total_equity_usd)],
    ["Open Positions", String(input.overview.open_positions)],
    ["Drawdown", formatRatioPercent(input.overview.drawdown_pct)]
  ]);
  if (input.executed.length === 0) {
    printer.note("warn", "No live orders were sent");
    return;
  }
  for (const [index, order] of input.executed.entries()) {
    printer.note(
      order.ok ? "success" : "error",
      `${index + 1}. ${order.marketSlug}`,
      `${order.side} ${order.unit === "usd" ? formatUsd(order.executionAmount) : `${order.executionAmount.toFixed(4)} shares`} | order ${order.orderId ?? "-"}`
    );
  }
}

export async function runStatelessLiveTest(args: Args = parseArgs()) {
  process.env.ENV_FILE = process.env.ENV_FILE?.trim() || ".env.pizza";
  const reporter = createTerminalProgressReporter({
    enabled: !args.json,
    stream: args.json ? process.stderr : process.stdout
  });
  const useHumanOutput = !args.json && shouldUseHumanOutput(process.stdout);
  const orchestratorConfig = loadOrchestratorConfig();
  const executorConfig = loadExecutorConfig();
  const maxBuyTokens = Math.max(
    0,
    Number.isFinite(Number(process.env.STATELESS_MAX_BUY_TOKENS))
      ? Number(process.env.STATELESS_MAX_BUY_TOKENS)
      : STATELESS_MAX_BUY_TOKENS
  );
  const statelessMinTradeUsd = Math.max(
    0,
    Number.isFinite(Number(process.env.STATELESS_MIN_TRADE_USD))
      ? Number(process.env.STATELESS_MIN_TRADE_USD)
      : Math.min(orchestratorConfig.minTradeUsd, STATELESS_MIN_TRADE_USD)
  );
  const timestamp = formatTimestampToken();
  let archiveDir = await createArchiveDir(
    path.join(orchestratorConfig.artifactStorageRoot, "live-stateless"),
    timestamp
  );
  let runId: string | null = null;
  let errorPath: string | null = null;
  let preflightPath: string | null = null;
  let recommendationPath: string | null = null;
  let executionSummaryPath: string | null = null;
  let preflightReport: PreflightReport | null = null;
  let overviewBefore: OverviewResponse | null = null;
  let overviewAfter: OverviewResponse | null = null;
  let decisionsForSummary: TradeDecision[] = [];
  let plansForSummary: PlannedExecution[] = [];
  let skippedForSummary: Array<{ marketSlug: string; reason: string }> = [];
  let executedForSummary: ExecutedOrderSummary[] = [];
  let promptSummary: string | null = null;
  let reasoningMd: string | null = null;
  let pulseMarkdownPath: string | null = null;
  let pulseJsonPath: string | null = null;
  let runtimeLogPath: string | null = null;

  try {
    reporter.info("Flow: 1) preflight 2) fetch remote portfolio 3) generate pulse 4) run decision runtime 5) apply guards + 1-token cap 6) execute directly 7) summarize");
    const preflight = await runPreflight({
      executorConfig,
      orchestratorConfig,
      maxBuyTokens,
      minTradeUsd: statelessMinTradeUsd,
      recommendOnly: args.recommendOnly
    });
    preflightReport = preflight.report;
    preflightPath = path.join(archiveDir, "preflight.json");
    await writeJson(preflightPath, preflight.report);
    if (useHumanOutput) {
      const printer = createTerminalPrinter();
      printer.section("Stateless Live Preflight", "route live:test:stateless");
      printer.table([
        ["Env File", preflight.report.envFilePath ?? "-"],
        ...buildStatelessRunIdentityRows({
          executionMode: preflight.report.executionMode,
          decisionStrategy: preflight.report.decisionStrategy
        }),
        ["Signer", maskAddress(preflight.report.signerAddress)],
        ["Wallet", maskAddress(preflight.report.funderAddress)],
        ["Effective Collateral", formatUsd(preflight.report.collateralBalanceUsd)],
        ["Reported Collateral", preflight.report.reportedCollateralBalanceUsd == null ? "-" : formatUsd(preflight.report.reportedCollateralBalanceUsd)],
        ["Onchain USDC", preflight.report.onchainUsdcBalanceUsd == null ? "-" : formatUsd(preflight.report.onchainUsdcBalanceUsd)],
        ["Collateral Source", preflight.report.collateralSource],
        ["Remote Positions", String(preflight.report.remotePositionCount)],
        ["Bankroll Cap", formatUsd(preflight.report.bankrollCapUsd)],
        ["Min Trade", formatUsd(preflight.report.minTradeUsd)],
        ["Stateless Min Trade", formatUsd(preflight.report.statelessMinTradeUsd)],
        ["Buy Token Cap", String(preflight.report.maxBuyTokens)]
      ]);
      for (const check of preflight.report.checks) {
        printer.note(check.ok ? "success" : "error", check.key, check.detail);
      }
    }
    if (!preflight.report.ok) {
      throw new StatelessLiveError(
        "preflight",
        "Stateless live preflight failed.",
        buildContextRows({
          envFilePath: preflight.report.envFilePath,
          archiveDir,
          funderAddress: executorConfig.funderAddress,
          executionMode: preflight.report.executionMode,
          decisionStrategy: preflight.report.decisionStrategy
        })
      );
    }

    const positions = await buildRemotePublicPositions(
      executorConfig,
      preflight.remotePositions,
      orchestratorConfig.positionStopLossPct
    );
    const overview = buildStatelessOverview({
      collateralBalanceUsd: preflight.collateralBalanceUsd,
      positions,
      bankrollCapUsd: orchestratorConfig.initialBankrollUsd
    });
    overviewBefore = overview;
    const pulseRunId = randomUUID();
    const settings = resolveProviderSkillSettings(orchestratorConfig, orchestratorConfig.runtimeProvider);
    reporter.stage({
      percent: 10,
      label: "Loaded stateless portfolio context",
      detail: `${positions.length} positions | collateral ${formatUsd(preflight.collateralBalanceUsd)} | effective bankroll ${formatUsd(overview.total_equity_usd)}`
    });
    const pulse = args.pulseJsonPath
      ? await loadPulseSnapshotFromArtifacts({
          artifactStorageRoot: orchestratorConfig.artifactStorageRoot,
          pulseJsonPath: args.pulseJsonPath,
          pulseMarkdownPath: args.pulseMarkdownPath
        })
      : await generatePulseSnapshot({
          config: orchestratorConfig,
          provider: orchestratorConfig.runtimeProvider,
          locale: settings.locale,
          runId: pulseRunId,
          mode: "full",
          progress: reporter
        });
    reporter.stage({
      percent: 70,
      label: args.pulseJsonPath ? "Reused pulse snapshot ready" : "Pulse snapshot ready",
      detail: `${pulse.selectedCandidates} candidates | risk flags ${pulse.riskFlags.length}`
    });
    const runtime = createAgentRuntime(orchestratorConfig);
    const runtimeResult = await runtime.run({
      runId: pulseRunId,
      mode: "full",
      overview,
      positions,
      pulse,
      progress: reporter
    });
    runId = runtimeResult.decisionSet.run_id;
    archiveDir = await finalizeArchiveDir(archiveDir, timestamp, runId);
    preflightPath = path.join(archiveDir, "preflight.json");
    runtimeLogPath = runtimeResult.decisionSet.artifacts.find((artifact) => artifact.kind === "runtime-log")?.path ?? null;
    recommendationPath = path.join(archiveDir, "recommendation.json");
    promptSummary = runtimeResult.promptSummary;
    reasoningMd = runtimeResult.reasoningMd;
    decisionsForSummary = runtimeResult.decisionSet.decisions;
    pulseMarkdownPath = pulse.absoluteMarkdownPath;
    pulseJsonPath = pulse.absoluteJsonPath;
    const { plans, skipped } = await buildExecutionPlan({
      decisions: runtimeResult.decisionSet.decisions,
      positions,
      overview,
      orchestratorConfig,
      executorConfig,
      maxBuyTokens,
      minTradeUsd: statelessMinTradeUsd
    });
    plansForSummary = plans;
    skippedForSummary = skipped;
    await writeJson(recommendationPath, {
      runId,
      executionMode: "live-stateless",
      envFilePath: preflight.report.envFilePath,
      collateralBalanceUsd: preflight.report.collateralBalanceUsd,
      overview,
      pulseMarkdownPath: pulse.absoluteMarkdownPath,
      pulseJsonPath: pulse.absoluteJsonPath,
      runtimeLogPath: runtimeLogPath,
      promptSummary: runtimeResult.promptSummary,
      reasoningMd: runtimeResult.reasoningMd,
      decisions: runtimeResult.decisionSet.decisions,
      executablePlans: plans,
      skipped
    });

    if (useHumanOutput) {
      printRecommendationSummary({
        executionMode: preflight.report.executionMode,
        decisionStrategy: preflight.report.decisionStrategy,
        envFilePath: preflight.report.envFilePath,
        runId,
        archiveDir,
        collateralBalanceUsd: preflight.report.collateralBalanceUsd,
        overview,
        plans,
        skipped,
        pulseMarkdownPath: pulse.absoluteMarkdownPath,
        pulseJsonPath: pulse.absoluteJsonPath,
        runtimeLogPath: runtimeLogPath
      });
    }

    if (args.recommendOnly) {
      await writeRunSummaryArtifacts({
        mode: "live:test:stateless",
        executionMode: "live",
        strategy: orchestratorConfig.decisionStrategy,
        envFilePath: preflight.report.envFilePath,
        archiveDir,
        runId,
        status: "success",
        stage: "recommend-only",
        promptSummary,
        reasoningMd,
        decisions: decisionsForSummary.map((decision) => ({
          action: decision.action,
          marketSlug: decision.market_slug,
          eventSlug: decision.event_slug,
          tokenId: decision.token_id,
          side: decision.side,
          notionalUsd: decision.notional_usd,
          thesisMd: decision.thesis_md
        })),
        executablePlans: plansForSummary.map((plan) => ({
          action: plan.action,
          marketSlug: plan.marketSlug,
          eventSlug: plan.eventSlug,
          tokenId: plan.tokenId,
          side: plan.side,
          notionalUsd: plan.notionalUsd,
          bankrollRatio: plan.bankrollRatio,
          thesisMd: plan.thesisMd
        })),
        blockedItems: skippedForSummary.map((item) => ({
          marketSlug: item.marketSlug,
          reason: item.reason
        })),
        portfolioBefore: mapOverviewToSummarySnapshot(overview),
        portfolioAfter: mapOverviewToSummarySnapshot(overview),
        artifacts: {
          preflightPath,
          recommendationPath,
          pulseMarkdownPath,
          pulseJsonPath,
          runtimeLogPath
        }
      });
      const output = {
        ok: true,
        mode: "recommend-only",
        executionMode: preflight.report.executionMode,
        decisionStrategy: preflight.report.decisionStrategy,
        runId,
        archiveDir,
        recommendationPath,
        executablePlans: plans.length
      };
      if (args.json) {
        console.log(JSON.stringify(output, null, 2));
      }
      return output;
    }

    executedForSummary = await executePlans({
      plans,
      executorConfig,
      archiveDir,
      runId,
      envFilePath: preflight.report.envFilePath,
      executionMode: preflight.report.executionMode,
      decisionStrategy: preflight.report.decisionStrategy
    });
    const finalState = await buildFinalPortfolioState({
      executorConfig,
      orchestratorConfig
    });
    overviewAfter = finalState.overview;
    executionSummaryPath = path.join(archiveDir, "execution-summary.json");
    await writeJson(executionSummaryPath, {
      runId,
      archiveDir,
      overview: finalState.overview,
      collateralBalanceUsd: finalState.collateralBalanceUsd,
      positions: finalState.positions,
      executed: executedForSummary
    });

    reporter.done(`Stateless live run completed | ${runId}`);
    if (useHumanOutput) {
      printExecutionSummary({
        executionMode: preflight.report.executionMode,
        decisionStrategy: preflight.report.decisionStrategy,
        runId,
        archiveDir,
        overview: finalState.overview,
        executed: executedForSummary
      });
    }

    await writeRunSummaryArtifacts({
      mode: "live:test:stateless",
      executionMode: "live",
      strategy: orchestratorConfig.decisionStrategy,
      envFilePath: preflight.report.envFilePath,
      archiveDir,
      runId,
      status: "success",
      stage: "completed",
      promptSummary,
      reasoningMd,
      decisions: decisionsForSummary.map((decision) => ({
        action: decision.action,
        marketSlug: decision.market_slug,
        eventSlug: decision.event_slug,
        tokenId: decision.token_id,
        side: decision.side,
        notionalUsd: decision.notional_usd,
        thesisMd: decision.thesis_md
      })),
      executablePlans: plansForSummary.map((plan) => ({
        action: plan.action,
        marketSlug: plan.marketSlug,
        eventSlug: plan.eventSlug,
        tokenId: plan.tokenId,
        side: plan.side,
        notionalUsd: plan.notionalUsd,
        bankrollRatio: plan.bankrollRatio,
        thesisMd: plan.thesisMd
      })),
      executedOrders: executedForSummary.map((order) => ({
        action: order.action,
        marketSlug: order.marketSlug,
        tokenId: order.tokenId,
        side: order.side,
        requestedNotionalUsd: order.notionalUsd,
        executionAmount: order.executionAmount,
        executionUnit: order.unit,
        filledNotionalUsd: order.filledNotionalUsd,
        orderId: order.orderId,
        avgPrice: order.avgPrice,
        ok: order.ok
      })),
      blockedItems: skippedForSummary.map((item) => ({
        marketSlug: item.marketSlug,
        reason: item.reason
      })),
      portfolioBefore: overviewBefore ? mapOverviewToSummarySnapshot(overviewBefore) : null,
      portfolioAfter: overviewAfter ? mapOverviewToSummarySnapshot(overviewAfter) : null,
      artifacts: {
        preflightPath,
        recommendationPath,
        executionSummaryPath,
        pulseMarkdownPath,
        pulseJsonPath,
        runtimeLogPath
      }
    });

    const output = {
      ok: true,
      executionMode: preflight.report.executionMode,
      decisionStrategy: preflight.report.decisionStrategy,
      runId,
      archiveDir,
      recommendationPath,
      executionSummaryPath,
      executedOrders: executedForSummary.length
    };
    if (args.json) {
      console.log(JSON.stringify(output, null, 2));
    }
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stage = error instanceof StatelessLiveError ? error.stage : "unknown";
    const errorContext = error instanceof StatelessLiveError
      ? error.context
      : buildContextRows({
          envFilePath: preflightReport?.envFilePath ?? (orchestratorConfig.envFilePath ?? executorConfig.envFilePath),
          archiveDir,
          funderAddress: executorConfig.funderAddress,
          executionMode: preflightReport?.executionMode ?? (process.env.AUTOPOLY_EXECUTION_MODE ?? "live"),
          decisionStrategy: preflightReport?.decisionStrategy ?? orchestratorConfig.decisionStrategy,
          runId
        });
    errorPath = path.join(archiveDir, "error.json");
    await ensureDirectory(archiveDir);
    await writeJson(errorPath, {
      stage,
      message,
      archiveDir,
      runId,
      context: errorContext
    });
    await writeRunSummaryArtifacts({
      mode: "live:test:stateless",
      executionMode: "live",
      strategy: orchestratorConfig.decisionStrategy,
      envFilePath: preflightReport?.envFilePath ?? null,
      archiveDir,
      runId,
      status: "failed",
      stage,
      promptSummary,
      reasoningMd,
      decisions: decisionsForSummary.map((decision) => ({
        action: decision.action,
        marketSlug: decision.market_slug,
        eventSlug: decision.event_slug,
        tokenId: decision.token_id,
        side: decision.side,
        notionalUsd: decision.notional_usd,
        thesisMd: decision.thesis_md
      })),
      executablePlans: plansForSummary.map((plan) => ({
        action: plan.action,
        marketSlug: plan.marketSlug,
        eventSlug: plan.eventSlug,
        tokenId: plan.tokenId,
        side: plan.side,
        notionalUsd: plan.notionalUsd,
        bankrollRatio: plan.bankrollRatio,
        thesisMd: plan.thesisMd
      })),
      executedOrders: executedForSummary.map((order) => ({
        action: order.action,
        marketSlug: order.marketSlug,
        tokenId: order.tokenId,
        side: order.side,
        requestedNotionalUsd: order.notionalUsd,
        executionAmount: order.executionAmount,
        executionUnit: order.unit,
        filledNotionalUsd: order.filledNotionalUsd,
        orderId: order.orderId,
        avgPrice: order.avgPrice,
        ok: order.ok
      })),
      blockedItems: skippedForSummary.map((item) => ({
        marketSlug: item.marketSlug,
        reason: item.reason
      })),
      portfolioBefore: overviewBefore ? mapOverviewToSummarySnapshot(overviewBefore) : null,
      portfolioAfter: overviewAfter ? mapOverviewToSummarySnapshot(overviewAfter) : null,
      failure: {
        stage,
        message,
        nextSteps: [
          "Inspect error.json and recommendation.json in the stateless archive.",
          "Retry after fixing the Polymarket or provider-side failure."
        ]
      },
      artifacts: {
        preflightPath,
        recommendationPath,
        executionSummaryPath,
        errorPath,
        pulseMarkdownPath,
        pulseJsonPath,
        runtimeLogPath
      }
    });
    if (args.json) {
      console.log(JSON.stringify({
        ok: false,
        executionMode: preflightReport?.executionMode ?? (process.env.AUTOPOLY_EXECUTION_MODE ?? "live"),
        decisionStrategy: preflightReport?.decisionStrategy ?? orchestratorConfig.decisionStrategy,
        stage,
        message,
        archiveDir,
        runId,
        errorPath
      }, null, 2));
    } else {
      printErrorSummary(createTerminalPrinter(), {
        title: "Stateless Live Test Failed",
        stage,
        error,
        context: errorContext,
        artifactDir: archiveDir,
        nextSteps: [
          "Inspect error.json and recommendation.json in the stateless archive.",
          "Retry after fixing the Polymarket or provider-side failure."
        ]
      });
    }
    return {
      ok: false,
      executionMode: preflightReport?.executionMode ?? (process.env.AUTOPOLY_EXECUTION_MODE ?? "live"),
      decisionStrategy: preflightReport?.decisionStrategy ?? orchestratorConfig.decisionStrategy,
      archiveDir,
      runId,
      errorPath
    };
  }
}

async function main() {
  const result = await runStatelessLiveTest(parseArgs());
  if (!result.ok) {
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main().catch((error) => {
    printErrorSummary(createTerminalPrinter(), {
      title: "Stateless Live Test Failed",
      stage: "bootstrap",
      error,
      context: buildContextRows({
        envFilePath: process.env.ENV_FILE?.trim() || null,
        archiveDir: "-",
        funderAddress: process.env.FUNDER_ADDRESS ?? "",
        executionMode: process.env.AUTOPOLY_EXECUTION_MODE ?? "live",
        decisionStrategy: process.env.AGENT_DECISION_STRATEGY ?? "provider-runtime"
      }),
      nextSteps: ["Inspect the stack trace above and retry after fixing the bootstrap error."]
    });
    process.exit(1);
  });
}
