// Process-metrics layer: blends expected-goals (xG) and expected-threat (xT)
// signals into Poisson scoring rates. These are the "enhancement" inputs that
// Kimi's 2026 World Cup report layered on top of the base score-line models.
//
// All functions are pure and immutable. Indexed grid access is guarded with
// `?? 0` because `noUncheckedIndexedAccess` types every lookup as `T | undefined`.

/**
 * Blend a team's process-based xG average with its realised goal average into a
 * single Poisson rate (lambda).
 *
 * Formula: lambda = alpha * xgAvg + (1 - alpha) * goalAvg
 *
 * xG is a less noisy estimator of underlying chance creation than raw goals, so
 * weighting it heavily (Kimi uses alpha = 0.7) shrinks the rate toward the
 * process signal while still respecting finishing/conversion captured by actual
 * goals.
 *
 * @param xgAvg   Average expected goals per match.
 * @param goalAvg Average actual goals scored per match.
 * @param alpha   Weight on the xG term, in [0, 1]. Defaults to 0.7 (Kimi).
 * @returns Blended Poisson rate (expected goals for this fixture context).
 */
export function xgEnhancedLambda(
  xgAvg: number,
  goalAvg: number,
  alpha = 0.7,
): number {
  return alpha * xgAvg + (1 - alpha) * goalAvg;
}

/**
 * Maher / Dixon-Coles multiplicative scoring rate.
 *
 * Formula: lambda = attackStrength * opponentDefenseStrength
 *                   * leagueAverageGoals * homeAdvantage
 *
 * Each team carries a relative attack rating and a relative defence rating
 * (1.0 = league average). A fixture's expected goals scale the league baseline
 * by the attacker's strength, the opponent's leakiness, and a home-field
 * multiplier (1 = neutral venue).
 *
 * @param attackStrength         Attacker's relative attack rating (1 = average).
 * @param opponentDefenseStrength Opponent's relative defence rating (1 = average; >1 = leakier).
 * @param leagueAverageGoals     Mean goals per team per match across the league.
 * @param homeAdvantage          Multiplicative home boost (1 = neutral).
 * @returns Expected goals (Poisson rate) for the attacking team.
 */
export function attackDefenseLambda(
  attackStrength: number,
  opponentDefenseStrength: number,
  leagueAverageGoals: number,
  homeAdvantage = 1,
): number {
  return (
    attackStrength * opponentDefenseStrength * leagueAverageGoals * homeAdvantage
  );
}

/** A cell coordinate into an expected-threat grid. */
export interface GridCell {
  readonly row: number;
  readonly col: number;
}

/**
 * Expected threat added (xT) by moving the ball from one grid cell to another.
 *
 * Formula: xT = value(to) - value(from)
 *
 * Each cell of the threat grid holds the probability-weighted scoring value of
 * possessing the ball there. A pass or carry's contribution is the increment in
 * that value. Positive means the move advanced the ball into more dangerous
 * territory. Out-of-bounds cells are treated as zero value.
 *
 * @param grid Threat grid; grid[row][col] is the value of that cell.
 * @param from Origin cell.
 * @param to   Destination cell.
 * @returns Change in scoring threat (may be negative).
 */
export function expectedThreatAdded(
  grid: ReadonlyArray<ReadonlyArray<number>>,
  from: GridCell,
  to: GridCell,
): number {
  const fromValue = grid[from.row]?.[from.col] ?? 0;
  const toValue = grid[to.row]?.[to.col] ?? 0;
  return toValue - fromValue;
}

/**
 * Build a didactic linear expected-threat grid in [0, 1].
 *
 * The value increases linearly toward the attacking end (higher column index),
 * so the deepest attacking column approaches 1 and the defensive end is near 0.
 * Rows share the same column-based value (no central-channel bias).
 *
 * NOTE: This is a placeholder default for demos and tests. A real xT grid is
 * *learned* from event data (Markov chain over pitch zones), not hand-built.
 *
 * @param rows Number of grid rows (vertical pitch zones). Must be >= 1.
 * @param cols Number of grid columns (horizontal pitch zones, attacking = high). Must be >= 1.
 * @returns A rows x cols grid of values in [0, 1].
 */
export function buildLinearThreatGrid(rows: number, cols: number): number[][] {
  const safeRows = Math.max(1, Math.floor(rows));
  const safeCols = Math.max(1, Math.floor(cols));
  // With a single column there is no gradient, so every cell is 0.
  const denominator = safeCols > 1 ? safeCols - 1 : 1;
  return Array.from({ length: safeRows }, () =>
    Array.from({ length: safeCols }, (_unused, col) =>
      safeCols > 1 ? col / denominator : 0,
    ),
  );
}
