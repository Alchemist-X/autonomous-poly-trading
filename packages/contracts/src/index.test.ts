import { describe, expect, it } from "vitest";
import {
  applyPaperTradeDecision,
  roughLoopRunRecordSchema,
  roughLoopTaskSchema,
  tradeDecisionSetSchema
} from "./index.js";

describe("tradeDecisionSetSchema", () => {
  it("accepts a valid decision set", () => {
    const parsed = tradeDecisionSetSchema.parse({
      run_id: "47a9e19f-7352-4c7a-a41e-3d18c4487bb9",
      runtime: "codex-skill-runtime",
      generated_at_utc: "2026-03-13T10:00:00.000Z",
      bankroll_usd: 10000,
      mode: "full",
      decisions: [
        {
          action: "open",
          event_slug: "event",
          market_slug: "market",
          token_id: "token",
          side: "BUY",
          notional_usd: 50,
          order_type: "FOK",
          ai_prob: 0.6,
          market_prob: 0.42,
          edge: 0.18,
          confidence: "high",
          thesis_md: "Edge is positive.",
          sources: [
            {
              title: "Source",
              url: "https://example.com",
              retrieved_at_utc: "2026-03-13T10:00:00.000Z"
            }
          ],
          stop_loss_pct: 0.3,
          resolution_track_required: true
        }
      ],
      artifacts: []
    });

    expect(parsed.runtime).toBe("codex-skill-runtime");
  });

  it("rejects decisions without sources", () => {
    expect(() =>
      tradeDecisionSetSchema.parse({
        run_id: "47a9e19f-7352-4c7a-a41e-3d18c4487bb9",
        runtime: "codex-skill-runtime",
        generated_at_utc: "2026-03-13T10:00:00.000Z",
        bankroll_usd: 10000,
        mode: "full",
        decisions: [
          {
            action: "open",
            event_slug: "event",
            market_slug: "market",
            token_id: "token",
            side: "BUY",
            notional_usd: 50,
            order_type: "FOK",
            ai_prob: 0.6,
            market_prob: 0.42,
            edge: 0.18,
            confidence: "high",
            thesis_md: "Edge is positive.",
            sources: [],
            stop_loss_pct: 0.3,
            resolution_track_required: true
          }
        ],
        artifacts: []
      })
    ).toThrow();
  });
});

describe("roughLoopTaskSchema", () => {
  it("accepts a valid rough loop task", () => {
    const parsed = roughLoopTaskSchema.parse({
      id: "RL-001",
      title: "Implement rough loop parser",
      status: "todo",
      priority: "P1",
      dependsOn: [],
      allowedPaths: ["services/rough-loop"],
      definitionOfDone: ["Parser can round-trip markdown tasks."],
      verification: ["pnpm test"],
      context: ["Start from the rough-loop guide template."],
      latestResult: ["Not started."],
      attempts: 0,
      section: "queue",
      createdOrder: 0
    });

    expect(parsed.status).toBe("todo");
  });
});

describe("roughLoopRunRecordSchema", () => {
  it("accepts a run record with verification results", () => {
    const parsed = roughLoopRunRecordSchema.parse({
      runId: "run-123",
      taskId: "RL-001",
      provider: "codex",
      status: "done",
      attempt: 1,
      startedAtUtc: "2026-03-14T08:00:00.000Z",
      finishedAtUtc: "2026-03-14T08:05:00.000Z",
      summary: "Task completed.",
      changedFiles: ["services/rough-loop/src/lib/markdown.ts"],
      artifactsDir: "runtime-artifacts/rough-loop/runs/2026/03/14/run-123",
      verification: {
        passed: true,
        summary: "All verification commands passed.",
        commandResults: [
          {
            command: "pnpm test",
            exitCode: 0,
            passed: true,
            stdout: "",
            stderr: ""
          }
        ]
      }
    });

    expect(parsed.verification?.passed).toBe(true);
  });
});

describe("applyPaperTradeDecision", () => {
  it("opens a new paper position from a BUY decision", () => {
    const result = applyPaperTradeDecision({
      position: null,
      avgPrice: 0.5,
      timestampUtc: "2026-03-16T10:00:00.000Z",
      decision: {
        action: "open",
        event_slug: "event",
        market_slug: "market",
        token_id: "token",
        side: "BUY",
        notional_usd: 25,
        order_type: "FOK",
        ai_prob: 0.6,
        market_prob: 0.45,
        edge: 0.15,
        confidence: "high",
        thesis_md: "Open a paper position.",
        sources: [
          {
            title: "Source",
            url: "https://example.com",
            retrieved_at_utc: "2026-03-16T10:00:00.000Z"
          }
        ],
        stop_loss_pct: 0.3,
        resolution_track_required: true
      }
    });

    expect(result.status).toBe("filled");
    expect(result.filledNotionalUsd).toBe(25);
    expect(result.nextPosition?.size).toBeCloseTo(50);
  });

  it("rejects a SELL decision when no paper position exists", () => {
    const result = applyPaperTradeDecision({
      position: null,
      avgPrice: 0.48,
      timestampUtc: "2026-03-16T10:00:00.000Z",
      decision: {
        action: "close",
        event_slug: "event",
        market_slug: "market",
        token_id: "token",
        side: "SELL",
        notional_usd: 25,
        order_type: "FOK",
        ai_prob: 0.6,
        market_prob: 0.45,
        edge: 0.15,
        confidence: "high",
        thesis_md: "Close a missing paper position.",
        sources: [
          {
            title: "Source",
            url: "https://example.com",
            retrieved_at_utc: "2026-03-16T10:00:00.000Z"
          }
        ],
        stop_loss_pct: 0.3,
        resolution_track_required: true
      }
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toContain("no open position");
  });
});
