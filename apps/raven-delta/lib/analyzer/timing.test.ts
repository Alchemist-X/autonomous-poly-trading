import { describe, expect, it } from "vitest";
import { formatElapsed, freshnessRead } from "./timing";

const T0 = "2026-07-05T12:00:00.000Z";

describe("formatElapsed", () => {
  it("formats minutes, hours, and days", () => {
    expect(formatElapsed("2026-07-05T11:46:00.000Z", T0, "en")).toBe("14 min");
    expect(formatElapsed("2026-07-05T08:30:00.000Z", T0, "en")).toBe("3h 30m");
    expect(formatElapsed("2026-07-03T10:00:00.000Z", T0, "en")).toBe("2d 2h");
    expect(formatElapsed("2026-07-05T11:46:00.000Z", T0, "zh")).toBe("14 分钟");
  });

  it("flags future timestamps as suspect", () => {
    expect(formatElapsed("2026-07-05T13:00:00.000Z", T0, "en")).toContain("suspect");
  });
});

describe("freshnessRead", () => {
  it("is honest about unknown first-seen", () => {
    const read = freshnessRead(null, T0, "en");
    expect(read.known).toBe(false);
    expect(read.label).toContain("could not be verified");
  });

  it("warns when the news is older than 24h", () => {
    expect(freshnessRead("2026-07-03T12:00:00.000Z", T0, "en").staleWarning).toBe(true);
    expect(freshnessRead("2026-07-05T11:00:00.000Z", T0, "en").staleWarning).toBe(false);
  });
});
