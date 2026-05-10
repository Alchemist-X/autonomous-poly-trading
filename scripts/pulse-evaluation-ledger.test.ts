import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import { describe, expect, it } from "vitest";
import type { PublicPosition, TradeDecision } from "@autopoly/contracts";
import {
  buildCalibrationLedgerEntries,
  buildPositionMarkAttribution,
  writePulseEvaluationArtifacts
} from "./pulse-evaluation-ledger.ts";

function createPosition(overrides: Partial<PublicPosition> = {}): PublicPosition {
  return {
    id: "position-1",
    event_slug: "demo-event",
    market_slug: "demo-market",
    token_id: "token-no",
    side: "BUY",
    outcome_label: "No",
    size: 10,
    avg_cost: 0.4,
    current_price: 0.5,
    current_value_usd: 5,
    unrealized_pnl_pct: 0.25,
    stop_loss_pct: 0.3,
    opened_at: "2026-05-07T00:00:00.000Z",
    updated_at: "2026-05-07T00:00:00.000Z",
    ...overrides
  };
}

function createDecision(overrides: Partial<TradeDecision> = {}): TradeDecision {
  return {
    action: "open",
    event_slug: "new-event",
    market_slug: "new-market",
    token_id: "token-yes",
    outcome_label: "Yes",
    side: "BUY",
    notional_usd: 10,
    order_type: "FOK",
    ai_prob: 0.62,
    market_prob: 0.52,
    edge: 0.1,
    confidence: "medium",
    thesis_md: "Positive edge with enough liquidity.",
    sources: [
      {
        title: "Pulse",
        url: "https://example.com/pulse",
        retrieved_at_utc: "2026-05-07T00:00:00.000Z"
      }
    ],
    stop_loss_pct: 0.3,
    resolution_track_required: true,
    ...overrides
  };
}

describe("pulse evaluation ledger", () => {
  it("builds before/after mark attribution with new-position spread impact", () => {
    const attribution = buildPositionMarkAttribution({
      beforePositions: [
        createPosition({
          token_id: "existing-token",
          market_slug: "existing-market",
          current_price: 0.5,
          current_value_usd: 5
        })
      ],
      afterPositions: [
        createPosition({
          token_id: "existing-token",
          market_slug: "existing-market",
          current_price: 0.45,
          current_value_usd: 4.5
        }),
        createPosition({
          token_id: "new-token",
          market_slug: "new-market",
          size: 20,
          avg_cost: 0.5,
          current_price: 0.49,
          current_value_usd: 9.8
        })
      ],
      executedOrders: [
        {
          action: "open",
          marketSlug: "new-market",
          tokenId: "new-token",
          side: "BUY",
          notionalUsd: 10,
          filledNotionalUsd: 10,
          avgPrice: 0.5,
          ok: true
        }
      ],
      beforeSnapshotAtUtc: "2026-05-07T00:00:00.000Z",
      afterSnapshotAtUtc: "2026-05-07T00:05:00.000Z"
    });

    expect(attribution.totals.beforeMarkedValueUsd).toBe(5);
    expect(attribution.totals.afterMarkedValueUsd).toBe(14.3);
    expect(attribution.totals.untradedExistingMarkDeltaUsd).toBe(-0.5);
    expect(attribution.totals.newPositionMarkVsFillDeltaUsd).toBe(-0.2);
    expect(attribution.changes.map((change) => [change.tokenId, change.status])).toEqual([
      ["existing-token", "existing-untraded"],
      ["new-token", "new"]
    ]);
  });

  it("builds calibration rows that bind decisions to execution and marks", () => {
    const attribution = buildPositionMarkAttribution({
      beforePositions: [],
      afterPositions: [
        createPosition({
          token_id: "token-yes",
          market_slug: "new-market",
          outcome_label: "Yes",
          current_price: 0.51,
          current_value_usd: 9.9
        })
      ],
      executedOrders: [
        {
          action: "open",
          marketSlug: "new-market",
          tokenId: "token-yes",
          side: "BUY",
          notionalUsd: 10,
          filledNotionalUsd: 10,
          avgPrice: 0.52,
          ok: true,
          orderId: "order-1"
        }
      ],
      beforeSnapshotAtUtc: "2026-05-07T00:00:00.000Z",
      afterSnapshotAtUtc: "2026-05-07T00:05:00.000Z"
    });

    const [entry] = buildCalibrationLedgerEntries({
      runId: "run-1",
      generatedAtUtc: "2026-05-07T00:00:00.000Z",
      archiveDir: "/tmp/archive",
      executionMode: "pulse:live",
      decisionStrategy: "pulse-direct",
      decisions: [createDecision()],
      executedOrders: [
        {
          action: "open",
          marketSlug: "new-market",
          tokenId: "token-yes",
          side: "BUY",
          notionalUsd: 10,
          filledNotionalUsd: 10,
          avgPrice: 0.52,
          ok: true,
          orderId: "order-1"
        }
      ],
      skipped: [],
      markAttribution: attribution
    });

    expect(entry?.decisionKey).toBe("run-1:open:new-market:token-yes:Yes");
    expect(entry?.execution.status).toBe("filled");
    expect(entry?.execution.orderId).toBe("order-1");
    expect(entry?.marks.afterPrice).toBe(0.51);
    expect(entry?.outcome.status).toBe("pending");
  });

  it("writes per-run and global JSONL artifacts", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "pulse-eval-ledger-"));
    const archiveDir = path.join(tempDir, "pulse-live", "run-1");

    try {
      const result = await writePulseEvaluationArtifacts({
        artifactStorageRoot: tempDir,
        archiveDir,
        runId: "run-1",
        generatedAtUtc: "2026-05-07T00:00:00.000Z",
        executionMode: "recommend-only",
        decisionStrategy: "pulse-direct",
        decisions: [createDecision()],
        skipped: [],
        executedOrders: [],
        beforePositions: [],
        afterPositions: [],
        beforeSnapshotAtUtc: "2026-05-07T00:00:00.000Z",
        afterSnapshotAtUtc: "2026-05-07T00:00:00.000Z"
      });

      const markSnapshot = await readFile(result.markSnapshotPath, "utf8");
      const runLedger = await readFile(result.runLedgerPath, "utf8");
      const globalLedger = await readFile(result.globalLedgerPath, "utf8");

      expect(markSnapshot).toContain("\"beforePositions\": []");
      expect(runLedger.trim().split("\n")).toHaveLength(1);
      expect(globalLedger).toContain("\"executionMode\":\"recommend-only\"");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
