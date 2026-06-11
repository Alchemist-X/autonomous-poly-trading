import { describe, expect, it } from "vitest";
import { categorizeMarket } from "./categorize.js";

const cases: Array<[string, { question: string; eventSlug: string; eventTitle: string }, string]> = [
  ["champion", { question: "Will Spain win the 2026 FIFA World Cup?", eventSlug: "world-cup-winner", eventTitle: "World Cup Winner" }, "tournament_winner"],
  ["award", { question: "Will Kylian Mbappe win the Golden Boot?", eventSlug: "golden-boot", eventTitle: "Golden Boot" }, "golden_boot"],
  ["group_ko", { question: "Will Brazil win Group C?", eventSlug: "group-c-winner", eventTitle: "Group C Winner" }, "group_winner"],
  ["group_ko", { question: "Will the USA advance from group?", eventSlug: "usa-advance", eventTitle: "Advance to Knockout" }, "advance_to_ko"],
  ["match", { question: "Will Argentina win on 2026-06-16?", eventSlug: "fifwc-arg-alg-2026-06-16", eventTitle: "Argentina vs. Algeria" }, "moneyline_1x2"],
  ["match", { question: "Will Argentina vs. Algeria end in a draw?", eventSlug: "fifwc-arg-alg-2026-06-16", eventTitle: "Argentina vs. Algeria" }, "moneyline_1x2"],
  ["match", { question: "Total goals over 2.5 in Brazil vs Morocco?", eventSlug: "fifwc-bra-mar", eventTitle: "Brazil vs. Morocco" }, "total_goals"],
  ["match", { question: "Both teams to score in France vs Senegal?", eventSlug: "fifwc-fra-sen", eventTitle: "France vs. Senegal" }, "both_teams_to_score"]
];

describe("categorizeMarket", () => {
  for (const [expectedCategory, input, expectedSubtype] of cases) {
    it(`${input.question} → ${expectedCategory}/${expectedSubtype}`, () => {
      const r = categorizeMarket(input);
      expect(r.category).toBe(expectedCategory);
      expect(r.subtype).toBe(expectedSubtype);
    });
  }

  it("falls back to special/other for unknown", () => {
    const r = categorizeMarket({ question: "Will the stadium roof be open?", eventSlug: "misc", eventTitle: "Misc" });
    expect(r.category).toBe("special");
  });
});
