import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";

import { PolymarketRelayerAdapter } from "./polymarket-relayer-adapter.js";
import type { ManagedTradingConfig } from "./config.js";
import type { Address } from "./polymarket-adapter.js";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

const SAFE_A: Address = "0x1111111111111111111111111111111111111111";
const SAFE_B: Address = "0x2222222222222222222222222222222222222222";

function makeConfig(overrides: Partial<ManagedTradingConfig> = {}): ManagedTradingConfig {
  return {
    mode: "paper",
    polymarketHost: "https://clob.polymarket.com",
    polygonRpcUrl: undefined,
    chainId: 137,
    privySessionSignerPrivateKey: undefined,
    builderAttribution: null,
    ...overrides
  };
}

// Minimal viem-shaped client mock; only `readContract` is called by
// `getBalance`. Returns a configurable raw bigint per address.
function makeViemClient(
  balances: Record<string, bigint>
): { client: PublicClient; reads: number } {
  const stats = { reads: 0 };
  const client = {
    readContract: vi.fn(async (args: { args: readonly [string] }) => {
      stats.reads += 1;
      const owner = args.args[0].toLowerCase();
      return balances[owner] ?? 0n;
    })
  } as unknown as PublicClient;
  return { client, get reads() { return stats.reads; } };
}

// JSON-fetch double for getPositions tests.
function makeFetch(payload: unknown, overrides: Partial<Response> = {}): typeof fetch {
  return vi.fn(async () => {
    const response = {
      ok: overrides.ok ?? true,
      status: overrides.status ?? 200,
      json: async () => payload
    } as unknown as Response;
    return response;
  }) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// getBalance
// ---------------------------------------------------------------------------

describe("PolymarketRelayerAdapter.getBalance", () => {
  it("returns formatted USDC.e balance from viem readContract", async () => {
    const viem = makeViemClient({ [SAFE_A]: 12_345_678n });
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: { viemClient: viem.client }
    });

    const balance = await adapter.getBalance(SAFE_A);

    expect(balance.usdcRaw).toBe(12_345_678n);
    // 12.345678 -> formatUnits(raw, 6)
    expect(balance.usdcFormatted).toBe("12.345678");
  });

  it("caches per-address for 30 s and re-fetches across distinct addresses", async () => {
    const viem = makeViemClient({
      [SAFE_A]: 1_000_000n,
      [SAFE_B]: 2_000_000n
    });

    let nowMs = 1_000_000;
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: { viemClient: viem.client, now: () => nowMs }
    });

    const first = await adapter.getBalance(SAFE_A);
    const cached = await adapter.getBalance(SAFE_A);
    expect(first.usdcFormatted).toBe("1");
    expect(cached.usdcFormatted).toBe("1");
    expect(viem.reads).toBe(1);

    // Different address bypasses the per-address cache.
    const other = await adapter.getBalance(SAFE_B);
    expect(other.usdcFormatted).toBe("2");
    expect(viem.reads).toBe(2);

    // Advance past TTL — re-reads.
    nowMs += 30_001;
    await adapter.getBalance(SAFE_A);
    expect(viem.reads).toBe(3);
  });

  it("rethrows with prefix when readContract rejects", async () => {
    const client = {
      readContract: vi.fn(async () => {
        throw new Error("rpc_unavailable");
      })
    } as unknown as PublicClient;

    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: { viemClient: client }
    });

    await expect(adapter.getBalance(SAFE_A)).rejects.toThrow(
      /getBalance: USDC\.e balanceOf RPC call failed: rpc_unavailable/
    );
  });

  it("rejects malformed safe address with descriptive error", async () => {
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: { viemClient: {} as PublicClient }
    });

    await expect(
      adapter.getBalance("0xnope" as unknown as Address)
    ).rejects.toThrow(/getBalance: invalid safe address/);
  });

  it("preserves zero balance shape (not coerced to negative or NaN)", async () => {
    const viem = makeViemClient({ [SAFE_A]: 0n });
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: { viemClient: viem.client }
    });

    const balance = await adapter.getBalance(SAFE_A);
    expect(balance.usdcRaw).toBe(0n);
    expect(balance.usdcFormatted).toBe("0");
  });

  it("formats sub-cent balances at 6 decimals", async () => {
    const viem = makeViemClient({ [SAFE_A]: 1n });
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: { viemClient: viem.client }
    });

    const balance = await adapter.getBalance(SAFE_A);
    expect(balance.usdcFormatted).toBe("0.000001");
  });
});

// ---------------------------------------------------------------------------
// getPositions
// ---------------------------------------------------------------------------

describe("PolymarketRelayerAdapter.getPositions", () => {
  it("returns empty array on non-2xx response", async () => {
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: {
        fetch: makeFetch(null, { ok: false, status: 502 }),
        viemClient: {} as PublicClient
      }
    });

    const positions = await adapter.getPositions(SAFE_A);
    expect(positions).toEqual([]);
  });

  it("normalizes a data-api payload into Position rows", async () => {
    const payload = [
      {
        asset: "tok-1",
        size: 25,
        outcome: "Yes",
        avgPrice: 0.42,
        curPrice: 0.55,
        currentValue: 13.75,
        percentPnl: 30.95,
        market_slug: "elections-2026"
      },
      {
        // dust under threshold path — `size` is zero so we drop it
        // even though sizeThreshold filtering is server-side.
        asset_id: "tok-2",
        size: 0,
        outcome: "No"
      },
      {
        // missing tokenId — drop
        size: 5,
        outcome: "yes"
      }
    ];
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: {
        fetch: makeFetch(payload),
        viemClient: {} as PublicClient
      }
    });

    const positions = await adapter.getPositions(SAFE_A);

    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({
      tokenId: "tok-1",
      marketSlug: "elections-2026",
      side: "yes",
      size: "25",
      avgCost: 0.42,
      currentPrice: 0.55,
      unrealizedPnlPct: 30.95
    });
    expect(positions[0]?.currentValueUsd).toBe("13.75");
  });
});
