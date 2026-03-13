import { describe, expect, it } from "vitest";
import { tradeDecisionSetSchema } from "./index.js";

describe("tradeDecisionSetSchema", () => {
  it("accepts a valid decision set", () => {
    const parsed = tradeDecisionSetSchema.parse({
      run_id: "47a9e19f-7352-4c7a-a41e-3d18c4487bb9",
      runtime: "claude-code-headless",
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

    expect(parsed.runtime).toBe("claude-code-headless");
  });

  it("rejects decisions without sources", () => {
    expect(() =>
      tradeDecisionSetSchema.parse({
        run_id: "47a9e19f-7352-4c7a-a41e-3d18c4487bb9",
        runtime: "claude-code-headless",
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

