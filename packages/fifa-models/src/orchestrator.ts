/**
 * Orchestrator — fit the eight models on the group stage, then forecast the
 * (not-yet-played) knockout fixtures with all nine forecasters.
 *
 * Why the group stage trains everything: for a LIVE tournament the knockout
 * outcomes are unknown, so the only labelled data is the completed group matches.
 * - Base models (1-7) fit their ratings/parameters on those matches.
 * - The stacked ensemble (8) trains its meta-learner on the base models' group-match
 *   predictions, built with leakage-safe `profileAsOf` features (a team's profile as
 *   of just before each match, never including that match).
 * - The multi-calibrated forecaster (9) pools all eight, then learns MCBoost subgroup
 *   corrections from the group matches, and replays them on the knockout fixtures.
 *
 * The in-sample group-stage leaderboard this produces is an optimistic sanity check
 * (especially for forecasters 8 and 9, which are fit on those same rows). The real,
 * held-out comparison is the knockout results, scored as each match resolves.
 *
 * Market-blind throughout: only FIFA on-pitch stats + pre-tournament Elo priors.
 */

import type { OneXTwo } from "@autopoly/sports-model";

import type {
  CompletedMatch,
  Driver,
  MatchFixture,
  ModelPrediction,
  PredictionModel,
  Rationale,
  ResolvedFixture,
  TeamMatchStats,
  TeamPrior,
  TeamProfile,
} from "./types.js";
import {
  buildFieldContext,
  profileAsOf,
  type FieldContext,
} from "./profile.js";
import {
  createBaseModels,
  createStackedEnsemble,
  ENSEMBLE_ID,
  ENSEMBLE_NAME,
  MULTICAL_ID,
  MULTICAL_NAME,
} from "./registry.js";
import {
  applyMCBoost,
  fitMCBoost,
  type CalibrationSample,
  type MCBoostModel,
} from "./calibration/mcboost.js";
import { leaderboard, scoreModel, type ScoredModel } from "./evaluate.js";

export interface TournamentData {
  readonly matches: readonly CompletedMatch[];
  readonly profiles: ReadonlyMap<string, TeamProfile>;
  readonly priors: ReadonlyMap<string, TeamPrior>;
  readonly fixtures: readonly MatchFixture[];
}

export interface ForecasterPrediction {
  readonly fixtureId: string;
  readonly teamA: string;
  readonly teamB: string;
  readonly prediction: ModelPrediction;
}

export interface Forecaster {
  readonly id: string;
  readonly name: string;
  readonly family: string;
  readonly predictions: readonly ForecasterPrediction[];
}

export interface OrchestratorResult {
  /** Nine forecasters: 7 base + stacked ensemble + multi-calibrated. */
  readonly forecasters: readonly Forecaster[];
  /** In-sample group-stage calibration check (optimistic; see file header). */
  readonly leaderboard: readonly ScoredModel[];
  readonly skippedFixtures: readonly string[];
  readonly groupMatchesUsed: number;
}

/** Look up both teams' end-of-group profiles + priors for a knockout fixture. */
const resolveFixture = (
  fx: MatchFixture,
  profiles: ReadonlyMap<string, TeamProfile>,
  priors: ReadonlyMap<string, TeamPrior>,
): ResolvedFixture | null => {
  const profileA = profiles.get(fx.teamA);
  const profileB = profiles.get(fx.teamB);
  if (!profileA || !profileB) return null;
  const priorA = priors.get(fx.teamA) ?? profileA.prior;
  const priorB = priors.get(fx.teamB) ?? profileB.prior;
  return { ...fx, profileA, profileB, priorA, priorB };
};

/** Group a flat stats list by team for leakage-safe as-of profile construction. */
const groupStatsByTeam = (
  matches: readonly CompletedMatch[],
): Map<string, TeamMatchStats[]> => {
  const byTeam = new Map<string, TeamMatchStats[]>();
  for (const m of matches) {
    for (const s of [m.home, m.away]) {
      const list = byTeam.get(s.team) ?? [];
      list.push(s);
      byTeam.set(s.team, list);
    }
  }
  return byTeam;
};

/** Resolve a completed group match into a fixture using leakage-safe as-of profiles. */
const resolveGroupMatch = (
  m: CompletedMatch,
  byTeam: ReadonlyMap<string, TeamMatchStats[]>,
  priors: ReadonlyMap<string, TeamPrior>,
  field: FieldContext,
): ResolvedFixture => {
  const a = m.home.team;
  const b = m.away.team;
  const priorA = priors.get(a) ?? { team: a, elo: field.eloMean, squadValueIndex: null };
  const priorB = priors.get(b) ?? { team: b, elo: field.eloMean, squadValueIndex: null };
  const profileA = profileAsOf(a, byTeam.get(a) ?? [], priorA, field, m.date);
  const profileB = profileAsOf(b, byTeam.get(b) ?? [], priorB, field, m.date);
  return {
    id: `grp-${m.home.matchId}`,
    stage: "R32",
    teamA: a,
    teamB: b,
    neutral: m.neutral,
    kickoffUtc: `${m.date}T00:00:00Z`,
    profileA,
    profileB,
    priorA,
    priorB,
  };
};

/**
 * Equal-weight LINEAR (arithmetic) pool of every base view (the "8-in-1"
 * consensus). Linear, not logarithmic: a geometric pool lets a single
 * overconfident model (e.g. an ML model emitting ~0% for an outcome) veto that
 * outcome and crush the consensus — arithmetic averaging is robust to that.
 */
const poolEight = (views: readonly OneXTwo[]): OneXTwo => {
  if (views.length === 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  const n = views.length;
  const home = views.reduce((a, v) => a + v.home, 0) / n;
  const draw = views.reduce((a, v) => a + v.draw, 0) / n;
  const away = views.reduce((a, v) => a + v.away, 0) / n;
  const s = home + draw + away || 1;
  return { home: home / s, draw: draw / s, away: away / s };
};

/**
 * Cap how far the multi-calibration may move each outcome from the model
 * consensus (house style: bounded ±pp adjustment). Tiny per-subgroup samples make
 * MCBoost prone to stacking large corrections and flipping a clear favourite into a
 * draw; this keeps the calibrated view a sane refinement of the consensus.
 */
const BOUND_PP = 0.12;
const boundToConsensus = (
  pooled: OneXTwo,
  corrected: OneXTwo,
  cap = BOUND_PP,
): OneXTwo => {
  const clamp = (c: number, p: number): number => Math.min(p + cap, Math.max(p - cap, c));
  const home = clamp(corrected.home, pooled.home);
  const draw = clamp(corrected.draw, pooled.draw);
  const away = clamp(corrected.away, pooled.away);
  const s = home + draw + away || 1;
  return { home: home / s, draw: draw / s, away: away / s };
};

const favoured = (p: OneXTwo, fx: ResolvedFixture): { who: string; pct: number } => {
  if (p.draw >= p.home && p.draw >= p.away) return { who: "a draw", pct: Math.round(p.draw * 100) };
  return p.home >= p.away
    ? { who: fx.teamA, pct: Math.round(p.home * 100) }
    : { who: fx.teamB, pct: Math.round(p.away * 100) };
};

/** Build the ninth forecaster's plain-language rationale. */
const multicalRationale = (
  fx: ResolvedFixture,
  pooled: OneXTwo,
  corrected: OneXTwo,
  nBase: number,
  mc: MCBoostModel,
): Rationale => {
  const v = favoured(corrected, fx);
  const headline = `Blending all ${nBase} models and correcting for known group-stage biases, ${v.who} is the call here at about ${v.pct}%.`;
  const shiftA = Number(((corrected.home - pooled.home) * 100).toFixed(1));
  const drivers: Driver[] = [
    {
      label: "Consensus of all models",
      detail: `The eight model views are pooled into one balanced consensus before any adjustment, which favours ${favoured(pooled, fx).who} at ${favoured(pooled, fx).pct}%.`,
      contributionPp: Number(((pooled.home - 1 / 3) * 100).toFixed(1)),
    },
    {
      label: "Bias correction",
      detail:
        mc.corrections.length === 0
          ? `No systematic group-stage bias was large enough to correct, so the consensus stands as-is.`
          : `The consensus is nudged to fix biases the models showed on group matches of this type, shifting ${fx.teamA}'s win chance by ${shiftA > 0 ? "+" : ""}${shiftA} points.`,
      contributionPp: shiftA,
    },
  ];
  const methodNote =
    `Market-blind: equal-weight linear (arithmetic) opinion pool of all ${nBase} model views (seven base models + the ` +
    `stacked ensemble), then MCBoost multicalibration (alpha=${mc.alpha}, ${mc.iterations} correction round(s)) ` +
    `learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and ` +
    `bounded to within ${Math.round(BOUND_PP * 100)}pp per outcome of the consensus. No betting or ` +
    `market-implied probabilities were used at any stage.`;
  return { headline, drivers, methodNote };
};

/**
 * Fit all models on the group stage and forecast every knockout fixture with the
 * nine forecasters. Pure: no I/O, returns a fresh result.
 */
export function runForecasts(data: TournamentData): OrchestratorResult {
  const { matches, profiles, priors, fixtures } = data;
  const baseModels = createBaseModels();
  const ensemble = createStackedEnsemble();

  // --- Fit base models on the group stage ---
  const fitInput = { matches, profiles, priors };
  const fitted = baseModels.map((m) => ({ model: m, state: m.fit(fitInput) }));

  // --- Leakage-safe group-match predictions (for meta + calibration + leaderboard) ---
  const allStats = matches.flatMap((m) => [m.home, m.away]);
  const field = buildFieldContext(allStats, priors);
  const byTeam = groupStatsByTeam(matches);

  // Per-forecaster group predictions, keyed by forecaster id -> [{probs, result}].
  const groupPreds = new Map<string, { probs: OneXTwo; result: CompletedMatch["result"] }[]>();
  const pushGroup = (id: string, probs: OneXTwo, result: CompletedMatch["result"]) => {
    const list = groupPreds.get(id) ?? [];
    list.push({ probs, result });
    groupPreds.set(id, list);
  };

  // Pass 1: base (7-model) predictions on each group match; cache for later passes.
  const groupCtx = matches.map((m) => {
    const rf = resolveGroupMatch(m, byTeam, priors, field);
    const base = new Map<string, OneXTwo>();
    for (const { model, state } of fitted) {
      const p = model.predict(state, rf).probs;
      base.set(model.id, p);
      pushGroup(model.id, p, m.result);
    }
    return { result: m.result, rf, base };
  });

  // Fit the stacked ensemble on the 7-model group predictions (base only — no leakage
  // of the ensemble's own output into its features).
  const metaState = ensemble.fitMeta(
    groupCtx.map(({ base, result }) => ({ baseProbs: base, result })),
  );

  // Pass 2: ensemble view + pooled-eight calibration sample per group match.
  const calibSamples: CalibrationSample[] = groupCtx.map(({ rf, base, result }) => {
    const ens = ensemble.predictMeta(metaState, base, rf).probs;
    pushGroup(ENSEMBLE_ID, ens, result);
    const eight = new Map(base);
    eight.set(ENSEMBLE_ID, ens);
    return { fixture: rf, probs: poolEight([...eight.values()]), outcome: result };
  });
  const mcModel = fitMCBoost(calibSamples);
  for (const s of calibSamples) {
    pushGroup(MULTICAL_ID, boundToConsensus(s.probs, applyMCBoost(mcModel, s.fixture, s.probs)), s.outcome);
  }

  // --- Forecast the knockout fixtures with all nine forecasters ---
  const skipped: string[] = [];
  const basePred = new Map<string, ForecasterPrediction[]>();
  const ensPred: ForecasterPrediction[] = [];
  const mcPred: ForecasterPrediction[] = [];

  for (const fx of fixtures) {
    const rf = resolveFixture(fx, profiles, priors);
    if (!rf) {
      skipped.push(fx.id);
      continue;
    }
    const base = new Map<string, OneXTwo>();
    for (const { model, state } of fitted) {
      const pred = model.predict(state, rf);
      base.set(model.id, pred.probs);
      const list = basePred.get(model.id) ?? [];
      list.push({ fixtureId: fx.id, teamA: fx.teamA, teamB: fx.teamB, prediction: pred });
      basePred.set(model.id, list);
    }
    const ens = ensemble.predictMeta(metaState, base, rf);
    base.set(ENSEMBLE_ID, ens.probs);
    ensPred.push({ fixtureId: fx.id, teamA: fx.teamA, teamB: fx.teamB, prediction: ens });

    const pooled = poolEight([...base.values()]);
    const corrected = boundToConsensus(pooled, applyMCBoost(mcModel, rf, pooled));
    mcPred.push({
      fixtureId: fx.id,
      teamA: fx.teamA,
      teamB: fx.teamB,
      prediction: { probs: corrected, rationale: multicalRationale(rf, pooled, corrected, base.size, mcModel) },
    });
  }

  // --- Assemble forecasters + in-sample leaderboard ---
  const forecasters: Forecaster[] = [
    ...fitted.map(({ model }) => ({
      id: model.id,
      name: model.name,
      family: model.family,
      predictions: basePred.get(model.id) ?? [],
    })),
    { id: ENSEMBLE_ID, name: ENSEMBLE_NAME, family: "ensemble", predictions: ensPred },
    { id: MULTICAL_ID, name: MULTICAL_NAME, family: "ensemble", predictions: mcPred },
  ];

  const scored: ScoredModel[] = forecasters.map((f) => {
    const preds = groupPreds.get(f.id) ?? [];
    return scoreModel(f.id, f.name, preds);
  });

  return {
    forecasters,
    leaderboard: leaderboard(scored),
    skippedFixtures: skipped,
    groupMatchesUsed: matches.length,
  };
}
