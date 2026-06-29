/**
 * Build market-blind team profiles from extracted FIFA match stats.
 *
 * Two concerns the models must not get wrong:
 *  1. Small samples — every team has only 3 group matches. We Bayesian-shrink each
 *     observed mean toward an Elo-derived prior (report section 4.1):
 *         theta = (n * observed + M * prior) / (n + M)
 *     with M=5 for strength, M=3 for style, per the report's prior-weight table.
 *  2. Leakage — when ML models build training rows from group matches, the team
 *     profile must use only matches BEFORE the row's match. `profileAsOf` enforces this.
 */

import type {
  DatasetStats,
  PassEdge,
  TeamMatchStats,
  TeamPrior,
  TeamProfile,
} from "./types.js";

export const M_STRENGTH = 5;
export const M_STYLE = 3;
/** Baseline goals scored per team per match (≈ 2.7 total), the field prior mean. */
export const BASELINE_GOALS = 1.35;
/** Tactical fields (in order) that form the standardised mElo embedding. */
export const TACTICAL_FIELDS = [
  "possessionPct",
  "highPressPct",
  "counterAttackPct",
  "lowBlockPct",
] as const;

export interface FieldContext {
  readonly eloMean: number;
  readonly eloSd: number;
  readonly dataset: DatasetStats;
}

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

const sd = (xs: readonly number[], mu: number): number => {
  if (xs.length < 2) return 1;
  const v = xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1);
  return v > 1e-9 ? Math.sqrt(v) : 1;
};

/** Bayesian shrinkage of an observed mean toward a prior (report 4.1). */
export const shrink = (
  observed: number,
  prior: number,
  n: number,
  m: number,
): number => (n * observed + m * prior) / (n + m);

const safeDiv = (a: number, b: number, fallback = 0): number =>
  b > 1e-9 ? a / b : fallback;

/**
 * Map a team's Elo (relative to the field) to prior goal rates. Stronger teams get
 * a higher attack prior and a lower goals-against prior, multiplicatively around
 * the baseline, so both stay positive.
 */
export const eloToGoalRates = (
  elo: number,
  field: FieldContext,
  spread = 0.25,
): { attack: number; defense: number } => {
  const z = field.eloSd > 0 ? (elo - field.eloMean) / field.eloSd : 0;
  return {
    attack: BASELINE_GOALS * Math.exp(spread * z),
    defense: BASELINE_GOALS * Math.exp(-spread * z),
  };
};

/** Graph features for one match's passing network; neutral defaults when absent. */
export const networkFeatures = (
  edges: readonly PassEdge[] | null,
): { density: number; centralization: number; top5Share: number } => {
  if (!edges || edges.length === 0) {
    return { density: 0.45, centralization: 0.35, top5Share: 0.3 };
  }
  const nodes = new Set<string>();
  const deg = new Map<string, number>();
  let total = 0;
  for (const e of edges) {
    if (e.count <= 0) continue;
    nodes.add(e.from);
    nodes.add(e.to);
    deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
    deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
    total += e.count;
  }
  const n = Math.max(nodes.size, 2);
  const liveEdges = edges.filter((e) => e.count > 0).length;
  const density = safeDiv(liveEdges, n * (n - 1));
  const degrees = [...deg.values()];
  const maxDeg = degrees.length ? Math.max(...degrees) : 0;
  const centralization = safeDiv(
    degrees.reduce((a, d) => a + (maxDeg - d), 0),
    (n - 1) * (n - 2),
  );
  const top5 = [...edges]
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .reduce((a, e) => a + e.count, 0);
  return { density, centralization, top5Share: safeDiv(top5, total, 0.3) };
};

const tacticalRaw = (s: TeamMatchStats): Record<string, number> => ({
  possessionPct: s.possessionPct,
  highPressPct: s.phaseHighPressPct,
  counterAttackPct: s.phaseCounterAttackPct,
  lowBlockPct: s.phaseLowBlockPct,
});

/** Compute dataset means/SDs for the tactical fields (used to standardise embeddings). */
export const buildDatasetStats = (
  allStats: readonly TeamMatchStats[],
): DatasetStats => {
  const meanRec: Record<string, number> = {};
  const sdRec: Record<string, number> = {};
  for (const field of TACTICAL_FIELDS) {
    const xs = allStats.map((s) => tacticalRaw(s)[field] ?? 0);
    const mu = mean(xs);
    meanRec[field] = mu;
    sdRec[field] = sd(xs, mu);
  }
  return { mean: meanRec, sd: sdRec };
};

export const buildFieldContext = (
  allStats: readonly TeamMatchStats[],
  priors: ReadonlyMap<string, TeamPrior>,
): FieldContext => {
  const elos = [...priors.values()].map((p) => p.elo);
  const mu = mean(elos);
  return { eloMean: mu, eloSd: sd(elos, mu), dataset: buildDatasetStats(allStats) };
};

/** Build one team's profile from a set of its match stats (already filtered/as-of). */
export const buildTeamProfile = (
  team: string,
  stats: readonly TeamMatchStats[],
  prior: TeamPrior,
  field: FieldContext,
): TeamProfile => {
  const n = stats.length;
  const priorRates = eloToGoalRates(prior.elo, field);

  const attackRate = shrink(mean(stats.map((s) => s.xgApprox)), priorRates.attack, n, M_STRENGTH);
  const defenseRate = shrink(mean(stats.map((s) => s.goalsAgainst)), priorRates.defense, n, M_STRENGTH);

  const styleMean = (pick: (s: TeamMatchStats) => number, priorVal: number): number =>
    shrink(mean(stats.map(pick)), priorVal, n, M_STYLE);

  const possessionPct = styleMean((s) => s.possessionPct, 50);
  const highPressPct = styleMean((s) => s.phaseHighPressPct, field.dataset.mean.highPressPct ?? 25);
  const counterAttackPct = styleMean((s) => s.phaseCounterAttackPct, field.dataset.mean.counterAttackPct ?? 12);
  const lowBlockPct = styleMean((s) => s.phaseLowBlockPct, field.dataset.mean.lowBlockPct ?? 20);

  const lineBreakSuccessPct = 100 * safeDiv(
    mean(stats.map((s) => s.lineBreaksCompleted)),
    mean(stats.map((s) => s.lineBreaksAttempted)),
    0.6,
  );
  const lb4UnitShare = safeDiv(
    mean(stats.map((s) => s.lb4UnitsCompleted)),
    mean(stats.map((s) => s.lineBreaksCompleted)),
    0.1,
  );
  const offers = stats.map((s) => s.offerConversionPct).filter((v): v is number => v != null);
  const offerConversionPct = shrink(offers.length ? mean(offers) : 50, 50, offers.length, M_STYLE);

  const sprintLoadPerMin = mean(stats.map((s) => safeDiv(s.sprints + s.highSpeedRuns, s.minutesPlayed)));
  const highIntensityShare = mean(stats.map((s) => safeDiv(s.highIntensityDistanceKm, s.teamTotalDistanceKm)));
  const avgHighIntensityKm = mean(stats.map((s) => s.highIntensityDistanceKm));

  const nf = stats.map((s) => networkFeatures(s.passNetwork));
  const networkDensity = mean(nf.map((f) => f.density));
  const networkCentralization = mean(nf.map((f) => f.centralization));
  const top5EdgeShare = mean(nf.map((f) => f.top5Share));

  const tacticalVector = TACTICAL_FIELDS.map((fld) => {
    const raw =
      fld === "possessionPct" ? possessionPct
      : fld === "highPressPct" ? highPressPct
      : fld === "counterAttackPct" ? counterAttackPct
      : lowBlockPct;
    const mu = field.dataset.mean[fld] ?? raw;
    const s = field.dataset.sd[fld] ?? 1;
    return (raw - mu) / (s || 1);
  });

  return {
    team,
    matchesObserved: n,
    prior,
    attackRate,
    defenseRate,
    possessionPct,
    highPressPct,
    counterAttackPct,
    lowBlockPct,
    lineBreakSuccessPct,
    lb4UnitShare,
    offerConversionPct,
    sprintLoadPerMin,
    highIntensityShare,
    avgHighIntensityKm,
    networkDensity,
    networkCentralization,
    top5EdgeShare,
    tacticalVector,
  };
};

/** Build end-of-window profiles for every team from the full stats set. */
export const buildProfiles = (
  allStats: readonly TeamMatchStats[],
  priors: ReadonlyMap<string, TeamPrior>,
): Map<string, TeamProfile> => {
  const field = buildFieldContext(allStats, priors);
  const byTeam = new Map<string, TeamMatchStats[]>();
  for (const s of allStats) {
    const list = byTeam.get(s.team) ?? [];
    list.push(s);
    byTeam.set(s.team, list);
  }
  const out = new Map<string, TeamProfile>();
  for (const [team, list] of byTeam) {
    const prior = priors.get(team) ?? { team, elo: field.eloMean, squadValueIndex: null };
    out.set(team, buildTeamProfile(team, list, prior, field));
  }
  return out;
};

/**
 * Leakage-safe profile for `team` using only matches strictly before `beforeDate`.
 * Falls back to the prior-only profile when no prior matches exist (n=0 → pure prior).
 */
export const profileAsOf = (
  team: string,
  teamStats: readonly TeamMatchStats[],
  prior: TeamPrior,
  field: FieldContext,
  beforeDate: string,
): TeamProfile =>
  buildTeamProfile(
    team,
    teamStats.filter((s) => s.date < beforeDate),
    prior,
    field,
  );
