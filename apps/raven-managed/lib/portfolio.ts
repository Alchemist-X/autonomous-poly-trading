// On-chain portfolio reads for managed users.
//
// Reads USDC.e ERC-20 balance for a user's Polymarket Safe on Polygon.
// Uses viem with a public RPC (configurable via POLYGON_RPC_URL env). A
// short-lived in-memory cache (30 s) prevents the dashboard polling loop
// from hammering the RPC.

import { createPublicClient, http, formatUnits, getAddress } from "viem";
import { polygon } from "viem/chains";

// USDC.e on Polygon (canonical, bridged USDC).
const USDC_E_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;
const USDC_DECIMALS = 6;
const CACHE_TTL_MS = 30_000;

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

type CacheEntry = { value: { usdc: string }; expiresAt: number };
const balanceCache = new Map<string, CacheEntry>();

let cachedClient: ReturnType<typeof createPublicClient> | null = null;

function getClient() {
  if (cachedClient) return cachedClient;
  const rpcUrl = process.env.POLYGON_RPC_URL;
  // viem falls back to a public Polygon RPC when transport URL is undefined.
  cachedClient = createPublicClient({
    chain: polygon,
    transport: http(rpcUrl)
  });
  return cachedClient;
}

export type SafeBalance = { usdc: string };

// Read on-chain USDC.e balance for a Safe address. Returns formatted decimal
// string (e.g. "123.45"). Returns "0.00" + warning on RPC error or invalid
// input — never throws into the API route.
export async function getSafeBalance(safeAddress: string): Promise<SafeBalance> {
  if (!safeAddress) {
    return { usdc: "0.00" };
  }

  let normalised: `0x${string}`;
  try {
    normalised = getAddress(safeAddress);
  } catch {
    console.warn(`[portfolio] invalid safe address: ${safeAddress}`);
    return { usdc: "0.00" };
  }

  const cached = balanceCache.get(normalised);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const client = getClient();
    const raw = (await client.readContract({
      address: USDC_E_ADDRESS,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [normalised]
    })) as bigint;
    const usdc = formatUnits(raw, USDC_DECIMALS);
    const value = { usdc };
    balanceCache.set(normalised, { value, expiresAt: now + CACHE_TTL_MS });
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[portfolio] balance read failed for ${normalised}: ${message}`);
    return { usdc: "0.00" };
  }
}
