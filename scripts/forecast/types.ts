// Shared types for the iterative binary forecaster.
//
// One forecast tracks ONE binary (yes/no) event. Its probability is maintained
// across multiple rounds: each round the agent searches for NEW evidence and
// proposes per-source log-likelihood-ratios; the engine threads those through a
// Bayesian log-odds update so every probability move is attributable to a cited
// source. State persists between rounds so the loop can resume and so the whole
// decision process stays auditable.

export type Stance = "supports_yes" | "supports_no" | "neutral";
export type Strength = "weak" | "moderate" | "strong";
export type Confidence = "low" | "medium" | "high";

// ---- The structured object the agent MUST emit each round (validated, fail-closed). ----
export interface AgentEvidence {
  claim: string; // the specific fact found, in one sentence
  source_url: string; // where it came from
  source_title: string;
  stance: Stance; // direction relative to the YES outcome
  strength: Strength; // how strongly it moves the belief
  llr: number; // signed log-likelihood ratio in nats; + favors YES, - favors NO
  rationale: string; // why this moves the probability and by how much
}

export interface AgentRoundOutput {
  round_summary: string;
  new_evidence: AgentEvidence[];
  agent_holistic_probability: number; // agent's own gut P(YES) 0..1 — sanity check only
  confidence: Confidence;
  found_new_information: boolean; // false => no fresh evidence this round (stop signal)
  notes: string;
}

// ---- Engine-side records (the load-bearing, computed state). ----

// One source, after the engine has applied it to the running probability.
export interface LedgerEntry {
  id: string;
  url: string;
  urlCanonical: string; // dedupe key
  title: string;
  claim: string;
  stance: Stance;
  strength: Strength;
  effectiveLlr: number; // sign from stance, magnitude clamped — the value actually applied
  probBefore: number; // running P(YES) just before this source
  probAfter: number; // running P(YES) just after this source
  deltaPp: number; // (probAfter - probBefore) * 100, the "+N percentage points" attribution
  rationale: string;
  retrievedAtUtc: string;
  firstSeenRound: number;
  verifiedInSearchTrace: boolean; // was this URL actually returned by the agent's WebSearch?
}

export interface PerSourceUpdate {
  url: string;
  title: string;
  from: number;
  to: number;
  deltaPp: number;
  explanation: string;
  verified: boolean;
}

export interface RoundRecord {
  round: number;
  ts: string;
  priorProb: number; // MUST equal previous round's postProb (continuity invariant)
  postProb: number;
  perSourceUpdates: PerSourceUpdate[];
  newSourceCount: number;
  duplicateCount: number; // sources dropped because already counted in a prior round
  agentHolisticProb: number;
  confidence: Confidence;
  reasoning: string;
  searchQueries: string[];
  searchResultUrlCount: number;
  costUsd: number | null;
}

export type ForecastStatus =
  | "open"
  | "converged"
  | "no_new_info"
  | "max_rounds"
  | "resolved"
  | "aborted";

export interface ForecastState {
  eventId: string;
  eventText: string;
  resolutionCriteria: string | null;
  deadline: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  currentProb: number; // the maintained P(YES), threaded across rounds
  credibleInterval: [number, number];
  round: number; // number of completed rounds
  status: ForecastStatus;
  evidenceLedger: LedgerEntry[];
  roundHistory: RoundRecord[];
}
