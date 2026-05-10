import { describe, expect, it } from "vitest";
import type { PublicPosition } from "@autopoly/contracts";
import { buildPositionResearchSnapshot } from "./position-research.js";

function createPosition(): PublicPosition {
  return {
    id: "position-1",
    event_slug: "demo-event",
    market_slug: "target-market",
    token_id: "token-no",
    side: "BUY",
    outcome_label: "No",
    size: 10,
    avg_cost: 0.4,
    current_price: 0.44,
    current_value_usd: 4.4,
    unrealized_pnl_pct: 0.1,
    stop_loss_pct: 0.3,
    opened_at: "2026-03-17T00:00:00.000Z",
    updated_at: "2026-03-17T00:00:00.000Z"
  };
}

describe("position research", () => {
  it("uses the market record matching the held market slug", () => {
    const snapshot = buildPositionResearchSnapshot({
      position: createPosition(),
      book: {
        bestBid: 0.44,
        bestAsk: 0.45,
        minOrderSize: 5
      },
      eventRecord: {
        slug: "demo-event",
        markets: [
          {
            slug: "other-market",
            description: "Wrong rules",
            outcomes: "[\"Yes\",\"No\"]",
            outcomePrices: "[\"0.10\",\"0.90\"]"
          },
          {
            slug: "target-market",
            description: "Target rules",
            resolutionSource: "Official source",
            outcomes: "[\"Yes\",\"No\"]",
            outcomePrices: "[\"0.56\",\"0.44\"]",
            active: true,
            closed: false,
            archived: false
          }
        ]
      },
      fetchedAtUtc: "2026-03-17T01:00:00.000Z"
    });

    expect(snapshot.rules?.description).toBe("Target rules");
    expect(snapshot.rules?.resolutionSource).toBe("Official source");
    expect(snapshot.marketProb).toBe(0.44);
    expect(snapshot.unresolvedData).not.toContain("Gamma market payload unavailable");
  });

  it("does not borrow a sibling market when multiple records miss the held slug", () => {
    const snapshot = buildPositionResearchSnapshot({
      position: createPosition(),
      book: null,
      eventRecord: {
        slug: "demo-event",
        markets: [
          {
            slug: "other-market",
            description: "Wrong rules"
          },
          {
            slug: "second-other-market",
            description: "Also wrong"
          }
        ]
      },
      fetchedAtUtc: "2026-03-17T01:00:00.000Z"
    });

    expect(snapshot.rules?.description).toBeNull();
    expect(snapshot.unresolvedData).toContain("Gamma market payload unavailable");
    expect(snapshot.marketProb).toBe(0.44);
  });
});
