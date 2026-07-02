/**
 * @autopoly/fifa-models — eight FIFA-data football models + a multi-calibrated
 * ninth forecaster, for market-blind World Cup knockout prediction.
 *
 * Pipeline: extract/fifa_extract.py (PDFs -> stats JSON) -> data-loader ->
 * orchestrator (fit on group stage, forecast knockouts with all 9) -> report
 * (bilingual forecasting-engine archive) + evaluate (Brier/LogLoss leaderboard).
 */

export * from "./types.js";
export * from "./profile.js";
export * from "./registry.js";
export * from "./bracket.js";
export * from "./orchestrator.js";
export * from "./report.js";
export * from "./evaluate.js";
export * from "./synthetic.js";
export * from "./data-loader.js";
export {
  SUBGROUPS,
  fitMCBoost,
  applyMCBoost,
  bootstrapCalibrationCI,
  type CalibrationSample,
  type MCBoostModel,
} from "./calibration/mcboost.js";
export { calibrateKnockoutDraw, knockoutEvenness, KNOCKOUT_DRAW_K } from "./calibration/knockout-draw.js";

// Base model factories (for direct use / testing).
export { createDixonColesBayes } from "./models/dixon-coles-bayesian.js";
export { createXgElo } from "./models/xg-elo.js";
export { createProdegy } from "./models/prodegy.js";
export { createFatigueElo } from "./models/fatigue-elo.js";
export { createTacticalMElo } from "./models/tactical-melo.js";
export { createLinebreakGbm } from "./models/linebreak-gbm.js";
export { createPassnetRf } from "./models/passnet-rf.js";
export { createStackedEnsemble } from "./models/stacked-ensemble.js";
