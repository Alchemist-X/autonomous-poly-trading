/**
 * Shared team-name normalization + matching for World Cup settlement mapping.
 *
 * Both the Polymarket settlement reader (settlement.ts) and the ESPN score
 * backfill (espn-results.ts) must decide whether a feed's team label refers to
 * our fixture's team `a` or team `b`. They MUST normalize identically, so a name
 * that resolves one way in one place resolves the same way in the other.
 *
 * Accent-/punctuation-insensitive so "Côte d'Ivoire", "Curaçao" and
 * "Bosnia-Herzegovina" compare cleanly across sources.
 */

// Strip accents + punctuation, lowercase, keep only [a-z0-9].
export function normTeamName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// True when two team labels denote the same team: exact normalized equality, or
// one normalized name contained in the other (handles "Korea" vs "South Korea"
// and full-question strings like "Will England win on 2026-06-17?").
export function teamNamesMatch(a: string, b: string): boolean {
  const x = normTeamName(a);
  const t = normTeamName(b);
  if (!x || !t) return false;
  return x === t || (x.length >= 3 && t.includes(x)) || (t.length >= 3 && x.includes(t));
}
