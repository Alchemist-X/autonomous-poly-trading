import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { OverviewResponse, PublicPosition, TradeDecision, TradeDecisionSet } from "@autopoly/contracts";
import type { PulseSnapshot } from "../pulse/market-pulse.js";
import type { PositionReviewResult } from "./decision-metadata.js";
import {
  buildAgentContextPack,
  buildExecutionDispatchPlan,
  buildExecutionGateResult,
  buildPositionReviewArtifact,
  buildRavenAgentIterationArtifacts,
  buildSourceResolutionAudit,
  evaluateRavenAgentIteration,
  writeRavenAgentIterationArtifacts
} from "./raven-agent-loop.js";

const generatedAtUtc = "2026-05-04T12:00:00.000Z";

function overview(status: OverviewResponse["status"] = "running"): OverviewResponse {
  return {
    status,
    cash_balance_usd: 100,
    total_equity_usd: 500,
    high_water_mark_usd: 520,
    drawdown_pct: 0.038,
    open_positions: 1,
    last_run_at: null,
    latest_risk_event: null,
    equity_curve: []
  };
}

function position(overrides: Partial<PublicPosition> = {}): PublicPosition {
  return {
    id: "pos-1",
    event_slug: "event-1",
    market_slug: "market-1",
    token_id: "token-1",
    side: "BUY",
    outcome_label: "Yes",
    size: 20,
    avg_cost: 0.5,
    current_price: 0.52,
    current_value_usd: 10.4,
    unrealized_pnl_pct: 0.04,
    stop_loss_pct: 0.3,
    opened_at: generatedAtUtc,
    updated_at: generatedAtUtc,
    ...overrides
  };
}

function pulse(overrides: Partial<PulseSnapshot> = {}): PulseSnapshot {
  return {
    id: "pulse-1",
    generatedAtUtc,
    title: "Pulse",
    relativeMarkdownPath: "reports/pulse.md",
    absoluteMarkdownPath: "/tmp/pulse.md",
    relativeJsonPath: "reports/pulse.json",
    absoluteJsonPath: "/tmp/pulse.json",
    markdown: "# Pulse",
    totalFetched: 100,
    totalFiltered: 20,
    selectedCandidates: 1,
    minLiquidityUsd: 5000,
    candidates: [],
    riskFlags: [],
    tradeable: true,
    ...overrides
  };
}

function decision(overrides: Partial<TradeDecision> = {}): TradeDecision {
  return {
    action: "open",
    event_slug: "event-1",
    market_slug: "market-1",
    token_id: "token-1",
    side: "BUY",
    notional_usd: 5,
    order_type: "FOK",
    ai_prob: 0.6,
    market_prob: 0.52,
    edge: 0.08,
    confidence: "medium",
    thesis_md: "The Raven Agent thesis covers market probability, counter-evidence, liquidity, position impact, and why this action is preferred now.",
    sources: [
      {
        title: "Primary source",
        url: "https://example.com/source",
        retrieved_at_utc: generatedAtUtc
      }
    ],
    stop_loss_pct: 0.3,
    resolution_track_required: true,
    ...overrides
  };
}

function decisionSet(input: { runId?: string; decisions?: TradeDecision[] } = {}): TradeDecisionSet {
  return {
    run_id: input.runId ?? randomUUID(),
    runtime: "raven-agent-test",
    generated_at_utc: generatedAtUtc,
    bankroll_usd: 500,
    mode: "full",
    decisions: input.decisions ?? [decision()],
    artifacts: []
  };
}

function positionReview(input: {
  pos?: PublicPosition;
  action?: PositionReviewResult["action"];
  edgeValue?: number;
  pulseCoverage?: PositionReviewResult["pulseCoverage"];
} = {}): PositionReviewResult {
  const pos = input.pos ?? position();
  const dec = decision({
    action: input.action ?? "hold",
    side: input.action === "close" || input.action === "reduce" ? "SELL" : "BUY",
    token_id: pos.token_id,
    market_slug: pos.market_slug,
    event_slug: pos.event_slug,
    edge: input.edgeValue ?? 0.08
  });
  return {
    position: pos,
    action: input.action ?? "hold",
    stillHasEdge: (input.edgeValue ?? 0.08) > 0,
    edgeAssessment: (input.edgeValue ?? 0.08) > 0 ? "yes" : "no",
    edgeValue: input.edgeValue ?? 0.08,
    pulseCoverage: input.pulseCoverage ?? "supporting",
    evidenceRefreshStatus: "fresh-supporting",
    freshEvidence: [],
    adverseSignals: [],
    stopOrReduceTriggers: [],
    pnlSnapshot: {
      currentValueUsd: 10,
      avgCost: 0.5,
      currentPrice: 0.55,
      unrealizedPnlPct: 0.1,
      stopLossPct: 0.3
    },
    humanReviewFlag: false,
    confidence: "medium",
    reason: "Position retains a positive edge after refreshed review.",
    reviewConclusion: "Hold because the edge remains positive and sources are current.",
    suggestedExitPct: 0,
    basis: "pulse-supports-current",
    decision: dec
  };
}

describe("raven agent loop artifacts", () => {
  it("scores missing current-position review as revision required", () => {
    const runId = randomUUID();
    const pos = position();
    const contextPack = buildAgentContextPack({
      runId,
      mode: "full",
      overview: overview(),
      positions: [pos],
      pulse: pulse(),
      generatedAtUtc
    });
    const decisions = decisionSet({ runId });
    const report = evaluateRavenAgentIteration({
      contextPack,
      positionReview: buildPositionReviewArtifact({
        runId,
        positions: [pos],
        positionReviews: [],
        generatedAtUtc
      }),
      sourceResolutionAudit: buildSourceResolutionAudit({
        runId,
        decisionSet: decisions,
        generatedAtUtc
      }),
      decisionSet: decisions
    });

    expect(report.overallScore).toBe(4);
    expect(report.findings.some((finding) => finding.title === "Open position was not reviewed")).toBe(true);
  });

  it("marks clean live execution intents as dispatch-ready", () => {
    const runId = randomUUID();
    const contextPack = buildAgentContextPack({
      runId,
      mode: "full",
      overview: overview(),
      positions: [position()],
      pulse: pulse(),
      generatedAtUtc
    });
    const evaluatorReport = evaluateRavenAgentIteration({
      contextPack,
      positionReview: buildPositionReviewArtifact({
        runId,
        positions: [position()],
        positionReviews: [positionReview()],
        generatedAtUtc
      }),
      sourceResolutionAudit: buildSourceResolutionAudit({
        runId,
        decisionSet: decisionSet({ runId }),
        generatedAtUtc
      }),
      decisionSet: decisionSet({ runId })
    });
    const gate = buildExecutionGateResult({
      runId,
      mode: "live",
      contextPack,
      evaluatorReport,
      generatedAtUtc
    });
    const dispatchPlan = buildExecutionDispatchPlan({
      runId,
      decisions: [decision()],
      executionGate: gate,
      generatedAtUtc
    });

    expect(gate.decision).toBe("execute");
    expect(dispatchPlan.readyToBroadcast).toBe(true);
    expect(dispatchPlan.orders[0]?.dispatchStatus).toBe("ready");
  });

  it("writes the live dispatch artifact set", async () => {
    const runId = randomUUID();
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "raven-agent-loop-"));
    try {
      const pos = position();
      const contextPack = buildAgentContextPack({
        runId,
        mode: "full",
        overview: overview(),
        positions: [pos],
        pulse: pulse(),
        generatedAtUtc
      });
      const artifacts = buildRavenAgentIterationArtifacts({
        contextPack,
        decisionSet: decisionSet({ runId }),
        positions: [pos],
        positionReviews: [positionReview({ pos })],
        mode: "live"
      });
      await writeRavenAgentIterationArtifacts({
        archiveDir: tempDir,
        artifacts
      });

      const dispatchPlan = JSON.parse(await readFile(path.join(tempDir, "execution-dispatch-plan.json"), "utf8")) as {
        readyToBroadcast: boolean;
      };
      const feedback = await readFile(path.join(tempDir, "feedback-injection.md"), "utf8");
      expect(dispatchPlan.readyToBroadcast).toBe(true);
      expect(feedback).toContain("Raven Agent Feedback Injection");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
