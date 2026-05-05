import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";

import {
  PolymarketRelayerAdapter,
  type ClobClientFactory,
  type RelayerStatusClient
} from "./polymarket-relayer-adapter.js";
import type { ManagedTradingConfig, BuilderAttribution } from "./config.js";
import type { Address, OrderRequest, SessionSigner } from "./polymarket-adapter.js";

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

  it("returns empty array when fetch rejects", async () => {
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: {
        fetch: (vi.fn(async () => {
          throw new Error("network down");
        }) as unknown) as typeof fetch,
        viemClient: {} as PublicClient
      }
    });

    expect(await adapter.getPositions(SAFE_A)).toEqual([]);
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

// ---------------------------------------------------------------------------
// deploySafe
// ---------------------------------------------------------------------------

const EOA: Address = "0x3333333333333333333333333333333333333333";

function makeRelayerStatus(
  isDeployed: boolean | (() => Promise<boolean>)
): RelayerStatusClient {
  return {
    getDeployed: vi.fn(async () => {
      if (typeof isDeployed === "function") {
        return isDeployed();
      }
      return isDeployed;
    })
  };
}

describe("PolymarketRelayerAdapter.deploySafe", () => {
  it("returns alreadyDeployed=true when relayer reports deployed", async () => {
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: {
        relayerStatusClient: makeRelayerStatus(true),
        viemClient: {} as PublicClient
      }
    });

    const result = await adapter.deploySafe(EOA);

    expect(result.alreadyDeployed).toBe(true);
    expect(result.deployTxHash).toBeNull();
    expect(result.safeAddress.toLowerCase()).toBe(EOA);
  });

  it("returns alreadyDeployed=false when relayer reports not deployed", async () => {
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: {
        relayerStatusClient: makeRelayerStatus(false),
        viemClient: {} as PublicClient
      }
    });

    const result = await adapter.deploySafe(EOA);

    expect(result.alreadyDeployed).toBe(false);
  });

  it("rethrows with prefix when relayer.getDeployed fails", async () => {
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: {
        relayerStatusClient: makeRelayerStatus(async () => {
          throw new Error("relayer offline");
        }),
        viemClient: {} as PublicClient
      }
    });

    await expect(adapter.deploySafe(EOA)).rejects.toThrow(
      /deploySafe: relayer\.getDeployed failed: relayer offline/
    );
  });

  it("rejects malformed EOA with descriptive error", async () => {
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig(),
      deps: {
        relayerStatusClient: makeRelayerStatus(false),
        viemClient: {} as PublicClient
      }
    });

    await expect(
      adapter.deploySafe("0xnope" as unknown as Address)
    ).rejects.toThrow(/deploySafe: invalid EOA address/);
  });
});

// ---------------------------------------------------------------------------
// placeOrder
// ---------------------------------------------------------------------------

const TEST_BUILDER: BuilderAttribution = {
  address: "0x4444444444444444444444444444444444444444",
  code: "0x" + "ab".repeat(32),
  apiKey: "k",
  apiSecret: "s",
  apiPassphrase: "p"
};

const TEST_PRIVATE_KEY =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

function makeOrder(overrides: Partial<OrderRequest> = {}): OrderRequest {
  return {
    tokenId: "tok-xyz",
    side: "BUY",
    price: 0.42,
    notionalUsd: "20.00",
    ...overrides
  };
}

const SESSION_SIGNER: SessionSigner = { id: "sess-1" };

// Stub ClobClient factory — captures the constructor args + returns a
// fake client whose `createAndPostMarketOrder` is configurable per test.
function makeClobFactory(
  postOrder: (
    order: Record<string, unknown>
  ) => Promise<unknown> | unknown
): {
  factory: ClobClientFactory;
  calls: Array<Record<string, unknown>>;
  factoryArgs: Array<Record<string, unknown>>;
} {
  const calls: Array<Record<string, unknown>> = [];
  const factoryArgs: Array<Record<string, unknown>> = [];
  const factory: ClobClientFactory = async (params) => {
    factoryArgs.push({ ...params });
    return {
      createAndPostMarketOrder: async (order: Record<string, unknown>) => {
        calls.push(order);
        return postOrder(order);
      }
    } as unknown as Awaited<ReturnType<ClobClientFactory>>;
  };
  return { factory, calls, factoryArgs };
}

describe("PolymarketRelayerAdapter.placeOrder", () => {
  it("rejects in paper mode without calling SDK", async () => {
    const { factory, calls } = makeClobFactory(async () => {
      throw new Error("should not be called in paper mode");
    });
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig({ mode: "paper" }),
      deps: { clobClientFactory: factory, viemClient: {} as PublicClient }
    });

    const result = await adapter.placeOrder(SAFE_A, makeOrder(), SESSION_SIGNER);

    expect(result.status).toBe("rejected");
    expect(result.errorMessage).toMatch(/live mode required/);
    expect(calls).toHaveLength(0);
  });

  it("rejects in live mode when builder attribution is missing", async () => {
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig({
        mode: "live",
        builderAttribution: null,
        privySessionSignerPrivateKey: TEST_PRIVATE_KEY
      }),
      deps: { viemClient: {} as PublicClient }
    });

    const result = await adapter.placeOrder(SAFE_A, makeOrder(), SESSION_SIGNER);

    expect(result.status).toBe("rejected");
    expect(result.errorMessage).toMatch(/builder attribution missing/);
  });

  it("rejects on invalid order shape (price out of range)", async () => {
    const { factory, calls } = makeClobFactory(async () => ({}));
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig({
        mode: "live",
        builderAttribution: TEST_BUILDER,
        privySessionSignerPrivateKey: TEST_PRIVATE_KEY
      }),
      deps: { clobClientFactory: factory, viemClient: {} as PublicClient }
    });

    const result = await adapter.placeOrder(
      SAFE_A,
      makeOrder({ price: 1.5 }),
      SESSION_SIGNER
    );

    expect(result.status).toBe("rejected");
    expect(result.errorMessage).toMatch(/invalid price/);
    expect(calls).toHaveLength(0);
  });

  it("places a BUY order and returns filled result", async () => {
    const { factory, calls, factoryArgs } = makeClobFactory(async () => ({
      success: true,
      orderID: "0xorder123",
      makingAmount: "20",
      takingAmount: "47.619",
      status: "matched"
    }));
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig({
        mode: "live",
        builderAttribution: TEST_BUILDER,
        privySessionSignerPrivateKey: TEST_PRIVATE_KEY
      }),
      deps: { clobClientFactory: factory, viemClient: {} as PublicClient }
    });

    const result = await adapter.placeOrder(SAFE_A, makeOrder(), SESSION_SIGNER);

    expect(result.status).toBe("filled");
    expect(result.orderId).toBe("0xorder123");
    expect(result.filledNotionalUsd).toBe("20.00");
    expect(result.avgPrice).toBeCloseTo(20 / 47.619, 4);
    expect(result.errorMessage).toBeUndefined();

    // Sanity-check the SDK call shape: the user's Safe is the funder,
    // builder code is stamped on the order, and FOK is used.
    expect(factoryArgs).toHaveLength(1);
    expect(factoryArgs[0]?.safeAddress).toBe(SAFE_A);
    expect(factoryArgs[0]?.builderAttribution).toBe(TEST_BUILDER);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.tokenID).toBe("tok-xyz");
    expect(calls[0]?.builderCode).toBe(TEST_BUILDER.code);
    expect(calls[0]?.orderType).toBe("FOK");
  });

  it("classifies SDK errors and surfaces structured rejection", async () => {
    const { factory } = makeClobFactory(async () => {
      throw new Error("429 Too Many Requests");
    });
    const adapter = new PolymarketRelayerAdapter({
      config: makeConfig({
        mode: "live",
        builderAttribution: TEST_BUILDER,
        privySessionSignerPrivateKey: TEST_PRIVATE_KEY
      }),
      deps: { clobClientFactory: factory, viemClient: {} as PublicClient }
    });

    const result = await adapter.placeOrder(SAFE_A, makeOrder(), SESSION_SIGNER);

    expect(result.status).toBe("rejected");
    expect(result.errorMessage).toMatch(/rate_limit/);
  });
});
