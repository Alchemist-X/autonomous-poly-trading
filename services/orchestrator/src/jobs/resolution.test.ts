import { describe, expect, it } from "vitest";
import { evaluateTrackability } from "./resolution.js";

describe("resolution trackability", () => {
  it("marks arena leaderboards as fully trackable when a public URL exists", () => {
    const result = evaluateTrackability({
      description: "Resolves based on the public Arena leaderboard.",
      sourceUrl: "https://arena.ai/leaderboard/text/overall-no-style-control",
      sourceType: "arena_leaderboard"
    });

    expect(result.level).toBe("完全");
  });

  it("marks subjective markets as untrackable", () => {
    const result = evaluateTrackability({
      description: "Resolution is at the sole judgment and discretion of the oracle.",
      sourceUrl: "https://example.com/rules",
      sourceType: "generic_url"
    });

    expect(result.level).toBe("不可");
  });

  it("marks markets without a source URL as manual review", () => {
    const result = evaluateTrackability({
      description: "Official reporting will be used if available.",
      sourceUrl: null,
      sourceType: "unknown"
    });

    expect(result.level).toBe("手动");
  });
});
