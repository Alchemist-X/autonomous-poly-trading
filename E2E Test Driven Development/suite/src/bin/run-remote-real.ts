import { createScenarioContext } from "../lib/context.js";
import { runRemoteRealScenario } from "../scenarios/remote-real.js";

const context = await createScenarioContext("remote-real");
if (!context.featureFlags.remoteEnabled) {
  throw new Error("Set AUTOPOLY_E2E_REMOTE=1 before running the remote-real scenario.");
}

const result = await runRemoteRealScenario(context);
console.log(JSON.stringify(result, null, 2));
