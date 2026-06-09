// Deterministic, seedable PRNG so Monte Carlo runs and tests are reproducible.
// We never use Math.random in the model layer — every stochastic path takes an
// explicit Rng so the same seed yields the same result.

export type Rng = () => number; // returns a float in [0, 1)

/** mulberry32 — small, fast, good-enough statistical quality for simulation. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [0, maxExclusive). */
export function randInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

/** Sample an index from a discrete probability distribution (need not sum to 1). */
export function sampleCategorical(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return 0;
  let target = rng() * total;
  for (let i = 0; i < weights.length; i += 1) {
    target -= Math.max(0, weights[i] ?? 0);
    if (target < 0) return i;
  }
  return weights.length - 1;
}
