# France vs Iraq (2026 World Cup Group I) — Market-Blind Forecast

- **Match**: 2026 FIFA World Cup Group Stage, Group I, Match 42 — France vs Iraq
- **Kickoff**: 2026-06-22 21:00 UTC (17:00 local), Lincoln Financial Field, Philadelphia (neutral venue)
- **Generated**: 2026-06-11 · **Type**: market-blind (fully independent of any betting or prediction-market prices)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| France win | **77.5%** | 71% – 83% | Medium |
| Draw | **16.0%** | 11% – 21% | Medium |
| Iraq win | **6.5%** | 4% – 10% | Medium |

**One-line view**: With a 456-point Elo gap and a near-full-strength squad, France are heavy favourites on merit; Iraq's first World Cup in 40 years and Graham Arnold's defensive organisation leave modest room for a draw.

## 2. Definition

Three-way 90-minute result (win/draw/loss). Group-stage matches have no extra time or penalties; the result at full time settles the outcome.

## 3. Strength Profile

| Item | France | Iraq |
| --- | --- | --- |
| Elo rating | 2063 (world #3) | 1607 (world #63) |
| Source | eloratings.net snapshot 2026-06-11 (runtime-artifacts/world-cup/elo-table.json, from https://www.eloratings.net/World.tsv) | same |
| Context | 2022 runners-up core, Mbappe captains, chasing a third title (Al Jazeera, 2026-06-02) | First World Cup since 1986; qualified via late playoff winner against Bolivia (FIFA.com, 2026-06) |

## 4. Key Factors

1. **456-point Elo gap** (2063 vs 1607): Davidson model gives France ~79% baseline win probability. Source: eloratings.net (snapshot 2026-06-11).
2. **Mbappe included and captains the side** after a thigh-injury scare; in top form at Real Madrid (56 France goals, second only to Giroud). Source: CBC Sports / ESPN, early June 2026.
3. **Limited French absences**: Camavinga (injury-disrupted season), Ekitike (Achilles, out since April), Kolo Muani omitted — depth comfortably covers. Source: ESPN, June 2026.
4. **Iraq coach Graham Arnold** (since May 2025) brings World Cup experience (Australia, Qatar 2022) and defensive organisation; a low block against France is expected. Source: FIFA.com / FourFourTwo, June 2026.
5. **Iraq squad anchors**: 100-cap keeper Jalal Hassan captains; Ipswich's Ali Al-Hamadi and qualifying top scorer Hussein (8 goals) lead the attack. Source: FourFourTwo, June 2026.
6. **Neutral venue confirmed**: Lincoln Financial Field, Philadelphia, 5pm local kickoff; afternoon heat affects both sides equally — no host adjustment applied. Source: lincolnfinancialfield.com / ESPN match page.

## 5. Model and Adjustment

- **p_stat** (Davidson three-way, scale=400, drawNu=0.7, neutral venue, no host bonus): France 79.3% / Draw 14.9% / Iraq 5.8%.
- **Adjustment (1.8pp total, well under the ±8pp cap; evidence is thin so the delta is small)**:
  - France −1.8pp: residual uncertainty from Mbappe's recent thigh issue plus three depth absences;
  - Draw +1.1pp, Iraq +0.7pp: Arnold's low-block system and maximal motivation at a first World Cup in 40 years.
- **p_final**: France 77.5% / Draw 16.0% / Iraq 6.5% (renormalised).
- **This is a market-blind forecast**: no betting odds or prediction-market prices were read or referenced at any point; probabilities come solely from the Elo statistical model plus the bounded evidence-based adjustment above.
- Intervals reflect parameter sensitivity (drawNu 0.6–0.8 moves France 77.7%–81.0%, draw 13.1%–16.7%) plus extra uncertainty from Iraq's sparse record against elite opposition.

## 6. Method and Sources

**Method**: eloratings.net ratings (2026-06-11) feed a Davidson three-way model (identical to eloToOneXTwo in packages/sports-model/src/elo.ts); a bounded adjustment of at most ±8pp, justified only by dated, sourced facts, is applied and renormalised; 80% intervals combine model parameter sensitivity with evidence thinness.

**Sources**:
1. eloratings.net World.tsv (local snapshot 2026-06-11)
2. Al Jazeera — France World Cup 2026 preview (2026-06-02) https://www.aljazeera.com/sports/2026/6/2/france-world-cup-2026-preview-players-to-watch-group-matches-and-squad
3. ESPN — France 2026 World Cup squad (June 2026) https://www.espn.com/soccer/story/_/id/48771039/france-2026-world-cup-squad-mbappe-camavinga-kolo-muani-dembele
4. CBC Sports — World Cup injury scares (June 2026) https://www.cbc.ca/sports/soccer/worldcup/injuries-2026-fifa-world-cup-messi-mbappe-yamal-davies-9.7221543
5. FIFA.com — Iraq preliminary squad / Graham Arnold (June 2026) https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/iraq-preliminary-squad-announcement-graham-arnold
6. FourFourTwo — Iraq World Cup 2026 squad (June 2026) https://www.fourfourtwo.com/team/iraq-world-cup-2026-squad
7. Wikipedia — 2026 FIFA World Cup Group I https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_I
8. Lincoln Financial Field — France vs Iraq (Group I) event page https://www.lincolnfinancialfield.com/events/france-vs-iraq-group-i/

**Disclaimer**: This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
