import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import type { OverviewResponse, PublicPosition, TradeDecision } from "@autopoly/contracts";
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
  fetchMarketBySlug,
  fetchRemotePositions,
  readBook,
  resolvePolymarketSigningIdentity,
  type BookSnapshot,
  type PolymarketSigningIdentity,
  type RemotePosition
} from "../services/executor/src/lib/polymarket.ts";
import { loadConfig as loadOrchestratorConfig } from "../services/orchestrator/src/config.ts";
import {
  ensureDailyPulseSnapshot,
  runDailyPulseCore
} from "../services/orchestrator/src/jobs/daily-pulse-core.ts";
import {
  generatePositionReviewPulseSnapshot,
  type PulseCandidate
} from "../services/orchestrator/src/pulse/market-pulse.ts";
import {
  buildExecutionPlan,
  shouldWarnSkippedDecision,
  type PlannedExecution,
  type SkippedDecision
} from "../services/orchestrator/src/lib/execution-planning.ts";
import { createTerminalProgressReporter } from "../services/orchestrator/src/lib/terminal-progress.ts";
import { createAgentRuntime } from "../services/orchestrator/src/runtime/runtime-factory.ts";
import { resolveProviderSkillSettings } from "../services/orchestrator/src/runtime/skill-settings.ts";
import { loadPulseSnapshotFromArtifacts } from "./pulse-live-pulse.ts";
import {
  buildPulseLiveRunIdentityRows,
  buildPulseLiveOverview,
  calculatePositionPnlPct,
  calculatePositionValueUsd,
  applyPulseFilters,
  hasPulseFilters,
  loadPulseFilterFile,
  mergePulseFilters,
  parsePulseFilterArgs,
  type PulseFilterArgs
} from "./pulse-live-helpers.ts";
import {
  mapOverviewToSummarySnapshot,
  writeRunSummaryArtifacts
} from "./live-run-summary.ts";
import {
  writePulseEvaluationArtifacts,
  type PositionMarkAttribution
} from "./pulse-evaluation-ledger.ts";
import {
  mapBlockedItemToSummaryBlockedItem,
  mapDecisionToSummaryDecision,
  mapExecutedOrderToSummaryOrder,
  mapPulseLivePlanToSummaryPlan
} from "./live-run-summary-builders.ts";
import {
  buildLiveRunContextRows,
  createArchiveDir,
  ensureDirectory,
  finalizeArchiveDir,
  formatTimestampToken,
  maskAddressForDisplay,
  writeJsonArtifact
} from "./live-run-common.ts";
import {
  buildCredentialsCheck,
  buildEnvFileCheck,
  buildExecutionModeCheck,
  buildSignerFunderCheck,
  getPreflightBlockingReason
} from "./preflight-checks.ts";
import {
  probeCollateralBalanceUsd
} from "./live-preflight-probes.ts";
import { appendEquitySnapshot } from "./equity-snapshot.ts";
import { buildPulsePositionResearchSnapshots } from "./pulse-position-research.ts";
import {
  autoRedeemResolved,
  type AutoRedeemSummary
} from "../services/executor/src/lib/redeem.ts";
import {
  writePulseDecisionReportArtifacts,
  type PulseDecisionReportResult
} from "./pulse-decision-report.ts";

interface Args {
  json: boolean;
  recommendOnly: boolean;
  positionsOnly: boolean;
  pulseJsonPath: string | null;
  pulseMarkdownPath: string | null;
  filters: PulseFilterArgs;
}

interface PreflightReport {
  ok: boolean;
  blockingReason: string | null;
  envFilePath: string | null;
  executionMode: string;
  decisionStrategy: string;
  signerAddress: string;
  funderAddress: string;
  signerMatchesFunder: boolean | null;
  effectiveCollateralUsd: number;
  remotePositionCount: number;
  fallbackBankrollUsd: number;
  configuredMinTradeUsd: number;
  maxTradePct: number;
  maxEventExposurePct: number;
  entryMaxPlans: number;
  entryFixedNotionalUsd: number | null;
  collateral: {
    source: "reported" | "onchain" | "fallback";
    reportedUsd: number | null;
    onchainUsdcUsd: number | null;
    probeError: string | null;
  };
  checks: Array<{
    key: string;
    ok: boolean;
    blocking: boolean;
    summary: string;
  }>;
}

interface ExecutedOrderSummary extends PlannedExecution {
  orderId: string | null;
  ok: boolean;
  avgPrice: number | null;
  filledNotionalUsd: number;
  rawResponse: unknown;
}

class PulseLiveError extends Error {
  constructor(
    readonly stage: string,
    message: string,
    readonly context: Array<[string, string]> = [],
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "PulseLiveError";
  }
}

function parseArgs(argv = process.argv.slice(2)): Args {
  const get = (flag: string) => {
    const index = argv.indexOf(flag);
    const value = index >= 0 ? argv[index + 1] : undefined;
    return value && !value.startsWith("--") ? value : null;
  };
  const fileFilters = loadPulseFilterFile(get("--filters"));
  const cliFilters = parsePulseFilterArgs(argv);
  const positionsOnly = argv.includes("--positions-only") || argv.includes("--review-positions-only");
  return {
    json: argv.includes("--json"),
    recommendOnly: argv.includes("--recommend-only") || positionsOnly,
    positionsOnly,
    pulseJsonPath: get("--pulse-json"),
    pulseMarkdownPath: get("--pulse-markdown"),
    filters: mergePulseFilters(fileFilters, cliFilters)
  };
}

function printPulseFilterSummary(
  printer: ReturnType<typeof createTerminalPrinter>,
  filters: PulseFilterArgs,
  totalBefore: number,
  totalAfter: number
) {
  const parts: string[] = [];
  if (filters.category != null) parts.push(`category: ${filters.category}`);
  if (filters.tag != null) parts.push(`tag: ${filters.tag}`);
  const probParts: string[] = [];
  if (filters.minProb != null) probParts.push(filters.minProb.toFixed(2));
  if (filters.maxProb != null) probParts.push(filters.maxProb.toFixed(2));
  if (probParts.length > 0) {
    parts.push(`prob: ${filters.minProb != null ? filters.minProb.toFixed(2) : "*"}-${filters.maxProb != null ? filters.maxProb.toFixed(2) : "*"}`);
  }
  if (filters.minLiquidity != null) parts.push(`min-liquidity: $${filters.minLiquidity}`);
  printer.note("info", "Pulse filters active", parts.join(" | "));
  printer.note("info", "Candidates", `${totalBefore} total -> ${totalAfter} after filters`);
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(4));
}

function createRunMarketDataAccess(executorConfig: ReturnType<typeof loadExecutorConfig>) {
  const bookCache = new Map<string, Promise<BookSnapshot | null>>();
  const avgCostCache = new Map<string, Promise<number | null>>();

  return {
    readBook(tokenId: string) {
      const cached = bookCache.get(tokenId);
      if (cached) {
        return cached;
      }
      const pending = readBook(executorConfig, tokenId).catch((error) => {
        bookCache.delete(tokenId);
        throw error;
      });
      bookCache.set(tokenId, pending);
      return pending;
    },
    computeAvgCost(tokenId: string) {
      const cached = avgCostCache.get(tokenId);
      if (cached) {
        return cached;
      }
      const pending = computeAvgCost(executorConfig, tokenId).catch((error) => {
        avgCostCache.delete(tokenId);
        throw error;
      });
      avgCostCache.set(tokenId, pending);
      return pending;
    }
  };
}

function getErrorCause(error: unknown): unknown {
  return error instanceof Error ? error.cause : undefined;
}

function getErrorRawSummary(error: unknown): string | null {
  const cause = getErrorCause(error);
  if (cause == null) {
    return null;
  }
  return getErrorMessage(cause);
}

function getMarketBindingBlocks(items: SkippedDecision[]) {
  return items.filter((item) => item.reason.startsWith("blocked_by_market_binding:"));
}

function buildArchivedPreflightReport(report: PreflightReport) {
  const gateCheckOrder = ["execution-mode", "env-file", "credentials", "collateral", "exchange-sizing"];
  const gateChecks = gateCheckOrder
    .map((key) => report.checks.find((check) => check.key === key))
    .filter((check): check is PreflightReport["checks"][number] => Boolean(check))
    .map((check) => ({
      key: check.key,
      ok: check.ok,
      blocking: check.blocking,
      detail: check.summary
    }));

  const warnings: string[] = [];
  if (report.signerMatchesFunder === false) {
    warnings.push(`Signer ${report.signerAddress} does not match wallet ${report.funderAddress}.`);
  } else if (report.signerMatchesFunder == null && report.signerAddress) {
    warnings.push("Signer and wallet alignment could not be fully verified.");
  }
  if (report.collateral.probeError) {
    warnings.push(report.collateral.probeError);
  }

  const wallet = {
    funderAddress: report.funderAddress,
    signerAddress: report.signerAddress,
    signerMatchesFunder: report.signerMatchesFunder
  };
  const collateralDiagnostics = {
    source: report.collateral.source,
    reportedUsd: report.collateral.reportedUsd,
    onchainUsdcUsd: report.collateral.onchainUsdcUsd,
    probeError: report.collateral.probeError
  };

  return {
    ok: report.ok,
    status: report.ok ? "pass" : "blocked",
    primaryConclusion: report.blockingReason
      ?? report.checks.find((check) => check.key === "collateral")?.summary
      ?? "Preflight passed.",
    liveReadiness: {
      canContinue: report.ok,
      blockingReason: report.blockingReason,
      effectiveCollateralUsd: report.effectiveCollateralUsd,
      remotePositionCount: report.remotePositionCount
    },
    execution: {
      executionMode: report.executionMode,
      decisionStrategy: report.decisionStrategy,
      envFilePath: report.envFilePath
    },
    tradingConstraints: {
      fallbackBankrollUsd: report.fallbackBankrollUsd,
      configuredMinTradeUsd: report.configuredMinTradeUsd,
      maxTradePct: report.maxTradePct,
      maxEventExposurePct: report.maxEventExposurePct,
      entryMaxPlans: report.entryMaxPlans,
      entryFixedNotionalUsd: report.entryFixedNotionalUsd,
      exchangeSizingRequired: true
    },
    gateChecks,
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(report.funderAddress || report.signerAddress ? { wallet } : {}),
    ...(report.collateral.reportedUsd != null || report.collateral.onchainUsdcUsd != null || report.collateral.probeError
      ? { collateralDiagnostics }
      : {})
  };
}

async function buildRemotePublicPositions(
  executorConfig: ReturnType<typeof loadExecutorConfig>,
  remotePositions: RemotePosition[],
  stopLossPct: number,
  marketData: ReturnType<typeof createRunMarketDataAccess> = createRunMarketDataAccess(executorConfig)
): Promise<PublicPosition[]> {
  const timestamp = new Date().toISOString();
  return Promise.all(
    remotePositions.map(async (remote) => {
      const [avgCost, book] = await Promise.all([
        marketData.computeAvgCost(remote.tokenId),
        marketData.readBook(remote.tokenId)
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

function parseStringArrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseStringArrayValue(parsed);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseNumberArrayValue(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseNumberArrayValue(parsed);
    } catch {
      return value
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item));
    }
  }
  return [];
}

function readNumberField(record: Record<string, unknown> | null, names: string[], fallback = 0): number {
  for (const name of names) {
    const value = Number(record?.[name]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}

function readStringField(record: Record<string, unknown> | null, names: string[], fallback = ""): string {
  for (const name of names) {
    const value = record?.[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function buildPositionContext(position: PublicPosition): PulseCandidate["position"] {
  return {
    positionId: position.id,
    heldOutcomeLabel: position.outcome_label,
    heldTokenId: position.token_id,
    shares: position.size,
    avgCost: position.avg_cost,
    currentPrice: position.current_price,
    currentValueUsd: position.current_value_usd,
    unrealizedPnlPct: position.unrealized_pnl_pct,
    stopLossPct: position.stop_loss_pct,
    openedAtUtc: position.opened_at,
    updatedAtUtc: position.updated_at
  };
}

function buildFallbackPositionCandidate(position: PublicPosition): PulseCandidate {
  const heldIsYes = position.outcome_label.toLowerCase() === "yes";
  const outcomes = ["Yes", "No"];
  const outcomePrices = heldIsYes
    ? [position.current_price, Math.max(0, 1 - position.current_price)]
    : [Math.max(0, 1 - position.current_price), position.current_price];
  const clobTokenIds = heldIsYes
    ? [position.token_id, `${position.token_id}:opposite-no`]
    : [`${position.token_id}:opposite-yes`, position.token_id];
  return {
    question: position.market_slug,
    eventSlug: position.event_slug,
    marketSlug: position.market_slug,
    url: `https://polymarket.com/event/${position.event_slug}`,
    liquidityUsd: Math.max(position.current_value_usd, 1),
    volume24hUsd: 0,
    outcomes,
    outcomePrices,
    clobTokenIds,
    endDate: position.updated_at,
    bestBid: position.current_price,
    bestAsk: position.current_price,
    spread: 0,
    categorySlug: null,
    categoryLabel: null,
    categorySource: null,
    tags: [],
    position: buildPositionContext(position)
  };
}

async function buildPositionPulseCandidates(input: {
  executorConfig: ReturnType<typeof loadExecutorConfig>;
  positions: PublicPosition[];
}): Promise<PulseCandidate[]> {
  return await Promise.all(input.positions.map(async (position) => {
    const fallback = buildFallbackPositionCandidate(position);
    const [market] = await fetchMarketBySlug(input.executorConfig, position.market_slug).catch(() => []);
    const record = market && typeof market === "object" && !Array.isArray(market)
      ? market as Record<string, unknown>
      : null;
    if (!record) {
      return fallback;
    }

    const outcomes = parseStringArrayValue(record.outcomes);
    const outcomePrices = parseNumberArrayValue(record.outcomePrices ?? record.outcome_prices);
    const clobTokenIds = parseStringArrayValue(record.clobTokenIds ?? record.clob_token_ids);
    if (outcomes.length === 0 || outcomePrices.length === 0 || clobTokenIds.length === 0) {
      return fallback;
    }

    return {
      question: readStringField(record, ["question", "title"], fallback.question),
      eventSlug: position.event_slug,
      marketSlug: position.market_slug,
      url: `https://polymarket.com/event/${position.event_slug}`,
      liquidityUsd: readNumberField(record, ["liquidity", "liquidityNum"], fallback.liquidityUsd),
      volume24hUsd: readNumberField(record, ["volume24hr", "volume24h", "volume24hrClob"], fallback.volume24hUsd),
      outcomes,
      outcomePrices,
      clobTokenIds,
      endDate: readStringField(record, ["endDate", "end_date"], fallback.endDate),
      bestBid: readNumberField(record, ["bestBid", "best_bid"], fallback.bestBid),
      bestAsk: readNumberField(record, ["bestAsk", "best_ask"], fallback.bestAsk),
      spread: readNumberField(record, ["spread"], Math.max(0, fallback.bestAsk - fallback.bestBid)),
      categorySlug: readStringField(record, ["category", "categorySlug", "category_slug"], "") || null,
      categoryLabel: readStringField(record, ["categoryLabel", "category_label"], "") || null,
      categorySource: null,
      tags: [],
      negRisk: typeof record.negRisk === "boolean" ? record.negRisk : typeof record.neg_risk === "boolean" ? record.neg_risk : false,
      feesEnabled: typeof record.feesEnabled === "boolean" ? record.feesEnabled : typeof record.fees_enabled === "boolean" ? record.fees_enabled : undefined,
      position: buildPositionContext(position)
    } satisfies PulseCandidate;
  }));
}

async function runPreflight(input: {
  executorConfig: ReturnType<typeof loadExecutorConfig>;
  orchestratorConfig: ReturnType<typeof loadOrchestratorConfig>;
  recommendOnly: boolean;
}) {
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
  const remotePositions = await fetchRemotePositions(input.executorConfig);
  const collateralProbe = await probeCollateralBalanceUsd(input.executorConfig);
  const privateKeySignerAddress = input.executorConfig.privateKey
    ? (() => {
        try {
          return new Wallet(input.executorConfig.privateKey).address;
        } catch {
          return "";
        }
      })()
    : "";
  const signerAddress = walletIdentity?.signerAddress ?? privateKeySignerAddress;
  const funderAddress = walletIdentity?.funderAddress ?? input.executorConfig.funderAddress;
  const signerMatchesFunder =
    signerAddress &&
    funderAddress &&
    signerAddress.toLowerCase() === funderAddress.toLowerCase();
  const effectiveCollateralBalanceUsd = roundCurrency(
    collateralProbe.balanceUsd ?? input.orchestratorConfig.initialBankrollUsd
  );
  const checks = [
    buildExecutionModeCheck(process.env.AUTOPOLY_EXECUTION_MODE),
    buildEnvFileCheck(input.orchestratorConfig.envFilePath ?? input.executorConfig.envFilePath, "forecast:live runs"),
    buildCredentialsCheck({
      usesOnchainOsWallet,
      walletIdentity,
      walletIdentityError,
      hasPrivateKey: Boolean(input.executorConfig.privateKey),
      hasFunderAddress: Boolean(input.executorConfig.funderAddress),
      blocking: true
    }),
    buildSignerFunderCheck({
      usesOnchainOsWallet,
      walletIdentity,
      signerAddress,
      funderAddress: funderAddress ?? "",
      signerMatchesFunder: Boolean(signerMatchesFunder)
    }),
    {
      key: "collateral",
      blocking: !input.recommendOnly,
      ok: input.recommendOnly || collateralProbe.balanceUsd == null || collateralProbe.balanceUsd > 0 || remotePositions.length > 0,
      summary: input.recommendOnly && !(collateralProbe.balanceUsd == null || collateralProbe.balanceUsd > 0 || remotePositions.length > 0)
        ? "Recommend-only mode ignores zero collateral and continues without sending live orders."
        : collateralProbe.balanceUsd == null
          ? `Collateral probe unavailable; falling back to configured INITIAL_BANKROLL_USD ${input.orchestratorConfig.initialBankrollUsd.toFixed(2)} USD. ${collateralProbe.errorMessage ?? ""}`.trim()
        : collateralProbe.balanceUsd > 0 || remotePositions.length > 0
          ? `Collateral ${collateralProbe.balanceUsd.toFixed(2)} USD (${collateralProbe.source}) | reported ${(collateralProbe.reportedBalanceUsd ?? 0).toFixed(2)} USD | onchain ${(collateralProbe.onchainBalanceUsd ?? 0).toFixed(2)} USD | remote positions ${remotePositions.length}.`
          : `No tradable collateral and no remote positions are available. reported ${(collateralProbe.reportedBalanceUsd ?? 0).toFixed(2)} USD | onchain ${(collateralProbe.onchainBalanceUsd ?? 0).toFixed(2)} USD.`
    },
    {
      key: "exchange-sizing",
      blocking: false,
      ok: true,
      summary: "Live orders will be checked against Polymarket order-book sizing before execution."
    }
  ];

  return {
    report: {
      ok: checks.every((check) => check.ok || !check.blocking),
      blockingReason: getPreflightBlockingReason(checks),
      envFilePath: input.orchestratorConfig.envFilePath ?? input.executorConfig.envFilePath,
      executionMode: process.env.AUTOPOLY_EXECUTION_MODE ?? "live",
      decisionStrategy: input.orchestratorConfig.decisionStrategy,
      signerAddress,
      funderAddress,
      signerMatchesFunder: signerAddress && funderAddress && walletIdentity?.walletMode !== "proxy"
        ? signerMatchesFunder
        : null,
      effectiveCollateralUsd: effectiveCollateralBalanceUsd,
      remotePositionCount: remotePositions.length,
      fallbackBankrollUsd: input.orchestratorConfig.initialBankrollUsd,
      configuredMinTradeUsd: input.orchestratorConfig.minTradeUsd,
      maxTradePct: input.orchestratorConfig.maxTradePct,
      maxEventExposurePct: input.orchestratorConfig.maxEventExposurePct,
      entryMaxPlans: input.orchestratorConfig.pulse.entryMaxPlans,
      entryFixedNotionalUsd: input.orchestratorConfig.pulse.entryFixedNotionalUsd,
      collateral: {
        source: collateralProbe.source,
        reportedUsd: collateralProbe.reportedBalanceUsd,
        onchainUsdcUsd: collateralProbe.onchainBalanceUsd,
        probeError: collateralProbe.errorMessage
      },
      checks
    } satisfies PreflightReport,
    remotePositions,
    collateralBalanceUsd: effectiveCollateralBalanceUsd
  };
}

async function verifyFeesForPlans(
  plans: PlannedExecution[],
  executorConfig: ReturnType<typeof loadExecutorConfig>,
  archiveDir: string
) {
  const { verifyFeeEstimate, logFeeDiscrepancyIfNeeded } = await import("../services/orchestrator/src/lib/fees.ts");
  for (const plan of plans) {
    try {
      const response = await fetch(
        `https://clob.polymarket.com/fee-rate?token_id=${plan.tokenId}`
      );
      if (response.ok) {
        const data = await response.json() as { base_fee?: number };
        const discrepancy = verifyFeeEstimate({
          tokenId: plan.tokenId,
          marketSlug: plan.marketSlug,
          categorySlug: plan.categorySlug,
          actualBaseFee: data.base_fee ?? 0,
          negRisk: plan.negRisk
        });
        await logFeeDiscrepancyIfNeeded(discrepancy, archiveDir);
        if (discrepancy.mismatch) {
          console.warn(
            `[WARN] Fee mismatch for ${plan.marketSlug}: estimated feeRate=${discrepancy.estimatedFeeRate}, CLOB base_fee=${discrepancy.actualBaseFee}`
          );
        }
      }
    } catch {
      // Non-blocking: fee verification failure should not prevent trading
    }
  }
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
  await verifyFeesForPlans(input.plans, input.executorConfig, input.archiveDir);
  const executed: ExecutedOrderSummary[] = [];
  for (const plan of input.plans) {
    // For SELL orders, verify on-chain balance before executing
    if (plan.side === "SELL") {
      const { validateSellBalance } = await import("../services/executor/src/lib/polymarket-sdk.ts");
      const check = await validateSellBalance(input.executorConfig.funderAddress, plan.tokenId, plan.executionAmount);
      if (!check.ok) {
        console.warn(
          `[WARN] On-chain balance check failed for ${plan.marketSlug}: ` +
          `requested=${check.requestedAmount.toFixed(2)} on-chain=${check.onChainBalance?.toFixed(2)} shortfall=${check.shortfall.toFixed(2)} — skipping sell`
        );
        continue;
      }
    }
    // GTC limit order path: place limit → poll → fallback to FOK if unfilled
    if (plan.orderType === "GTC" && plan.gtcLimitPrice != null) {
      const { executeLimitOrder, getOrderStatus, cancelOrder } = await import("../services/executor/src/lib/polymarket-sdk.ts");
      const gtcSize = plan.executionAmount / plan.gtcLimitPrice;
      console.log(`[INFO] GTC limit order: ${plan.marketSlug} | price=${plan.gtcLimitPrice} | size=${gtcSize.toFixed(1)} shares`);
      const gtcResult = await executeLimitOrder(input.executorConfig, {
        tokenId: plan.tokenId,
        side: plan.side,
        price: plan.gtcLimitPrice,
        size: Math.floor(gtcSize)
      });
      if (gtcResult.ok && gtcResult.orderId) {
        // Poll for fill (30s intervals, up to 5 minutes)
        const GTC_POLL_INTERVAL_MS = 30_000;
        const GTC_MAX_WAIT_MS = 300_000;
        const startMs = Date.now();
        let filled = false;
        while (Date.now() - startMs < GTC_MAX_WAIT_MS) {
          await new Promise((r) => setTimeout(r, GTC_POLL_INTERVAL_MS));
          const status = await getOrderStatus(input.executorConfig, gtcResult.orderId);
          console.log(`[INFO] GTC poll: ${plan.marketSlug} | status=${status.status} | filled=${status.filledSize}`);
          if (status.status === "matched" || status.status === "filled") {
            filled = true;
            executed.push({
              ...plan,
              orderId: gtcResult.orderId,
              ok: true,
              avgPrice: plan.gtcLimitPrice,
              filledNotionalUsd: plan.executionAmount,
              rawResponse: status.rawResponse
            });
            break;
          }
          if (status.status === "canceled") {
            break;
          }
        }
        if (!filled) {
          // Cancel unfilled GTC and fall through to FOK
          console.log(`[INFO] GTC timeout — cancelling and falling back to FOK: ${plan.marketSlug}`);
          await cancelOrder(input.executorConfig, gtcResult.orderId);
        }
        if (filled) {
          continue;
        }
      }
      // GTC failed or timed out — fall through to FOK below
      console.log(`[INFO] FOK fallback: ${plan.marketSlug}`);
    }

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
      throw new PulseLiveError(
        "execute",
        `Order rejected for ${plan.marketSlug}.`,
        buildLiveRunContextRows({
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
    probeCollateralBalanceUsd(input.executorConfig)
  ]);
  const positions = await buildRemotePublicPositions(
    input.executorConfig,
    remotePositions,
    input.orchestratorConfig.positionStopLossPct
  );
  const overview = buildPulseLiveOverview({
    collateralBalanceUsd: roundCurrency(collateralBalanceUsd.balanceUsd ?? input.orchestratorConfig.initialBankrollUsd),
    positions
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
  skipped: SkippedDecision[];
  pulseMarkdownPath: string;
  pulseJsonPath: string;
  runtimeLogPath: string | null;
}) {
  const printer = createTerminalPrinter();
  printer.section("Pulse Live Recommendation", "route forecast:live");
  printer.table([
    ["Run ID", input.runId],
    ["Env File", input.envFilePath ?? "-"],
    ...buildPulseLiveRunIdentityRows({
      executionMode: input.executionMode,
      decisionStrategy: input.decisionStrategy
    }),
    ["Wallet Collateral", formatUsd(input.collateralBalanceUsd)],
    ["Effective Bankroll", formatUsd(input.overview.total_equity_usd)],
    ["Archive Dir", input.archiveDir]
  ]);
  printer.section("Planned Orders", `${input.plans.length} trade(s)`);
  if (input.plans.length === 0) {
    printer.note("warn", "No live-ready orders", "All candidate orders were removed by guardrails or Polymarket sizing checks.");
  } else {
    for (const [index, plan] of input.plans.entries()) {
      printer.note(
        "info",
        `${index + 1}. ${plan.action} ${plan.marketSlug}`,
        `${formatUsd(plan.notionalUsd)} | ${formatRatioPercent(plan.bankrollRatio)} bankroll${plan.exchangeMinNotionalUsd != null ? ` | exchange minimum ${formatUsd(plan.exchangeMinNotionalUsd)}` : ""}`
      );
      printer.line(`    ${plan.thesisMd}`);
    }
  }
  if (input.skipped.length > 0) {
    printer.section("Skipped Decisions");
    for (const item of input.skipped) {
      printer.note(shouldWarnSkippedDecision(item.reason) ? "warn" : "muted", item.marketSlug, item.reason);
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
  printer.section("Pulse Live Execution Summary", `run ${input.runId}`);
  printer.table([
    ...buildPulseLiveRunIdentityRows({
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

export async function runPulseLive(args: Args = parseArgs()) {
  process.env.ENV_FILE = process.env.ENV_FILE?.trim() || ".env.pizza";
  const reporter = createTerminalProgressReporter({
    enabled: !args.json,
    stream: args.json ? process.stderr : process.stdout
  });
  const useHumanOutput = !args.json && shouldUseHumanOutput(process.stdout);
  const orchestratorConfig = loadOrchestratorConfig();
  const executorConfig = loadExecutorConfig();
  const marketData = createRunMarketDataAccess(executorConfig);
  const configuredMinTradeUsd = Math.max(0, orchestratorConfig.minTradeUsd);
  const timestamp = formatTimestampToken();
  let archiveDir = await createArchiveDir(
    path.join(orchestratorConfig.artifactStorageRoot, "pulse-live"),
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
  let skippedForSummary: SkippedDecision[] = [];
  let executedForSummary: ExecutedOrderSummary[] = [];
  let promptSummary: string | null = null;
  let reasoningMd: string | null = null;
  let pulseMarkdownPath: string | null = null;
  let pulseJsonPath: string | null = null;
  let runtimeLogPath: string | null = null;
  let supplementalArtifactPaths: string[] = [];
  let decisionReportResult: PulseDecisionReportResult | null = null;
  let positionsBefore: PublicPosition[] = [];
  let positionMarkAttribution: PositionMarkAttribution | null = null;
  let positionMarkSnapshotPath: string | null = null;
  let calibrationLedgerPath: string | null = null;
  let globalCalibrationLedgerPath: string | null = null;
  let positionResearchPath: string | null = null;

  try {
    reporter.info(args.positionsOnly
      ? "Flow: 1) preflight 2) auto-redeem resolved positions 3) fetch remote portfolio 4) run position-only Pulse review 5) emit existing-position decisions only 6) summarize"
      : "Flow: 1) preflight 2) auto-redeem resolved positions 3) fetch remote portfolio 4) generate pulse 5) run decision runtime 6) apply guards + exchange sizing checks 7) execute directly 8) summarize");
    const preflight = await runPreflight({
      executorConfig,
      orchestratorConfig,
      recommendOnly: args.recommendOnly
    });
    preflightReport = preflight.report;
    preflightPath = path.join(archiveDir, "preflight.json");
    await writeJsonArtifact(preflightPath, buildArchivedPreflightReport(preflight.report));
    if (useHumanOutput) {
      const printer = createTerminalPrinter();
      printer.section("Pulse Live Preflight", "route forecast:live");
      printer.table([
        ...buildPulseLiveRunIdentityRows({
          executionMode: preflight.report.executionMode,
          decisionStrategy: preflight.report.decisionStrategy
        }),
        ["Env File", preflight.report.envFilePath ?? "-"],
        ["Effective Collateral", formatUsd(preflight.report.effectiveCollateralUsd)],
        ["Remote Positions", String(preflight.report.remotePositionCount)],
        ["Fallback Bankroll", formatUsd(preflight.report.fallbackBankrollUsd)],
        ["Configured Min Trade", formatUsd(preflight.report.configuredMinTradeUsd)],
        ["Entry Limit", `${preflight.report.entryMaxPlans} plan(s)`],
        ["Fixed Entry Size", preflight.report.entryFixedNotionalUsd == null ? "-" : formatUsd(preflight.report.entryFixedNotionalUsd)],
        ["Max Trade", formatRatioPercent(preflight.report.maxTradePct)],
        ["Max Event Exposure", formatRatioPercent(preflight.report.maxEventExposurePct)],
        ["Wallet", maskAddressForDisplay(preflight.report.funderAddress)],
        ["Exchange Sizing", "Validated per Polymarket order book"]
      ]);
      if (preflight.report.blockingReason) {
        printer.note("error", "Blocking reason", preflight.report.blockingReason);
      }
      if (preflight.report.signerMatchesFunder === false) {
        printer.note(
          "warn",
          "Signer / Wallet mismatch",
          `${maskAddressForDisplay(preflight.report.signerAddress)} vs ${maskAddressForDisplay(preflight.report.funderAddress)}`
        );
      }
      if (preflight.report.collateral.reportedUsd != null || preflight.report.collateral.onchainUsdcUsd != null) {
        printer.note(
          "muted",
          "Collateral diagnostics",
          `reported ${preflight.report.collateral.reportedUsd == null ? "-" : formatUsd(preflight.report.collateral.reportedUsd)} | onchain ${preflight.report.collateral.onchainUsdcUsd == null ? "-" : formatUsd(preflight.report.collateral.onchainUsdcUsd)} | source ${preflight.report.collateral.source}`
        );
      }
      if (preflight.report.collateral.probeError) {
        printer.note("warn", "Collateral probe", preflight.report.collateral.probeError);
      }
      for (const check of preflight.report.checks) {
        printer.note(check.ok ? "success" : check.blocking ? "error" : "warn", check.key, check.summary);
      }
    }
    if (!preflight.report.ok) {
      throw new PulseLiveError(
        "preflight",
        "Pulse live preflight failed.",
        buildLiveRunContextRows({
          envFilePath: preflight.report.envFilePath,
          archiveDir,
          funderAddress: executorConfig.funderAddress,
          executionMode: preflight.report.executionMode,
          decisionStrategy: preflight.report.decisionStrategy
        })
      );
    }

    // ---- Auto-redeem resolved positions (non-blocking) ----------------------
    let redeemSummary: AutoRedeemSummary | null = null;
    try {
      reporter.stage({ percent: 5, label: "Checking for resolved positions to auto-redeem" });
      redeemSummary = await autoRedeemResolved(executorConfig, preflight.remotePositions);

      if (redeemSummary.redeemed.length > 0) {
        await writeJsonArtifact(
          path.join(archiveDir, "auto-redeem.json"),
          redeemSummary
        );

        if (useHumanOutput) {
          const printer = createTerminalPrinter();
          printer.section("Auto-Redeem Resolved Positions", `${redeemSummary.redeemed.length} position(s)`);
          for (const result of redeemSummary.redeemed) {
            const winLabel = result.position.isWinner ? "winner" : "loser";
            const usdcNote = result.position.isWinner
              ? ` → $${result.position.size.toFixed(2)} USDC`
              : " → $0.00 (clearing dead tokens)";
            if (result.ok) {
              printer.note(
                "success",
                `Auto-redeem: ${result.position.marketSlug}`,
                `${result.position.size.toFixed(2)} shares | ${winLabel}: ${result.position.isWinner ? "Yes" : "No"}${usdcNote} | tx ${result.txHash}`
              );
            } else {
              printer.note(
                "warn",
                `Auto-redeem failed: ${result.position.marketSlug}`,
                `${result.position.size.toFixed(2)} shares | ${winLabel} | error: ${result.error}`
              );
            }
          }
          if (redeemSummary.totalWinnerUsdc > 0) {
            printer.note("info", "Total redeemed USDC", formatUsd(redeemSummary.totalWinnerUsdc));
          }
        }
      } else if (useHumanOutput) {
        const printer = createTerminalPrinter();
        printer.note("muted", "Auto-redeem", "No resolved positions found to redeem.");
      }
    } catch (redeemError) {
      // Auto-redeem is non-blocking: log and continue
      if (useHumanOutput) {
        const printer = createTerminalPrinter();
        printer.note("warn", "Auto-redeem skipped", `Error: ${redeemError instanceof Error ? redeemError.message : String(redeemError)}`);
      }
    }

    // If positions were redeemed, re-fetch remote positions to get updated state
    const effectiveRemotePositions =
      redeemSummary && redeemSummary.redeemed.some((r) => r.ok)
        ? await fetchRemotePositions(executorConfig)
        : preflight.remotePositions;

    const positions = await buildRemotePublicPositions(
      executorConfig,
      effectiveRemotePositions,
      orchestratorConfig.positionStopLossPct,
      marketData
    );
    positionsBefore = positions;
    const positionResearch = await buildPulsePositionResearchSnapshots({
      executorConfig,
      positions,
      readBook: marketData.readBook
    });
    const overview = buildPulseLiveOverview({
      collateralBalanceUsd: preflight.collateralBalanceUsd,
      positions
    });
    overviewBefore = overview;
    const pulseRunId = randomUUID();
    reporter.stage({
      percent: 10,
      label: "Loaded pulse-live portfolio context",
      detail: `${positions.length} positions | ${positionResearch.length} position research snapshot(s) | collateral ${formatUsd(preflight.collateralBalanceUsd)} | effective bankroll ${formatUsd(overview.total_equity_usd)}`
    });
    const pulseSkillSettings = resolveProviderSkillSettings(orchestratorConfig, orchestratorConfig.runtimeProvider);
    const pulse = args.pulseJsonPath
      ? await loadPulseSnapshotFromArtifacts({
          artifactStorageRoot: orchestratorConfig.artifactStorageRoot,
          pulseJsonPath: args.pulseJsonPath,
          pulseMarkdownPath: args.pulseMarkdownPath
        })
      : args.positionsOnly
        ? await generatePositionReviewPulseSnapshot({
            config: orchestratorConfig,
            provider: orchestratorConfig.runtimeProvider,
            locale: pulseSkillSettings.locale,
            runId: pulseRunId,
            mode: "full",
            candidates: await buildPositionPulseCandidates({
              executorConfig,
              positions
            }),
            progress: reporter
          })
      : await ensureDailyPulseSnapshot({
          config: orchestratorConfig,
          runId: pulseRunId,
          mode: "full",
          progress: reporter,
          filters: hasPulseFilters(args.filters) ? args.filters : undefined
        });
    reporter.stage({
      percent: 70,
      label: args.pulseJsonPath ? "Reused pulse snapshot ready" : "Pulse snapshot ready",
      detail: `${pulse.selectedCandidates} candidates | risk flags ${pulse.riskFlags.length}`
    });
    const filtersActive = !args.positionsOnly && hasPulseFilters(args.filters);
    const effectivePulse = filtersActive
      ? (() => {
          const filtered = applyPulseFilters(pulse.candidates, args.filters);
          if (useHumanOutput) {
            const printer = createTerminalPrinter();
            printPulseFilterSummary(printer, args.filters, pulse.candidates.length, filtered.length);
          }
          return {
            ...pulse,
            candidates: filtered,
            selectedCandidates: filtered.length
          };
        })()
      : pulse;
    const runtime = createAgentRuntime(orchestratorConfig);
    const coreResult = await runDailyPulseCore({
      config: orchestratorConfig,
      runtime,
      runId: pulseRunId,
      mode: "full",
      overview,
      positions,
      pulse: effectivePulse,
      positionResearch,
      reviewPositionsOnly: args.positionsOnly,
      progress: reporter
    });
    const runtimeResult = coreResult.result;
    runId = coreResult.decisionSet.run_id;
    archiveDir = await finalizeArchiveDir(archiveDir, timestamp, runId);
    preflightPath = path.join(archiveDir, "preflight.json");
    runtimeLogPath = coreResult.decisionSet.artifacts.find((artifact) => artifact.kind === "runtime-log")?.path ?? null;
    supplementalArtifactPaths = coreResult.decisionSet.artifacts
      .filter((artifact) => !["pulse-report", "runtime-log"].includes(artifact.kind))
      .map((artifact) => artifact.path);
    recommendationPath = path.join(archiveDir, "recommendation.json");
    promptSummary = runtimeResult.promptSummary;
    reasoningMd = runtimeResult.reasoningMd;
    decisionsForSummary = coreResult.decisionSet.decisions;
    pulseMarkdownPath = pulse.absoluteMarkdownPath;
    pulseJsonPath = pulse.absoluteJsonPath;
    positionResearchPath = path.join(archiveDir, "position-research.json");
    await writeJsonArtifact(positionResearchPath, positionResearch);
    supplementalArtifactPaths = [
      ...supplementalArtifactPaths,
      positionResearchPath
    ];
    const { plans, skipped } = await buildExecutionPlan({
      decisions: coreResult.decisionSet.decisions,
      positions,
      overview,
      config: orchestratorConfig,
      minTradeUsd: configuredMinTradeUsd,
      pulseCandidates: effectivePulse.candidates,
      readBook: async (tokenId) => {
        const book = await marketData.readBook(tokenId);
        if (!book) {
          return null;
        }
        return {
          bestAsk: book.bestAsk ?? null,
          bestBid: book.bestBid ?? null,
          minOrderSize: book.minOrderSize ?? null,
          asks: book.asks,
          bids: book.bids
        };
      }
    });
    plansForSummary = plans;
    skippedForSummary = skipped;
    await writeJsonArtifact(recommendationPath, {
      runId,
      executionMode: "pulse-live",
      envFilePath: preflight.report.envFilePath,
      collateralBalanceUsd: preflight.report.effectiveCollateralUsd,
      overview,
      pulseMarkdownPath: pulse.absoluteMarkdownPath,
      pulseJsonPath: pulse.absoluteJsonPath,
      runtimeLogPath: runtimeLogPath,
      promptSummary: runtimeResult.promptSummary,
      reasoningMd: runtimeResult.reasoningMd,
      decisions: coreResult.decisionSet.decisions,
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
        collateralBalanceUsd: preflight.report.effectiveCollateralUsd,
        overview,
        plans,
        skipped,
        pulseMarkdownPath: pulse.absoluteMarkdownPath,
        pulseJsonPath: pulse.absoluteJsonPath,
        runtimeLogPath: runtimeLogPath
      });
    }

    const marketBindingBlocks = getMarketBindingBlocks(skipped);
    if (!args.recommendOnly && marketBindingBlocks.length > 0) {
      const evalArtifacts = await writePulseEvaluationArtifacts({
        artifactStorageRoot: orchestratorConfig.artifactStorageRoot,
        archiveDir,
        runId,
        generatedAtUtc: coreResult.decisionSet.generated_at_utc,
        executionMode: "failed",
        decisionStrategy: orchestratorConfig.decisionStrategy,
        decisions: decisionsForSummary,
        skipped: skippedForSummary,
        executedOrders: [],
        beforePositions: positionsBefore,
        afterPositions: positionsBefore,
        beforeSnapshotAtUtc: overview.equity_curve[0]?.timestamp ?? coreResult.decisionSet.generated_at_utc,
        afterSnapshotAtUtc: overview.equity_curve[0]?.timestamp ?? coreResult.decisionSet.generated_at_utc
      });
      positionMarkAttribution = evalArtifacts.markAttribution;
      positionMarkSnapshotPath = evalArtifacts.markSnapshotPath;
      calibrationLedgerPath = evalArtifacts.runLedgerPath;
      globalCalibrationLedgerPath = evalArtifacts.globalLedgerPath;
      supplementalArtifactPaths = [
        ...supplementalArtifactPaths,
        positionMarkSnapshotPath,
        calibrationLedgerPath,
        globalCalibrationLedgerPath
      ];
      throw new PulseLiveError(
        "binding-gate",
        `P00 market binding gate blocked live execution for ${marketBindingBlocks.length} decision(s).`,
        [
          ...buildLiveRunContextRows({
            envFilePath: preflight.report.envFilePath,
            archiveDir,
            funderAddress: executorConfig.funderAddress,
            executionMode: preflight.report.executionMode,
            decisionStrategy: preflight.report.decisionStrategy,
            runId
          }),
          ...marketBindingBlocks.slice(0, 5).map((item, index) => [
            `Binding Block ${index + 1}`,
            `${item.marketSlug} | ${item.tokenId ?? "-"} | ${item.reason}`
          ] as [string, string])
        ]
      );
    }

    if (args.recommendOnly) {
      const evalArtifacts = await writePulseEvaluationArtifacts({
        artifactStorageRoot: orchestratorConfig.artifactStorageRoot,
        archiveDir,
        runId,
        generatedAtUtc: coreResult.decisionSet.generated_at_utc,
        executionMode: "recommend-only",
        decisionStrategy: orchestratorConfig.decisionStrategy,
        decisions: decisionsForSummary,
        skipped: skippedForSummary,
        executedOrders: [],
        beforePositions: positionsBefore,
        afterPositions: positionsBefore,
        beforeSnapshotAtUtc: overview.equity_curve[0]?.timestamp ?? coreResult.decisionSet.generated_at_utc,
        afterSnapshotAtUtc: overview.equity_curve[0]?.timestamp ?? coreResult.decisionSet.generated_at_utc
      });
      positionMarkAttribution = evalArtifacts.markAttribution;
      positionMarkSnapshotPath = evalArtifacts.markSnapshotPath;
      calibrationLedgerPath = evalArtifacts.runLedgerPath;
      globalCalibrationLedgerPath = evalArtifacts.globalLedgerPath;
      supplementalArtifactPaths = [
        ...supplementalArtifactPaths,
        positionMarkSnapshotPath,
        calibrationLedgerPath,
        globalCalibrationLedgerPath
      ];
      await writeRunSummaryArtifacts({
        mode: "forecast:live",
        executionMode: "live",
        strategy: orchestratorConfig.decisionStrategy,
        envFilePath: preflight.report.envFilePath,
        archiveDir,
        runId,
        status: "success",
        stage: "recommend-only",
        promptSummary,
        reasoningMd,
        decisions: decisionsForSummary.map(mapDecisionToSummaryDecision),
        executablePlans: plansForSummary.map(mapPulseLivePlanToSummaryPlan),
        blockedItems: skippedForSummary.map(mapBlockedItemToSummaryBlockedItem),
        portfolioBefore: mapOverviewToSummarySnapshot(overview),
        portfolioAfter: mapOverviewToSummarySnapshot(overview),
        positionMarkAttribution,
        artifacts: {
          preflightPath,
          recommendationPath,
          pulseMarkdownPath,
          pulseJsonPath,
          runtimeLogPath,
          additionalPaths: supplementalArtifactPaths
        }
      });
      decisionReportResult = await writePulseDecisionReportArtifacts({
        archiveDir,
        stage: "recommend-only"
      });
      supplementalArtifactPaths = [
        ...supplementalArtifactPaths,
        decisionReportResult.markdownPath,
        decisionReportResult.englishMarkdownPath,
        decisionReportResult.htmlPath,
        ...(decisionReportResult.pdfPath ? [decisionReportResult.pdfPath] : []),
        ...(decisionReportResult.errorPath ? [decisionReportResult.errorPath] : [])
      ];
      if (useHumanOutput) {
        const printer = createTerminalPrinter();
        if (decisionReportResult.pdfPath) {
          printer.note("success", "Decision PDF generated", decisionReportResult.pdfPath);
        } else {
          printer.note("warn", "Decision PDF generation failed", decisionReportResult.errorPath ?? "No error artifact written.");
        }
      }
      const equityResult = await appendEquitySnapshot({
        overview,
        envFilePath: preflight.report.envFilePath
      });
      if (useHumanOutput) {
        const printer = createTerminalPrinter();
        if (equityResult.appended) {
          printer.note("success", "Equity snapshot appended", `${equityResult.snapshotCount} total snapshots in ${equityResult.historyPath}`);
          printer.note("warn", "Remember to commit + push", "equity-history.json must be pushed for the live chart to update on Vercel.");
        } else {
          printer.note("muted", "Equity snapshot skipped", equityResult.reason);
        }
      }
      const output = {
        ok: true,
        mode: "recommend-only",
        executionMode: preflight.report.executionMode,
        decisionStrategy: preflight.report.decisionStrategy,
        runId,
        archiveDir,
        recommendationPath,
        decisionReportPath: decisionReportResult.markdownPath,
        decisionReportPdfPath: decisionReportResult.pdfPath,
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
    const evalArtifacts = await writePulseEvaluationArtifacts({
      artifactStorageRoot: orchestratorConfig.artifactStorageRoot,
      archiveDir,
      runId,
      generatedAtUtc: coreResult.decisionSet.generated_at_utc,
      executionMode: "forecast:live",
      decisionStrategy: orchestratorConfig.decisionStrategy,
      decisions: decisionsForSummary,
      skipped: skippedForSummary,
      executedOrders: executedForSummary,
      beforePositions: positionsBefore,
      afterPositions: finalState.positions,
      beforeSnapshotAtUtc: overviewBefore?.equity_curve[0]?.timestamp ?? coreResult.decisionSet.generated_at_utc,
      afterSnapshotAtUtc: finalState.overview.equity_curve[0]?.timestamp ?? new Date().toISOString()
    });
    positionMarkAttribution = evalArtifacts.markAttribution;
    positionMarkSnapshotPath = evalArtifacts.markSnapshotPath;
    calibrationLedgerPath = evalArtifacts.runLedgerPath;
    globalCalibrationLedgerPath = evalArtifacts.globalLedgerPath;
    supplementalArtifactPaths = [
      ...supplementalArtifactPaths,
      positionMarkSnapshotPath,
      calibrationLedgerPath,
      globalCalibrationLedgerPath
    ];
    executionSummaryPath = path.join(archiveDir, "execution-summary.json");
    await writeJsonArtifact(executionSummaryPath, {
      runId,
      archiveDir,
      overview: finalState.overview,
      collateralBalanceUsd: finalState.collateralBalanceUsd,
      positions: finalState.positions,
      executed: executedForSummary,
      positionMarkAttribution,
      artifacts: {
        positionMarkSnapshotPath,
        calibrationLedgerPath,
        globalCalibrationLedgerPath
      }
    });

    reporter.done(`Pulse live run completed | ${runId}`);
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
      mode: "forecast:live",
      executionMode: "live",
      strategy: orchestratorConfig.decisionStrategy,
      envFilePath: preflight.report.envFilePath,
      archiveDir,
      runId,
      status: "success",
      stage: "completed",
      promptSummary,
      reasoningMd,
      decisions: decisionsForSummary.map(mapDecisionToSummaryDecision),
      executablePlans: plansForSummary.map(mapPulseLivePlanToSummaryPlan),
      executedOrders: executedForSummary.map(mapExecutedOrderToSummaryOrder),
      blockedItems: skippedForSummary.map(mapBlockedItemToSummaryBlockedItem),
      portfolioBefore: overviewBefore ? mapOverviewToSummarySnapshot(overviewBefore) : null,
      portfolioAfter: overviewAfter ? mapOverviewToSummarySnapshot(overviewAfter) : null,
      positionMarkAttribution,
      artifacts: {
        preflightPath,
        recommendationPath,
        executionSummaryPath,
        pulseMarkdownPath,
        pulseJsonPath,
        runtimeLogPath,
        additionalPaths: supplementalArtifactPaths
      }
    });

    decisionReportResult = await writePulseDecisionReportArtifacts({
      archiveDir,
      stage: "completed"
    });
    supplementalArtifactPaths = [
      ...supplementalArtifactPaths,
      decisionReportResult.markdownPath,
      decisionReportResult.englishMarkdownPath,
      decisionReportResult.htmlPath,
      ...(decisionReportResult.pdfPath ? [decisionReportResult.pdfPath] : []),
      ...(decisionReportResult.errorPath ? [decisionReportResult.errorPath] : [])
    ];
    if (useHumanOutput) {
      const printer = createTerminalPrinter();
      if (decisionReportResult.pdfPath) {
        printer.note("success", "Decision PDF generated", decisionReportResult.pdfPath);
      } else {
        printer.note("warn", "Decision PDF generation failed", decisionReportResult.errorPath ?? "No error artifact written.");
      }
    }

    const equityResult = await appendEquitySnapshot({
      overview: finalState.overview,
      envFilePath: preflight.report.envFilePath
    });
    if (useHumanOutput) {
      const printer = createTerminalPrinter();
      if (equityResult.appended) {
        printer.note("success", "Equity snapshot appended", `${equityResult.snapshotCount} total snapshots in ${equityResult.historyPath}`);
        printer.note("warn", "Remember to commit + push", "equity-history.json must be pushed for the live chart to update on Vercel.");
      } else {
        printer.note("muted", "Equity snapshot skipped", equityResult.reason);
      }
    }
    const output = {
      ok: true,
      executionMode: preflight.report.executionMode,
      decisionStrategy: preflight.report.decisionStrategy,
      runId,
      archiveDir,
      recommendationPath,
      executionSummaryPath,
      decisionReportPath: decisionReportResult.markdownPath,
      decisionReportPdfPath: decisionReportResult.pdfPath,
      executedOrders: executedForSummary.length
    };
    if (args.json) {
      console.log(JSON.stringify(output, null, 2));
    }
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stage = error instanceof PulseLiveError ? error.stage : "unknown";
    const rawSummary = getErrorRawSummary(error);
    const rawResponse = getErrorCause(error) ?? null;
    const errorContext = error instanceof PulseLiveError
      ? error.context
      : buildLiveRunContextRows({
          envFilePath: preflightReport?.envFilePath ?? (orchestratorConfig.envFilePath ?? executorConfig.envFilePath),
          archiveDir,
          funderAddress: executorConfig.funderAddress,
          executionMode: preflightReport?.executionMode ?? (process.env.AUTOPOLY_EXECUTION_MODE ?? "live"),
          decisionStrategy: preflightReport?.decisionStrategy ?? orchestratorConfig.decisionStrategy,
          runId
        });
    errorPath = path.join(archiveDir, "error.json");
    await ensureDirectory(archiveDir);
    await writeJsonArtifact(errorPath, {
      stage,
      message,
      rawSummary,
      rawResponse,
      archiveDir,
      runId,
      context: errorContext
    });
    await writeRunSummaryArtifacts({
      mode: "forecast:live",
      executionMode: "live",
      strategy: orchestratorConfig.decisionStrategy,
      envFilePath: preflightReport?.envFilePath ?? null,
      archiveDir,
      runId,
      status: "failed",
      stage,
      promptSummary,
      reasoningMd,
      decisions: decisionsForSummary.map(mapDecisionToSummaryDecision),
      executablePlans: plansForSummary.map(mapPulseLivePlanToSummaryPlan),
      executedOrders: executedForSummary.map(mapExecutedOrderToSummaryOrder),
      blockedItems: skippedForSummary.map(mapBlockedItemToSummaryBlockedItem),
      portfolioBefore: overviewBefore ? mapOverviewToSummarySnapshot(overviewBefore) : null,
      portfolioAfter: overviewAfter ? mapOverviewToSummarySnapshot(overviewAfter) : null,
      positionMarkAttribution,
      failure: {
        stage,
        message,
        rawSummary,
        nextSteps: [
          "Inspect error.json and recommendation.json in the pulse-live archive.",
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
        runtimeLogPath,
        additionalPaths: supplementalArtifactPaths
      }
    });
    if (recommendationPath) {
      decisionReportResult = await writePulseDecisionReportArtifacts({
        archiveDir,
        stage
      });
    }
    if (args.json) {
      console.log(JSON.stringify({
        ok: false,
        executionMode: preflightReport?.executionMode ?? (process.env.AUTOPOLY_EXECUTION_MODE ?? "live"),
        decisionStrategy: preflightReport?.decisionStrategy ?? orchestratorConfig.decisionStrategy,
        stage,
        message,
        archiveDir,
        runId,
        errorPath,
        decisionReportPath: decisionReportResult?.markdownPath ?? null,
        decisionReportPdfPath: decisionReportResult?.pdfPath ?? null
      }, null, 2));
    } else {
      printErrorSummary(createTerminalPrinter(), {
        title: "Pulse Live Failed",
        stage,
        error,
        rawSummary,
        context: errorContext,
        artifactDir: archiveDir,
        nextSteps: [
          "Inspect error.json and recommendation.json in the pulse-live archive.",
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
      errorPath,
      decisionReportPath: decisionReportResult?.markdownPath ?? null,
      decisionReportPdfPath: decisionReportResult?.pdfPath ?? null
    };
  }
}

async function main() {
  const result = await runPulseLive(parseArgs());
  if (!result.ok) {
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main().catch((error) => {
    printErrorSummary(createTerminalPrinter(), {
      title: "Pulse Live Failed",
      stage: "bootstrap",
      error,
      context: buildLiveRunContextRows({
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
