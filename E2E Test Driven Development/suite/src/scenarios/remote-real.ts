import { writeRunReport } from "../lib/report.js";
import {
  assertAdminAuthAndActions,
  assertPortfolioSync,
  assertPublicSiteUpdated,
  assertRiskGuardBehavior,
  assertRunPersisted,
  recordBrowserWalkthrough,
  recordFailureWalkthrough,
  startOrAttachEnvironment,
  triggerAgentCycle,
  verifyCurrentState
} from "../modules/trading-system.js";
import type { ScenarioContext, ScenarioModule, ScenarioResult } from "../types.js";

export const remoteRealScenarioModules: ScenarioModule[] = [
  verifyCurrentState,
  startOrAttachEnvironment,
  triggerAgentCycle,
  assertRunPersisted,
  assertPublicSiteUpdated,
  assertPortfolioSync,
  assertRiskGuardBehavior,
  assertAdminAuthAndActions,
  recordFailureWalkthrough,
  recordBrowserWalkthrough
];

export async function runRemoteRealScenario(context: ScenarioContext) {
  const results: ScenarioResult[] = [];
  for (const module of remoteRealScenarioModules) {
    results.push(await module.run(context));
  }
  const reportPath = await writeRunReport(context.artifactDir, "remote-real", results);
  return {
    results,
    reportPath
  };
}
