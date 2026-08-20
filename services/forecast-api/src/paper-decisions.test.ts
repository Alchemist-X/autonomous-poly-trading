import { describe, expect, it } from "vitest";
import { buildDecisionQuality, collectEntryContext, replayEpisodes } from "./paper-decisions";
import type { PaperLedgerEvent } from "./paper-ledger";

const noInputs = {
  livePrices: new Map<string, number>(),
  markPrices: new Map<string, number>(),
  questions: new Map<string, string>(),
  benchmarkAsOfUtc: "2026-08-20T12:00:00.000Z"
};

const buy = (over: Partial<PaperLedgerEvent> = {}): PaperLedgerEvent => ({
  ts: "2026-07-01T00:00:00.000Z",
  type: "trade",
  side: "buy",
  style: "market",
  positionId: "mkt:1",
  slug: "mkt",
  outcome: "No",
  shares: 1000,
  avgPrice: 0.4,
  feeUsd: 0,
  reason: "watchlist_entry",
  ...over
});

const sell = (over: Partial<PaperLedgerEvent> = {}): PaperLedgerEvent => ({
  ts: "2026-07-05T00:00:00.000Z",
  type: "trade",
  side: "sell",
  style: "market",
  positionId: "mkt:1",
  slug: "mkt",
  shares: 1000,
  avgPrice: 0.5,
  feeUsd: 0,
  reason: "negative_edge",
  ...over
});

describe("replayEpisodes", () => {
  it("closes an episode when the shares are fully sold", () => {
    const { closed, openTail } = replayEpisodes([buy(), sell()]);
    expect(openTail.size).toBe(0);
    expect(closed).toHaveLength(1);
    expect(closed[0]?.entryPrice).toBeCloseTo(0.4);
    expect(closed[0]?.exitPrice).toBeCloseTo(0.5);
    expect(closed[0]?.proceedsUsd).toBeCloseTo(500);
  });

  it("settles the remainder on a resolution event", () => {
    const { closed } = replayEpisodes([
      buy(),
      { ts: "2026-07-09T00:00:00.000Z", type: "resolution", positionId: "mkt:1", slug: "mkt", kind: "won" }
    ]);
    expect(closed[0]?.settledPerShare).toBe(1);
    expect(closed[0]?.exitReason).toBe("settled_won");
    expect(closed[0]?.proceedsUsd).toBeCloseTo(1000);
  });

  it("re-entry under the same position id yields two separate episodes", () => {
    const { closed } = replayEpisodes([
      buy(),
      sell({ reason: "stop_loss", avgPrice: 0.26 }),
      buy({ ts: "2026-07-06T00:00:00.000Z", avgPrice: 0.3 }),
      sell({ ts: "2026-07-20T00:00:00.000Z", avgPrice: 0.55 })
    ]);
    expect(closed).toHaveLength(2);
    expect(closed[0]?.exitReason).toBe("stop_loss");
    expect(closed[1]?.entryPrice).toBeCloseTo(0.3);
  });

  it("keeps a partially sold position open with a pro-rated cost basis", () => {
    const { closed, openTail } = replayEpisodes([buy({ feeUsd: 10 }), sell({ shares: 400 })]);
    expect(closed).toHaveLength(0);
    const rest = openTail.get("mkt:1");
    expect(rest?.shares).toBeCloseTo(600);
    // 60% of (400 notional + 10 fee)
    expect(rest?.costUsd).toBeCloseTo(246);
  });
});

describe("buildDecisionQuality", () => {
  it("splits pnl into entry + exit against one benchmark, exactly", () => {
    const events = [buy(), sell({ avgPrice: 0.5, feeUsd: 5 })];
    const dq = buildDecisionQuality(
      events,
      { ...noInputs, livePrices: new Map([["mkt:1", 0.9]]) },
      495 - 400
    );
    const ep = dq.episodes[0];
    expect(ep?.benchmarkPrice).toBe(0.9);
    // buy-and-hold to 0.90 would have made 1000*0.9 - 400 = +500
    expect(ep?.entryAlphaUsd).toBeCloseTo(500);
    // selling at 0.50 instead gave up 495 - 900 = -405
    expect(ep?.exitAlphaUsd).toBeCloseTo(-405);
    expect(ep?.pnlUsd).toBeCloseTo(95);
    expect((ep?.entryAlphaUsd ?? 0) + (ep?.exitAlphaUsd ?? 0)).toBeCloseTo(ep?.pnlUsd ?? 0);
    expect(dq.reconciliation.deltaUsd).toBeCloseTo(0);
  });

  it("attributes an open position entirely to the entry decision", () => {
    const dq = buildDecisionQuality(
      [buy({ feeUsd: 20 })],
      { ...noInputs, markPrices: new Map([["mkt:1", 0.65]]) },
      0
    );
    const ep = dq.episodes[0];
    expect(ep?.status).toBe("open");
    expect(ep?.exitAlphaUsd).toBe(0);
    // 1000 * 0.65 - (400 + 20)
    expect(ep?.entryAlphaUsd).toBeCloseTo(230);
    expect(dq.entry.openUsd).toBeCloseTo(230);
    expect(dq.entry.closedUsd).toBe(0);
  });

  it("prefers a settlement over any observed price as the benchmark", () => {
    const dq = buildDecisionQuality(
      [
        buy(),
        sell({ avgPrice: 0.26, reason: "stop_loss" }),
        buy({ ts: "2026-07-06T00:00:00.000Z" }),
        { ts: "2026-07-09T00:00:00.000Z", type: "resolution", positionId: "mkt:1", slug: "mkt", kind: "lost" }
      ],
      { ...noInputs, livePrices: new Map([["mkt:1", 0.9]]) },
      -140
    );
    const settled = dq.episodes.find((e) => e.exitReason === "settled_lost");
    expect(settled?.benchmarkSource).toBe("settled");
    expect(settled?.benchmarkPrice).toBe(0);
    // The stop-loss episode still marks against the live price it was sold into.
    const stopped = dq.episodes.find((e) => e.exitReason === "stop_loss");
    expect(stopped?.benchmarkPrice).toBe(0.9);
  });

  it("flags an episode as unscored for exit quality when no benchmark exists", () => {
    const dq = buildDecisionQuality([buy(), sell({ avgPrice: 0.5 })], noInputs, 100);
    expect(dq.episodes[0]?.benchmarkSource).toBe("exit");
    expect(dq.episodes[0]?.exitAlphaUsd).toBeCloseTo(0);
    expect(dq.exit.unscored).toBe(1);
  });

  it("surfaces a replay mismatch instead of hiding it", () => {
    const dq = buildDecisionQuality([buy(), sell({ avgPrice: 0.5 })], noInputs, 999);
    expect(dq.reconciliation.deltaUsd).toBeCloseTo(100 - 999);
  });
});

describe("collectEntryContext", () => {
  it("attributes the preceding watchlist screen and the first review to the buy", () => {
    const ctx = collectEntryContext([
      {
        ts: "2026-06-30T00:00:00.000Z",
        type: "watchlist_eval",
        slug: "mkt",
        probYes: 0.12,
        marketProbYes: 0.35,
        edgePp: 23,
        enter: true
      },
      buy(),
      {
        ts: "2026-07-02T00:00:00.000Z",
        type: "evaluation",
        positionId: "mkt:1",
        engineRounds: 4,
        evidenceCount: 17
      },
      {
        ts: "2026-07-03T00:00:00.000Z",
        type: "evaluation",
        positionId: "mkt:1",
        engineRounds: 9,
        evidenceCount: 30
      }
    ]);
    const entry = ctx.get("mkt:1");
    // The position is NO, so both probabilities are reported for the held side.
    expect(entry?.agentProb).toBeCloseTo(0.88);
    expect(entry?.marketProb).toBeCloseTo(0.65);
    expect(entry?.roundsAtEntry).toBe(4);
    expect(entry?.evidenceAtEntry).toBe(17);
    expect(entry?.reviewCount).toBe(2);
  });
});
