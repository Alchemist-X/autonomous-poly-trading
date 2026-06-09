import { describe, expect, it } from "vitest";
import { buildPulseStageFlowReport } from "./stage-flow.js";

const config = {
  pulseAiPrescreen: false,
  pulse: {
    reportCandidates: 4,
    webSearchEnabled: true,
    webSearchTimeoutSeconds: 120
  }
};

describe("pulse stage flow report", () => {
  it("tracks the screenshot-aligned seven-stage flow and current external collection", () => {
    const report = buildPulseStageFlowReport({
      config,
      generatedAtUtc: "2026-06-07T00:00:00.000Z",
      selectedCandidates: 4
    });

    expect(report.source_framework).toBe("skills/probability-analysis");
    expect(report.steps).toHaveLength(7);
    expect(report.steps.map((step) => step.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(report.current_external_collection).toMatchObject({
      polymarket_event_scrapes: 4,
      orderbook_reads: 12,
      web_search_queries: 16,
      web_search_timeout_seconds: 120
    });
    expect(report.summary.partial_steps).toBeGreaterThan(0);
    expect(report.summary.full_parity_incremental_estimate.additionalOutputTokens.max).toBeGreaterThan(0);
  });

  it("records disabled web-search without hiding the remaining flow gaps", () => {
    const report = buildPulseStageFlowReport({
      config: {
        ...config,
        pulse: {
          ...config.pulse,
          webSearchEnabled: false
        }
      },
      generatedAtUtc: "2026-06-07T00:00:00.000Z",
      purpose: "position-review",
      selectedCandidates: 2
    });

    expect(report.purpose).toBe("position-review");
    expect(report.current_external_collection.web_search_queries).toBe(0);
    expect(report.summary.current_llm_report_calls).toBe(1);
    expect(report.steps.some((step) => step.gaps.length > 0)).toBe(true);
  });
});
