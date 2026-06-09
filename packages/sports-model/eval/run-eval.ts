/**
 * Walk-forward backtest of the sports-model modules on real historical matches
 * (football-data.co.uk). No look-ahead: every prediction uses only data from
 * matches strictly before kickoff. Writes a JSON report + prints a table.
 *
 * Run: pnpm tsx packages/sports-model/eval/run-eval.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllMatches, type EvalMatch } from "./data-loader.js";
import {
  aggregate1x2, binaryLogLoss, reliabilityTable, argmaxResult, type AggregateMetrics
} from "./metrics.js";
import { eloExpectedScore, eloToOneXTwo } from "../src/elo.js";
import { scoreMatrix, outcomeProbabilities, overUnderProbabilities } from "../src/poisson.js";
import { dixonColesScoreMatrix } from "../src/dixon-coles.js";
import { spiMatchProbabilities } from "../src/spi.js";
import { logOpinionPoolOneXTwo } from "../src/ensemble.js";
import { devigPower } from "../src/market.js";
import { bayesianUpdate, logit } from "../src/bayesian.js";
import { normaliseOneXTwo, type OneXTwo, type MatchResult } from "../src/types.js";
import { fitLogisticRegression, predictProbability } from "../src/ml/logistic-regression.js";
import { fitGradientBoosting, predictGradientBoosting } from "../src/ml/gradient-boosting.js";
import { fitRandomForest, predictForest } from "../src/ml/random-forest.js";
import { mulberry32 } from "../src/rng.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "../../../runtime-artifacts/sports/eval/results");

const HOME_ADV_ELO = 65;
const ELO_K = 20;
const MIN_GAMES = 6;
const DC_RHO = -0.05;
const HOME_GOAL_BOOST = 1.0; // home edge already captured by leagueAvgHome vs leagueAvgAway

interface TeamState {
  elo: number;
  forSum: number;
  againstSum: number;
  games: number;
  recentPoints: number[]; // last 5 results' points
  recentGoalDiff: number[]; // last 5 goal diffs
}

interface LeagueState {
  homeGoals: number;
  awayGoals: number;
  games: number;
  teams: Map<string, TeamState>;
}

function newTeam(): TeamState {
  return { elo: 1500, forSum: 0, againstSum: 0, games: 0, recentPoints: [], recentGoalDiff: [] };
}

function avg(values: readonly number[], fallback: number): number {
  if (values.length === 0) return fallback;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function marketProbs(match: EvalMatch): OneXTwo | null {
  if (!match.odds) return null;
  const [h, d, a] = devigPower([1 / match.odds.home, 1 / match.odds.draw, 1 / match.odds.away]);
  return normaliseOneXTwo({ home: h ?? 0, draw: d ?? 0, away: a ?? 0 });
}

interface Row {
  features: number[];
  label: number; // 0 home, 1 draw, 2 away
  result: MatchResult;
  market: OneXTwo;
}

async function main(): Promise<void> {
  const matches = await loadAllMatches();
  const leagues = new Map<string, LeagueState>();

  const preds: Record<string, OneXTwo[]> = {
    market: [], elo: [], poisson: [], dixonColes: [], spi: [], ensemble: [], bayesian: [], poissonNoHome: []
  };
  const evalResults: MatchResult[] = [];

  // Over/Under 2.5 collection
  const ouModelProb: number[] = [];
  const ouMarketProb: number[] = [];
  const ouOutcome: (0 | 1)[] = [];

  const rows: Row[] = []; // for ML

  for (const m of matches) {
    let lg = leagues.get(m.league);
    if (!lg) { lg = { homeGoals: 0, awayGoals: 0, games: 0, teams: new Map() }; leagues.set(m.league, lg); }
    const home = lg.teams.get(m.home) ?? newTeam();
    const away = lg.teams.get(m.away) ?? newTeam();

    const leagueAvgGoals = lg.games > 0 ? (lg.homeGoals + lg.awayGoals) / (2 * lg.games) : 1.35;
    const leagueAvgHome = lg.games > 0 ? lg.homeGoals / lg.games : 1.5;
    const leagueAvgAway = lg.games > 0 ? lg.awayGoals / lg.games : 1.1;

    const eligible = home.games >= MIN_GAMES && away.games >= MIN_GAMES && lg.games >= 40;
    const mkt = marketProbs(m);

    if (eligible && mkt) {
      const homeAttack = (home.forSum / home.games) / leagueAvgGoals;
      const homeDefense = (home.againstSum / home.games) / leagueAvgGoals;
      const awayAttack = (away.forSum / away.games) / leagueAvgGoals;
      const awayDefense = (away.againstSum / away.games) / leagueAvgGoals;

      const lambdaHome = Math.max(0.15, homeAttack * awayDefense * leagueAvgHome * HOME_GOAL_BOOST);
      const lambdaAway = Math.max(0.15, awayAttack * homeDefense * leagueAvgAway);
      const lambdaHomeNoHA = Math.max(0.15, homeAttack * awayDefense * leagueAvgGoals);
      const lambdaAwayNoHA = Math.max(0.15, awayAttack * homeDefense * leagueAvgGoals);

      const poissonM = outcomeProbabilities(scoreMatrix({ home: lambdaHome, away: lambdaAway }, 10));
      const poissonNoHomeM = outcomeProbabilities(scoreMatrix({ home: lambdaHomeNoHA, away: lambdaAwayNoHA }, 10));
      const dcM = outcomeProbabilities(dixonColesScoreMatrix({ home: lambdaHome, away: lambdaAway }, DC_RHO, 10));
      const eloM = eloToOneXTwo(home.elo, away.elo, { homeAdvantage: HOME_ADV_ELO });
      const spiM = spiMatchProbabilities({
        offenseHome: home.forSum / home.games, defenseHome: home.againstSum / home.games,
        offenseAway: away.forSum / away.games, defenseAway: away.againstSum / away.games,
        leagueAverageGoals: leagueAvgGoals, homeAdvantage: 1.12
      });
      const ensembleM = logOpinionPoolOneXTwo([eloM, dcM, mkt], [0.3, 0.3, 0.4]);

      // Bayesian: Elo home-win prior updated by a recent-form log-likelihood ratio.
      const formEdge = avg(home.recentPoints, 1.3) - avg(away.recentPoints, 1.3); // points/ game diff
      const llr = 0.15 * formEdge; // bounded form signal in log-odds
      const bayesHome = bayesianUpdate(eloM.home, [llr]);
      const remainder = 1 - bayesHome;
      const eloRest = eloM.draw + eloM.away;
      const bayesianM = normaliseOneXTwo({
        home: bayesHome,
        draw: eloRest > 0 ? remainder * (eloM.draw / eloRest) : remainder / 2,
        away: eloRest > 0 ? remainder * (eloM.away / eloRest) : remainder / 2
      });

      preds.market.push(mkt);
      preds.elo.push(eloM);
      preds.poisson.push(poissonM);
      preds.poissonNoHome.push(poissonNoHomeM);
      preds.dixonColes.push(dcM);
      preds.spi.push(spiM);
      preds.ensemble.push(ensembleM);
      preds.bayesian.push(bayesianM);
      evalResults.push(m.result);

      // Over/Under 2.5
      if (m.ou25) {
        const ou = overUnderProbabilities(dixonColesScoreMatrix({ home: lambdaHome, away: lambdaAway }, DC_RHO, 10), 2.5);
        const [mo, mu] = devigPower([1 / m.ou25.over, 1 / m.ou25.under]);
        ouModelProb.push(ou.over);
        ouMarketProb.push((mo ?? 0.5) / ((mo ?? 0.5) + (mu ?? 0.5)));
        ouOutcome.push(m.totalGoals > 2.5 ? 1 : 0);
      }

      rows.push({
        features: [
          (home.elo - away.elo) / 100,
          avg(home.recentPoints, 1.3), avg(away.recentPoints, 1.3),
          avg(home.recentGoalDiff, 0), avg(away.recentGoalDiff, 0),
          homeAttack, awayAttack, homeDefense, awayDefense
        ],
        label: m.result === "home" ? 0 : m.result === "draw" ? 1 : 2,
        result: m.result,
        market: mkt
      });
    }

    // ---- update state AFTER predicting (no look-ahead) ----
    const eHome = eloExpectedScore(home.elo + HOME_ADV_ELO, away.elo);
    const actualHome = m.result === "home" ? 1 : m.result === "draw" ? 0.5 : 0;
    const delta = ELO_K * (actualHome - eHome);
    home.elo += delta;
    away.elo -= delta;
    home.forSum += m.homeGoals; home.againstSum += m.awayGoals; home.games += 1;
    away.forSum += m.awayGoals; away.againstSum += m.homeGoals; away.games += 1;
    const homePts = m.result === "home" ? 3 : m.result === "draw" ? 1 : 0;
    const awayPts = m.result === "away" ? 3 : m.result === "draw" ? 1 : 0;
    home.recentPoints = [...home.recentPoints, homePts].slice(-5);
    away.recentPoints = [...away.recentPoints, awayPts].slice(-5);
    home.recentGoalDiff = [...home.recentGoalDiff, m.homeGoals - m.awayGoals].slice(-5);
    away.recentGoalDiff = [...away.recentGoalDiff, m.awayGoals - m.homeGoals].slice(-5);
    lg.teams.set(m.home, home);
    lg.teams.set(m.away, away);
    lg.homeGoals += m.homeGoals; lg.awayGoals += m.awayGoals; lg.games += 1;
  }

  // ---- core model metrics ----
  const metrics: Record<string, AggregateMetrics> = {};
  for (const key of Object.keys(preds)) {
    metrics[key] = aggregate1x2(preds[key]!, evalResults);
  }

  // High-confidence subset: accuracy when the model is sure (top prob >= thresh).
  function hiConf(forecasts: OneXTwo[], results: MatchResult[], thresh: number) {
    let n = 0; let correct = 0;
    for (let i = 0; i < forecasts.length; i += 1) {
      const f = forecasts[i]!;
      const top = Math.max(f.home, f.draw, f.away);
      if (top >= thresh) { n += 1; if (argmaxResult(f) === results[i]) correct += 1; }
    }
    return { n, coverage: n / Math.max(1, forecasts.length), accuracy: n ? correct / n : NaN };
  }
  const hiConfTable = [0.5, 0.6, 0.65, 0.7].map((t) => ({
    threshold: t,
    market: hiConf(preds.market, evalResults, t),
    ensemble: hiConf(preds.ensemble, evalResults, t)
  }));

  // ---- over/under metrics ----
  const ouMetrics = {
    n: ouOutcome.length,
    modelLogLoss: binaryLogLoss(ouModelProb, ouOutcome),
    marketLogLoss: binaryLogLoss(ouMarketProb, ouOutcome),
    actualOverRate: ouOutcome.reduce((s, v) => s + v, 0) / Math.max(1, ouOutcome.length)
  };

  // ---- calibration reliability (ensemble home prob) ----
  const ensembleHome = preds.ensemble.map((p) => p.home);
  const ensembleHomeOutcome = evalResults.map((r): 0 | 1 => (r === "home" ? 1 : 0));
  const reliability = reliabilityTable(ensembleHome, ensembleHomeOutcome, 10);

  // ---- PRINT CORE FIRST (before slow ML) ----
  const fmt = (m: AggregateMetrics) => `n=${String(m.n).padStart(4)}  RPS=${m.rps.toFixed(4)}  logloss=${m.logLoss.toFixed(4)}  brier=${m.brier.toFixed(4)}  acc=${(m.accuracy * 100).toFixed(1)}%`;
  console.log(`\n=== 1X2 backtest (${evalResults.length} matches, ${[...leagues.keys()].length} league-seasons) ===`);
  console.log("(lower RPS/logloss/brier = better; market = Pinnacle/B365 de-vigged = benchmark)");
  for (const k of ["market", "ensemble", "dixonColes", "poisson", "elo", "spi", "bayesian", "poissonNoHome"]) {
    console.log(`${k.padEnd(14)} ${fmt(metrics[k]!)}`);
  }
  console.log(`\n=== High-confidence subset accuracy (where >70% IS reachable) ===`);
  for (const r of hiConfTable) {
    console.log(`top>=${r.threshold}  market: acc=${(r.market.accuracy * 100).toFixed(1)}% cov=${(r.market.coverage * 100).toFixed(1)}% (n=${r.market.n})  | ensemble: acc=${(r.ensemble.accuracy * 100).toFixed(1)}% cov=${(r.ensemble.coverage * 100).toFixed(1)}% (n=${r.ensemble.n})`);
  }
  console.log(`\n=== Over/Under 2.5 (${ouMetrics.n} matches) ===`);
  console.log(`model(DC) logloss=${ouMetrics.modelLogLoss.toFixed(4)}  market logloss=${ouMetrics.marketLogLoss.toFixed(4)}  actualOverRate=${(ouMetrics.actualOverRate * 100).toFixed(1)}%`);
  console.log(`\n=== Calibration (ensemble P(home), reliability bins) ===`);
  for (const b of reliability) if (b.n > 0) console.log(`${b.bin}  n=${String(b.n).padStart(4)}  pred=${b.predicted.toFixed(3)}  obs=${b.observed.toFixed(3)}`);

  // ---- ML: chronological 70/30 split, one-vs-rest (reduced cost) ----
  console.log(`\n=== ML training (one-vs-rest)... ===`);
  const splitIdx = Math.floor(rows.length * 0.7);
  // Cap ML training rows: pure-TS CART split search is O(n^2)/node; the most
  // recent rows are the most relevant anyway. Production swaps in a tuned
  // backend (CatBoost/XGBoost) behind the same fit/predict interface.
  const train = rows.slice(0, splitIdx).slice(-1200);
  const test = rows.slice(splitIdx);
  const X = train.map((r) => r.features);
  const Xtest = test.map((r) => r.features);
  const testResults = test.map((r) => r.result);
  const testMarket = test.map((r) => r.market);
  const ovrTargets = (cls: number): (0 | 1)[] => train.map((r) => (r.label === cls ? 1 : 0));
  const toProbs = (raw: [number, number, number]): OneXTwo => {
    const c = raw.map((v) => Math.min(1, Math.max(1e-4, v))) as [number, number, number];
    return normaliseOneXTwo({ home: c[0], draw: c[1], away: c[2] });
  };
  const logModels = [0, 1, 2].map((c) => fitLogisticRegression(X, ovrTargets(c), { learningRate: 0.3, epochs: 400, l2: 0.001 }));
  const gbModels = [0, 1, 2].map((c) => fitGradientBoosting(X, ovrTargets(c), { nRounds: 30, learningRate: 0.12, maxDepth: 2 }));
  const rng = mulberry32(12345);
  const rfModels = [0, 1, 2].map((c) => fitRandomForest(X, ovrTargets(c), { nTrees: 6, maxDepth: 4, featureSubsample: 0.7 }, rng));
  const logPreds = Xtest.map((x) => toProbs([predictProbability(logModels[0]!, x), predictProbability(logModels[1]!, x), predictProbability(logModels[2]!, x)]));
  const gbPreds = Xtest.map((x) => toProbs([predictGradientBoosting(gbModels[0]!, x), predictGradientBoosting(gbModels[1]!, x), predictGradientBoosting(gbModels[2]!, x)]));
  const rfPreds = Xtest.map((x) => toProbs([predictForest(rfModels[0]!, x), predictForest(rfModels[1]!, x), predictForest(rfModels[2]!, x)]));
  const mlMetrics = {
    marketOnTest: aggregate1x2(testMarket, testResults),
    logistic: aggregate1x2(logPreds, testResults),
    gradientBoosting: aggregate1x2(gbPreds, testResults),
    randomForest: aggregate1x2(rfPreds, testResults)
  };
  console.log(`=== ML (chronological 70/30: train=${train.length} test=${test.length}) ===`);
  for (const k of ["marketOnTest", "logistic", "gradientBoosting", "randomForest"] as const) {
    console.log(`${k.padEnd(16)} ${fmt(mlMetrics[k])}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dataset: { matches: matches.length, evaluated: evalResults.length, leagues: [...leagues.keys()] },
    config: { HOME_ADV_ELO, ELO_K, MIN_GAMES, DC_RHO, ensembleWeights: { elo: 0.3, dixonColes: 0.3, market: 0.4 } },
    oneX2: metrics,
    highConfidence: hiConfTable,
    ml: { trainN: train.length, testN: test.length, metrics: mlMetrics },
    overUnder25: ouMetrics,
    calibrationReliability: reliability
  };
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, "eval-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nReport → ${path.join(OUT_DIR, "eval-report.json")}`);
}

main().catch((err) => { console.error("eval failed:", err); process.exitCode = 1; });
