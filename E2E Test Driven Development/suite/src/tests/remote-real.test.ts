import { describe, expect, it } from "vitest";
import { createScenarioContext } from "../lib/context.js";
import { runRemoteRealScenario } from "../scenarios/remote-real.js";

describe("remote-real trading-system E2E", () => {
  it("runs the remote-real smoke suite when explicitly enabled", async () => {
    const context = await createScenarioContext("remote-real");
    if (!context.featureFlags.remoteEnabled) {
      return;
    }

    const { results, reportPath } = await runRemoteRealScenario(context);
    expect(results.every((result) => result.status === "passed" || result.status === "skipped")).toBe(true);
    expect(reportPath).toContain("remote-real.json");
  });
});
