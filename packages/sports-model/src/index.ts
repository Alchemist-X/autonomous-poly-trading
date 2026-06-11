// @autopoly/sports-model — pure-function statistical engine reproducing the
// methods used in Kimi's 2026 World Cup report, as composable modules:
//   strength (Elo/FIFA) → goal distribution (Poisson / Dixon-Coles / Bivariate)
//   → process metrics (xG/xT) → ML enhancement → Monte Carlo simulation
//   → Bayesian update → market de-vig/deviation → ensemble → calibration.
// Every module is deterministic, immutable, and unit-tested.

export * from "./types.js";
export * from "./rng.js";

export * from "./elo.js";
export * from "./poisson.js";
export * from "./zigp.js";
export * from "./spi.js";
export * from "./dixon-coles.js";
export * from "./bivariate-poisson.js";
export * from "./xg.js";
export * from "./contextual.js";
export * from "./monte-carlo.js";

export * from "./decision.js";
export * from "./bayesian.js";
export * from "./market.js";
export * from "./ensemble.js";
export * from "./calibration.js";

export * from "./ml/decision-tree.js";
export * from "./ml/random-forest.js";
export * from "./ml/gradient-boosting.js";
export * from "./ml/logistic-regression.js";
