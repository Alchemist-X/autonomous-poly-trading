/**
 * Model registry — the canonical roster of forecasters.
 *
 * Seven base models (statistical / Elo / ML) implement PredictionModel and predict
 * a fixture directly. Model 8 (the stacked ensemble) implements MetaModel and
 * combines the seven. A ninth forecaster — the "8-in-1 multi-calibrated" view —
 * is assembled by the orchestrator (pool of all eight, then MCBoost correction),
 * not constructed here.
 */

import type { PredictionModel } from "./types.js";
import { createDixonColesBayes } from "./models/dixon-coles-bayesian.js";
import { createXgElo } from "./models/xg-elo.js";
import { createProdegy } from "./models/prodegy.js";
import { createFatigueElo } from "./models/fatigue-elo.js";
import { createTacticalMElo } from "./models/tactical-melo.js";
import { createLinebreakGbm } from "./models/linebreak-gbm.js";
import { createPassnetRf } from "./models/passnet-rf.js";
import { createStackedEnsemble } from "./models/stacked-ensemble.js";

/** The seven base models, in stable display order. Freshly constructed each call. */
export const createBaseModels = (): PredictionModel[] => [
  createDixonColesBayes(),
  createXgElo(),
  createProdegy(),
  createFatigueElo(),
  createTacticalMElo(),
  createLinebreakGbm(),
  createPassnetRf(),
];

export { createStackedEnsemble };

export const ENSEMBLE_ID = "stacked-ensemble";
export const ENSEMBLE_NAME = "Stacked Ensemble";
/** The ninth forecaster: all eight pooled, then multi-calibrated (report section 5). */
export const MULTICAL_ID = "multicalibrated";
export const MULTICAL_NAME = "Multi-calibrated 8-in-1";
