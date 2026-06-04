import { describe, expect, it } from "vitest";
import { testables } from "./pulse-decision-report.ts";

describe("pulse decision report helpers", () => {
  it("converts a BUY No decision into event probability and traded-outcome probability", () => {
    const decision = testables.normalizeDecision({
      action: "open",
      event_slug: "event",
      market_slug: "market",
      token_id: "token",
      outcome_label: "No",
      side: "BUY",
      notional_usd: 10,
      order_type: "FOK",
      ai_prob: 0.9,
      market_prob: 0.8,
      edge: 0.1,
      confidence: "medium",
      thesis_md: "Positive No edge.",
      sources: [
        {
          title: "Market",
          url: "https://example.com",
          retrieved_at_utc: "2026-06-04T00:00:00Z"
        }
      ]
    });

    expect(decision).not.toBeNull();
    const probability = testables.computeEventProbability(decision!);
    expect(probability.ravenEventProb).toBeCloseTo(0.1);
    expect(probability.marketEventProb).toBeCloseTo(0.2);
    expect(probability.tradedOutcomeProb).toBeCloseTo(0.9);
    expect(probability.edge).toBeCloseTo(0.1);
  });

  it("describes source needs dynamically without naming fixed external websites", () => {
    const needs = testables.inferSourceNeeds({
      question: "Will Example FC win the final?",
      categoryLabel: "Sports",
      tags: [
        { slug: "football", label: "Football" },
        { slug: "final", label: "Final" }
      ]
    });

    const joined = needs.join("\n");
    expect(joined).toContain("Will Example FC win the final?");
    expect(joined).toContain("Sports");
    expect(joined).toContain("Football");
    expect(joined).toContain("not a fixed source list");
    expect(joined).not.toContain("NHL.com");
    expect(joined).not.toContain("CoinGecko");
    expect(joined).not.toContain("NobelPrize");
  });
});
