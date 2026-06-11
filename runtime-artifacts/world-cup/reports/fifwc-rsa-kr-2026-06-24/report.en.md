# South Africa vs Korea Republic — 2026 World Cup Group A (Market-Blind Forecast)

- **Fixture**: 2026 FIFA World Cup, Group A, Matchday 3
- **Kickoff (UTC)**: 2026-06-25T01:00:00Z (evening of June 24 local, Estadio BBVA, Monterrey, Mexico)
- **Generated**: 2026-06-11T13:15:00Z | Event slug (resolution metadata only): `fifwc-rsa-kr-2026-06-24`

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| South Africa win | **16.6%** | 11% – 23% | Medium |
| Draw | **22.9%** | 17% – 29% | Medium |
| Korea Republic win | **60.5%** | 50% – 69% | Medium |

**One-line view**: A 241-point Elo gap makes Korea Republic the clear stronger side at roughly 60%; matchday-3 qualification scenarios add rotation uncertainty, leaving South Africa's combined upset-or-draw probability near 40%.

## 2. Outcome definition

Three-way 90-minute result (including stoppage time): win / draw / loss. No extra time or penalties in the group stage; a draw stands as the final result.

## 3. Team profiles

| Team | Elo (2026-06-11) | Elo rank | Notes |
| --- | --- | --- | --- |
| South Africa | 1517 | 80 | 19 of 26 squad players from the domestic league; coach Hugo Broos (Daily Maverick, 2026-05-27) |
| Korea Republic | 1758 | 33 | Son Heung-min (33, LAFC) captains at his fourth World Cup, in sparkling form (ESPN, May/June 2026) |

Elo source: eloratings.net World.tsv snapshot (fetched 2026-06-11T12:24:51Z).

## 4. Key factors

1. **241-point Elo gap** (1758 vs 1517) is the dominant driver of the baseline probabilities (eloratings.net, 2026-06-11).
2. **Korea midfielder Hwang In-beom (Feyenoord) carries an ankle injury concern** but was still called up by Hong Myung-bo; centre-back Cho Yu-min withdrew injured, replaced by Cho Wi-je on June 2 (Olympics.com, June 2026: https://www.olympics.com/en/news/fifa-world-cup-2026-republic-of-korea-all-players-full-squad-list-key-stats-schedule).
3. **South Africa left-back Aubrey Modiba returned to full training** and is expected fit; no other major absences (The South African, June 2026: https://www.thesouthafrican.com/sport/soccer/soccer-world-cup/bafana-bafana-world-cup-daily-experienced-star-returns-from-injury/).
4. **Both teams play all three group games in Mexico**, so acclimatization is symmetric by matchday 3; Monterrey sits at roughly 540 m altitude — broadly neutral conditions (beIN Sports, 2026-05-16: https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/south-korea-and-heung-min-son-at-the-2026-fifa-world-cup-squad-fixtures-and-everything-to-know-2026-05-16; Wikipedia: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_A).
5. **Matchday-3 stakes are unknown as of 2026-06-11** (matchday 1 still in progress): Korea could rotate if already through, while South Africa may chase points — the main reason the intervals are wide.

## 5. Model and adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neither side a host nation, no host bonus): South Africa 15.6% / Draw 21.9% / Korea 62.5%.
- **Adjustment** (2pp total, within the ±8pp cap): Korea −2pp → South Africa +1pp, Draw +1pp. Rationale: Hwang In-beom's injury concern plus a centre-back loss (factor 2), and asymmetric matchday-3 rotation risk for Korea (factor 5); South Africa has no major absences (factor 3). Evidence is thin overall, so the shift is kept small.
- **p_final**: South Africa 16.6% / Draw 22.9% / Korea Republic 60.5%.
- **This is a market-blind forecast**: fully independent of any betting or prediction-market prices, derived only from the Elo statistical model plus the cited facts above.

## 6. Method

Elo ratings from eloratings.net feed a Davidson three-way probability model (identical to eloToOneXTwo in the repo's packages/sports-model/src/elo.ts: scale=400, drawNu=0.7; +100 Elo host bonus for group matches, not applicable here). A bounded evidence-based adjustment of at most ±8pp is applied on top of the statistical baseline, then renormalized. The 80% intervals reflect drawNu sensitivity (0.6–0.8) plus evidence thinness and unknown matchday-3 stakes.

### Sources

1. eloratings.net World.tsv snapshot, 2026-06-11 — https://www.eloratings.net/World.tsv
2. Daily Maverick — South Africa 26-man squad, 2026-05-27 — https://www.dailymaverick.co.za/article/2026-05-27-here-they-are-the-26-players-representing-sa-at-the-world-cup/
3. The South African — Modiba back in training, June 2026 — https://www.thesouthafrican.com/sport/soccer/soccer-world-cup/bafana-bafana-world-cup-daily-experienced-star-returns-from-injury/
4. ESPN — Korea squad / Son Heung-min, May/June 2026 — https://www.espn.com/soccer/story/_/id/48788433/son-heung-min-south-korea-world-cup-squad-lee-kang-kim-min-jae
5. Olympics.com — Korea injuries and schedule, June 2026 — https://www.olympics.com/en/news/fifa-world-cup-2026-republic-of-korea-all-players-full-squad-list-key-stats-schedule
6. beIN Sports — Korea plays all group games in Mexico, 2026-05-16 — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/south-korea-and-heung-min-son-at-the-2026-fifa-world-cup-squad-fixtures-and-everything-to-know-2026-05-16
7. Wikipedia — 2026 FIFA World Cup Group A (venue: Estadio BBVA, Monterrey) — https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_A

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
