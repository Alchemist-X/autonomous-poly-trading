import { afterEach, describe, expect, it, vi } from "vitest";
import { newsInputSchema } from "./schema";
import { runQualityGate } from "./quality-gate";

afterEach(() => {
  vi.unstubAllEnvs();
});

function news(text: string) {
  return newsInputSchema.parse({ text });
}

describe("runQualityGate (rules path)", () => {
  it("rejects catalyst-free chatter", async () => {
    vi.stubEnv("DELTA_PROVIDER", "rules");
    const gate = await runQualityGate(news("A small industry conference opens with no new product announcements"));
    expect(gate.gateEngine).toBe("rules");
    expect(gate.pass).toBe(false);
  });

  it("passes a major catalyst headline", async () => {
    vi.stubEnv("DELTA_PROVIDER", "rules");
    const gate = await runQualityGate(
      news("OpenAI signs a $40B GPU and data center capacity agreement with Microsoft, Nvidia and Oracle")
    );
    expect(gate.pass).toBe(true);
    expect(gate.score).toBeGreaterThanOrEqual(gate.threshold);
  });

  it("honors the DELTA_GATE_MIN_SCORE threshold in both directions", async () => {
    vi.stubEnv("DELTA_PROVIDER", "rules");
    // A rates headline is a mid-band item: real catalyst, but no large direct
    // single-name impact — under the default bar, over a lowered one.
    const midBand = "Fed Chair signals a September rate cut is likely as inflation cools faster than expected";

    const defaultGate = await runQualityGate(news(midBand));
    expect(defaultGate.threshold).toBe(60);
    expect(defaultGate.score).toBeLessThan(60);
    expect(defaultGate.pass).toBe(false);

    vi.stubEnv("DELTA_GATE_MIN_SCORE", "10");
    const lowered = await runQualityGate(news(midBand));
    expect(lowered.threshold).toBe(10);
    expect(lowered.pass).toBe(true);
  });
});
