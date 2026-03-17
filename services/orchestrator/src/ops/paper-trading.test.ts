import { describe, expect, it } from "vitest";
import { createDefaultLocalAppState } from "@autopoly/db";
import type { TradeDecisionSet } from "@autopoly/contracts";
import { approvePaperRun, guardDecisionSetForPaper, persistPaperRecommendation } from "./paper-trading.js";

function createDecisionSet(): TradeDecisionSet {
  return {
    run_id: "11111111-1111-4111-8111-111111111111",
    runtime: "codex-skill-runtime",
    generated_at_utc: "2026-03-16T10:00:00.000Z",
    bankroll_usd: 11842.77,
    mode: "full",
    decisions: [
      {
        action: "open",
        event_slug: "local-paper-run",
        market_slug: "local-paper-run",
        token_id: "token-local-paper-open",
        side: "BUY",
        notional_usd: 200,
        order_type: "FOK",
        ai_prob: 0.64,
        market_prob: 0.44,
        edge: 0.2,
        confidence: "high",
        thesis_md: "Open a guarded paper position.",
        sources: [
          {
            title: "Paper Source",
            url: "https://example.com/paper",
            retrieved_at_utc: "2026-03-16T10:00:00.000Z"
          }
        ],
        stop_loss_pct: 0.3,
        resolution_track_required: true
      }
    ],
    artifacts: [
      {
        kind: "pulse-report",
        title: "Paper pulse",
        path: "reports/pulse/local-paper.md",
        published_at_utc: "2026-03-16T10:00:00.000Z"
      }
    ]
  };
}

describe("paper trading helpers", () => {
  it("persists a guarded recommendation as awaiting approval without changing positions", () => {
    const state = createDefaultLocalAppState();
    const guarded = guardDecisionSetForPaper({
      decisionSet: createDecisionSet(),
      overview: state.overview,
      positions: state.positions,
      config: {
        maxTradePct: 0.05,
        maxTotalExposurePct: 0.5,
        maxEventExposurePct: 0.3,
        maxPositions: 10,
        minTradeUsd: 10
      }
    });

    const nextState = persistPaperRecommendation({
      state,
      promptSummary: "Paper summary",
      reasoningMd: "Paper reasoning",
      logsMd: "Paper logs",
      decisionSet: guarded.decisionSet
    });

    expect(nextState.runs[0]?.status).toBe("awaiting-approval");
    expect(nextState.runDetails[guarded.decisionSet.run_id]?.status).toBe("awaiting-approval");
    expect(nextState.positions).toEqual(state.positions);
    expect(nextState.trades).toEqual(state.trades);
    expect(nextState.runs[0]?.decision_count).toBe(1);
    expect(nextState.runDetails[guarded.decisionSet.run_id]?.decisions[0]?.notional_usd).toBeCloseTo(120);
  });

  it("approves the latest awaiting recommendation and updates positions and trades", () => {
    const state = persistPaperRecommendation({
      state: createDefaultLocalAppState(),
      promptSummary: "Paper summary",
      reasoningMd: "Paper reasoning",
      logsMd: "Paper logs",
      decisionSet: {
        ...createDecisionSet(),
        decisions: [
          {
            ...createDecisionSet().decisions[0]!,
            notional_usd: 25
          }
        ]
      }
    });

    const approved = approvePaperRun({
      state,
      latest: true,
      config: {
        drawdownStopPct: 0.2
      }
    });

    expect(approved.runId).toBe("11111111-1111-4111-8111-111111111111");
    expect(approved.executedTradeCount).toBe(1);
    expect(approved.state.runs[0]?.status).toBe("completed");
    expect(approved.state.trades[0]?.status).toBe("filled");
    expect(approved.state.positions.some((position) => position.token_id === "token-local-paper-open")).toBe(true);
  });

  it("caps total new exposure per event", () => {
    const state = createDefaultLocalAppState();
    const guarded = guardDecisionSetForPaper({
      decisionSet: {
        ...createDecisionSet(),
        decisions: [
          {
            ...createDecisionSet().decisions[0]!,
            event_slug: "shared-event",
            market_slug: "shared-event-market-a",
            token_id: "shared-event-market-a",
            notional_usd: 200,
            edge: 0.3
          },
          {
            ...createDecisionSet().decisions[0]!,
            event_slug: "shared-event",
            market_slug: "shared-event-market-b",
            token_id: "shared-event-market-b",
            notional_usd: 200,
            edge: 0.3
          }
        ]
      },
      overview: {
        ...state.overview,
        total_equity_usd: 200
      },
      positions: [],
      config: {
        maxTradePct: 0.1,
        maxTotalExposurePct: 0.8,
        maxEventExposurePct: 0.3,
        maxPositions: 10,
        minTradeUsd: 10
      }
    });

    expect(guarded.decisionSet.decisions[0]?.notional_usd).toBe(20);
    expect(guarded.decisionSet.decisions[1]?.notional_usd).toBe(20);
  });

  it("rejects repeated approvals for the same run", () => {
    const state = persistPaperRecommendation({
      state: createDefaultLocalAppState(),
      promptSummary: "Paper summary",
      reasoningMd: "Paper reasoning",
      logsMd: "Paper logs",
      decisionSet: {
        ...createDecisionSet(),
        decisions: [
          {
            ...createDecisionSet().decisions[0]!,
            notional_usd: 25
          }
        ]
      }
    });
    const approved = approvePaperRun({
      state,
      latest: true,
      config: {
        drawdownStopPct: 0.2
      }
    });

    expect(() =>
      approvePaperRun({
        state: approved.state,
        runId: approved.runId,
        config: {
          drawdownStopPct: 0.2
        }
      })
    ).toThrow(`Run ${approved.runId} is already completed.`);
  });
});
