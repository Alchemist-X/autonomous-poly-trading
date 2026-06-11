# Netherlands vs Sweden — 2026 World Cup Group F (Market-Blind Forecast)

- **Match**: 2026-06-20 17:00 UTC, Houston (Group F, matchday 2)
- **Generated**: 2026-06-11 | **Nature**: market-blind (100% independent of any betting/prediction-market data)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Netherlands win | **59.0%** | 53% – 65% | Medium |
| Draw | **23.5%** | 18% – 28% | Medium |
| Sweden win | **17.5%** | 13% – 22% | Medium |

**One-line view**: The Netherlands hold a clear Elo edge and roughly a 60% win probability, but the Timber and Simons absences, a warm-up defeat, and Sweden's Isak–Gyökeres strike pair keep the upset window ajar.

## 2. Definition

Three-way 90-minute result (win/draw/loss); no extra time or penalties in the group stage — a draw stands as the final outcome.

## 3. Strength Profile

| Item | Netherlands | Sweden |
| --- | --- | --- |
| Elo (eloratings.net, 2026-06-11) | 1948 (8th) | 1712 (43rd) |
| Qualification path | Direct (UEFA group) | Play-offs, beat Ukraine and Poland (Opta Analyst) |
| Coach / Captain | Koeman / Van Dijk | Potter (since Oct 2025) / Lindelöf |
| Latest friendlies | 0-1 vs Algeria (Jun 3, ESPN) | 1-3 vs Norway (Jun 1), 2-2 vs Greece (Jun 4, ESPN) |

A 236-point Elo gap marks a clear but not overwhelming mismatch; Sweden's low rating partly reflects a disastrous qualifying group stage, while their front line (Isak, Gyökeres) is stronger than a typical 43rd-ranked side.

## 4. Key Factors

1. **Dutch defensive loss**: Jurrien Timber (groin) ruled out of the World Cup; Lutsharel Geertruida called up (FIFA.com, Jun 2026).
2. **Dutch creativity hit**: Xavi Simons out since April with a ruptured ACL; Frimpong omitted (FourFourTwo, 2026-05-27).
3. **Dutch warm-up defeat**: 0-1 to Algeria in Rotterdam on Jun 3, attack misfiring (ESPN, 2026-06-03).
4. **Sweden's elite forwards**: Gyökeres scored 21 Premier League goals in 2025-26 and the late play-off winner vs Poland (Opta Analyst, 2026).
5. **Isak fitness doubt**: limited minutes after long-term injury; Potter admits recovery is "one step forward, one step back" (ESPN, 2026-05-14).
6. **Sweden's flat warm-ups**: 1-3 to Norway and a stoppage-time 2-2 vs Greece; Potter's system still bedding in (ESPN, 2026-06-01 / 06-04).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way Elo, scale=400, nu=0.7, neutral venue, no host bonus): Netherlands 62.0% / Draw 22.0% / Sweden 16.0%.
- **Delta (6pp total, within the ±8pp cap)**: Netherlands −3.0pp, Draw +1.5pp, Sweden +1.5pp.
  - Rationale: Timber's withdrawal plus Simons' ACL weaken the Dutch starting structure (factors 1–2); Sweden's forward talent exceeds its Elo-rank baseline (factor 4).
  - Counterweights: the Algeria loss and Sweden's mediocre friendlies are already in the Jun 11 Elo snapshot (no double counting); Isak's fitness doubt (factor 5) offsets part of the Sweden uplift.
- **p_final**: Netherlands 59.0% / Draw 23.5% / Sweden 17.5%.
- This is a **market-blind** forecast: no betting odds or prediction-market prices were fetched, read, or referenced; probabilities come solely from the statistical model plus cited evidence.

## 6. Method

Base model: Davidson three-way Elo (identical to `eloToOneXTwo` in `packages/sports-model/src/elo.ts`, scale=400, drawNu=0.7) on the eloratings.net snapshot of 2026-06-11. Evidence adjustment capped at ±8pp, driven only by dated, sourced facts. The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (Dutch win 60.2%–64.1%), adjustment uncertainty, and unknown lineups nine days out.

**Sources**:
1. eloratings.net (snapshot 2026-06-11) — Elo ratings and ranks
2. FIFA.com — Timber out / Geertruida called up (Jun 2026): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/netherlands-call-up-geertruida-jurrien-timber
3. FourFourTwo — Netherlands 26-man squad, Simons ACL (2026-05-27): https://www.fourfourtwo.com/team/netherlands-world-cup-2026-squad
4. ESPN — Netherlands 0-1 Algeria (2026-06-03): https://www.espn.com/soccer/match/_/gameId/401863500/algeria-netherlands
5. ESPN — Sweden roster, Isak fitness (2026-05-14): https://www.espn.com/soccer/story/_/id/48754111/alexander-isak-headlines-final-sweden-world-cup-roster
6. Opta Analyst — Gyökeres form, play-offs, Potter (2026): https://theanalyst.com/articles/sweden-world-cup-2026-preview-gyokeres-isak-potter
7. ESPN — Norway 3-1 Sweden (2026-06-01): https://www.espn.com/soccer/match/_/gameId/401864055/sweden-norway ; Sweden 2-2 Greece (2026-06-04): https://www.espn.com/football/match/_/gameId/401870034/greece-sweden
8. UEFA.com — Sweden fixtures (Houston, Jun 20): https://www.uefa.com/european-qualifiers/news/02a6-20d159618c27-fd6d64ccd5f6-1000--sweden-at-the-world-cup-2026-squad-fixtures-group-and-hi/

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
