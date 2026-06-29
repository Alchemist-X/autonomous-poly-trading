/**
 * Model 5 — Tactical style-clash mElo (multidimensional Elo).
 *
 * Standard Elo collapses every team onto a single transitive strength axis, so it
 * can never express "A usually beats B, B usually beats C, yet C usually beats A".
 * Real football has exactly that: a high-pressing side can suffocate a possession
 * team while being itself vulnerable to a disciplined counter-attacker. We model it
 * with a multidimensional Elo (mElo, Balduzzi 2021):
 *
 *   each team i has a scalar base rating mu_i and a tactical vector c_i (length 4),
 *   arranged as two 2D blocks, and the head-to-head advantage is
 *
 *     A_ij = (mu_i - mu_j) + c_i^T Omega c_j
 *
 *   with Omega block-diagonal, each block the cyclic rotation [[0, 1], [-1, 0]].
 *   The c^T Omega c term is ANTISYMMETRIC, so it adds to A_ij exactly what it
 *   subtracts from A_ji — a pure non-transitive (rock-paper-scissors) correction
 *   that leaves the symmetric strength gap mu_i - mu_j untouched.
 *
 *   P(i beats j) = sigmoid(A_ij).
 *
 * fit() learns only the scalar mu (logistic gradient ascent on the group-stage
 * results, draws counted as 0.5); the tactical vectors c are taken fixed from each
 * team's standardised profile embedding. predict() turns the two-way win
 * probability into a 1X2 forecast with a Davidson-style draw allocation.
 *
 * Market-blind: every input is an on-pitch FIFA tactical z-score or a pre-tournament
 * Elo prior. No betting or prediction-market data is consulted.
 */

import { normaliseOneXTwo } from "@autopoly/sports-model";
import type { OneXTwo } from "@autopoly/sports-model";
import type {
  Driver,
  FitInput,
  ModelPrediction,
  PredictionModel,
  Rationale,
  ResolvedFixture,
  TeamProfile,
} from "../types.js";

/** Fitted state: learned scalar ratings keyed by team, plus the rating scale. */
export interface TacticalMEloState {
  /** Learned base rating mu_i per team (logit units). */
  readonly mu: ReadonlyMap<string, number>;
  /** Field-mean Elo used to centre priors when a team is unseen at predict time. */
  readonly eloMean: number;
  /** Elo-to-logit scale applied to (prior.elo - eloMean) for initialisation. */
  readonly eloScale: number;
  /** Strength of the non-transitive style-clash term (multiplies c^T Omega c). */
  readonly clashWeight: number;
}

const LEARNING_RATE = 0.05;
const EPOCHS = 200;
/** Elo points per logit unit; ~173 keeps a 1-SD field Elo gap near one logit. */
const ELO_SCALE = 173;
/** Davidson draw concentration: draw = DRAW_NU * sqrt(pWin * pLoss). */
const DRAW_NU = 0.85;
/** Style-clash magnitude. Small: the cyclic term nudges, never dominates strength. */
const CLASH_WEIGHT = 0.35;

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/**
 * Cyclic quadratic form c^T Omega d for length-4 vectors arranged as two 2D
 * blocks, with each block's Omega = [[0, 1], [-1, 0]]:
 *
 *   block 0: c0*d1 - c1*d0
 *   block 1: c2*d3 - c3*d2
 *
 * Antisymmetric by construction: omegaForm(c, d) === -omegaForm(d, c).
 */
const omegaForm = (c: readonly number[], d: readonly number[]): number => {
  const c0 = c[0] ?? 0;
  const c1 = c[1] ?? 0;
  const c2 = c[2] ?? 0;
  const c3 = c[3] ?? 0;
  const d0 = d[0] ?? 0;
  const d1 = d[1] ?? 0;
  const d2 = d[2] ?? 0;
  const d3 = d[3] ?? 0;
  return c0 * d1 - c1 * d0 + (c2 * d3 - c3 * d2);
};

/** Head-to-head advantage A_ij = (mu_i - mu_j) + clashWeight * c_i^T Omega c_j. */
const advantage = (
  muI: number,
  muJ: number,
  cI: readonly number[],
  cJ: readonly number[],
  clashWeight: number,
): number => muI - muJ + clashWeight * omegaForm(cI, cJ);

/** Map an Elo prior to an initial logit rating, centred on the field mean. */
const initRating = (elo: number, eloMean: number, eloScale: number): number =>
  (elo - eloMean) / eloScale;

/**
 * Fit the scalar ratings by logistic gradient ascent. The style-clash term is held
 * fixed (depends only on tactical vectors), so its contribution to each match is a
 * constant offset in the logit and the mu gradient is the standard logistic one:
 *
 *   d/dmu_i logLik = sum_matches (actual - sigmoid(A))  (and the negative for mu_j).
 */
export function createTacticalMElo(): PredictionModel<TacticalMEloState> {
  return {
    id: "tactical-melo",
    name: "Tactical style-clash mElo",
    family: "elo",

    fit(input: FitInput): TacticalMEloState {
      const elos = [...input.priors.values()].map((p) => p.elo);
      const eloMean =
        elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : 0;

      // Initialise every team's mu from its centred Elo prior.
      const mu = new Map<string, number>();
      for (const [team, prior] of input.priors) {
        mu.set(team, initRating(prior.elo, eloMean, ELO_SCALE));
      }
      for (const [team, profile] of input.profiles) {
        if (!mu.has(team)) {
          mu.set(team, initRating(profile.prior.elo, eloMean, ELO_SCALE));
        }
      }

      const vectorFor = (team: string): readonly number[] =>
        input.profiles.get(team)?.tacticalVector ?? [0, 0, 0, 0];

      const ratingFor = (team: string, current: Map<string, number>): number =>
        current.get(team) ?? 0;

      // Logistic gradient ascent. Each epoch returns a fresh map (no mutation of
      // the prior epoch's state); within an epoch we accumulate into a working copy.
      let ratings = mu;
      for (let epoch = 0; epoch < EPOCHS; epoch += 1) {
        const next = new Map<string, number>(ratings);
        for (const match of input.matches) {
          const teamA = match.home.team;
          const teamB = match.away.team;
          const cA = vectorFor(teamA);
          const cB = vectorFor(teamB);
          const muA = ratingFor(teamA, next);
          const muB = ratingFor(teamB, next);
          const pAWin = sigmoid(advantage(muA, muB, cA, cB, CLASH_WEIGHT));
          const actual =
            match.result === "home" ? 1 : match.result === "away" ? 0 : 0.5;
          const grad = LEARNING_RATE * (actual - pAWin);
          next.set(teamA, muA + grad);
          next.set(teamB, muB - grad);
        }
        ratings = next;
      }

      return {
        mu: ratings,
        eloMean,
        eloScale: ELO_SCALE,
        clashWeight: CLASH_WEIGHT,
      };
    },

    predict(
      state: TacticalMEloState,
      fixture: ResolvedFixture,
    ): ModelPrediction {
      const muA =
        state.mu.get(fixture.teamA) ??
        initRating(fixture.priorA.elo, state.eloMean, state.eloScale);
      const muB =
        state.mu.get(fixture.teamB) ??
        initRating(fixture.priorB.elo, state.eloMean, state.eloScale);

      const cA = fixture.profileA.tacticalVector;
      const cB = fixture.profileB.tacticalVector;

      const strengthGap = muA - muB;
      const clashTerm = state.clashWeight * omegaForm(cA, cB);
      const a = strengthGap + clashTerm;

      // Two-way win probability, then split off draw mass (Davidson 1970).
      const pAWin2 = sigmoid(a);
      const pBWin2 = 1 - pAWin2;
      const drawRaw = DRAW_NU * Math.sqrt(Math.max(0, pAWin2 * pBWin2));
      const probs: OneXTwo = normaliseOneXTwo({
        home: pAWin2,
        draw: drawRaw,
        away: pBWin2,
      });

      const rationale = buildRationale(
        fixture,
        strengthGap,
        clashTerm,
        probs,
      );

      return { probs, rationale };
    },
  };
}

/** Plain-language style descriptor for a team's two strongest tactical traits. */
const styleLabel = (profile: TeamProfile): string => {
  const traits: ReadonlyArray<[string, number]> = [
    ["pressing high up the pitch", profile.highPressPct - 25],
    ["keeping the ball", profile.possessionPct - 50],
    ["springing counter-attacks", profile.counterAttackPct - 12],
    ["sitting in a deep block", profile.lowBlockPct - 20],
  ];
  const sorted = [...traits].sort((x, y) => y[1] - x[1]);
  const top = sorted[0];
  return top && top[1] > 0 ? top[0] : "a balanced approach";
};

/** Build the decision-first rationale (verdict + evidence cards + method note). */
function buildRationale(
  fixture: ResolvedFixture,
  strengthGap: number,
  clashTerm: number,
  probs: OneXTwo,
): Rationale {
  const { teamA, teamB } = fixture;
  const favoured = probs.home >= probs.away ? teamA : teamB;
  const favouredP = Math.max(probs.home, probs.away);
  const strength =
    favouredP >= 0.6 ? "clear" : favouredP >= 0.48 ? "slight" : "narrow";

  const styleA = styleLabel(fixture.profileA);
  const styleB = styleLabel(fixture.profileB);

  // The cyclic term favours team A when positive, team B when negative.
  const clashBeneficiary = clashTerm >= 0 ? teamA : teamB;
  const clashUnderdog =
    strengthGap >= 0
      ? clashBeneficiary === teamB
      : clashBeneficiary === teamA;

  const clashPp = Math.round(probabilityShift(clashTerm) * 1000) / 10;
  const strengthPp = Math.round(probabilityShift(strengthGap) * 1000) / 10;

  const headline =
    strength === "narrow"
      ? `${teamA} and ${teamB} look evenly matched, with ${favoured} a hair ahead on the day.`
      : `${favoured} is the ${strength} favourite — its game style matches up well against ${
          favoured === teamA ? teamB : teamA
        }.`;

  const drivers: Driver[] = [
    {
      label: "Overall quality",
      detail: `${
        strengthGap >= 0 ? teamA : teamB
      } has been the stronger side across the group stage, scoring more freely and conceding less.`,
      contributionPp: strengthGap >= 0 ? Math.abs(strengthPp) : -Math.abs(strengthPp),
    },
    {
      label: "Style matchup",
      detail: `${teamA} leans on ${styleA} while ${teamB} leans on ${styleB}; that clash ${
        Math.abs(clashTerm) < 0.02
          ? "is close to a wash"
          : `tilts the game toward ${clashBeneficiary}${
              clashUnderdog ? ", who is the lower-rated side here" : ""
            }`
      }.`,
      contributionPp: clashTerm >= 0 ? Math.abs(clashPp) : -Math.abs(clashPp),
    },
    {
      label: "How even it is",
      detail:
        strength === "narrow"
          ? "The styles roughly cancel out, so a draw is very much in play."
          : `${favoured} controls the kind of game it wants to play, which is why we make it the pick rather than a coin flip.`,
      contributionPp: 0,
    },
  ];

  const methodNote =
    `Market-blind: multidimensional Elo (mElo). Each team carries a learned scalar ` +
    `rating mu (logistic gradient ascent on group-stage results, draws as 0.5, ` +
    `priors seeded from centred Elo) plus a fixed 4D tactical embedding c built from ` +
    `FIFA possession / high-press / counter-attack / low-block z-scores. Head-to-head ` +
    `advantage A = (mu_A - mu_B) + ${CLASH_WEIGHT} * c_A^T Omega c_B with Omega ` +
    `block-diagonal cyclic [[0,1],[-1,0]], giving an antisymmetric non-transitive ` +
    `style-clash term; win prob = sigmoid(A), draw split via Davidson nu=${DRAW_NU}. ` +
    `Uses only on-pitch FIFA statistics and pre-tournament Elo priors — no market data was used.`;

  return { headline, drivers, methodNote };
}

/** Convert a logit shift into an approximate win-probability shift around 0.5. */
const probabilityShift = (logit: number): number => sigmoid(logit) - 0.5;
