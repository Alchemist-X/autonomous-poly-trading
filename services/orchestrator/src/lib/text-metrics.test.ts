import { describe, expect, it } from "vitest";
import { combineTextMetrics, formatTextMetrics, measureText } from "./text-metrics.js";

describe("text metrics", () => {
  it("measures bytes, chars, lines, and approximate tokens", () => {
    const metrics = measureText("alpha\nbeta");

    expect(metrics.chars).toBe(10);
    expect(metrics.lines).toBe(2);
    expect(metrics.bytes).toBe(10);
    expect(metrics.approxTokens).toBe(3);
  });

  it("combines and formats multiple metrics", () => {
    const combined = combineTextMetrics([
      measureText("abcd"),
      measureText("efghij")
    ]);

    expect(combined.chars).toBe(10);
    expect(combined.approxTokens).toBe(3);
    expect(formatTextMetrics(combined)).toContain("10 chars");
  });
});
