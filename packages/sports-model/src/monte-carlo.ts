// Monte Carlo tournament simulation. Reproduces the simulation layer of Kimi's
// 2026 World Cup report: sample many tournament realisations from per-match 1X2
// (or head-to-head win) probabilities and report empirical advance/champion
// rates.
//
// All randomness flows through an injected Rng (see ./rng.js) so runs are
// deterministic for a fixed seed. Functions are pure with respect to their
// inputs; the only state mutated is local scratch arrays/maps built inside each
// call.

import type { MatchResult, OneXTwo } from "./types.js";
import { randInt, sampleCategorical, type Rng } from "./rng.js";

/**
 * Sample a single match outcome from its 1X2 probabilities.
 *
 * Draws an index from the categorical distribution [home, draw, away]; weights
 * need not be normalised (sampleCategorical renormalises internally).
 *
 * @param probs Home / draw / away probabilities.
 * @param rng   Random source.
 * @returns The sampled result.
 */
export function sampleMatchResult(probs: OneXTwo, rng: Rng): MatchResult {
  const index = sampleCategorical(rng, [probs.home, probs.draw, probs.away]);
  if (index === 0) return "home";
  if (index === 1) return "draw";
  return "away";
}

/**
 * Estimate 1X2 outcome probabilities by Monte Carlo.
 *
 * Samples the match `iterations` times and returns empirical frequencies. As
 * iterations grow these converge to the input probabilities (law of large
 * numbers); the standard error of each frequency is sqrt(p(1-p)/n).
 *
 * @param probs      True per-draw probabilities to sample from.
 * @param rng        Random source.
 * @param iterations Number of samples (>= 1).
 * @returns Empirical home / draw / away frequencies (sum to 1 when iterations >= 1).
 */
export function estimateOutcomeProbabilities(
  probs: OneXTwo,
  rng: Rng,
  iterations: number,
): OneXTwo {
  const n = Math.max(1, Math.floor(iterations));
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let i = 0; i < n; i += 1) {
    const result = sampleMatchResult(probs, rng);
    if (result === "home") home += 1;
    else if (result === "draw") draw += 1;
    else away += 1;
  }
  return { home: home / n, draw: draw / n, away: away / n };
}

/**
 * Standard error of a Monte Carlo proportion estimate.
 *
 * Formula: SE = sqrt(p * (1 - p) / n)
 *
 * This is the standard deviation of a sample proportion under a Bernoulli
 * model — a quick gauge of how tight a simulated probability is for n draws.
 *
 * @param p Estimated proportion in [0, 1].
 * @param n Number of samples (>= 1).
 * @returns The standard error.
 */
export function standardError(p: number, n: number): number {
  const safeN = Math.max(1, n);
  return Math.sqrt((p * (1 - p)) / safeN);
}

/** Input for a single group-stage Monte Carlo run. */
export interface GroupSimulationInput {
  readonly teams: readonly string[];
  readonly fixtures: readonly { home: string; away: string }[];
  /** P(home win / draw / away win) for an ordered fixture pair. */
  readonly matchProb: (home: string, away: string) => OneXTwo;
  /** How many top teams advance from the group. */
  readonly advanceCount: number;
  readonly iterations: number;
}

/**
 * Simulate a round-robin group and estimate each team's probability of
 * finishing in the top `advanceCount`.
 *
 * Scoring: win = 3 pts, draw = 1 pt, loss = 0. After all fixtures are sampled,
 * teams are ranked by points.
 *
 * Tie-break: ties are broken by a random shuffle (Fisher-Yates over the passed
 * Rng). This is a deliberate simplification — real FIFA tiebreakers use goal
 * difference, goals scored, head-to-head, fair-play points, then drawing of
 * lots. We do not model goals here, so a random tie-break gives every tied team
 * an equal advance chance in expectation.
 *
 * @param input Group teams, fixtures, per-match probabilities, advance count, iterations.
 * @param rng   Random source.
 * @returns Map of team -> P(advance).
 */
export function simulateGroup(
  input: GroupSimulationInput,
  rng: Rng,
): Map<string, number> {
  const { teams, fixtures, matchProb, advanceCount, iterations } = input;
  const n = Math.max(1, Math.floor(iterations));
  const advanceCounts = new Map<string, number>(teams.map((t) => [t, 0]));

  for (let iter = 0; iter < n; iter += 1) {
    const points = new Map<string, number>(teams.map((t) => [t, 0]));
    for (const fixture of fixtures) {
      const result = sampleMatchResult(
        matchProb(fixture.home, fixture.away),
        rng,
      );
      if (result === "home") {
        points.set(fixture.home, (points.get(fixture.home) ?? 0) + 3);
      } else if (result === "away") {
        points.set(fixture.away, (points.get(fixture.away) ?? 0) + 3);
      } else {
        points.set(fixture.home, (points.get(fixture.home) ?? 0) + 1);
        points.set(fixture.away, (points.get(fixture.away) ?? 0) + 1);
      }
    }

    const ranked = rankTeams(teams, points, rng);
    for (let rank = 0; rank < advanceCount && rank < ranked.length; rank += 1) {
      const team = ranked[rank];
      if (team !== undefined) {
        advanceCounts.set(team, (advanceCounts.get(team) ?? 0) + 1);
      }
    }
  }

  return new Map(
    teams.map((t) => [t, (advanceCounts.get(t) ?? 0) / n]),
  );
}

/**
 * Rank teams by points (descending) with random tie-breaks.
 *
 * First shuffles the team list so equal-point teams have no positional bias,
 * then performs a stable sort by points descending. The pre-shuffle is what
 * randomises ties; the sort itself only reorders by points.
 */
function rankTeams(
  teams: readonly string[],
  points: ReadonlyMap<string, number>,
  rng: Rng,
): string[] {
  const shuffled = shuffle(teams, rng);
  return shuffled.sort((a, b) => (points.get(b) ?? 0) - (points.get(a) ?? 0));
}

/** Fisher-Yates shuffle producing a new array (does not mutate the input). */
function shuffle(items: readonly string[], rng: Rng): string[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randInt(rng, i + 1);
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

/** Input for a single-elimination knockout Monte Carlo run. */
export interface KnockoutSimulationInput {
  /** Seeded bracket; length must be a power of two. Adjacent pairs meet first. */
  readonly bracket: readonly string[];
  /** P(a beats b) for a head-to-head match (no draws). */
  readonly winProbability: (a: string, b: string) => number;
  readonly iterations: number;
}

/**
 * Simulate a single-elimination knockout and estimate each team's championship
 * probability.
 *
 * The bracket length must be a power of two. Each round pairs adjacent
 * survivors (0 vs 1, 2 vs 3, ...); `winProbability(a, b)` is the chance the
 * left team `a` beats the right team `b`. There are no draws — knockout matches
 * always produce a winner.
 *
 * @param input Bracket, head-to-head win probability fn, iterations.
 * @param rng   Random source.
 * @returns Map of team -> P(champion).
 */
export function simulateKnockout(
  input: KnockoutSimulationInput,
  rng: Rng,
): Map<string, number> {
  const { bracket, winProbability, iterations } = input;
  const n = Math.max(1, Math.floor(iterations));
  const titles = new Map<string, number>(bracket.map((t) => [t, 0]));

  for (let iter = 0; iter < n; iter += 1) {
    let round: string[] = [...bracket];
    while (round.length > 1) {
      const next: string[] = [];
      for (let i = 0; i + 1 < round.length; i += 2) {
        const a = round[i];
        const b = round[i + 1];
        if (a === undefined || b === undefined) continue;
        const pAWins = winProbability(a, b);
        next.push(rng() < pAWins ? a : b);
      }
      round = next;
    }
    const champion = round[0];
    if (champion !== undefined) {
      titles.set(champion, (titles.get(champion) ?? 0) + 1);
    }
  }

  return new Map(bracket.map((t) => [t, (titles.get(t) ?? 0) / n]));
}
