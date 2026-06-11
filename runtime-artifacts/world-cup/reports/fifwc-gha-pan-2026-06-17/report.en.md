# Ghana vs Panama — 2026 World Cup Group L (Market-Blind Forecast)

- **Fixture**: FIFA World Cup 2026 group stage, Group L (also in group: England, Croatia)
- **Kickoff**: 2026-06-17T23:00:00Z (BMO Field, Toronto; 19:00 local, June 17)
- **Generated**: 2026-06-11 | **Resolution metadata**: `fifwc-gha-pan-2026-06-17`

## 1. Forecast Summary

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Ghana win | **15.5%** | 11% – 21% | Medium |
| Draw | **23.0%** | 18% – 28% | Medium |
| Panama win | **61.5%** | 54% – 69% | Medium |

**One-line view**: The Elo gap (Panama 1730 vs Ghana 1510) and squad news point the same way — Ghana is missing Kudus/Salisu with Partey doubtful and a coach hired in April; Panama wins roughly six times in ten, with the draw the main hedging outcome.

## 2. Definition

Three-way 90-minute result (win/draw/loss); group-stage matches have no extra time or penalties, stoppage time counts within the 90-minute result.

## 3. Strength Profile

| Team | Elo (2026-06-11 snapshot) | Elo rank | Recent picture |
| --- | --- | --- | --- |
| Ghana | 1510 | 81 | Lost 1-5 to Austria and 1-2 to Germany in March 2026; no win vs a European/South American side since Nov 2022 (SI, 2026-05-14) |
| Panama | 1730 | 38 | Stable setup under Christiansen; 26-man squad named May 26, led by record cap-holder Godoy (157 caps) (FIFA/Newsroom Panama, 2026-05-26) |

Elo source: eloratings.net World.tsv snapshot (repo `elo-table.json`, fetched 2026-06-11).

## 4. Key Factors

1. **Ghana's two pillars out**: Kudus (quadriceps injury setback) and Salisu (January ACL rupture) both miss the tournament (ESPN, squad announcement, 2026-06).
2. **Partey doubtful**: groin tightness has heavily restricted his training intensity and match readiness (ESPN/Ghanaian media, 2026-06).
3. **Late coaching change**: Otto Addo was dismissed about 72 days before the tournament; Carlos Queiroz took over in April 2026, leaving chaotic preparation (SI, 2026-05-14).
4. **Ghana still has weapons**: Semenyo (Manchester City, February Premier League Player of the Month) and Iñaki Williams remain, limiting downside collapse (ESPN, 2026-06).
5. **Panama's own concern**: creative midfielder Carrasquilla picked up a groin issue around the Liga MX final (Yahoo Sports, 2026-05/06).
6. **Neutral venue**: Toronto is neutral ground — no host bonus for either side; both treat this as the key match for second place / best-third hopes (FOX Sports schedule, 2026-06).

## 5. Model and Adjustment

- **p_stat (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus)**:
  Ghana 17.1% / Draw 22.5% / Panama 60.5%.
- **Evidence-based adjustment (within the ±8pp cap; actual ~±1.5pp)**:
  - Ghana −1.5pp, Panama +1.0pp, Draw +0.5pp.
  - Rationale: the Kudus/Salisu absences and Partey doubt are squad-level information Elo cannot see (Elo encodes results, not team sheets), compounded by coaching upheaval — a mild negative for Ghana. But Ghana's recent heavy defeats are already largely priced into the 1510 rating (avoiding double-counting), and Panama's Carrasquilla concern partially offsets, so the shift is deliberately conservative.
- **p_final**: Ghana 15.5% / Draw 23.0% / Panama 61.5%.
- **This is a market-blind forecast**: fully independent of any betting line, odds, or prediction-market price; no bookmaker or market data was consulted.

## 6. Method

Elo ratings from eloratings.net feed a Davidson three-way model (identical to `eloToOneXTwo` in repo `packages/sports-model/src/elo.ts`: scale=400, drawNu=0.7) to produce a statistical baseline; dated, sourced public news then drives a bounded adjustment of at most ±8pp, renormalized. The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (baseline ranges: Ghana 16.5–17.6%, Draw 19.9–24.9%, Panama 58.6–62.5%) plus additional widening for evidence thinness and lineup uncertainty.

### Sources

1. eloratings.net World.tsv snapshot (elo-table.json, fetched 2026-06-11): https://www.eloratings.net/World.tsv
2. ESPN: Ghana squad — Kudus/Salisu out, Partey doubtful (2026-06): https://www.espn.com/espn/story/_/id/48878999/antoine-semenyo-thomas-partey-headline-ghana-provisional-fifa-world-cup-squad-injured-mohammed-kudus-out
3. Sports Illustrated: Ghana's chaotic preparation, March friendly results, coaching timeline (2026-05-14): https://www.si.com/soccer/ghana-2026-world-cup-preview
4. FIFA.com: Panama squad announcement (2026-05-26): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/panama-squad-announcement-thomas-christiansen
5. Newsroom Panama: Panama 26-man squad details (2026-05-26): https://newsroompanama.com/2026/05/26/the-26-players-called-up-for-the-2026-world-cup-the-panama-national-football-team/
6. Yahoo Sports: Panama squad and Carrasquilla injury concern (2026-05/06): https://sports.yahoo.com/articles/panama-2026-world-cup-squad-064000504.html
7. FOX Sports: schedule and venue confirmation (2026-06): https://www.foxsports.com/stories/soccer/ghana-world-cup-2026-schedule-locations-dates-times

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
