import type { WcCategory } from "./types.js";

// Maps a Polymarket market to the World Cup taxonomy (the categories in the
// reference table: Match / Group-KO / Champion / Award / Player / Special) plus
// a fine-grained subtype, using event slug/title + question + group-item text.

export interface CategoryResult {
  readonly category: WcCategory;
  readonly subtype: string;
}

function has(haystack: string, ...needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * Classify by combining the event context (most reliable) with the question.
 * Order matters: more specific patterns first.
 */
export function categorizeMarket(input: {
  question: string;
  eventSlug: string;
  eventTitle: string;
  groupItem?: string | null;
}): CategoryResult {
  const q = input.question.toLowerCase();
  const ev = `${input.eventSlug} ${input.eventTitle}`.toLowerCase();
  const all = `${ev} ${q}`;

  // ---- Champion ----
  if (has(all, "win the 2026 fifa world cup", "world-cup-winner", "tournament winner", "winner of the 2026")) {
    return { category: "champion", subtype: "tournament_winner" };
  }
  if (has(all, "winning continent", "which continent", "confederation of the winner")) {
    return { category: "champion", subtype: "winning_continent" };
  }
  if (has(all, "unbeaten", "go undefeated", "win every", "without conceding")) {
    return { category: "champion", subtype: "unbeaten_novelty" };
  }

  // ---- Award ----
  if (has(all, "golden boot")) return { category: "award", subtype: "golden_boot" };
  if (has(all, "silver boot")) return { category: "award", subtype: "silver_boot" };
  if (has(all, "bronze boot")) return { category: "award", subtype: "bronze_boot" };
  if (has(all, "golden ball")) return { category: "award", subtype: "golden_ball" };
  if (has(all, "silver ball")) return { category: "award", subtype: "silver_ball" };
  if (has(all, "bronze ball")) return { category: "award", subtype: "bronze_ball" };
  if (has(all, "golden glove")) return { category: "award", subtype: "golden_glove" };
  if (has(all, "most assists")) return { category: "award", subtype: "most_assists" };
  if (has(all, "goal contribution")) return { category: "award", subtype: "most_goal_contributions" };
  if (has(all, "clean sheet")) return { category: "award", subtype: "most_clean_sheets" };
  if (has(all, "fair play")) return { category: "award", subtype: "fair_play" };
  if (has(all, "top scorer nation", "most goals as a nation", "nation with the most goals")) {
    return { category: "award", subtype: "top_scorer_nation" };
  }
  if (has(all, "nationality of the top", "nation of top goalscorer", "country of the top scorer")) {
    return { category: "award", subtype: "nation_of_top_goalscorer" };
  }

  // ---- Group / Knockout ----
  if (has(all, "win group", "group winner", "finish first in group", "top its group")) {
    return { category: "group_ko", subtype: "group_winner" };
  }
  if (has(all, "finish 2nd", "second in group", "group 2nd", "runner-up in group")) {
    return { category: "group_ko", subtype: "group_second" };
  }
  if (has(all, "finish last", "last in group", "bottom of group", "wooden spoon")) {
    return { category: "group_ko", subtype: "group_last" };
  }
  if (has(all, "group of the champion", "champion come from group", "winning group")) {
    return { category: "group_ko", subtype: "group_of_champion" };
  }
  if (has(all, "reach the final", "make the final", "reach final")) {
    return { category: "group_ko", subtype: "reach_final" };
  }
  if (has(all, "semifinal", "semi-final", "reach the semi", "final four")) {
    return { category: "group_ko", subtype: "reach_semifinals" };
  }
  if (has(all, "quarterfinal", "quarter-final", "reach the quarter", "final eight")) {
    return { category: "group_ko", subtype: "reach_quarterfinals" };
  }
  if (has(all, "round of 16", "reach r16", "advance to the knockout", "reach the knockout", "advance from group", "reach the round of 16")) {
    return { category: "group_ko", subtype: "advance_to_ko" };
  }
  if (has(all, "stage of elimination", "how far will", "be eliminated in")) {
    return { category: "group_ko", subtype: "stage_of_elimination" };
  }
  if (has(all, "furthest", "best-performing nation from")) {
    return { category: "group_ko", subtype: "confederation_furthest" };
  }
  if (has(all, "worst", "earliest exit from")) {
    return { category: "group_ko", subtype: "confederation_worst" };
  }

  // ---- Player ----
  if (has(all, "to play", "injury", "named in the squad", "make the squad", "ruled out")) {
    return { category: "player", subtype: "player_to_play" };
  }

  // ---- Match (per-fixture markets; fifwc-* slugs are fixtures) ----
  if (has(all, "halftime", "half-time", "at the half")) {
    return { category: "match", subtype: "halftime_result" };
  }
  if (has(all, "exact score", "correct score", "final score")) {
    return { category: "match", subtype: "exact_score" };
  }
  if (has(all, "both teams to score", "btts", "both teams score")) {
    return { category: "match", subtype: "both_teams_to_score" };
  }
  if (has(all, "by 2", "by 3", "-1.5", "-2.5", "+1.5", "handicap", "spread", "win by")) {
    return { category: "match", subtype: "spread_handicap" };
  }
  if (has(all, "total goals", "over ", "under ", "o/u", "goals scored in")) {
    return { category: "match", subtype: "total_goals" };
  }
  if (has(all, "to score in", "score a goal in the match", "anytime scorer")) {
    return { category: "match", subtype: "player_to_score" };
  }
  if (has(input.eventSlug.toLowerCase(), "fifwc-") || has(all, "end in a draw", "win on ", "to beat", "moneyline")) {
    return { category: "match", subtype: "moneyline_1x2" };
  }

  return { category: "special", subtype: "other" };
}
