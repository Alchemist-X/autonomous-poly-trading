// @autopoly/sports-model — pure-function statistical engine reproducing the
// methods used in Kimi's 2026 World Cup report, as composable modules:
//   strength (Elo) → goal distribution (Poisson / Dixon-Coles)
//   → process metrics (xG/xT) → contextual adjustment → ML enhancement
//   → ensemble → calibration.
// Every module is deterministic, immutable, and unit-tested.
// (Unused modules — zigp / spi / bivariate-poisson / monte-carlo / bayesian /
//  market / decision — were removed in the 2026-07-03 Stage 1 cleanup; see git
//  history to restore.)

export * from "./types.js";
export * from "./rng.js";

export * from "./elo.js";
export * from "./poisson.js";
export * from "./dixon-coles.js";
export * from "./xg.js";
export * from "./contextual.js";

export * from "./ensemble.js";
export * from "./calibration.js";

export * from "./ml/decision-tree.js";
export * from "./ml/random-forest.js";
export * from "./ml/gradient-boosting.js";
export * from "./ml/logistic-regression.js";
