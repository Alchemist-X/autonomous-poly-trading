import { afterEach, describe, expect, it } from "vitest";
import { createScenarioContext } from "../lib/context.js";
import { stopEnvironment } from "../lib/environment.js";
import { runLocalLiteScenario } from "../scenarios/local-lite.js";
import type { ScenarioContext } from "../types.js";

let activeContext: ScenarioContext | undefined;

afterEach(async () => {
  if (activeContext) {
    await stopEnvironment(activeContext);
    activeContext = undefined;
  }
});

describe("local-lite trading-system E2E", () => {
  it("runs the local-lite smoke suite with videos, artifacts, and dynamic mock updates", async () => {
    activeContext = await createScenarioContext("local-lite");
    const { results, reportPath } = await runLocalLiteScenario(activeContext);
    expect(results.every((result) => result.status === "passed" || result.status === "skipped")).toBe(true);
    expect(results.some((result) => result.id === "recordFailureWalkthrough" && result.status === "passed")).toBe(true);
    expect(results.some((result) => result.id === "recordBrowserWalkthrough" && result.status === "passed")).toBe(true);
    expect(reportPath).toContain("local-lite.json");
  });
});
