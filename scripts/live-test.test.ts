import { describe, expect, it } from "vitest";
import {
  buildLiveTestDirectoryName,
  evaluateLiveTestPreflight
} from "./live-test-helpers.ts";

describe("live test helpers", () => {
  it("builds archive directory names from timestamp and run id", () => {
    expect(buildLiveTestDirectoryName("20260316T100000Z", "run-123")).toBe("20260316T100000Z-run-123");
    expect(buildLiveTestDirectoryName("20260316T100000Z", null)).toBe("20260316T100000Z-pending");
  });

  it("rejects missing live credentials and non-empty wallets", () => {
    const report = evaluateLiveTestPreflight({
      executionMode: "paper",
      envFilePath: null,
      hasPrivateKey: false,
      hasFunderAddress: false,
      dbOk: true,
      redisOk: false,
      clobOk: false,
      remotePositionCount: 1,
      localOpenPositionCount: 2,
      initialBankrollUsd: 100,
      maxTradePct: 0.2,
      maxEventExposurePct: 0.4,
      usdcBalance: 0
    });

    expect(report.ok).toBe(false);
    expect(report.checks.filter((check) => !check.ok).map((check) => check.key)).toEqual([
      "execution-mode",
      "env-file",
      "credentials",
      "redis",
      "clob-client",
      "remote-positions",
      "local-state",
      "bankroll-cap",
      "trade-cap",
      "event-cap",
      "balance"
    ]);
  });

  it("accepts a clean dedicated live-test configuration", () => {
    const report = evaluateLiveTestPreflight({
      executionMode: "live",
      envFilePath: "/tmp/.env.live-test",
      hasPrivateKey: true,
      hasFunderAddress: true,
      dbOk: true,
      redisOk: true,
      clobOk: true,
      remotePositionCount: 0,
      localOpenPositionCount: 0,
      initialBankrollUsd: 20,
      maxTradePct: 0.1,
      maxEventExposurePct: 0.3,
      usdcBalance: 25
    });

    expect(report.ok).toBe(true);
    expect(report.checks.every((check) => check.ok)).toBe(true);
  });
});
