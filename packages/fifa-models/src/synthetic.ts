/**
 * Synthetic FIFA-tournament generator.
 *
 * Lets the whole 8-model engine run end-to-end WITHOUT any real FIFA Post Match
 * Summary PDFs — for unit tests, CI, and local smoke runs. It fabricates a fully
 * self-consistent tournament:
 *
 *   latent strength ~ N(0,1)  -->  Elo prior (1500 + 220*strength)
 *     -->  group round-robins simulated (Poisson goals tied to strength gap)
 *       -->  a complete, in-range TeamMatchStats for BOTH perspectives of every
 *            match (every field correlated with strength + a style latent)
 *         -->  profiles built via buildProfiles (same path real data takes)
 *           -->  a plausible 16-match Round-of-32 fixture list to predict.
 *
 * Everything is deterministic from `seed`: the same options always yield the same
 * tournament. Market-blind by construction — no prices or market data anywhere.
 * Pure and immutable: no input is mutated, fresh objects/arrays are returned.
 */

import { mulberry32, type Rng } from "@autopoly/sports-model";

import type {
  CompletedMatch,
  MatchFixture,
  MatchResult,
  PassEdge,
  TeamMatchStats,
  TeamPrior,
  TeamProfile,
} from "./types.js";
import { buildProfiles } from "./profile.js";

/** A generated tournament: raw matches, priors, profiles, fixtures, ground truth. */
export interface SyntheticTournament {
  readonly matches: CompletedMatch[];
  readonly priors: Map<string, TeamPrior>;
  readonly profiles: Map<string, TeamProfile>;
  readonly fixtures: MatchFixture[];
  /** Ground-truth latent strength per team (for diagnostics; never fed to models). */
  readonly trueStrength: Map<string, number>;
}

export interface SyntheticOptions {
  /** Total teams (default 48 — WC2026). */
  readonly teams?: number;
  /** Number of groups (default 12 — WC2026). Teams are split as evenly as possible. */
  readonly groups?: number;
  /** PRNG seed (default 7). */
  readonly seed?: number;
}

const DEFAULT_TEAMS = 48;
const DEFAULT_GROUPS = 12;
const DEFAULT_SEED = 7;

/** Clamp x into [lo, hi]. */
const clamp = (x: number, lo: number, hi: number): number =>
  x < lo ? lo : x > hi ? hi : x;

/**
 * Standard-normal sample via the Box–Muller transform, driven by the seeded Rng
 * so draws are deterministic. We avoid u == 0 to keep log() finite.
 */
const gaussian = (rng: Rng): number => {
  const u1 = 1 - rng(); // in (0, 1]
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

/** Inverse-transform Poisson sampler (Knuth); fine for the small lambdas here. */
const samplePoisson = (rng: Rng, lambda: number): number => {
  const safe = clamp(lambda, 0, 25);
  const limit = Math.exp(-safe);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > limit);
  return k - 1;
};

/** Deterministic three-letter-ish team code from a numeric index (T00..T99...). */
const teamCode = (index: number): string => `T${String(index).padStart(2, "0")}`;

/** Even split of `teams` into `groups` buckets, each holding the team indices. */
const partitionGroups = (teams: number, groups: number): number[][] => {
  const buckets: number[][] = Array.from({ length: groups }, () => []);
  for (let i = 0; i < teams; i += 1) {
    // Snake assignment keeps group sizes within one of each other.
    const g = i % groups;
    (buckets[g] as number[]).push(i);
  }
  return buckets;
};

/**
 * Synthesise one team's full match stats from its perspective. Every field is a
 * smooth function of the team's latent strength and a per-team style latent, plus
 * a small deterministic jitter, then clamped into the field's realistic range so
 * downstream profile/model code never sees an out-of-range or non-finite value.
 */
const buildTeamMatchStats = (params: {
  readonly team: string;
  readonly opponent: string;
  readonly matchId: string;
  readonly date: string;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly strength: number; // own latent strength (~N(0,1))
  readonly style: number; // own style latent in [0,1] (low=counter, high=possession)
  readonly rng: Rng;
}): TeamMatchStats => {
  const { team, opponent, matchId, date, goalsFor, goalsAgainst, strength, style, rng } =
    params;

  // Small symmetric jitter helper in [-0.5, 0.5].
  const j = (): number => rng() - 0.5;

  // Possession rises with both strength and the possession-leaning style latent.
  const possessionPct = clamp(50 + 12 * strength + 18 * (style - 0.5) + 6 * j(), 25, 75);

  // Volume of attacking attempts scales with strength and possession.
  const attemptsAtGoal = clamp(Math.round(11 + 4 * strength + 5 * (style - 0.5) + 3 * j()), 3, 30);
  const onTargetShare = clamp(0.36 + 0.06 * strength + 0.04 * j(), 0.2, 0.6);
  const attemptsOnTarget = clamp(Math.round(attemptsAtGoal * onTargetShare), 1, attemptsAtGoal);
  const attemptsOffTarget = clamp(attemptsAtGoal - attemptsOnTarget, 0, attemptsAtGoal);

  // Passing volume tracks possession; completion rises with strength.
  const totalPasses = clamp(Math.round(420 + 6 * possessionPct + 40 * strength + 20 * j()), 250, 900);
  const completionRate = clamp(0.82 + 0.06 * strength + 0.02 * j(), 0.6, 0.95);
  const passesCompleted = clamp(Math.round(totalPasses * completionRate), 100, totalPasses);

  const crosses = clamp(Math.round(14 + 5 * (style - 0.5) + 4 * strength + 3 * j()), 2, 40);
  const ballProgressions = clamp(Math.round(38 + 10 * strength + 8 * j()), 10, 90);

  // --- Phases of play: shares that sum to <= 100 (the remainder is "settled" play).
  // Possession-leaning style presses high; counter-leaning style sits in a low block.
  const phaseHighPressPct = clamp(24 + 10 * (style - 0.5) + 6 * strength + 4 * j(), 5, 50);
  const phaseCounterAttackPct = clamp(14 - 8 * (style - 0.5) + 4 * j(), 3, 35);
  const phaseLowBlockPct = clamp(20 - 10 * (style - 0.5) - 5 * strength + 4 * j(), 3, 45);

  // --- Line breaks: stronger + more progressive teams complete more.
  const lineBreaksAttempted = clamp(Math.round(48 + 12 * strength + 8 * (style - 0.5) + 5 * j()), 15, 110);
  const lbSuccess = clamp(0.6 + 0.08 * strength + 0.03 * j(), 0.35, 0.9);
  const lineBreaksCompleted = clamp(Math.round(lineBreaksAttempted * lbSuccess), 5, lineBreaksAttempted);
  const lb4Share = clamp(0.12 + 0.05 * strength + 0.02 * j(), 0.02, 0.4);
  const lb4UnitsCompleted = clamp(Math.round(lineBreaksCompleted * lb4Share), 0, lineBreaksCompleted);

  // --- Offers & movement (graphical layer): present here so smoke runs exercise it.
  const offerConversionPct = clamp(45 + 12 * strength + 8 * (style - 0.5) + 6 * j(), 15, 85);
  const movementInBehind = clamp(Math.round(22 + 8 * strength + 6 * (style - 0.5) + 4 * j()), 4, 60);

  // --- Defensive pressure: high-press styles force more turnovers.
  const forcedTurnovers = clamp(Math.round(46 + 10 * (phaseHighPressPct - 24) / 10 + 6 * strength + 4 * j()), 15, 90);
  const ballRecoveryTimeSec = clamp(9 - 2 * strength + 2 * (0.5 - style) + 1.5 * j(), 3, 18);

  // --- Physical: distances and efforts. ~990 player-minutes for 11 outfielders.
  const teamTotalDistanceKm = clamp(108 + 6 * strength + 3 * j(), 95, 125);
  const highIntensityShare = clamp(0.085 + 0.02 * strength + 0.015 * (style - 0.5) + 0.008 * j(), 0.05, 0.16);
  const highIntensityDistanceKm = clamp(teamTotalDistanceKm * highIntensityShare, 5, 22);
  const sprints = clamp(Math.round(150 + 30 * strength + 25 * (style - 0.5) + 12 * j()), 70, 320);
  const highSpeedRuns = clamp(Math.round(190 + 30 * strength + 15 * j()), 90, 360);
  const topSpeedMax = clamp(32.5 + 1.5 * strength + 0.6 * j(), 29, 37);
  const minutesPlayed = clamp(Math.round(990 + 6 * j()), 980, 1000);

  // --- Synthetic passing network: ~8 edges among a small set of nodes. Edge weight
  //     grows with passing volume; stronger/possession teams build denser networks.
  const passNetwork = buildPassNetwork(strength, style, passesCompleted, rng);

  // --- Derived xG approximation (report Model 2 formula). Line-break-to-shot proxy
  //     credits progression that manufactures attempts.
  const lbToShotProxy = clamp(lineBreaksCompleted * 0.18, 0, attemptsAtGoal);
  const xgApprox = clamp(
    0.1 * attemptsOnTarget + 0.03 * attemptsOffTarget + 0.05 * lbToShotProxy,
    0,
    8,
  );

  return {
    team,
    opponent,
    matchId,
    date,
    neutral: true,
    goalsFor,
    goalsAgainst,
    possessionPct,
    attemptsAtGoal,
    attemptsOnTarget,
    attemptsOffTarget,
    totalPasses,
    passesCompleted,
    crosses,
    ballProgressions,
    phaseHighPressPct,
    phaseCounterAttackPct,
    phaseLowBlockPct,
    lineBreaksAttempted,
    lineBreaksCompleted,
    lb4UnitsCompleted,
    offerConversionPct,
    movementInBehind,
    forcedTurnovers,
    ballRecoveryTimeSec,
    teamTotalDistanceKm,
    highIntensityDistanceKm,
    sprints,
    highSpeedRuns,
    topSpeedMax,
    minutesPlayed,
    passNetwork,
    xgApprox,
  };
};

/** Build a small (~8-edge) deterministic passing network for one team-match. */
const buildPassNetwork = (
  strength: number,
  style: number,
  passesCompleted: number,
  rng: Rng,
): readonly PassEdge[] => {
  // Eight outfield "slots"; the playmaker (node 5) hubs more passes for stronger
  // possession sides, which raises network centralization downstream.
  const nodeCount = 8;
  const nodes = Array.from({ length: nodeCount }, (_, i) => `P${i + 1}`);
  const hubBias = clamp(0.5 + 0.4 * style + 0.2 * strength, 0.2, 1.2);
  const base = passesCompleted / 28; // mean passes per edge
  const edges: PassEdge[] = [];
  for (let i = 0; i < nodeCount; i += 1) {
    const from = nodes[i] as string;
    const to = nodes[(i + 1) % nodeCount] as string;
    const isHub = i === 4 || i === 5; // playmaker spine
    const count = Math.max(
      1,
      Math.round(base * (isHub ? hubBias : 1) * (0.6 + 0.8 * rng())),
    );
    edges.push({ from, to, count });
  }
  return edges;
};

/** Result from the home team's perspective given the two goal totals. */
const resultFromGoals = (homeGoals: number, awayGoals: number): MatchResult =>
  homeGoals > awayGoals ? "home" : homeGoals < awayGoals ? "away" : "draw";

/**
 * Generate a full synthetic tournament, deterministic from `opts.seed`.
 *
 * Defaults mirror WC2026: 48 teams in 12 groups of 4, each team playing a 3-match
 * group round-robin. The Round-of-32 fixtures pair group winners against runners-up
 * across groups (all flagged neutral, per knockout convention).
 */
export const generateSyntheticTournament = (
  opts?: SyntheticOptions,
): SyntheticTournament => {
  const teams = Math.max(2, Math.floor(opts?.teams ?? DEFAULT_TEAMS));
  const groups = Math.max(1, Math.floor(opts?.groups ?? DEFAULT_GROUPS));
  const seed = opts?.seed ?? DEFAULT_SEED;
  const rng = mulberry32(seed);

  // --- Latent strengths, priors, and per-team style latents (all from one Rng).
  const trueStrength = new Map<string, number>();
  const priors = new Map<string, TeamPrior>();
  const styleByTeam = new Map<string, number>();
  for (let i = 0; i < teams; i += 1) {
    const code = teamCode(i);
    const strength = gaussian(rng);
    trueStrength.set(code, strength);
    priors.set(code, {
      team: code,
      elo: 1500 + 220 * strength,
      squadValueIndex: null,
    });
    // Style latent in [0,1]: stronger teams skew slightly more possession-based.
    styleByTeam.set(code, clamp(0.5 + 0.15 * strength + 0.25 * (rng() - 0.5), 0, 1));
  }

  const buckets = partitionGroups(teams, groups);

  // --- Simulate every group's round-robin. Each pairing is one CompletedMatch with
  //     both perspectives filled. Goals are Poisson around a strength-gap rate.
  const matches: CompletedMatch[] = [];
  const allStats: TeamMatchStats[] = [];
  let matchSeq = 0;
  for (let g = 0; g < buckets.length; g += 1) {
    const bucket = buckets[g] as number[];
    for (let a = 0; a < bucket.length; a += 1) {
      for (let b = a + 1; b < bucket.length; b += 1) {
        const homeIdx = bucket[a] as number;
        const awayIdx = bucket[b] as number;
        const home = teamCode(homeIdx);
        const away = teamCode(awayIdx);
        const sHome = trueStrength.get(home) as number;
        const sAway = trueStrength.get(away) as number;

        // Expected goals: ~1.35 baseline scaled by the strength gap (no host bonus).
        const gap = sHome - sAway;
        const lambdaHome = clamp(1.35 * Math.exp(0.35 * gap), 0.15, 6);
        const lambdaAway = clamp(1.35 * Math.exp(-0.35 * gap), 0.15, 6);
        const homeGoals = samplePoisson(rng, lambdaHome);
        const awayGoals = samplePoisson(rng, lambdaAway);

        const matchId = `SYN-G${String(g).padStart(2, "0")}-M${String(matchSeq).padStart(3, "0")}`;
        // Deterministic group-stage dates: matchday 1..n spread across June.
        const date = `2026-06-${String(11 + (matchSeq % 12)).padStart(2, "0")}`;
        matchSeq += 1;

        const homeStats = buildTeamMatchStats({
          team: home,
          opponent: away,
          matchId,
          date,
          goalsFor: homeGoals,
          goalsAgainst: awayGoals,
          strength: sHome,
          style: styleByTeam.get(home) as number,
          rng,
        });
        const awayStats = buildTeamMatchStats({
          team: away,
          opponent: home,
          matchId,
          date,
          goalsFor: awayGoals,
          goalsAgainst: homeGoals,
          strength: sAway,
          style: styleByTeam.get(away) as number,
          rng,
        });

        allStats.push(homeStats, awayStats);
        matches.push({
          home: homeStats,
          away: awayStats,
          date,
          neutral: true,
          result: resultFromGoals(homeGoals, awayGoals),
        });
      }
    }
  }

  // --- Profiles via the real aggregation path (Bayesian shrink toward Elo priors).
  const profiles = buildProfiles(allStats, priors);

  // --- Round-of-32 fixtures: rank each group's teams by accumulated group points,
  //     then pair winners vs runners-up across adjacent groups (classic bracket).
  const fixtures = buildRound32(buckets, matches, trueStrength);

  return { matches, priors, profiles, fixtures, trueStrength };
};

/** Group standing for one team: points then goal difference, both tie-broken by Elo. */
interface Standing {
  readonly team: string;
  readonly points: number;
  readonly goalDiff: number;
  readonly strength: number;
}

/** Rank a group's teams by points, then goal difference, then latent strength. */
const rankGroup = (
  bucket: number[],
  matches: readonly CompletedMatch[],
  trueStrength: ReadonlyMap<string, number>,
): Standing[] => {
  const codes = new Set(bucket.map(teamCode));
  const points = new Map<string, number>();
  const goalDiff = new Map<string, number>();
  for (const code of codes) {
    points.set(code, 0);
    goalDiff.set(code, 0);
  }
  for (const m of matches) {
    const h = m.home.team;
    const a = m.away.team;
    if (!codes.has(h) || !codes.has(a)) continue;
    const gd = m.home.goalsFor - m.home.goalsAgainst;
    goalDiff.set(h, (goalDiff.get(h) ?? 0) + gd);
    goalDiff.set(a, (goalDiff.get(a) ?? 0) - gd);
    if (m.result === "home") points.set(h, (points.get(h) ?? 0) + 3);
    else if (m.result === "away") points.set(a, (points.get(a) ?? 0) + 3);
    else {
      points.set(h, (points.get(h) ?? 0) + 1);
      points.set(a, (points.get(a) ?? 0) + 1);
    }
  }
  return [...codes]
    .map(
      (team): Standing => ({
        team,
        points: points.get(team) ?? 0,
        goalDiff: goalDiff.get(team) ?? 0,
        strength: trueStrength.get(team) ?? 0,
      }),
    )
    .sort(
      (x, y) =>
        y.points - x.points ||
        y.goalDiff - x.goalDiff ||
        y.strength - x.strength,
    );
};

/**
 * Build a plausible Round-of-32 fixture list, mirroring the WC2026 format where 32
 * teams advance: every group winner and runner-up, plus the best third-placed teams
 * to fill the bracket (with 12 groups: 12 winners + 12 runners-up + 8 best thirds =
 * 32 teams = 16 fixtures). Qualified teams are seeded by group rank then strength,
 * snake-paired strong-vs-weak so the bracket is competitive. All venues are neutral.
 */
const buildRound32 = (
  buckets: number[][],
  matches: readonly CompletedMatch[],
  trueStrength: ReadonlyMap<string, number>,
): MatchFixture[] => {
  const standings = buckets
    .filter((b) => b.length >= 2)
    .map((b) => rankGroup(b, matches, trueStrength));
  if (standings.length === 0) return [];

  const winners = standings.map((s) => s[0] as Standing);
  const runners = standings.map((s) => s[1] as Standing);
  // Best third-placed teams, ranked across groups, fill the remaining slots so the
  // qualifier count reaches the next even number (a whole set of pairings).
  const thirds = standings
    .map((s) => s[2])
    .filter((x): x is Standing => x != null)
    .sort((x, y) => y.points - x.points || y.goalDiff - x.goalDiff || y.strength - x.strength);

  const direct = [...winners, ...runners];
  const needed = direct.length % 2 === 0 ? direct.length : direct.length + 1;
  // Target a full 16-fixture bracket when enough teams exist (WC2026 default).
  const targetTeams = Math.min(32, needed + (thirds.length - (thirds.length % 2)));
  const qualified = [...direct, ...thirds].slice(0, targetTeams);

  // Seed by strength so the snake pairing puts the strongest against the weakest.
  const seeded = [...qualified].sort((x, y) => y.strength - x.strength);
  const pairCount = Math.floor(seeded.length / 2);

  const fixtures: MatchFixture[] = [];
  for (let i = 0; i < pairCount; i += 1) {
    const teamA = (seeded[i] as Standing).team;
    const teamB = (seeded[seeded.length - 1 - i] as Standing).team;
    const day = 4 + (i % 6); // 2026-07-04 .. 2026-07-09
    fixtures.push({
      id: `fifwc-${teamA.toLowerCase()}-${teamB.toLowerCase()}-2026-07-${String(day).padStart(2, "0")}`,
      stage: "R32",
      teamA,
      teamB,
      neutral: true,
      kickoffUtc: `2026-07-${String(day).padStart(2, "0")}T18:00:00Z`,
    });
  }
  return fixtures;
};
