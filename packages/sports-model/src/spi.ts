// FiveThirtyEight Soccer Power Index (SPI) rating system — Kimi's 2026 World Cup
// report "model 3". Each team carries two ratings expressed in goals:
//   offenseRating  = expected goals a team SCORES against an average defence,
//   defenseRating  = expected goals a team CONCEDES against an average offence.
// A fixture's expected goals scale one side's offence by how leaky the other
// side's defence is relative to the league average, then feed an independent
// Poisson score matrix to read off 1X2. Pure, immutable, no globals.

import type { OneXTwo } from "./types.js";
import { scoreMatrix, outcomeProbabilities } from "./poisson.js";

/**
 * Expected goals for one side of an SPI fixture.
 *
 * Formula: xG = offenseRating * (opponentDefenseRating / leagueAverageGoals) * homeAdvantage
 *
 * Interpretation: a team that scores `offenseRating` against an average defence
 * scores more (less) when the opponent concedes more (less) than league average.
 * The ratio opponentDefenseRating / leagueAverageGoals is the opponent's defensive
 * leakiness (1 = average); homeAdvantage is a multiplicative bump applied only to
 * the home side by the caller (1 = neutral).
 *
 * @param offenseRating - Team's expected goals scored vs an average defence (>= 0).
 * @param opponentDefenseRating - Opponent's expected goals conceded vs an average offence (>= 0).
 * @param leagueAverageGoals - Mean goals per team per match in the league (> 0).
 * @param homeAdvantage - Multiplicative home bump (default 1, neutral).
 * @returns Expected goals (Poisson rate); 0 for invalid inputs.
 */
export function spiExpectedGoals(
  offenseRating: number,
  opponentDefenseRating: number,
  leagueAverageGoals: number,
  homeAdvantage = 1,
): number {
  if (
    !Number.isFinite(offenseRating) ||
    !Number.isFinite(opponentDefenseRating) ||
    !Number.isFinite(leagueAverageGoals) ||
    !Number.isFinite(homeAdvantage)
  )
    return 0;
  if (offenseRating < 0 || opponentDefenseRating < 0 || homeAdvantage < 0)
    return 0;
  if (leagueAverageGoals <= 0) return 0;
  return offenseRating * (opponentDefenseRating / leagueAverageGoals) * homeAdvantage;
}

/**
 * 1X2 probabilities for an SPI fixture.
 *
 * Builds lambda_home and lambda_away via {@link spiExpectedGoals} (the home bump
 * is applied to the home lambda only), forms an independent-Poisson score matrix
 * and collapses it to home / draw / away.
 *
 * Formula:
 *   lambda_home = spiExpectedGoals(offenseHome, defenseAway, leagueAverageGoals, homeAdvantage)
 *   lambda_away = spiExpectedGoals(offenseAway, defenseHome, leagueAverageGoals, 1)
 *   1X2 = outcomeProbabilities(scoreMatrix({ home: lambda_home, away: lambda_away }))
 *
 * @param input - Offence/defence ratings for both teams, the league average,
 *   and an optional homeAdvantage (default 1).
 * @returns Normalised home / draw / away probabilities.
 */
export function spiMatchProbabilities(input: {
  offenseHome: number;
  defenseHome: number;
  offenseAway: number;
  defenseAway: number;
  leagueAverageGoals: number;
  homeAdvantage?: number;
}): OneXTwo {
  const homeAdvantage = input.homeAdvantage ?? 1;
  const lambdaHome = spiExpectedGoals(
    input.offenseHome,
    input.defenseAway,
    input.leagueAverageGoals,
    homeAdvantage,
  );
  const lambdaAway = spiExpectedGoals(
    input.offenseAway,
    input.defenseHome,
    input.leagueAverageGoals,
    1,
  );
  const matrix = scoreMatrix({ home: lambdaHome, away: lambdaAway });
  return outcomeProbabilities(matrix);
}
