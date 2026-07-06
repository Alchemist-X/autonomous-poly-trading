// Compile-time locks between the orchestrator's execution-planning types and
// the recommendation.json wire schemas in @autopoly/contracts.
//
// The orchestrator interfaces stay the source the planner code reads; the
// contracts schemas are what the recommendation.json writer/readers type
// against. These mutual-assignability assertions make any drift between the
// two a typecheck failure instead of a silently mis-shaped artifact (the
// neg-risk fee field that was "sent but not received" cost three live fixes).
import type { PlannedExecutionWire, SkippedExecutionWire } from "@autopoly/contracts";
import type { PlannedExecution, SkippedDecision } from "./execution-planning.js";

type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

const plannedExecutionMatchesWire: MutuallyAssignable<PlannedExecution, PlannedExecutionWire> = true;
const skippedDecisionMatchesWire: MutuallyAssignable<SkippedDecision, SkippedExecutionWire> = true;

export const wireAssertions = { plannedExecutionMatchesWire, skippedDecisionMatchesWire };
