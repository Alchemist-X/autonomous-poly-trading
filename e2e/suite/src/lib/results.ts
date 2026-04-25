import type { ScenarioArtifact, ScenarioAssertion, ScenarioResult, ScenarioStatus } from "../types.js";

export function createAssertion(name: string, passed: boolean, details?: string): ScenarioAssertion {
  return { name, passed, details };
}

export function createResult(
  id: string,
  status: ScenarioStatus,
  assertions: ScenarioAssertion[],
  summary: string,
  artifacts: ScenarioArtifact[] = [],
  metadata?: Record<string, unknown>,
  nextAction?: string
): ScenarioResult {
  return {
    id,
    status,
    assertions,
    artifacts,
    summary,
    metadata,
    nextAction
  };
}

export function aggregateStatus(assertions: ScenarioAssertion[]): ScenarioStatus {
  return assertions.every((assertion) => assertion.passed) ? "passed" : "failed";
}
