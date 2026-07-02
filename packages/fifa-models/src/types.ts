/**
 * Shared contract for the FIFA-data 8-model knockout prediction engine.
 *
 * Data flow:
 *   FIFA Post Match Summary PDFs --(extract/fifa_extract.py)--> TeamMatchStats[]
 *     --(profile.ts: aggregate + Bayesian shrink, no leakage)--> TeamProfile per team
 *       --(models/*.ts: fit on group stage, predict knockouts)--> ModelPrediction
 *         --(cli/forecast.ts)--> runtime-artifacts/world-cup/reports/<dir>-fifa8/prediction.json
 *
 * Everything is market-blind: only on-pitch FIFA stats and pre-tournament Elo
 * priors are consumed. No betting or prediction-market data ever enters a model.
 */

import type { OneXTwo, MatchResult } from "@autopoly/sports-model";

export type { OneXTwo, MatchResult };

/** One passing-network edge (player -> player). Graphical layer; may be absent. */
export interface PassEdge {
  readonly from: string;
  readonly to: string;
  readonly count: number;
}

/**
 * Team-level stats extracted from a single FIFA Post Match Summary Report,
 * from one team's perspective. Fields that come from the graphical layers of the
 * PDF (passing networks, off-ball movement) are nullable: they are not reliably
 * machine-extractable and may be absent until hand/OCR annotated.
 */
export interface TeamMatchStats {
  readonly team: string;
  readonly opponent: string;
  readonly matchId: string;
  readonly date: string; // ISO date (YYYY-MM-DD)
  readonly neutral: boolean;
  readonly goalsFor: number;
  readonly goalsAgainst: number;

  // --- Key Statistics (PDF page 3): tabular, reliably extractable ---
  readonly possessionPct: number; // 0..100
  readonly attemptsAtGoal: number;
  readonly attemptsOnTarget: number;
  readonly attemptsOffTarget: number;
  readonly totalPasses: number;
  readonly passesCompleted: number;
  readonly crosses: number;
  readonly ballProgressions: number;

  // --- Phases of Play (PDF page 4): % of time, tabular ---
  readonly phaseHighPressPct: number; // 0..100
  readonly phaseCounterAttackPct: number;
  readonly phaseLowBlockPct: number;

  // --- Line Breaks (defence penetration): semi-tabular ---
  readonly lineBreaksAttempted: number;
  readonly lineBreaksCompleted: number;
  readonly lb4UnitsCompleted: number;

  // --- Offers & movement (graphical, optional) ---
  readonly offerConversionPct: number | null; // 0..100
  readonly movementInBehind: number | null;

  // --- Defensive pressure ---
  readonly forcedTurnovers: number;
  readonly ballRecoveryTimeSec: number | null;

  // --- Physical (PDF pages 45-52): player tables aggregated to team ---
  readonly teamTotalDistanceKm: number;
  readonly highIntensityDistanceKm: number; // zone 4 + zone 5
  readonly sprints: number;
  readonly highSpeedRuns: number;
  readonly topSpeedMax: number; // km/h
  readonly minutesPlayed: number; // summed player minutes (~990 for 11 outfield over 90')

  // --- Passing network (graphical, optional) ---
  readonly passNetwork: readonly PassEdge[] | null;

  // --- Derived approximate xG (report Model 2 formula); computed at extract time ---
  readonly xgApprox: number;
}

/** Pre-tournament strength prior for a team (market-blind: Elo + optional value). */
export interface TeamPrior {
  readonly team: string;
  readonly elo: number;
  /** Optional squad-value prior (e.g. Transfermarkt), normalised; null if unused. */
  readonly squadValueIndex: number | null;
}

/** Dataset-level means / SDs used to standardise the tactical embedding. */
export interface DatasetStats {
  readonly mean: Readonly<Record<string, number>>;
  readonly sd: Readonly<Record<string, number>>;
}

/**
 * Aggregated, Bayesian-shrunk team profile as of a cutoff (default: end of group
 * stage). This is the input the models consume to predict a future fixture.
 */
export interface TeamProfile {
  readonly team: string;
  readonly matchesObserved: number;
  readonly prior: TeamPrior;

  // Strength rates (per match), shrunk toward Elo-derived priors
  readonly attackRate: number; // expected goals for / match
  readonly defenseRate: number; // expected goals against / match

  // Style / tactical descriptors (shrunk means)
  readonly possessionPct: number;
  readonly highPressPct: number;
  readonly counterAttackPct: number;
  readonly lowBlockPct: number;

  // Penetration & creation efficiency
  readonly lineBreakSuccessPct: number; // completed / attempted
  readonly lb4UnitShare: number; // lb4Units / lineBreaksCompleted
  readonly offerConversionPct: number;

  // Physical / fatigue
  readonly sprintLoadPerMin: number; // (sprints + highSpeedRuns) / minutesPlayed
  readonly highIntensityShare: number; // HI distance / total distance
  readonly avgHighIntensityKm: number; // mean HI distance / match

  // Passing-network graph features (defaulted when network unavailable)
  readonly networkDensity: number;
  readonly networkCentralization: number;
  readonly top5EdgeShare: number;

  // Standardised tactical embedding (z-scores) for the mElo style-clash model
  readonly tacticalVector: readonly number[];
}

export type KnockoutStage = "R32" | "R16" | "QF" | "SF" | "3P" | "F";

/** A knockout fixture to be predicted (teams already seeded into the slot). */
export interface MatchFixture {
  readonly id: string; // event_slug, e.g. "fifwc-arg-bra-2026-07-04"
  readonly stage: KnockoutStage;
  readonly teamA: string;
  readonly teamB: string;
  /** Knockout venues vary; treated as neutral (no host bonus), per mc-sim convention. */
  readonly neutral: boolean;
  readonly kickoffUtc: string;
}

/** A completed (group-stage) match, both perspectives, with the observed 90' result. */
export interface CompletedMatch {
  readonly home: TeamMatchStats; // "teamA" perspective
  readonly away: TeamMatchStats;
  readonly date: string;
  readonly neutral: boolean;
  readonly result: MatchResult; // "home" | "draw" | "away"
}

/** Everything a model needs to fit: chronological matches, end-of-group profiles, priors. */
export interface FitInput {
  readonly matches: readonly CompletedMatch[];
  readonly profiles: ReadonlyMap<string, TeamProfile>;
  readonly priors: ReadonlyMap<string, TeamPrior>;
}

/** A fixture resolved with both teams' profiles + priors, ready to predict. */
export interface ResolvedFixture extends MatchFixture {
  readonly profileA: TeamProfile;
  readonly profileB: TeamProfile;
  readonly priorA: TeamPrior;
  readonly priorB: TeamPrior;
}

/** One plain-language evidence card backing a prediction (forecasting-engine style). */
export interface Driver {
  /** Short label, e.g. "Attack vs defence", "Fatigue load". */
  readonly label: string;
  /** Jargon-free explanation a product manager can read. */
  readonly detail: string;
  /** Signed nudge to team A's win probability, in percentage points (transparency). */
  readonly contributionPp: number;
}

/** Decision-first rationale: verdict + evidence cards + market-blind method note. */
export interface Rationale {
  /** Lead verdict in plain language: who is favoured and roughly how strongly. */
  readonly headline: string;
  readonly drivers: readonly Driver[];
  /** Market-blind method string for prediction.json (mirrors mc-sim.py style). */
  readonly methodNote: string;
}

export interface ModelPrediction {
  readonly probs: OneXTwo; // {home: P(A win), draw, away: P(B win)}
  readonly rationale: Rationale;
}

export type ModelFamily = "statistical" | "elo" | "ml" | "ensemble";

/**
 * The contract every base model (1-7) implements. `State` is the fitted internal
 * state (ratings, parameters, trained trees) — opaque to callers.
 */
export interface PredictionModel<State = unknown> {
  readonly id: string;
  readonly name: string;
  readonly family: ModelFamily;
  /** Fit on the full set of completed (group-stage) matches. Pure: returns state. */
  fit(input: FitInput): State;
  /** Predict one fixture from the two teams' end-of-group profiles. Pure. */
  predict(state: State, fixture: ResolvedFixture): ModelPrediction;
}

/**
 * Out-of-fold base-model predictions for one training match, keyed by model id.
 * Built by the orchestrator via cross-fitting and fed to the meta-learner (Model 8).
 */
export interface MetaTrainingRow {
  readonly baseProbs: ReadonlyMap<string, OneXTwo>;
  readonly result: MatchResult;
}

/** Model 8 (stacked ensemble) implements this instead of PredictionModel. */
export interface MetaModel<State = unknown> {
  readonly id: string;
  readonly name: string;
  readonly family: "ensemble";
  /** Fit the meta-learner on out-of-fold base predictions. */
  fitMeta(rows: readonly MetaTrainingRow[]): State;
  /** Combine base-model predictions for one fixture into a final probability. */
  predictMeta(
    state: State,
    baseProbs: ReadonlyMap<string, OneXTwo>,
    fixture: ResolvedFixture,
  ): ModelPrediction;
}
