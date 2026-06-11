# Germany vs Côte d'Ivoire — Group E (2026-06-20, Toronto), Market-Blind Forecast

> Generated: 2026-06-11T13:15:00Z | Kickoff: 2026-06-20T20:00:00Z (UTC) | Event identifier (resolution metadata only): `fifwc-ger-civ-2026-06-20`

## 1. Forecast Summary

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Germany win | **63.5%** | 57% – 70% | Medium |
| Draw | **21.5%** | 18% – 26% | Medium |
| Côte d'Ivoire win | **15.0%** | 11% – 20% | Medium |

**One-sentence view:** A 237-point Elo gap plus Germany's five-match winning streak puts Germany near 64%; Côte d'Ivoire arrived unbeaten through qualifying with a settled squad, keeping roughly a 15% upset chance, with the draw around 21%.

## 2. Definition

- Forecast covers the three-way 90-minute (plus stoppage time) result: Germany win / draw / Côte d'Ivoire win.
- World Cup group-stage matches have no extra time or penalties; a draw stands as the final result.
- Venue is Toronto, Canada — neutral for both sides, so no home-advantage bonus is applied.

## 3. Strength Profile

| Metric | Germany | Côte d'Ivoire | Source |
| --- | --- | --- | --- |
| Elo rating | 1932 (No. 10) | 1695 (No. 49) | Internal Elo snapshot `elo-table.json` (based on eloratings.net, 2026-06-11) |
| Recent form | Five straight wins (incl. 4-3 away vs Switzerland on Mar 27; friendlies vs Finland May 31, USA Jun 6) | Unbeaten in CAF Group F qualifying: 8W 2D, +25 goal difference, topped the group | ESPN/Fotmob results pages (accessed 2026-06-11); Olympics.com (accessed 2026-06-11) |
| Background | Four-time World Cup champions, strongest squad in Group E on paper | First finals since 2014; exited at the group stage in all three prior appearances | Olympics.com (accessed 2026-06-11) |

## 4. Key Factors

1. **237-point Elo gap**: 1932 vs 1695 — the pure statistical model alone gives Germany about 62% (eloratings.net snapshot, 2026-06-11).
2. **Germany in strong form with minor knocks**: five straight wins; Lennart Karl withdrew with a thigh muscle-fibre tear (replaced by Ouédraogo) — a rotation-level loss; Neuer's calf strain is expected to clear for the June 14 opener and should be a non-issue by June 20 (Sports Mole / Bundesliga.com, accessed 2026-06-11).
3. **Côte d'Ivoire are no pushovers**: unbeaten qualifying campaign (8W 2D); Kessié, Ndicka, Pépé and Singo all named, with Leipzig's Yan Diomande adding wing depth (FIFA.com squad announcement, accessed 2026-06-11).
4. **Haller omitted**: the experienced target striker was left out of the squad, reducing the fallback option for breaking down deep blocks (Goal.com / FourFourTwo, accessed 2026-06-11).
5. **Schedule context**: both teams play their openers on June 14 (Germany vs Curaçao, Côte d'Ivoire vs Ecuador); this is matchday 2, and opening results may shift qualification pressure — a nine-days-out uncertainty reflected in the intervals, not the point estimates (FIFA fixtures, accessed 2026-06-11).

## 5. Model and Adjustment

- **p_stat (Davidson three-way Elo, scale=400, drawNu=0.7, neutral venue, no host bonus)**: Germany 62.1% / Draw 22.0% / Côte d'Ivoire 15.9%.
- **Evidence adjustment (cap ±8pp; applied total +1.5pp)**: Germany +1.5pp (winning streak plus an intact first-choice core with only fringe injuries; Côte d'Ivoire lack a Haller-type finisher); Draw −0.5pp, Côte d'Ivoire −1.0pp, then renormalized. Evidence is thin and the two sides' positives largely offset (Côte d'Ivoire's unbeaten run is already baked into their Elo), so the shift was deliberately kept small.
- **p_final: Germany 63.5% / Draw 21.5% / Côte d'Ivoire 15.0%.**
- **This is a market-blind forecast**: produced fully independently of any betting line, odds, or prediction-market price; no such data was consulted or cited.

## 6. Method

Probabilities combine: (1) a Davidson three-way model on the eloratings.net snapshot (identical to `eloToOneXTwo` in the repo's `packages/sports-model/src/elo.ts`: piA=10^(Ra/400), draw term ν·√(piA·piB), ν=0.7; the host bonus applies only to Mexico/USA/Canada in home group matches — not applicable here); and (2) a bounded adjustment (±8pp cap) justified only by dated, sourced public facts. The 80% intervals reflect drawNu sensitivity over 0.6–0.8 (Germany win 60.2%–64.2%), ±50 Elo input uncertainty (57.2%–66.8%), and evidence thinness with lineups unsettled nine days out.

### Sources

1. Internal Elo snapshot `runtime-artifacts/world-cup/elo-table.json` (based on eloratings.net, 2026-06-11)
2. Sports Mole — Germany injury news (Karl out / Neuer calf): https://www.sportsmole.co.uk/football/germany/injury-news/news/huge-shock-how-nagelsmann-has-reacted-to-devastating-germany-injury-blow-before-world-cup_598752.html (accessed 2026-06-11)
3. Bundesliga.com — Neuer returns to Germany squad: https://www.bundesliga.com/en/bundesliga/news/germany-squad-world-cup-2026-manuel-neuer-nagelsmann-37487 (accessed 2026-06-11)
4. FIFA.com — Côte d'Ivoire squad announcement: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/cote-divoire-squad-announcement-emerse-fae (accessed 2026-06-11)
5. Olympics.com — Côte d'Ivoire qualifying record and schedule: https://www.olympics.com/en/news/fifa-world-cup-2026-cote-ivoire-all-players-full-squad-list-key-stats-schedule (accessed 2026-06-11)
6. FourFourTwo — Germany 26-man squad: https://www.fourfourtwo.com/team/germany-world-cup-2026-squad (accessed 2026-06-11)
7. ESPN — Germany 2026 results: https://www.espn.com/soccer/team/results/_/id/481/germany (accessed 2026-06-11)

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
