import { describe, expect, it, vi } from "vitest";
import { ManagedTradingDispatcher } from "./dispatcher.js";
import type { Db } from "./db-schema-adapter.js";
import type { PolymarketAdapter } from "./polymarket-adapter.js";
import type { ManagedUser, ProposedDecision } from "./types.js";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

interface CapturedInsert {
  readonly table: unknown;
  readonly values: unknown;
}

interface CapturedUpdate {
  readonly table: unknown;
  readonly set: Record<string, unknown>;
}

function makeUser(overrides: Partial<ManagedUser> = {}): ManagedUser {
  const now = new Date("2026-05-04T00:00:00.000Z");
  return {
    id: "user-1",
    privyDid: "did:privy:user-1",
    email: "user@example.com",
    eoaAddress: "0xeoaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    safeAddress: "0xsafeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    status: "active",
    aiAutoTradeEnabled: true,
    sessionSignerAuthorizedAt: now,
    sessionSignerRevokedAt: null,
    riskTier: "balanced",
    metadata: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  } as ManagedUser;
}

function makeOpenDecision(overrides: Partial<ProposedDecision> = {}): ProposedDecision {
  return {
    action: "open",
    eventSlug: "evt-1",
    marketSlug: "mkt-1",
    tokenId: "tok-1",
    side: "BUY",
    notionalUsd: 100,
    aiProb: 0.6,
    marketProb: 0.5,
    edge: 0.1,
    confidence: "medium",
    thesisMd: "open thesis",
    ...overrides
  };
}

function makeAdapter(balance: { usdcRaw: bigint; usdcFormatted: string }): PolymarketAdapter {
  return {
    deploySafe: vi.fn(),
    getBalance: vi.fn(async () => balance),
    placeOrder: vi.fn(),
    getPositions: vi.fn()
  } as unknown as PolymarketAdapter;
}

// Build a minimal Drizzle-shaped DB mock that captures inserts +
// updates and returns a configurable user list on `select`.
function makeDb(options: {
  selectRows: ManagedUser[];
  inserts?: CapturedInsert[];
  updates?: CapturedUpdate[];
}): Db {
  const inserts = options.inserts ?? [];
  const updates = options.updates ?? [];

  const selectChain = {
    from: () => ({
      where: () => ({
        limit: async () => options.selectRows
      })
    })
  };

  // Variant for `runPaperPulseForAllAuthorizedUsers` which calls
  // `.from(table).where(...)` without `.limit()`.
  const selectChainNoLimit = {
    from: () => {
      const where = async () => options.selectRows;
      return Object.assign(where, {
        where: async () => options.selectRows
      });
    }
  };

  const db = {
    select: () => {
      // Return a chain that supports both shapes.
      return {
        from: (_table: unknown) => {
          const wherePromise = async () => options.selectRows;
          const wherePromiseWithLimit = (cond: unknown) => ({
            limit: async (_n: number) => options.selectRows
          });
          return {
            where: (_cond: unknown) => ({
              limit: async (_n: number) => options.selectRows,
              then: (resolve: (rows: ManagedUser[]) => unknown) => resolve(options.selectRows)
            })
          };
        }
      };
    },
    insert: (table: unknown) => ({
      values: async (values: unknown) => {
        inserts.push({ table, values });
      }
    }),
    update: (table: unknown) => ({
      set: (set: Record<string, unknown>) => ({
        where: async (_cond: unknown) => {
          updates.push({ table, set });
        }
      })
    })
  };
  // void chains to silence unused-var lint noise from helper objects
  void selectChain;
  void selectChainNoLimit;
  return db as unknown as Db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ManagedTradingDispatcher.runPaperPulse", () => {
  it("skips users with aiAutoTradeEnabled=false", async () => {
    const inserts: CapturedInsert[] = [];
    const updates: CapturedUpdate[] = [];
    const dispatcher = new ManagedTradingDispatcher({
      db: makeDb({
        selectRows: [makeUser({ aiAutoTradeEnabled: false })],
        inserts,
        updates
      }),
      adapter: makeAdapter({ usdcRaw: 1000n * 10n ** 6n, usdcFormatted: "1000" })
    });

    const result = await dispatcher.runPaperPulse("user-1", [makeOpenDecision()]);

    expect(result.status).toBe("skipped");
    expect(result.skippedReason).toBe("ai_auto_trade_disabled");
    expect(result.runId).toBeNull();
    // No DB writes should have happened.
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("skips users with revoked session signer", async () => {
    const inserts: CapturedInsert[] = [];
    const dispatcher = new ManagedTradingDispatcher({
      db: makeDb({
        selectRows: [makeUser({ sessionSignerRevokedAt: new Date() })],
        inserts
      }),
      adapter: makeAdapter({ usdcRaw: 0n, usdcFormatted: "0" })
    });

    const result = await dispatcher.runPaperPulse("user-1", [makeOpenDecision()]);

    expect(result.status).toBe("skipped");
    expect(result.skippedReason).toBe("ai_auto_trade_disabled");
    expect(inserts).toHaveLength(0);
  });

  it("skips users whose Safe has zero USDC", async () => {
    const inserts: CapturedInsert[] = [];
    const dispatcher = new ManagedTradingDispatcher({
      db: makeDb({
        selectRows: [makeUser()],
        inserts
      }),
      adapter: makeAdapter({ usdcRaw: 0n, usdcFormatted: "0" })
    });

    const result = await dispatcher.runPaperPulse("user-1", [makeOpenDecision()]);

    expect(result.status).toBe("skipped");
    expect(result.skippedReason).toBe("empty_safe");
    expect(result.bankrollUsd).toBe(0);
    expect(inserts).toHaveLength(0);
  });

  it("persists run row and decisions when balance is positive", async () => {
    const inserts: CapturedInsert[] = [];
    const updates: CapturedUpdate[] = [];
    const dispatcher = new ManagedTradingDispatcher({
      db: makeDb({
        selectRows: [makeUser({ riskTier: "balanced" })],
        inserts,
        updates
      }),
      adapter: makeAdapter({
        usdcRaw: 1000n * 10n ** 6n,
        usdcFormatted: "1000"
      })
    });

    const result = await dispatcher.runPaperPulse("user-1", [
      makeOpenDecision({ tokenId: "t1", eventSlug: "e1", notionalUsd: 100 }),
      makeOpenDecision({ tokenId: "t2", eventSlug: "e2", notionalUsd: 200 })
    ]);

    expect(result.status).toBe("completed");
    expect(result.runId).toBeTruthy();
    expect(result.bankrollUsd).toBe(1000);
    expect(result.keptCount).toBeGreaterThan(0);

    // Two inserts: one for the run row, one for the decisions.
    expect(inserts.length).toBeGreaterThanOrEqual(2);
    // One update flipping status to 'completed'.
    const completedUpdate = updates.find(
      (u) => (u.set as Record<string, unknown>).status === "completed"
    );
    expect(completedUpdate).toBeDefined();
    expect(completedUpdate?.set.decisionCount).toBe(2);
  });

  it("returns failed status when adapter.getBalance throws", async () => {
    const adapter = {
      deploySafe: vi.fn(),
      getBalance: vi.fn(async () => {
        throw new Error("rpc_unavailable");
      }),
      placeOrder: vi.fn(),
      getPositions: vi.fn()
    } as unknown as PolymarketAdapter;

    const dispatcher = new ManagedTradingDispatcher({
      db: makeDb({ selectRows: [makeUser()] }),
      adapter
    });

    const result = await dispatcher.runPaperPulse("user-1", [makeOpenDecision()]);

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("rpc_unavailable");
  });
});
