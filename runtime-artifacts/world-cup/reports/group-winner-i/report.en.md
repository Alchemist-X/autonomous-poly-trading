# 2026 World Cup Group I Winner Forecast (France / Norway / Senegal / Iraq)

Generated: 2026-06-11T13:15:00Z | Method: pure-Elo Monte Carlo + bounded evidence adjustment | No market data of any kind

## 1. Conclusion

| Team | Statistical baseline | Adjusted probability |
| --- | --- | --- |
| France | 70.4% | **72.2%** |
| Norway | 19.2% | **17.2%** |
| Senegal | 10.1% | **10.4%** |
| Iraq | 0.3% | **0.3%** |

**One-sentence view:** A full-strength France (Mbappé fit and named captain, Saliba's fitness doubts cleared) sits ~150 Elo points above Norway and wins Group I in about 72% of simulations; Norway bring an in-form Haaland, but Ødegaard's injury-plagued season is a genuine drag.

## 2. Definition

"Group I winner" = first place in the final Group I standings of the 2026 FIFA World Cup group stage. Ranking criteria in order: **points → goal difference → goals scored → head-to-head among tied teams → fair-play points → drawing of lots**.

## 3. Team notes (Elo / form / schedule angle)

- **France (Elo 2063, world No. 3):** Clear Elo leader of the group (+149 over Norway, +203 over Senegal). Final squad is at full strength — Mbappé recovered from injury scares and was named captain, and Deschamps explicitly dismissed Saliba fitness fears; Camavinga and Kolo Muani missing out reflects depth, not crisis. If France take care of Senegal and Iraq first, the matchday-3 meeting with Norway (June 26) may matter less for first place.
- **Norway (Elo 1914, world No. 11):** Back at a World Cup after 28 years. Haaland — 55 international goals, 16 in qualifying — is confirmed fit and leads the squad; but chief creator Ødegaard suffered at least five separate injuries this season and missed the March friendlies, and Norway's creativity depends heavily on his health. This is the basis for the only downward adjustment (−2pp).
- **Senegal (Elo 1860, world No. 21):** A top-tier African side with real physical solidity; to win the group they most likely need points against France in the opener (June 16), otherwise they must beat Norway directly on matchday 2 (June 22) and win a goal-difference race.
- **Iraq (Elo 1607, world No. 63):** 250+ Elo points behind the other three with tough opponents in all three rounds; group-winner probability is near zero (0.3%).

## 4. Method

1. **Statistical baseline:** 100,000 full-tournament Monte Carlo simulations (seed 20260611) on a pure-Elo Poisson goals model built from the eloratings.net snapshot of 2026-06-11 — both teams' goals are independent Poissons whose lambdas split a 2.6-goal baseline by the Elo logistic win expectancy; group ranking uses points → goal difference → goals scored → head-to-head among fully tied teams → random draw; no market input of any kind. The host-nation Elo bonus applies only to the hosts' group matches and does not affect this group.
2. **Bounded adjustment (max ±4pp per team):** The only evidence-driven adjustment is Norway −2pp (Ødegaard fitness uncertainty, source 6); the released mass is redistributed proportionally to the other three teams and the vector renormalized to 1 (France +1.7pp, Senegal +0.3pp, Iraq +0.0pp).
3. **Uncertainty:** Confidence tier "Medium" — the direction is clear (France well ahead), but the magnitude is exposed to single-match variance in the direct France–Norway meeting on matchday 3.

## Sources

1. Elo rating snapshot: https://www.eloratings.net/World.tsv (fetched 2026-06-11; repo `elo-table.json`)
2. Simulation artifact: `runtime-artifacts/world-cup/mc-results.json` (2026-06-11, 100k sims); fixtures per `runtime-artifacts/world-cup/event-list/questions.json`
3. ESPN: France final squad — Mbappé included and named captain; Camavinga, Kolo Muani left out (announced 2026-05-14, accessed 2026-06-11) https://www.espn.com/soccer/story/_/id/48771039/france-2026-world-cup-squad-mbappe-camavinga-kolo-muani-dembele
4. FOX Sports: Deschamps dismisses Saliba injury fears (accessed 2026-06-11) https://www.foxsports.com/stories/soccer/william-saliba-hands-france-massive-injury-lift-as-didier-deschamps-issues-blunt-selection-warning-over-ousmane-dembele
5. CBC: Mbappé World Cup-bound after injury scares (accessed 2026-06-11) https://www.cbc.ca/sports/soccer/worldcup/injuries-2026-fifa-world-cup-messi-mbappe-yamal-davies-9.7221543
6. Al Jazeera: Norway preview — Ødegaard suffered at least five injuries this season, missed March friendlies (2026-05-26) https://www.aljazeera.com/sports/2026/5/26/norway-world-cup-2026-preview-players-to-watch-group-matches-squad-list
7. FIFA.com: Norway 26-man squad announcement, Haaland and Ødegaard headline (accessed 2026-06-11) https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/norway-squad-announcement-stale-solbakken
8. Olympics.com: Haaland 55 international goals, 16 in qualifying; Norway back after 28 years (accessed 2026-06-11) https://www.olympics.com/en/news/fifa-world-cup-2026-norway-all-players-full-squad-list-key-stats-and-schedule

## Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
