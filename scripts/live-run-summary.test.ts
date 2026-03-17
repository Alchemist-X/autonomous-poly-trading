import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import { describe, expect, it } from "vitest";
import {
  buildRunSummaryMarkdown,
  writeRunSummaryArtifacts,
  type LiveRunSummaryInput
} from "./live-run-summary.ts";

function createBaseInput(archiveDir: string): LiveRunSummaryInput {
  return {
    mode: "live:test:stateless",
    executionMode: "live",
    strategy: "pulse-direct",
    envFilePath: ".env.pizza",
    archiveDir,
    runId: "test-run-id",
    status: "success",
    stage: "completed",
    generatedAtUtc: "2026-03-17T03:00:00.000Z",
    promptSummary: "Loaded pulse and runtime context.",
    reasoningMd: "Reasoning says market edge is small but still executable.",
    decisions: [
      {
        action: "open",
        marketSlug: "demo-market-open",
        eventSlug: "demo-event",
        tokenId: "token-open",
        side: "BUY",
        notionalUsd: 2,
        thesisMd: "Open because edge is positive."
      },
      {
        action: "hold",
        marketSlug: "demo-market-hold",
        eventSlug: "demo-event",
        tokenId: "token-hold",
        side: "BUY",
        notionalUsd: 0.5,
        thesisMd: "Hold because thesis unchanged."
      }
    ],
    executablePlans: [
      {
        action: "open",
        marketSlug: "demo-market-open",
        eventSlug: "demo-event",
        tokenId: "token-open",
        side: "BUY",
        notionalUsd: 2,
        bankrollRatio: 0.1,
        thesisMd: "Open because edge is positive."
      }
    ],
    executedOrders: [
      {
        action: "open",
        marketSlug: "demo-market-open",
        tokenId: "token-open",
        side: "BUY",
        requestedNotionalUsd: 2,
        filledNotionalUsd: 1.98,
        orderId: "order-1",
        status: "filled",
        ok: true
      }
    ],
    blockedItems: [
      {
        action: "open",
        marketSlug: "blocked-market",
        tokenId: "token-blocked",
        reason: "guardrails removed the open decision"
      }
    ],
    portfolioBefore: {
      cashUsd: 20,
      equityUsd: 20,
      openPositions: 0,
      drawdownPct: 0
    },
    portfolioAfter: {
      cashUsd: 18.02,
      equityUsd: 20.12,
      openPositions: 1,
      drawdownPct: 0
    },
    artifacts: {
      preflightPath: path.join(archiveDir, "preflight.json"),
      recommendationPath: path.join(archiveDir, "recommendation.json"),
      executionSummaryPath: path.join(archiveDir, "execution-summary.json")
    }
  };
}

describe("live run summary markdown", () => {
  it("renders bilingual success content with executed orders", () => {
    const archiveDir = "/tmp/demo-archive";
    const input = createBaseInput(archiveDir);
    const markdown = buildRunSummaryMarkdown(input);

    expect(markdown.zh).toContain("# 运行总结");
    expect(markdown.zh).toContain("## 3. 新开仓与已执行订单");
    expect(markdown.zh).toContain("order-1");
    expect(markdown.en).toContain("# Run Summary");
    expect(markdown.en).toContain("## 3. New Positions & Executed Orders");
    expect(markdown.en).toContain("demo-market-open");
  });

  it("explains no-trade reason when all decisions are hold or skip", () => {
    const archiveDir = "/tmp/demo-archive";
    const input: LiveRunSummaryInput = {
      ...createBaseInput(archiveDir),
      decisions: [
        {
          action: "hold",
          marketSlug: "hold-only-market",
          eventSlug: "hold-event",
          tokenId: "token-hold",
          side: "BUY",
          notionalUsd: 0.2,
          thesisMd: "No new evidence."
        },
        {
          action: "skip",
          marketSlug: "skip-only-market",
          eventSlug: "skip-event",
          tokenId: "token-skip",
          side: "BUY",
          notionalUsd: 0.2,
          thesisMd: "Insufficient confidence."
        }
      ],
      executablePlans: [],
      executedOrders: [],
      blockedItems: []
    };

    const markdown = buildRunSummaryMarkdown(input);
    expect(markdown.zh).toContain("本轮决策均为 hold/skip");
    expect(markdown.en).toContain("All decisions were hold/skip");
  });

  it("renders failure stage and suggested next steps", () => {
    const archiveDir = "/tmp/demo-archive";
    const input: LiveRunSummaryInput = {
      ...createBaseInput(archiveDir),
      status: "failed",
      stage: "execute",
      failure: {
        stage: "execute",
        message: "Order rejected by exchange.",
        rawSummary: "insufficient liquidity",
        nextSteps: ["Check order size.", "Retry with smaller notional."]
      }
    };
    const markdown = buildRunSummaryMarkdown(input);
    expect(markdown.zh).toContain("## 7. 失败说明与下一步");
    expect(markdown.zh).toContain("Order rejected by exchange.");
    expect(markdown.en).toContain("## 7. Failure Context & Next Steps");
    expect(markdown.en).toContain("Retry with smaller notional.");
  });

  it("writes run-summary.md and run-summary.en.md into archive dir", async () => {
    const archiveDir = await mkdtemp(path.join(os.tmpdir(), "autopoly-run-summary-"));
    const input = createBaseInput(archiveDir);
    const written = await writeRunSummaryArtifacts(input);

    const zh = await readFile(written.zhPath, "utf8");
    const en = await readFile(written.enPath, "utf8");

    expect(path.basename(written.zhPath)).toBe("run-summary.md");
    expect(path.basename(written.enPath)).toBe("run-summary.en.md");
    expect(zh).toContain("# 运行总结");
    expect(en).toContain("# Run Summary");
  });
});
