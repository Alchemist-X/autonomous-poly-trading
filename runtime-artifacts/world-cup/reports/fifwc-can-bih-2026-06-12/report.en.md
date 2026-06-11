# Canada vs Bosnia-Herzegovina (2026 World Cup Group B, 2026-06-12) — Market-Blind Forecast

> Generated: 2026-06-11T13:15:00Z | Kickoff: 2026-06-12T19:00:00Z (BMO Field, Toronto)
> This is a **market-blind** forecast: fully independent of any betting market, odds, or prediction-market prices. Based solely on a public statistical model plus news evidence.

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Canada win | **63%** | 55% – 70% | Medium |
| Draw | **23%** | 17% – 28% | Medium |
| Bosnia-Herzegovina win | **14%** | 9% – 20% | Medium |

**One-line view**: A ~193-point Elo gap plus home advantage makes host Canada the clear favorite on paper, but with captain Alphonso Davies set to miss the opener, the win probability is revised down to the low 60s.

## 2. Definition

- Target: three-way result after 90 minutes (no extra time in the group stage), including stoppage time.
- Event slug (resolution metadata only): `fifwc-can-bih-2026-06-12`.

## 3. Strength Profile

| Metric | Canada | Bosnia-Herzegovina |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1788 (rank 25) | 1595 (rank 65) |
| Head coach | Jesse Marsch | Sergej Barbarez |
| Recent form | Unbeaten in 2026, 8-match unbeaten run (Sports Mole, 2026-06-10) | Unbeaten in last 8, but both playoff wins came on penalties (Yahoo Sports preview, 2026-06-11) |
| Warm-up friendlies | — | 0-0 vs North Macedonia, 1-1 vs Panama; blunt attack (ESPN, 2026-06-10) |

As a host nation playing its group match at home in Toronto, Canada receives the standard +100 Elo home adjustment (RaEff = 1888).

## 4. Key Factors

1. **Davies expected to miss the opener**: left hamstring injury (sustained May 6 in the Champions League vs PSG); Marsch hopes he returns for group match 2 or 3 (Yahoo Sports / FOX Sports, 2026-06-10). Canada loses its captain and biggest attacking threat.
2. **Canadian defensive absences**: Moise Bombito (tibia, not fully recovered) unlikely to feature; Marcelo Flores ruptured his ACL and was replaced by Jayden Nelson (Sports Mole, 2026-06-10).
3. **Bosnia's blunt attack**: one goal across two friendlies (0-0 North Macedonia, 1-1 Panama); attack led by 40-year-old Edin Dzeko alongside Demirovic, with Tabakovic (ankle) unlikely to play (ESPN 2026-06-10; Fantasy Football Scout 2026-06-08).
4. **Home stage**: BMO Field hosts Canada's first home World Cup opener; Toronto stages six World Cup matches (TSN, 2026-06).
5. **Both sides in form**: each team is on an 8-match unbeaten run; Bosnia's floor is solid, so the draw risk is non-trivial.

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, +100 host adjustment for Canada):
  Canada 67.3% / Draw 20.3% / Bosnia 12.5%
- **Evidence adjustment (total |delta| = 4pp, within the 8pp cap)**:
  - Canada −4pp: Davies absent (the most load-bearing fact) plus Bombito out lowers the hosts' ceiling;
  - Draw +2.5pp, Bosnia +1.5pp: Bosnia's unbeaten resilience and Canada's reduced attacking edge shift some mass to stalemate/upset.
- **p_final**: Canada 63.3% / Draw 22.8% / Bosnia 14.0% (published as 63/23/14).
- The 80% intervals reflect parameter sensitivity (drawNu 0.6–0.8 moves Canada's win probability 65.4%–69.3%; host bonus ±35 moves it 64.1%–70.2%) plus uncertainty about the magnitude of the Davies effect.
- This is a market-blind forecast with **no market leg**; p_final is the published number.

## 6. Method

World Elo ratings from eloratings.net feed a Davidson three-way model (identical to `packages/sports-model/src/elo.ts` eloToOneXTwo: scale=400, drawNu=0.7); host nations get +100 Elo for group matches played at home; a bounded (max ±8pp) evidence-based adjustment with dated sources is then applied and renormalized. No betting-market or odds data was read or cited at any point.

### Sources

1. eloratings.net World.tsv (via local elo-table.json, fetched 2026-06-11)
2. ESPN match preview — https://www.espn.com/soccer/story/_/id/48972712/fifa-world-cup-2026-canada-vs-bosnia-herzegovina-kickoff-how-watch-stats-team-news (2026-06-10)
3. Sports Mole preview — https://www.sportsmole.co.uk/football/canada/world-cup-2026/preview/canada-vs-bosnia-hvina-prediction-team-news-lineups_598907.html (2026-06-10)
4. Yahoo Sports: impact of Davies' absence — https://sports.yahoo.com/articles/why-alphonso-davies-missing-2026-213721175.html (2026-06-10)
5. FOX Sports: Davies named to squad despite injury — https://www.foxsports.com/stories/soccer/alphonso-davies-named-to-canadas-world-cup-squad-despite-hamstring-injury (2026-06)
6. Fantasy Football Scout: Bosnia-Herzegovina team preview — https://www.fantasyfootballscout.co.uk/2026/06/08/fantasy-fifa-world-cup-2026-team-previews-bosnia-herzegovina (2026-06-08)
7. TSN: six World Cup matches at Toronto Stadium — https://www.tsn.ca/soccer/fifa-world-cup/article/a-snapshot-look-at-the-six-fifa-world-cup-games-to-be-played-at-toronto-stadium/ (2026-06)

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
