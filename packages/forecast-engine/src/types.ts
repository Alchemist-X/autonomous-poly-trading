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
// Provenance class of a cited source: official = primary/company/government/
// regulator statements; press = journalism; insider = leakers, analysts,
// industry chatter.
export type SourceType = "official" | "press" | "insider";

// ---- The structured frame the agent writes BEFORE forecasting (Round 0). ----
// A free-text user prompt is not a well-posed forecastable event; this step
// turns it into a crisp binary question with explicit resolution, an inferred
// resolution date, a settlement source, and a forecastability judgement (so a
// hopelessly vague prompt is flagged for clarification rather than given a
// false-precision number).
export interface EventFraming {
  normalizedQuestion: string; // the crisp binary question actually forecast
  resolutionCriteria: string; // exactly what counts as YES vs NO
  resolutionDate: string | null; // YYYY-MM-DD by which it must resolve (inferred)
  settlementSource: string; // what authoritative source would confirm the outcome
  assumptions: string; // assumptions the agent made while framing
  forecastable: boolean; // false => too vague/subjective to forecast as binary
  clarificationNeeded: string; // when not forecastable, what the user must specify
  // P0-2: the model's own prior P(YES) from general knowledge, BEFORE any web
  // evidence — a base-rate anchor so the forecast doesn't start blind at 0.5.
  priorProbability: number; // 0..1
  priorRationale: string; // reference class / why this base rate
  // P0-1: a second, skeptical audit pass over the frame. Surfaces ambiguities in
  // the YES/NO bar, edge cases, date, or forecastability that a single-shot frame
  // would miss and silently corrupt every downstream round.
  framingCaveats: string; // ambiguities / edge cases the audit flagged
  framingConfidence: "high" | "medium" | "low";
}
export interface AgentEvidence {
  claim: string; // the specific fact found, in one sentence
  source_url: string; // where it came from
  source_title: string;
  stance: Stance; // direction relative to the YES outcome
  strength: Strength; // how strongly it moves the belief
  llr: number; // signed log-likelihood ratio in nats; + favors YES, - favors NO
  rationale: string; // why this moves the probability and by how much
  cluster_id: string; // P0-3: same id => sources share one underlying story/poll/origin
  source_type: SourceType; // provenance class (validator defaults to "press")
  credibility: Confidence; // reliability of this source for this claim (validator defaults to "medium")
}

// (a) Reflection: an adjustment to a PRIOR-round source, proposed when this
// round's research shows it was wrong / stale / double-counted. Guardrailed: only
// applied with a NEW cited reason, magnitude-clamped, tagged separately, and it
// can only nudge a specific prior source — never re-pick the whole probability.
export interface ReflectionAdjustment {
  target_url: string; // a prior source's URL to reweight
  llr_adjustment: number; // signed CHANGE to its weight (+ = should have favored YES more)
  reason: string; // why, in light of what
  new_source_url: string; // the NEW source justifying the change (required)
}

export interface AgentRoundOutput {
  round_summary: string;
  new_evidence: AgentEvidence[];
  reflection: ReflectionAdjustment[]; // (a) cross-round corrections; may be empty
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
  kind: "evidence" | "reflection"; // (a) reflection entries adjust a prior source
  clusterId: string; // P0-3: the source's claim-cluster
  clusterFactor: number; // independence discount applied within its cluster (1 = full, <1 = damped)
  effectiveLlr: number; // sign from stance, magnitude clamped, cluster + verification discounts applied — the value actually applied
  probBefore: number; // running P(YES) just before this source
  probAfter: number; // running P(YES) just after this source
  deltaPp: number; // (probAfter - probBefore) * 100, the "+N percentage points" attribution
  rationale: string;
  retrievedAtUtc: string;
  firstSeenRound: number;
  verifiedInSearchTrace: boolean; // was this URL actually returned by the agent's WebSearch?
  sourceType: SourceType; // provenance class of the cited source
  credibility: Confidence; // reliability of this source for this claim
}

export interface PerSourceUpdate {
  url: string;
  title: string;
  from: number;
  to: number;
  deltaPp: number;
  explanation: string;
  verified: boolean;
  clusterId: string;
  clusterFactor: number; // <1 means damped as a correlated same-cluster source
  kind: "evidence" | "reflection"; // (a) reflection = a correction to a prior source
  sourceType: SourceType; // provenance class of the cited source
  credibility: Confidence; // reliability of this source for this claim
}

// (b) Computed decomposition of why a round's probability moved: net, the split
// of supporting vs opposing percentage points, and the single dominant driver.
export interface WhyChanged {
  netPp: number; // postProb - priorProb, in pp
  upPp: number; // sum of positive per-source deltas
  downPp: number; // sum of negative per-source deltas (<= 0)
  dominantUrl: string;
  dominantTitle: string;
  dominantPp: number;
  dominantKind: "evidence" | "reflection";
}

export interface RoundRecord {
  round: number;
  ts: string;
  priorProb: number; // MUST equal previous round's postProb (continuity invariant)
  postProb: number;
  perSourceUpdates: PerSourceUpdate[];
  newSourceCount: number;
  duplicateCount: number; // sources dropped because already counted in a prior round
  reflectionCount: number; // (a) prior-source corrections applied this round
  unverifiedPp: number; // total |pp| of this round's movement from unverified (soft-clamped) sources
  confirmationRatio: number | null; // P0-5: share of evidence weight reinforcing the current lean
  whyChanged: WhyChanged | null; // (b) decomposition of the round's net move
  agentHolisticProb: number;
  confidence: Confidence;
  reasoning: string;
  searchQueries: string[];
  searchResultUrlCount: number;
  costUsd: number | null;
  analystConsumedIds?: string[]; // ids of analyst notes consumed (injected) this round
}

export type ForecastStatus =
  | "open"
  | "converged"
  | "no_new_info"
  | "max_rounds"
  | "resolved"
  | "aborted";

// A final, whole-forecast synthesis written after the last round. It EXPLAINS the
// engine's final probability (the balance of evidence, key drivers, open
// uncertainties) — it does NOT re-decide the number (engine still owns it).
export interface ForecastSummary {
  verdict: string; // 1-2 paragraphs: the overall read on why P(YES) landed here
  keyFactorsYes: string[]; // strongest factors pushing toward YES
  keyFactorsNo: string[]; // strongest factors pushing toward NO
  mainUncertainties: string; // what is unresolved / could move it before resolution
  calibrationNote: string; // optional: if the agent thinks the number is mis-calibrated, why (no new number)
  whySentence?: string; // ONE self-explaining sentence: the single reason the number landed here
  quip?: string; // one short dry human aside reacting to the verdict
  confidenceReason?: string; // one line on why confidence is high/medium/low
}

export interface ForecastState {
  eventId: string;
  eventText: string; // the original user prompt, verbatim
  framing: EventFraming; // Round-0 frame: the normalized question actually forecast
  createdAtUtc: string;
  updatedAtUtc: string;
  currentProb: number; // the maintained P(YES), threaded across rounds
  credibleInterval: [number, number];
  round: number; // number of completed rounds
  status: ForecastStatus;
  evidenceLedger: LedgerEntry[];
  roundHistory: RoundRecord[];
  summary: ForecastSummary | null; // final whole-forecast synthesis (after the last round)
  provider?: string; // which LLM provider produced this run ("claude" | "deepseek")
}

// ---- Analyst-in-the-loop (written by the app / a human, read by the engine). ----
// Notes are leads for the NEXT round: the engine injects every unconsumed note
// into the round prompt as a hypothesis to INVESTIGATE (never as established
// fact) and stamps consumedRound once injected. Marks let the analyst flag
// specific ledger entries: "doubt" asks the agent to re-examine that source via
// the reflection mechanism; "keep" is a passive endorsement (UI-only).
export type AnalystStance = "yes" | "no" | "question";
export type AnalystMark = "keep" | "doubt";
export interface AnalystNote {
  id: string; // server/app-assigned, e.g. note-<epoch>-<rand4>
  text: string;
  stance: AnalystStance; // pushes-yes / pushes-no / open question
  targetId: string | null; // LedgerEntry.id when the note is attached to one piece of evidence
  createdAtUtc: string;
  consumedRound: number | null; // set by the engine when injected into a round
}
export interface AnalystState {
  notes: AnalystNote[];
  marks: Record<string, AnalystMark>; // key = LedgerEntry.id (or reasoning id `round-<n>`)
  // Engine-side stamp: LedgerEntry.id -> the round that already injected this
  // doubt into a prompt. Marks stay (they drive the UI); the stamp stops the
  // same doubt from being re-injected — and re-walked-back — every later round.
  doubtsHandled?: Record<string, number>;
}
