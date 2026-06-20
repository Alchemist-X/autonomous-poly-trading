// Bayesian log-odds update — the math that makes per-source attribution real.
//
// We work in log-odds space. The prior probability is converted to log-odds,
// each piece of evidence adds its signed log-likelihood-ratio (LLR), and the
// posterior is read back as a probability. Because the update is additive in
// log-odds, we can report exactly how many percentage points EACH source moved
// the running probability — that is the "which source added how much" trace.
//
// Ported from the spirit of packages/sports-model/src/bayesian.ts, kept
// dependency-free so this script runs under plain tsx.

export const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));

const EPS = 1e-6;

export const logit = (p: number): number => {
  const c = clamp(p, EPS, 1 - EPS);
  return Math.log(c / (1 - c));
};

export const invLogit = (l: number): number => 1 / (1 + Math.exp(-l));

// Per-round clamps. One source cannot swing belief by more than ~tanh(2)≈0.96
// of the remaining odds; the running probability is never pinned to 0/1.
export const MAX_ABS_LLR = 2.0;
export const PROB_FLOOR = 0.01;
export const PROB_CEIL = 0.99;

// Map (stance, magnitude) -> signed effective LLR. Sign comes from stance so an
// agent that mislabels the sign cannot push the probability the wrong way; the
// magnitude is the agent's |llr|, clamped.
export function effectiveLlr(stance: string, rawLlr: number): number {
  const mag = clamp(Math.abs(Number.isFinite(rawLlr) ? rawLlr : 0), 0, MAX_ABS_LLR);
  if (stance === "supports_yes") return +mag;
  if (stance === "supports_no") return -mag;
  return 0; // neutral
}

// P0-4: a source whose cited URL did NOT appear in the agent's real tool trace
// (possibly fabricated/hallucinated) is soft-clamped — its magnitude is capped
// low so it can barely move the probability, but it is NOT dropped (the trace
// capture can still false-negative, e.g. odd result shapes), which would delete
// real evidence.
export const UNVERIFIED_MAX_LLR = 0.2;
export function clampUnverified(llr: number): number {
  const mag = Math.min(Math.abs(llr), UNVERIFIED_MAX_LLR);
  return Math.sign(llr) * mag;
}

// P0-3: independence-aware aggregation. Additive log-odds is valid only under
// conditional independence given the hypothesis. Five outlets echoing one wire
// story are NOT five independent pieces of evidence. The agent tags each source
// with a cluster id (same underlying story/poll/origin => same id); within a
// cluster the strongest source keeps full weight and each additional same-cluster
// source is geometrically damped, so one fact cannot be counted five times.
export const CLUSTER_DECAY = 0.5;
export function clusterFactors(clusterIds: string[], llrs: number[]): number[] {
  const groups = new Map<string, number[]>();
  clusterIds.forEach((cid, i) => {
    // blank / missing id => treat the source as its own independent cluster
    const key = cid && cid.trim() ? cid.trim() : `__solo_${i}`;
    const arr = groups.get(key);
    if (arr) arr.push(i);
    else groups.set(key, [i]);
  });
  const factors = new Array(clusterIds.length).fill(1);
  for (const idxs of groups.values()) {
    if (idxs.length <= 1) continue;
    // rank within the cluster by |llr| desc: strongest full, then ×decay^rank
    const ranked = [...idxs].sort((a, b) => Math.abs(llrs[b]) - Math.abs(llrs[a]));
    ranked.forEach((idx, rank) => (factors[idx] = Math.pow(CLUSTER_DECAY, rank)));
  }
  return factors;
}
// (vs opposed it). A prior-aware agent told "P(YES)=78%, find new evidence"
// tends to surface confirming results; a ratio near 1.0 round after round is a
// confirmation-bias ratchet. Returns null when there is no lean (prior == 0.5)
// or no evidence. Measured on the stance-signed LLRs (before any unverified
// soft-clamp) so it reflects what the agent actually went and found.
export function confirmationRatio(priorProb: number, llrs: number[]): number | null {
  const leanDir = priorProb > 0.5 ? 1 : priorProb < 0.5 ? -1 : 0;
  if (leanDir === 0) return null;
  let confirming = 0;
  let total = 0;
  for (const l of llrs) {
    const m = Math.abs(l);
    total += m;
    if (Math.sign(l) === leanDir) confirming += m;
  }
  return total > 0 ? confirming / total : null;
}

export interface AppliedStep {
  probBefore: number;
  probAfter: number;
  deltaPp: number;
}

// Thread a sequence of LLRs through the prior, returning the running probability
// after each step plus the final posterior. This is the engine's single source
// of truth for the probability — the agent never sets the number directly.
export function applyLlrs(
  priorProb: number,
  llrs: number[]
): { post: number; steps: AppliedStep[] } {
  let lo = logit(priorProb);
  const steps: AppliedStep[] = [];
  for (const llr of llrs) {
    const before = clamp(invLogit(lo), PROB_FLOOR, PROB_CEIL);
    lo += llr;
    const after = clamp(invLogit(lo), PROB_FLOOR, PROB_CEIL);
    steps.push({ probBefore: before, probAfter: after, deltaPp: (after - before) * 100 });
  }
  return { post: clamp(invLogit(lo), PROB_FLOOR, PROB_CEIL), steps };
}

// A crude-but-honest credible band: it narrows as more independent sources
// accumulate and as stated confidence rises. Not a calibrated interval — a
// visual uncertainty cue until/unless real calibration is added later.
export function credibleInterval(
  prob: number,
  nSources: number,
  confidence: string
): [number, number] {
  const confFactor = confidence === "high" ? 0.6 : confidence === "medium" ? 0.85 : 1.1;
  const base = 0.18 * confFactor;
  const halfWidth = base / Math.sqrt(1 + nSources);
  return [clamp(prob - halfWidth, 0, 1), clamp(prob + halfWidth, 0, 1)];
}
