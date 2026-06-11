# Uruguay vs Spain — 2026 World Cup Group Stage, Group H (Market-Blind Forecast)

- **Fixture**: 2026 FIFA World Cup, Group H, Matchday 3 (Match 66)
- **Kickoff**: 2026-06-27T00:00:00Z (June 26 local, Guadalajara Stadium, Mexico)
- **Generated**: 2026-06-11T13:15:00Z | Resolution metadata slug: `fifwc-ury-esp-2026-06-26`

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Uruguay win | **15.1%** | 11% – 20% | Medium |
| Draw | **23.1%** | 17% – 29% | Medium |
| Spain win | **61.8%** | 54% – 70% | Medium |

**One-line view**: Spain are the world's No. 1 Elo side and clearly the stronger team; but this is the final group match with both sides likely already through, and Spain carry fitness questions, so the draw deserves slightly more weight than the raw model gives it.

## 2. Definition

Three-way result over 90 minutes (win/draw/loss); no extra time or penalties in the group stage. Official result governs.

## 3. Strength Profile

| Item | Uruguay | Spain |
| --- | --- | --- |
| Elo (eloratings.net, snapshot 2026-06-11) | 1892 (#16) | 2157 (#1) |
| Recent standing | 4th in CONMEBOL qualifying; beat Brazil and Argentina (MLSSoccer, 2026-06) | Reigning European champions, among the tournament favourites by reputation (MLSSoccer, 2026-06) |
| Coach | Marcelo Bielsa (high-intensity pressing) | Luis de la Fuente (possession game) |

## 4. Key Factors

1. **Final-round schedule structure**: both teams face Cape Verde (Elo 1578) and Saudi Arabia (Elo 1576) first; by Matchday 3 both are likely already qualified, raising rotation and risk-averse tendencies — such matches historically draw more often. (Source: Wikipedia, 2026 FIFA World Cup Group H, accessed 2026-06-11)
2. **Spain fitness**: Merino (top scorer in qualifying) had surgery on a right-foot stress fracture in February and may not be fully ready; Yamal had an injury-hit season including a late hamstring problem; Nico Williams just returned from a hamstring injury. The coach voiced "no doubt" about availability for the opener, but late-group sharpness is uncertain. (Source: Al Jazeera, 2026-06-06)
3. **Uruguay fitness**: Bentancur out since January with a serious hamstring injury; his return is a race against time. De Arrascaeta / De la Cruz are the replacement options. (Source: FourFourTwo, 2026-06; squad announced 2026-05-31)
4. **Uruguay's big-game record**: under Bielsa, Uruguay beat both Brazil and Argentina in qualifying — proven ability to take results off elite sides. (Source: MLSSoccer Group H preview, 2026-06)
5. **Venue**: Guadalajara (~1,500 m altitude) is neutral for both; no host bonus applies. (Source: FOX Sports schedule page, 2026-06)
6. **Head-to-head**: both prior World Cup meetings ended in draws (2-2 in 1950, 0-0 in 1990) — background only, not used in the adjustment. (Source: Wikipedia Group H, accessed 2026-06-11)

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue with no host bonus; Uruguay 1892 vs Spain 2157):
  - Uruguay 14.1% / Draw 21.1% / Spain 64.8%
- **Bounded adjustment** (total |delta| = 6pp, within the 8pp cap): Uruguay +1pp, Draw +2pp, Spain -3pp
  - Rationale: likely dead-rubber/rotation dynamics in the final group match (Factor 1); Spain's fitness uncertainty slightly outweighs Uruguay's (Factors 2 vs 3); Uruguay's record against elite opposition (Factor 4). Evidence is structural rather than hard news, so the shift is kept conservative.
- **p_final**: Uruguay 15.1% / Draw 23.1% / Spain 61.8%
- **This is a market-blind forecast**: fully independent of any betting line, odds, or prediction-market price; no such data was consulted or cited.

## 6. Method and Sources

**Method**: Elo ratings from eloratings.net feed a Davidson three-way model (identical to eloToOneXTwo in packages/sports-model/src/elo.ts in this repo) for the statistical baseline; a bounded adjustment of at most +/-8pp total, justified only by dated, sourced public facts, is then applied and renormalized. The 80% intervals reflect drawNu 0.6-0.8 parameter sensitivity (~2-4pp baseline swing) plus lineup/group-state uncertainty 15 days before kickoff.

**Sources**:
1. eloratings.net World.tsv (snapshot 2026-06-11, repo elo-table.json)
2. Al Jazeera — Spain at World Cup 2026 preview (2026-06-06) https://www.aljazeera.com/sports/2026/6/6/spains-world-cup-2026-team-preview-players-to-watch-group-matches-squad
3. FourFourTwo — Uruguay squad World Cup 2026 (2026-06; squad announced 2026-05-31) https://www.fourfourtwo.com/team/uruguay-world-cup-2026-squad
4. MLSSoccer — 2026 FIFA World Cup Group H preview (2026-06) https://www.mlssoccer.com/competitions/fifa-world-cup/news/2026-fifa-world-cup-group-h-preview-spain-cape-verde-saudi-arabia-uruguay
5. Wikipedia — 2026 FIFA World Cup Group H (accessed 2026-06-11) https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_H
6. FOX Sports — Uruguay World Cup 2026 schedule (2026-06) https://www.foxsports.com/stories/soccer/uruguay-world-cup-2026-schedule-locations-dates-times

**Disclaimer**: This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
