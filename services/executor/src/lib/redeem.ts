import { Contract, Wallet, providers } from "ethers";
import type { ExecutorConfig } from "../config.js";
import { gammaFetch } from "./gamma.js";
import { fetchRemotePositions, type RemotePosition } from "./polymarket-sdk.js";

// ConditionalTokens contract on Polygon
const CONDITIONAL_TOKENS_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";

// USDC on Polygon (collateral token)
const USDC_POLYGON_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

// Parent collection ID (zero bytes32 for top-level conditions)
const PARENT_COLLECTION_ID = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Index sets for binary markets: outcome 0 = 1, outcome 1 = 2
const BINARY_INDEX_SETS = [1, 2];

// Default Polygon RPC
const DEFAULT_POLYGON_RPC = "https://polygon-rpc.com";

// Minimal ABI for redeemPositions
const CONDITIONAL_TOKENS_ABI = [
  "function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external"
];

export interface RedeemablePosition {
  readonly tokenId: string;
  readonly conditionId: string;
  readonly marketSlug: string;
  readonly size: number;
  readonly isWinner: boolean;
}

export interface RedeemResult {
  readonly ok: boolean;
  readonly txHash: string | null;
  readonly error: string | null;
  readonly position: RedeemablePosition;
}

export interface AutoRedeemSummary {
  readonly redeemed: readonly RedeemResult[];
  readonly skipped: number;
  readonly totalWinnerUsdc: number;
}

interface GammaMarketResponse {
  readonly condition_id?: string;
  readonly closed?: boolean;
  readonly resolved?: boolean;
  readonly active?: boolean;
  readonly end_date_iso?: string;
  readonly tokens?: ReadonlyArray<{
    readonly token_id?: string;
    readonly outcome?: string;
    readonly price?: number;
    readonly winner?: boolean;
  }>;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function resolveRpcUrl(config: ExecutorConfig): string {
  const configRecord = config as unknown as Record<string, unknown>;
  const chainRpcUrl = typeof configRecord.chainRpcUrl === "string" ? configRecord.chainRpcUrl : "";
  return chainRpcUrl || DEFAULT_POLYGON_RPC;
}

/**
 * Query the Gamma API to check whether a market (by slug) is resolved,
 * and retrieve its conditionId and winning token info.
 */
export async function fetchMarketResolutionStatus(
  marketSlug: string
): Promise<{
  resolved: boolean;
  conditionId: string | null;
  winnerTokenId: string | null;
}> {
  const response = await gammaFetch(`/markets?slug=${encodeURIComponent(marketSlug)}`);

  if (!response.ok) {
    return { resolved: false, conditionId: null, winnerTokenId: null };
  }

  const markets = (await response.json()) as GammaMarketResponse[];

  if (!Array.isArray(markets) || markets.length === 0) {
    return { resolved: false, conditionId: null, winnerTokenId: null };
  }

  const market = markets[0];
  if (!market) {
    return { resolved: false, conditionId: null, winnerTokenId: null };
  }

  const isResolved = Boolean(market.resolved) || Boolean(market.closed);

  if (!isResolved) {
    return { resolved: false, conditionId: null, winnerTokenId: null };
  }

  const conditionId = market.condition_id ?? null;
  const tokens = market.tokens ?? [];
  const winnerToken = tokens.find((t) => t.winner === true);
  const winnerTokenId = winnerToken?.token_id ?? null;

  return { resolved: isResolved, conditionId, winnerTokenId };
}

/**
 * Identify remote positions that sit in resolved markets and can be redeemed.
 */
export async function findRedeemablePositions(
  config: ExecutorConfig
): Promise<RedeemablePosition[]> {
  const remotePositions = await fetchRemotePositions(config);
  return findRedeemableFromPositions(remotePositions);
}

/**
 * Given an already-fetched list of remote positions, check each against the
 * Gamma API for resolution status and return the redeemable ones.
 */
export async function findRedeemableFromPositions(
  remotePositions: readonly RemotePosition[]
): Promise<RedeemablePosition[]> {
  const slugsSeen = new Set<string>();
  const positionsWithSlug = remotePositions.filter((p) => {
    const slug = p.marketSlug ?? p.eventSlug;
    return slug != null && slug.length > 0;
  });

  // Deduplicate API calls by slug
  const slugToResolution = new Map<
    string,
    { resolved: boolean; conditionId: string | null; winnerTokenId: string | null }
  >();

  const uniqueSlugs = [
    ...new Set(positionsWithSlug.map((p) => p.marketSlug ?? p.eventSlug ?? ""))
  ].filter(Boolean);

  await Promise.all(
    uniqueSlugs.map(async (slug) => {
      if (slugsSeen.has(slug)) return;
      slugsSeen.add(slug);
      try {
        const status = await fetchMarketResolutionStatus(slug);
        slugToResolution.set(slug, status);
      } catch {
        // Skip positions where we cannot determine resolution status
      }
    })
  );

  const redeemable: RedeemablePosition[] = [];

  for (const position of positionsWithSlug) {
    const slug = position.marketSlug ?? position.eventSlug ?? "";
    const resolution = slugToResolution.get(slug);

    if (!resolution || !resolution.resolved || !resolution.conditionId) {
      continue;
    }

    const isWinner = resolution.winnerTokenId != null
      ? position.tokenId === resolution.winnerTokenId
      : false;

    redeemable.push({
      tokenId: position.tokenId,
      conditionId: resolution.conditionId,
      marketSlug: slug,
      size: position.size,
      isWinner
    });
  }

  return redeemable;
}

/**
 * Call redeemPositions on the ConditionalTokens contract for a single position.
 * Returns a transaction hash on success.
 */
export async function redeemPosition(
  config: ExecutorConfig,
  position: RedeemablePosition
): Promise<RedeemResult> {
  try {
    if (!config.privateKey) {
      return {
        ok: false,
        txHash: null,
        error: "No private key configured for redemption.",
        position
      };
    }

    const rpcUrl = resolveRpcUrl(config);
    const provider = new providers.JsonRpcProvider(rpcUrl, config.chainId);
    const signer = new Wallet(config.privateKey, provider);

    const contract = new Contract(
      CONDITIONAL_TOKENS_ADDRESS,
      CONDITIONAL_TOKENS_ABI,
      signer
    );

    const tx = await contract.redeemPositions(
      USDC_POLYGON_ADDRESS,
      PARENT_COLLECTION_ID,
      position.conditionId,
      BINARY_INDEX_SETS
    );

    const receipt = await tx.wait();

    return {
      ok: true,
      txHash: receipt.transactionHash ?? tx.hash ?? null,
      error: null,
      position
    };
  } catch (error) {
    return {
      ok: false,
      txHash: null,
      error: getErrorMessage(error),
      position
    };
  }
}

/**
 * Auto-redeem all resolved positions. Non-blocking: errors are captured
 * per-position and the function always returns a summary.
 */
export async function autoRedeemResolved(
  config: ExecutorConfig,
  remotePositions: readonly RemotePosition[]
): Promise<AutoRedeemSummary> {
  const redeemable = await findRedeemableFromPositions(remotePositions);
  const skipped = remotePositions.length - redeemable.length;

  if (redeemable.length === 0) {
    return { redeemed: [], skipped, totalWinnerUsdc: 0 };
  }

  const results: RedeemResult[] = [];

  for (const position of redeemable) {
    const result = await redeemPosition(config, position);
    results.push(result);
  }

  const totalWinnerUsdc = results
    .filter((r) => r.ok && r.position.isWinner)
    .reduce((sum, r) => sum + r.position.size, 0);

  return {
    redeemed: results,
    skipped,
    totalWinnerUsdc
  };
}

// Re-export constants for testing
export const constants = {
  CONDITIONAL_TOKENS_ADDRESS,
  USDC_POLYGON_ADDRESS,
  PARENT_COLLECTION_ID,
  BINARY_INDEX_SETS,
  DEFAULT_POLYGON_RPC,
  CONDITIONAL_TOKENS_ABI
} as const;
