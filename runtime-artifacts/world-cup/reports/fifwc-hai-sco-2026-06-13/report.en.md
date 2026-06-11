# Haiti vs Scotland (2026 World Cup, Group C) — Market-Blind Forecast

- Match: 2026-06-13 (21:00 ET) / UTC 2026-06-14T01:00:00Z
- Venue: Gillette Stadium, Foxborough, Massachusetts (neutral ground)
- Event identifier (resolution metadata only): `fifwc-hai-sco-2026-06-13`
- Generated: 2026-06-11T13:15:00Z

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Haiti win | **18.5%** | 14% – 24% | Medium |
| Draw | **23.5%** | 19% – 28% | Medium |
| Scotland win | **58.0%** | 51% – 65% | Medium |

**One-line view:** Scotland are clear favourites on a 234-point Elo gap, but Gilmour's tournament-ending injury, Adams' fitness doubt, and a Haiti squad upgraded beyond its Elo justify trimming Scotland slightly below the raw model.

## 2. Definition

Three-way 90-minute result (incl. stoppage time, excl. extra time/penalties); no extra time in the group stage. Mutually exclusive outcomes: Haiti win / Draw / Scotland win.

## 3. Strength Profile

| | Haiti | Scotland |
| --- | --- | --- |
| Elo (2026-06-11, eloratings.net) | 1548 (rank 73) | 1782 (rank 26) |
| World Cup history | 2nd finals ever, first since 1974 | First in 28 years (since 1998) |
| Qualifying | 6 wins in 10, 20 goals scored | Topped group 4W-1D-1L, beat Denmark 4-2 in finale |
| Warm-ups | 4-0 vs New Zealand, then 1-2 vs Peru | 4-1 friendly win vs Curacao (May 30) |

Sources: eloratings.net (via repo elo-table.json, fetched 2026-06-11); Sky Sports Group C guide <https://www.skysports.com/football/news/12098/13543087/>; Olympics.com Haiti page <https://www.olympics.com/en/news/fifa-world-cup-2026-haiti-players-squad-list-key-stats-schedule>.

## 4. Key Factors

1. **Scotland midfielder Billy Gilmour (Napoli) is out of the entire tournament** (injured 2026-05-30 in the Curacao friendly, replaced by Tyler Fletcher) — weakens midfield control. ESPN <https://www.espn.com/soccer/story/_/id/48814281/>, 2026-06.
2. **Forward Che Adams (Torino) faces a fitness race** after a thigh injury. ESPN <https://www.espn.com/soccer/story/_/id/48701669/>, 2026-06.
3. **Robertson and McTominay are both fit and selected**; McTominay scored a bicycle kick vs Denmark in the qualifying finale. ESPN <https://www.espn.com/soccer/story/_/id/48814281/>, 2026-06.
4. **Haiti reinforced by European-based diaspora recruits**: Wilson Isidor (Sunderland, switched from France, debut March 2026) and Jean-Ricner Bellegarde (Wolves) — Elo lags these additions. Haitian Times <https://haitiantimes.com/2026/05/16/haiti-team-roster-2026-fifa-world-cup/>, 2026-05-16.
5. **Haiti's talisman Duckens Nazon** (all-time top scorer, 44 goals in 76 caps; 6 in qualifying incl. a hat-trick vs Costa Rica). FourFourTwo <https://www.fourfourtwo.com/team/haiti-world-cup-2026-squad>, 2026-06.
6. **Stakes**: with Brazil and Morocco in the group, both sides realistically target a best-third-place berth — this match is pivotal for both, so full motivation on each side. Sky Sports <https://www.skysports.com/football/news/12098/13543087/>, 2026-06.

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus): Haiti 16.1% / Draw 22.1% / Scotland 61.8%.
- **Adjustment (total ≤ ±8pp)**: Scotland −4.0pp (Gilmour out + Adams doubt); Haiti +2.5pp, Draw +1.5pp (diaspora upgrades not yet in Elo, decent warm-up form). Shifts sum to zero; no renormalization needed.
- **p_final**: Haiti 18.5% / Draw 23.5% / Scotland 58.0%.
- **This is a market-blind forecast**: fully independent of any betting line, odds, or prediction-market price; produced solely from the statistical model plus cited evidence-based adjustment.

## 6. Method, Sources, Disclaimer

**Method**: eloratings.net world Elo feeds a Davidson three-way draw model (drawNu=0.7) for the baseline; a bounded adjustment of at most ±8pp is applied only on dated, sourced public facts. The 80% intervals reflect parameter sensitivity (drawNu 0.6–0.8 moves each leg roughly ±1–3pp) and evidence thinness (Haiti's true strength is highly uncertain after the squad overhaul).

**Sources**:
1. eloratings.net World.tsv (via repo elo-table.json, fetched 2026-06-11)
2. Sky Sports — World Cup 2026 Group C guide (2026-06)
3. ESPN — Scotland World Cup squad announced (2026-06)
4. ESPN — Scotland at the 2026 World Cup hub (2026-06)
5. Olympics.com — Haiti at FIFA World Cup 2026 (2026-06)
6. Haitian Times — Haiti unveils 2026 FIFA World Cup roster (2026-05-16)
7. FourFourTwo — Haiti World Cup 2026 squad (2026-06)
8. FOX Sports — Haiti World Cup 2026 schedule (venue and kickoff, 2026-06)

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
