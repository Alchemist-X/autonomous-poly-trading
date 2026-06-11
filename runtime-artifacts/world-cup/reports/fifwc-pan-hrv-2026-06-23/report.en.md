# Panama vs Croatia — 2026 World Cup Group L (Market-Blind Forecast)

- **Match**: 2026-06-23 23:00 UTC (BMO Field, Toronto; 7:00 PM ET)
- **Event identifier** (resolution metadata only): `fifwc-pan-hrv-2026-06-23`
- **Generated**: 2026-06-11 · Nature: **market-blind** (fully independent of any odds/market data)

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Panama win | **21.5%** | 15% – 28% | Medium |
| Draw | **24.0%** | 19% – 29% | Medium |
| Croatia win | **54.5%** | 46% – 63% | Medium |

**One-line view**: Croatia's 182-point Elo edge and full-strength squad make them clear favourites on merit, but Panama's strong recent tournament record and quasi-home North American setting keep upset chances non-trivial.

## 2. Definition

90-minute three-way result (win/draw/loss); no extra time in the group stage, stoppage time counts within the 90-minute result.

## 3. Strength Profile

| Team | Elo | Elo rank | Recent form |
| --- | --- | --- | --- |
| Panama | 1730 | 38 | 2025 CONCACAF Nations League finalists; beat South Africa 2-1 in most recent outing (MLSSoccer Group L preview, 2026-06) |
| Croatia | 1912 | 12 | Won 3 of last 5, incl. a positive result vs Colombia in March 2026 (MLSSoccer Group L preview, 2026-06) |

Elo source: eloratings.net (fetched 2026-06-11). Croatia bring deep pedigree (2018 runners-up, 2022 third place); Panama are at their second World Cup. The teams have never met at senior level — this is a first encounter.

## 4. Key Factors

1. **182-point Elo gap**: 1912 vs 1730 yields a ~57% statistical baseline win probability for Croatia (eloratings.net, 2026-06-11).
2. **Modrić fit for a fifth World Cup**: the 40-year-old captain fractured his cheekbone last month but is expected fit for the opener vs England on June 17; minor fitness uncertainty remains (ESPN, 2026-06).
3. **Gvardiol back**: returned for Manchester City on May 14 after a January shin fracture — Croatia's defensive core is intact (ESPN, 2026-05-14).
4. **Panama's creative hub carries an injury question**: Carrasquilla suffered a groin issue in the Liga MX final shortly before the squad announcement (Olympics.com, 2026-05-26).
5. **Quasi-home setting and schedule convenience for Panama**: both of Panama's first two matches are in Toronto (June 18 vs Ghana, June 23 vs Croatia) — no inter-city travel, and CONCACAF sides enjoy North American crowds (FIFA schedule / MLSSoccer preview, 2026-06).
6. **Panama's upward trajectory**: 2023 Gold Cup finalists and 2025 Nations League finalists — a clear step up from their 2018 debut (FIFA team profile, 2026).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus): Panama 19.9% / Draw 23.5% / Croatia 56.7%
- **Adjustment** (~2.2pp net shifted from Croatia toward Panama and the draw — well inside the ±8pp cap):
  - Panama +1.6pp: strong form plus the Toronto quasi-home and same-city scheduling advantage (factors 5, 6)
  - Draw +0.5pp: Croatia's ageing core, Modrić's fresh injury recovery, and a first-ever meeting with little direct information (factor 2)
  - Croatia -2.1pp; Gvardiol's return and squad depth (factor 3) limit the downgrade
  - Carrasquilla's injury concern (factor 4) partially offsets Panama's upgrade, keeping the net adjustment small
- **p_final**: Panama 21.5% / Draw 24.0% / Croatia 54.5%
- This is a **market-blind** forecast: no betting odds or prediction-market prices were fetched, read, or referenced at any point. Probabilities come solely from the Elo statistical model plus a bounded evidence-based adjustment.

## 6. Method, Sources, Disclaimer

**Method**: world Elo ratings from eloratings.net feed a Davidson three-way model (identical to repo `packages/sports-model/src/elo.ts`, scale=400, drawNu=0.7) to produce p_stat; a bounded adjustment (max ±8pp total) based on dated, sourced public facts is then applied and renormalized. The 80% intervals reflect drawNu 0.6–0.8 sensitivity, ±25 Elo uncertainty, and evidence thinness.

**Sources**:
1. eloratings.net World.tsv (fetched 2026-06-11): https://www.eloratings.net/World.tsv
2. ESPN — Modrić's fifth World Cup, injury status, Gvardiol return (2026-06): https://www.espn.com/soccer/story/_/id/48807700/luka-modric-set-5th-world-cup-part-croatia-squad
3. Olympics.com — Panama 26-man squad and Carrasquilla injury (2026-05-26): https://www.olympics.com/en/news/fifa-world-cup-2026-panama-all-players-full-squad-list-key-stats-and-schedule
4. FIFA.com — Panama squad announcement (2026-05-26): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/panama-squad-announcement-thomas-christiansen
5. MLSSoccer.com — Group L preview (form, first meeting, schedule): https://www.mlssoccer.com/competitions/fifa-world-cup/news/2026-fifa-world-cup-group-l-preview-england-croatia-ghana-panama
6. Olympics.com — Croatia squad list and team news (2026-06): https://www.olympics.com/en/news/fifa-world-cup-2026-croatia-players-squad-list-key-stats-schedule

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
