# 2026 World Cup Group B Winner Forecast (Switzerland / Canada / Bosnia and Herzegovina / Qatar)

Generated: 2026-06-11T13:15:00Z | Prediction ID: `group-winner:b` | 中文版: [report.md](report.md)

## 1. Conclusion

| Team | Probability | MC baseline | Adjustment |
| --- | --- | --- | --- |
| Switzerland | **53.0%** | 50.0% | +3pp |
| Canada | **44.0%** | 48.0% | −4pp |
| Bosnia and Herzegovina | **2.9%** | 1.9% | +1pp |
| Qatar | **0.1%** | 0.1% | 0 |

**One-line view**: Switzerland and host Canada are essentially a coin flip on ratings, but Canada's pre-tournament injury cluster (captain Davies' hamstring, centre-back Bombito off the roster, David's poor form) tilts the scale slightly toward a fully intact Switzerland.

## 2. Question definition

The target is **first place in the final Group B standings** (FIFA official group-stage final ranking). Tiebreakers in order: points → goal difference → goals scored → head-to-head record among tied teams (mini-table) → fair-play points (cards) → FIFA drawing of lots. Group schedule: Canada vs Bosnia (Jun 12), Qatar vs Switzerland (Jun 13), Switzerland vs Bosnia & Canada vs Qatar (Jun 18), Bosnia vs Qatar & Switzerland vs Canada (Jun 24).

## 3. Team notes (Elo / form / schedule only)

- **Switzerland (Elo 1891, world No. 17)**: Highest Elo in the group with an intact squad — Xhaka (captain, fourth straight World Cup), Kobel, and Akanji (fresh off a Serie A title with Inter) are all in; no core absences (only backup forward Amdouni is just back from an ACL rupture). The opener against Qatar is the softest fixture in the group, and the direct meeting with Canada on Jun 24 will likely decide first place.
- **Canada (Elo 1788, world No. 25; host bonus in group games)**: As co-hosts playing group games at home, the model applies a +100 Elo group-stage bonus, putting their baseline nearly level with Switzerland. But pre-tournament attrition is severe: captain Alphonso Davies (hamstring strain) is doubtful for the opener; starting centre-back Moïse Bombito has reportedly been removed from the roster through injury; top striker Jonathan David managed just 6 Serie A goals all season at Juventus, only 1 since early February.
- **Bosnia and Herzegovina (Elo 1595, world No. 65)**: Third tier of the group; the realistic script is fighting for second/third. Their opener on Jun 12 lands exactly in Canada's worst injury window — points there open a small path to first place, hence a small upward bump to 2.9%.
- **Qatar (Elo 1421, world No. 96)**: Lowest Elo in the group, more than 350 Elo points behind the top two; roughly 0.1% group-winner probability across 100k simulations, with no recent evidence supporting an upgrade.

## 4. Method

1. **Statistical baseline**: Pure-Elo Poisson Monte Carlo — 100,000 full-tournament simulations (seed 20260611), ratings from the eloratings.net snapshot of 2026-06-11. Match goals are independent Poissons (a 2.6-goal baseline split by the Elo logistic expectancy); hosts Mexico, the United States and Canada receive +100 Elo in group matches only; group ranking follows points → goal difference → goals → head-to-head among tied teams → random draw. No market input of any kind. Group B baseline: Switzerland 49.98%, Canada 47.96%, Bosnia 1.95%, Qatar 0.12%.
2. **Bounded adjustment** (max ±4pp per team, evidence-cited, renormalized to sum 1): Canada −4pp for the injury cluster (Davies, Bombito, David's form); Switzerland +3pp for an intact squad; Bosnia +1pp for facing the depleted Canada in the opener; Qatar unchanged. Adjustments net to zero, so no further renormalization was needed.
3. **Uncertainty**: The race for first remains close to a coin flip (confidence tier: medium). The biggest swing factor is whether Davies regains match fitness before the Switzerland–Canada decider on Jun 24.

## Sources

1. eloratings.net World.tsv snapshot (2026-06-11) — https://www.eloratings.net/
2. FOX Sports: Davies named to Canada squad despite hamstring injury, opener in doubt (2026-06) — https://www.foxsports.com/stories/soccer/alphonso-davies-named-to-canadas-world-cup-squad-despite-hamstring-injury
3. Sports Illustrated: Canada loses Bombito to injury on eve of the World Cup (2026-06) — https://www.si.com/soccer/canada-loses-star-player-injury-eve-2026-world-cup
4. Goal.com: Jonathan David's poor season form (2026-06) — https://www.goal.com/en-us/lists/jonathan-david-leads-the-way-but-injuries-to-alphonso-davies-and-others-impact-canada-s-chances-2026-canada-world-cup-roster-projection/blt5a743ad1a7de5028
5. Tribuna: Switzerland squad announced with Xhaka/Kobel/Akanji (2026-05-20) — https://tribuna.com/en/news/2026-05-20-xhaka-kobel-akanji-and-jashari-named-in-switzerlands-2026-world-cup-squad/
6. ESPN: Xhaka to captain Switzerland (2026-05) — https://www.espn.com/soccer/story/_/id/48818354/granit-xhaka-captain-switzerland-world-cup-squad

## Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
