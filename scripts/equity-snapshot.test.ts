import { describe, expect, it } from "vitest";
import { resolveEquitySnapshotAppendPolicy } from "./equity-snapshot.ts";

describe("resolveEquitySnapshotAppendPolicy", () => {
  it("allows the canonical Pizza env file by default", () => {
    expect(resolveEquitySnapshotAppendPolicy({
      envFilePath: "/repo/.env.pizza"
    })).toMatchObject({
      allowed: true
    });
  });

  it("blocks non-Pizza env files by default", () => {
    expect(resolveEquitySnapshotAppendPolicy({
      envFilePath: "/repo/runtime-artifacts/okx-aw-smoke/aw-pulse.env"
    })).toMatchObject({
      allowed: false
    });
  });

  it("supports an explicit override for unusual public-history runs", () => {
    expect(resolveEquitySnapshotAppendPolicy({
      envFilePath: "/repo/runtime-artifacts/okx-aw-smoke/aw-pulse.env",
      override: "true"
    })).toMatchObject({
      allowed: true
    });
    expect(resolveEquitySnapshotAppendPolicy({
      envFilePath: "/repo/.env.pizza",
      override: "false"
    })).toMatchObject({
      allowed: false
    });
  });
});
