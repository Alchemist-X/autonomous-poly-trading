import { describe, expect, it } from "vitest";
import {
  applyResolution,
  computeRealizedPnlUsd,
  parseLedgerLines,
  renderCalibrationReport,
  scoreRows,
  type LedgerRow
} from "./forecast-resolution-backfill.ts";

const row = (over: Partial<LedgerRow> = {}): LedgerRow => ({
  decisionKey: "run:open_position:m1:tok:Yes",
  decision: { action: "open_position", marketSlug: "m1", outcomeLabel: "Yes", aiProb: 0.7, marketProb: 0.6 },
  execution: { status: "filled", filledNotionalUsd: 10, avgPrice: 0.5 },
  outcome: { status: "pending", resolvedAtUtc: null, winningOutcome: null, realizedPnlUsd: null },
  ...over
});

const resolvedMarket = (winner: number) => ({
  resolution: "resolved" as const,
  resolvedOutcomeIndex: winner,
  outcomes: ["Yes", "No"],
  endDateIso: "2026-06-30T00:00:00Z"
});

describe("parseLedgerLines", () => {
  it("parses one JSON object per line and counts malformed lines", () => {
    const { rows, badLines } = parseLedgerLines(`${JSON.stringify(row())}\nnot-json\n\n${JSON.stringify(row())}\n`);
    expect(rows).toHaveLength(2);
    expect(badLines).toBe(1);
  });
});

describe("computeRealizedPnlUsd", () => {
  it("win pays shares minus stake; loss loses the stake", () => {
    // $10 at 0.5 = 20 shares; win => 20 - 10 = +10
    expect(computeRealizedPnlUsd(row(), "Yes")).toBeCloseTo(10, 6);
    expect(computeRealizedPnlUsd(row(), "No")).toBeCloseTo(-10, 6);
  });
  it("null without a fill or price", () => {
    expect(computeRealizedPnlUsd(row({ execution: { status: "recommend_only", filledNotionalUsd: null, avgPrice: null } }), "Yes")).toBeNull();
  });
});

describe("applyResolution (immutably fills terminal outcomes)", () => {
  it("fills a resolved winner and computes PnL", () => {
    const base = row();
    const { row: updated, changed } = applyResolution(base, resolvedMarket(0), "2026-07-05T00:00:00Z");
    expect(changed).toBe(true);
    expect(updated.outcome?.status).toBe("resolved");
    expect(updated.outcome?.winningOutcome).toBe("Yes");
    expect(updated.outcome?.realizedPnlUsd).toBeCloseTo(10, 6);
    // immutability: the input row is untouched
    expect(base.outcome?.status).toBe("pending");
  });
  it("marks a voided market without inventing a winner or PnL", () => {
    const { row: updated, changed } = applyResolution(
      row(),
      { resolution: "voided", resolvedOutcomeIndex: null, outcomes: ["Yes", "No"], endDateIso: null },
      "2026-07-05T00:00:00Z"
    );
    expect(changed).toBe(true);
    expect(updated.outcome?.status).toBe("voided");
    expect(updated.outcome?.winningOutcome).toBeNull();
    expect(updated.outcome?.realizedPnlUsd).toBeNull();
  });
  it("leaves open/awaiting markets pending and already-resolved rows untouched", () => {
    expect(
      applyResolution(row(), { resolution: "awaiting", resolvedOutcomeIndex: null, outcomes: [], endDateIso: null }, "t").changed
    ).toBe(false);
    const done = row({ outcome: { status: "resolved", resolvedAtUtc: "t", winningOutcome: "Yes", realizedPnlUsd: 1 } });
    expect(applyResolution(done, resolvedMarket(1), "t").changed).toBe(false);
    expect(done.outcome?.winningOutcome).toBe("Yes");
  });
});

describe("scoreRows", () => {
  const resolvedRow = (aiProb: number, marketProb: number, held: string, winner: string, action = "open_position"): LedgerRow =>
    row({
      decision: { action, marketSlug: "m", outcomeLabel: held, aiProb, marketProb },
      outcome: { status: "resolved", resolvedAtUtc: "t", winningOutcome: winner, realizedPnlUsd: null }
    });

  it("computes AI and market Brier plus skill", () => {
    const stats = scoreRows([
      resolvedRow(0.8, 0.6, "Yes", "Yes"), // won: ai (0.2)^2, mkt (0.4)^2
      resolvedRow(0.3, 0.5, "No", "Yes") // lost: ai (0.3)^2, mkt (0.5)^2
    ]);
    expect(stats.resolvedScored).toBe(2);
    expect(stats.aiBrier).toBeCloseTo((0.04 + 0.09) / 2, 9);
    expect(stats.marketBrier).toBeCloseTo((0.16 + 0.25) / 2, 9);
    expect(stats.skillVsMarket).toBeGreaterThan(0);
  });

  it("buckets calibration by stated probability and reports hit rate", () => {
    const stats = scoreRows([
      resolvedRow(0.75, 0.7, "Yes", "Yes"),
      resolvedRow(0.72, 0.7, "Yes", "No"),
      resolvedRow(0.05, 0.1, "No", "Yes")
    ]);
    const seventies = stats.buckets.find((b) => b.range === "70-80%");
    expect(seventies?.count).toBe(2);
    expect(seventies?.hitRate).toBeCloseTo(0.5, 6);
  });

  it("skips pending rows and rows without usable probabilities", () => {
    const stats = scoreRows([row(), resolvedRow(0.7, 0.6, "Yes", "Yes"), resolvedRow(NaN as unknown as number, 0.6, "Yes", "Yes")]);
    expect(stats.resolvedScored).toBe(1);
    expect(stats.pendingRows).toBe(1);
  });

  it("splits Brier by action", () => {
    const stats = scoreRows([resolvedRow(0.7, 0.6, "Yes", "Yes", "open_position"), resolvedRow(0.4, 0.5, "No", "No", "hold")]);
    expect(stats.byAction.map((a) => a.action).sort()).toEqual(["hold", "open_position"]);
  });
});

describe("renderCalibrationReport", () => {
  it("renders the headline metrics and calibration table", () => {
    const stats = scoreRows([
      row({
        decision: { action: "open_position", marketSlug: "m", outcomeLabel: "Yes", aiProb: 0.8, marketProb: 0.7 },
        outcome: { status: "resolved", resolvedAtUtc: "t", winningOutcome: "Yes", realizedPnlUsd: 5 }
      })
    ]);
    const md = renderCalibrationReport(stats, "2026-07-05T00:00:00Z");
    expect(md).toContain("AI Brier score");
    expect(md).toContain("Skill vs market");
    expect(md).toContain("| 80-90% | 1 |");
    expect(md).toContain("$5.00");
  });
});
