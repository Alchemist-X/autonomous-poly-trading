# 2026 World Cup Group G Winner Forecast (Belgium / Egypt / Iran / New Zealand)

> Market-blind research report: this forecast is fully independent of any betting/prediction-market data. Probabilities come solely from an Elo Monte Carlo statistical model plus a bounded evidence-based adjustment. Generated: 2026-06-11T13:15:00Z.

## 1. Conclusion: Group G winner probabilities

| Team | Statistical baseline | Adjustment | Final probability |
| --- | --- | --- | --- |
| Belgium | 67.65% | −3.0pp | **64.65%** |
| Iran | 22.29% | +1.5pp | **23.79%** |
| Egypt | 8.89% | +1.5pp | **10.39%** |
| New Zealand | 1.17% | 0 | **1.17%** |

**One-sentence view:** Belgium's clear Elo edge makes it the most likely Group G winner (~65%), but fitness doubts over Lukaku, De Bruyne and Courtois leave Iran (~24%) genuine room for an upset.

## 2. Definition

"Group G winner" = the team finishing 1st in the final FIFA 2026 World Cup Group G standings. Ranking criteria in order: points → goal difference → goals scored → head-to-head among tied teams → fair-play points → drawing of lots. Group G fixtures: Jun 15 Belgium–Egypt, Iran–New Zealand; Jun 21 Belgium–Iran, New Zealand–Egypt; Jun 26 Egypt–Iran, New Zealand–Belgium.

## 3. Team notes (Elo / form / schedule angles only)

- **Belgium (Elo 1894, world #15):** A tier above the group by Elo (122 points clear of second-ranked Iran), with all three opponents clearly weaker — the most likely group winner. The caveat is the fitness of its core: Lukaku has played barely an hour of competitive club football this season due to recurring muscle injuries, De Bruyne was sidelined at Napoli with an eye injury late in the season, and Courtois is coming off an injury-disrupted run — the basis for the −3pp adjustment.
- **Iran (Elo 1772, world #29):** Second strongest in the group; final squad announced on schedule on Jun 1 with an intact preparation cycle. The key variable is the Jun 21 head-to-head with Belgium in Los Angeles: if Belgium's attack misfires, winning that match would very likely hand Iran top spot — hence +1.5pp of the redistributed share.
- **Egypt (Elo 1696, world #48):** Salah captains the side, and a front line with Manchester City's Marmoush is of higher quality than Egypt's Elo rank reflects (Elo mostly encodes its defensive, low-scoring qualifying profile); the squad is fully fit with no selection controversy, +1.5pp. The path to first place still requires beating Belgium directly on Jun 15 — a tall order.
- **New Zealand (Elo 1562, world #72):** Weakest in the group by a margin of over 130 Elo points to every opponent; a roughly 1% winner probability, with no evidence supporting any adjustment.

## 4. Method

1. **Statistical baseline:** Pure-Elo Poisson Monte Carlo, 100,000 full-tournament simulations (seed 20260611), ratings from the eloratings.net snapshot of 2026-06-11. Match goals are independent Poissons whose rates split a 2.6-goal baseline via the Elo logistic expectancy; hosts (MEX/USA/CAN) get +100 Elo in group matches only; group ranking simulated as points → goal difference → goals scored → head-to-head mini-table among tied teams → random draw. The model contains no market input of any kind.
2. **Bounded adjustment:** capped at ±4pp absolute per team, with cited evidence only. This run: Belgium −3.0pp (core-player fitness evidence), Iran +1.5pp and Egypt +1.5pp (direct beneficiary + intact-squad evidence); the deltas net to zero, so the distribution still sums to 1.

## Sources

1. eloratings.net World.tsv snapshot (2026-06-11, archived locally as elo-table.json) — Elo ratings and ranks for all four teams
2. FotMob, "De Bruyne and Lukaku named in Belgium World Cup squad despite injuries" (squad named 2026-05-15) — https://www.fotmob.com/news/18d3fh2himo601nk0xh84p4fky-de-bruyne-lukaku-named-belgium-world-cup-squad-despite-injuries
3. The Analyst (Opta), Belgium World Cup 2026 preview — https://theanalyst.com/articles/belgium-next-golden-generation-world-cup-2026-preview
4. Al Jazeera, "Mohamed Salah to captain Egypt as squad announced" (2026-05-21) — https://www.aljazeera.com/sports/2026/5/21/mohamed-salah-to-captain-egypt-as-squad-announced-for-fifa-world-cup-2026
5. Olympics.com, Egypt squad list and schedule — https://www.olympics.com/en/news/fifa-world-cup-2026-mohamed-salah-and-egypt-chase-first-ever-quarter-final-berth-all-players-full-squad-list-key-stats-and-schedule
6. Wikipedia, "2026 FIFA World Cup squads" (squad announcement dates incl. Iran's final list on Jun 1) — https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads

## Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
