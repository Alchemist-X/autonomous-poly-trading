# Qatar vs Switzerland — 2026 World Cup Group B (Market-Blind Forecast)

- Event: 2026 FIFA World Cup group stage, Group B (Match 8 of the tournament)
- Kickoff: 2026-06-13 19:00 UTC (12:00 PT local), Levi's Stadium (Santa Clara, San Francisco Bay Area)
- Generated: 2026-06-11 (about 2 days before kickoff)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Qatar win | **4.5%** | 3% – 7% | Medium |
| Draw | **13.5%** | 10% – 18% | Medium |
| Switzerland win | **82.0%** | 76% – 87% | Medium |

**One-sentence view**: With a 470-point Elo gap (1891 vs 1421), a fully fit Switzerland squad unbeaten in qualifying, and Qatar in poor recent form, a Switzerland win is by far the most likely outcome, though single-match variance keeps the draw above 10%.

## 2. Definition

The forecast covers the three-way result after 90 minutes of regulation time (win/draw/loss); group-stage matches have no extra time or penalties — a draw stands as the final result.

## 3. Strength Profile

| Item | Qatar | Switzerland |
| --- | --- | --- |
| Elo rating / world rank | 1421 / 96th | 1891 / 17th |
| Qualifying | Qualified from AFC (final round 2-1 win over UAE) | UEFA Group B unbeaten (W4 D2, 2 goals conceded in 6 matches) |
| Recent form | Lost 3 of last 4 competitive matches; 2025 Arab Cup group-stage exit | Rotated in March friendlies; core players rested |

- Elo source: eloratings.net (repo snapshot `elo-table.json`, fetched 2026-06-11).
- Switzerland qualifying and form: Squawka match preview, 2026-06 (https://www.squawka.com/us/news/world-cup/match-preview-qatar-vs-switzerland-06-13-26-world-cup-2026/).

## 4. Key Factors

1. **Huge Elo gap (470 points)**: 1891 vs 1421 gives Switzerland a ~80% baseline win probability in the model (eloratings.net snapshot, 2026-06-11).
2. **Switzerland with no notable absentees, Xhaka leads**: 33-year-old captain Granit Xhaka makes his 4th straight World Cup appearance (national-record 144 caps); no key absences reported (ESPN, 2026-06, https://www.espn.com/soccer/story/_/id/48818354/granit-xhaka-captain-switzerland-world-cup-squad; olympics.com, 2026-06).
3. **Qatar in poor form**: lost 3 of their last 4 competitive matches and exited the 2025 Arab Cup at the group stage (0-3 to Tunisia, goalless vs Palestine) (Squawka, 2026-06).
4. **Qatar's attacking core is available**: Akram Afif and Almoez Ali are fit, and Lopetegui is expected to field a settled XI — this caps how far Qatar should be marked down (Squawka, 2026-06).
5. **Neutral venue, mild weather**: Santa Clara in mid-June is roughly 13-21°C and dry; no meaningful weather or home-crowd variable, and Qatar receive no host bonus (levisstadium.com event page; AccuWeather June climate, 2026-06).
6. **Limited Swiss fringe concern**: forward Zeki Amdouni made the squad despite barely playing this season after a severe knee injury, but he is not a first-choice starter (olympics.com, 2026-06).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Qatar 5.4% / Draw 14.5% / Switzerland 80.1%
- **Adjustment (about ±1.9pp total, well within the ±8pp cap)**: Qatar −0.9pp, Draw −1.0pp, Switzerland +1.9pp.
  Rationale: Switzerland are at full strength with an exceptionally solid qualifying defence (2 goals conceded in 6), while Qatar's competitive form has clearly deteriorated (3 losses in last 4); Elo already partially reflects these results, so only a small same-direction correction is applied.
- **p_final**: Qatar 4.5% / Draw 13.5% / Switzerland 82.0%.
- The 80% intervals reflect drawNu 0.6-0.8 parameter sensitivity (Switzerland baseline ranges 78.5%-81.8%) plus the thinness of pre-tournament evidence.
- **This is a market-blind forecast**: no betting or prediction-market data of any kind is used; probabilities come solely from the Elo/Davidson statistical model plus a bounded evidence-based adjustment.

## 6. Method and Sources

Method: baseline probabilities from eloratings.net Elo ratings via a Davidson three-way model (drawNu=0.7); then a bounded adjustment (max ±8pp total) justified only by dated, sourced facts collected from at most 3 public news searches, renormalized. No betting or prediction-market data is used.

Sources:
1. eloratings.net (World.tsv snapshot, 2026-06-11)
2. Squawka match preview (2026-06): https://www.squawka.com/us/news/world-cup/match-preview-qatar-vs-switzerland-06-13-26-world-cup-2026/
3. ESPN Switzerland squad announcement (2026-06): https://www.espn.com/soccer/story/_/id/48818354/granit-xhaka-captain-switzerland-world-cup-squad
4. olympics.com Switzerland team feature (2026-06): https://www.olympics.com/en/news/fifa-world-cup-2026-switzerland-players-squad-list-key-stats-schedule
5. Levi's Stadium official event page (2026-06): https://levisstadium.com/event/fifa-world-cup-group-stage-2026-06-13/
6. AccuWeather San Francisco June climate (2026-06): https://www.accuweather.com/en/us/san-francisco/94103/june-weather/347629

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
