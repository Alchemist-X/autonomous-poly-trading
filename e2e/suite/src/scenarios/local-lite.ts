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
import { stopEnvironment } from "../lib/environment.js";
import type { ScenarioContext, ScenarioModule, ScenarioResult } from "../types.js";

export const localLiteScenarioModules: ScenarioModule[] = [
  verifyCurrentState,
  startOrAttachEnvironment,
  assertPublicSiteUpdated,
  assertAdminAuthAndActions,
  triggerAgentCycle,
  assertRunPersisted,
  assertPortfolioSync,
  assertRiskGuardBehavior,
  recordFailureWalkthrough,
  recordBrowserWalkthrough
];

export async function runLocalLiteScenario(context: ScenarioContext) {
  const results: ScenarioResult[] = [];
  try {
    for (const module of localLiteScenarioModules) {
      results.push(await module.run(context));
    }
    const reportPath = await writeRunReport(context.artifactDir, "local-lite", results);
    return {
      results,
      reportPath
    };
  } finally {
    await stopEnvironment(context);
  }
}
