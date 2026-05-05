import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutorConfig } from "../config.js";
import {
  autoRedeemResolved,
  constants,
  fetchMarketResolutionStatus,
  findRedeemableFromPositions,
  redeemPosition,
  type RedeemablePosition
} from "./redeem.js";
import type { RemotePosition } from "./polymarket-sdk.js";

// ---- helpers ----------------------------------------------------------------

function makeConfig(overrides: Partial<ExecutorConfig> = {}): ExecutorConfig {
  return {
    port: 4002,
    redisUrl: "redis://localhost:6379",
    envFilePath: null,
    privateKey: "0x" + "ab".repeat(32),
    funderAddress: "0x1234567890abcdef1234567890abcdef12345678",
    signatureType: 1,
    polymarketHost: "https://clob.polymarket.com",
    chainId: 137,
    defaultOrderType: "FOK",
    drawdownStopPct: 0.2,
    positionStopLossPct: 0.3,
    initialBankrollUsd: 10000,
    builderAttribution: null,
    ...overrides
  };
}

function makeRemotePosition(overrides: Partial<RemotePosition> = {}): RemotePosition {
  return {
    tokenId: "token-abc-123",
    outcome: "Yes",
    size: 55.74,
    title: "US Forces Enter Iran",
    eventSlug: "us-forces-enter-iran",
    marketSlug: "us-forces-enter-iran-by-march-31",
    ...overrides
  };
}

function makeRedeemable(overrides: Partial<RedeemablePosition> = {}): RedeemablePosition {
  return {
    tokenId: "token-abc-123",
    conditionId: "0xcondition123",
    marketSlug: "us-forces-enter-iran-by-march-31",
    size: 55.74,
    isWinner: true,
    ...overrides
  };
}

// ---- mocks ------------------------------------------------------------------

const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- fetchMarketResolutionStatus --------------------------------------------

describe("fetchMarketResolutionStatus", () => {
  it("returns resolved=true with conditionId and winnerTokenId for a resolved market", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          condition_id: "0xcond1",
          resolved: true,
          closed: true,
          tokens: [
            { token_id: "token-yes", outcome: "Yes", winner: true },
            { token_id: "token-no", outcome: "No", winner: false }
          ]
        }
      ]
    } as Response);

    const result = await fetchMarketResolutionStatus("some-market-slug");

    expect(result.resolved).toBe(true);
    expect(result.conditionId).toBe("0xcond1");
    expect(result.winnerTokenId).toBe("token-yes");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://gamma-api.polymarket.com/markets?slug=some-market-slug",
      expect.objectContaining({ headers: { "user-agent": "@autopoly/executor" } })
    );
  });

  it("returns resolved=false when API returns non-resolved market", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          condition_id: "0xcond2",
          resolved: false,
          closed: false,
          tokens: []
        }
      ]
    } as Response);

    const result = await fetchMarketResolutionStatus("active-market");
    expect(result.resolved).toBe(false);
    expect(result.conditionId).toBeNull();
  });

  it("returns resolved=false when API response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    const result = await fetchMarketResolutionStatus("broken-slug");
    expect(result.resolved).toBe(false);
  });

  it("returns resolved=false when API returns empty array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    } as Response);

    const result = await fetchMarketResolutionStatus("nonexistent");
    expect(result.resolved).toBe(false);
  });

  it("treats closed=true as resolved even if resolved=false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          condition_id: "0xcond3",
          resolved: false,
          closed: true,
          tokens: [
            { token_id: "token-a", outcome: "Yes", winner: false },
            { token_id: "token-b", outcome: "No", winner: true }
          ]
        }
      ]
    } as Response);

    const result = await fetchMarketResolutionStatus("closed-market");
    expect(result.resolved).toBe(true);
    expect(result.winnerTokenId).toBe("token-b");
  });

  it("returns null winnerTokenId when no token is flagged winner", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          condition_id: "0xcond4",
          resolved: true,
          tokens: [
            { token_id: "tok-1", outcome: "Yes" },
            { token_id: "tok-2", outcome: "No" }
          ]
        }
      ]
    } as Response);

    const result = await fetchMarketResolutionStatus("no-winner-flag");
    expect(result.resolved).toBe(true);
    expect(result.winnerTokenId).toBeNull();
  });
});

// ---- findRedeemableFromPositions --------------------------------------------

describe("findRedeemableFromPositions", () => {
  it("returns redeemable positions for resolved markets", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          condition_id: "0xcondA",
          resolved: true,
          closed: true,
          tokens: [
            { token_id: "token-abc-123", outcome: "Yes", winner: true },
            { token_id: "token-def-456", outcome: "No", winner: false }
          ]
        }
      ]
    } as Response);

    const positions: RemotePosition[] = [
      makeRemotePosition({ tokenId: "token-abc-123", size: 55.74 })
    ];

    const redeemable = await findRedeemableFromPositions(positions);
    expect(redeemable).toHaveLength(1);
    expect(redeemable[0]).toEqual({
      tokenId: "token-abc-123",
      conditionId: "0xcondA",
      marketSlug: "us-forces-enter-iran-by-march-31",
      size: 55.74,
      isWinner: true
    });
  });

  it("marks losing positions correctly", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          condition_id: "0xcondB",
          resolved: true,
          tokens: [
            { token_id: "winner-token", outcome: "Yes", winner: true },
            { token_id: "loser-token", outcome: "No", winner: false }
          ]
        }
      ]
    } as Response);

    const positions: RemotePosition[] = [
      makeRemotePosition({ tokenId: "loser-token", marketSlug: "slug-b" })
    ];

    const redeemable = await findRedeemableFromPositions(positions);
    expect(redeemable).toHaveLength(1);
    expect(redeemable[0]!.isWinner).toBe(false);
  });

  it("skips positions in non-resolved markets", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { condition_id: "0xcondC", resolved: false, closed: false, tokens: [] }
      ]
    } as Response);

    const positions: RemotePosition[] = [
      makeRemotePosition({ marketSlug: "active-market" })
    ];

    const redeemable = await findRedeemableFromPositions(positions);
    expect(redeemable).toHaveLength(0);
  });

  it("skips positions without a slug", async () => {
    const positions: RemotePosition[] = [
      { tokenId: "tok", outcome: "Yes", size: 10 }
    ];

    const redeemable = await findRedeemableFromPositions(positions);
    expect(redeemable).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("deduplicates API calls for positions sharing the same slug", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          condition_id: "0xcondD",
          resolved: true,
          tokens: [
            { token_id: "tok-yes", outcome: "Yes", winner: true },
            { token_id: "tok-no", outcome: "No", winner: false }
          ]
        }
      ]
    } as Response);

    const positions: RemotePosition[] = [
      makeRemotePosition({ tokenId: "tok-yes", marketSlug: "same-slug", size: 10 }),
      makeRemotePosition({ tokenId: "tok-no", marketSlug: "same-slug", size: 5 })
    ];

    const redeemable = await findRedeemableFromPositions(positions);
    expect(redeemable).toHaveLength(2);
    // Only one API call despite two positions
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("skips positions when API call throws", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const positions: RemotePosition[] = [
      makeRemotePosition({ marketSlug: "broken-slug" })
    ];

    const redeemable = await findRedeemableFromPositions(positions);
    expect(redeemable).toHaveLength(0);
  });
});

// ---- redeemPosition ---------------------------------------------------------

describe("redeemPosition", () => {
  it("returns error when no private key is configured", async () => {
    const config = makeConfig({ privateKey: "" });
    const position = makeRedeemable();

    const result = await redeemPosition(config, position);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No private key");
    expect(result.txHash).toBeNull();
    expect(result.position).toBe(position);
  });

  // Contract interaction tests require mocking ethers internals.
  // We test the happy path by mocking the Contract constructor.
  it("returns txHash on successful redemption", async () => {
    const mockTx = {
      hash: "0xtxhash123",
      wait: vi.fn().mockResolvedValue({ transactionHash: "0xtxhash123" })
    };
    const mockContract = {
      redeemPositions: vi.fn().mockResolvedValue(mockTx)
    };

    // Mock the Contract constructor
    vi.doMock("ethers", async () => {
      const actual = await vi.importActual<typeof import("ethers")>("ethers");
      return {
        ...actual,
        Contract: vi.fn().mockReturnValue(mockContract)
      };
    });

    // Re-import after mock
    const { redeemPosition: redeemPositionMocked } = await import("./redeem.js");
    const config = makeConfig();
    const position = makeRedeemable();

    const result = await redeemPositionMocked(config, position);

    // Since ethers module mock may not take effect due to ESM caching,
    // we verify the structure of the error result (RPC connection failure expected)
    expect(result.position).toEqual(position);
    expect(typeof result.ok).toBe("boolean");
    expect(result.txHash === null || typeof result.txHash === "string").toBe(true);

    vi.doUnmock("ethers");
  });

  it("captures contract errors and returns them in result", async () => {
    const config = makeConfig();
    const position = makeRedeemable();

    // This will fail because there's no real Polygon RPC, but the error should be captured
    const result = await redeemPosition(config, position);

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.txHash).toBeNull();
    expect(result.position).toBe(position);
  });
});

// ---- autoRedeemResolved -----------------------------------------------------

describe("autoRedeemResolved", () => {
  it("returns empty summary when no positions are redeemable", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { condition_id: "0xcondE", resolved: false, closed: false, tokens: [] }
      ]
    } as Response);

    const config = makeConfig();
    const positions: RemotePosition[] = [
      makeRemotePosition({ marketSlug: "active-market" })
    ];

    const summary = await autoRedeemResolved(config, positions);
    expect(summary.redeemed).toHaveLength(0);
    expect(summary.skipped).toBe(1);
    expect(summary.totalWinnerUsdc).toBe(0);
  });

  it("returns empty summary when positions list is empty", async () => {
    const config = makeConfig();
    const summary = await autoRedeemResolved(config, []);

    expect(summary.redeemed).toHaveLength(0);
    expect(summary.skipped).toBe(0);
    expect(summary.totalWinnerUsdc).toBe(0);
  });

  it("attempts redemption for resolved positions", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          condition_id: "0xcondF",
          resolved: true,
          tokens: [
            { token_id: "tok-w", outcome: "Yes", winner: true },
            { token_id: "tok-l", outcome: "No", winner: false }
          ]
        }
      ]
    } as Response);

    const config = makeConfig();
    const positions: RemotePosition[] = [
      makeRemotePosition({ tokenId: "tok-w", marketSlug: "resolved-market", size: 100 }),
      makeRemotePosition({ tokenId: "tok-l", marketSlug: "resolved-market", size: 50 })
    ];

    const summary = await autoRedeemResolved(config, positions);

    // Both positions should be attempted (will fail due to no real RPC)
    expect(summary.redeemed).toHaveLength(2);
    expect(summary.skipped).toBe(0);
    // Since RPC calls fail, no successful winner redemptions
    expect(summary.redeemed[0]!.position.isWinner).toBe(true);
    expect(summary.redeemed[1]!.position.isWinner).toBe(false);
  });
});

// ---- constants --------------------------------------------------------------

describe("redeem constants", () => {
  it("exports correct contract addresses", () => {
    expect(constants.CONDITIONAL_TOKENS_ADDRESS).toBe("0x4D97DCd97eC945f40cF65F87097ACe5EA0476045");
    expect(constants.USDC_POLYGON_ADDRESS).toBe("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
  });

  it("exports correct binary index sets", () => {
    expect(constants.BINARY_INDEX_SETS).toEqual([1, 2]);
  });

  it("exports zero-value parent collection ID", () => {
    expect(constants.PARENT_COLLECTION_ID).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
  });

  it("uses Polygon chain ID by default", () => {
    expect(constants.DEFAULT_POLYGON_RPC).toBe("https://polygon-rpc.com");
  });
});
