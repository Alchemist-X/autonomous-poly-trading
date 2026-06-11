# Market-Blind Forecast: Scotland vs Brazil (2026 World Cup Group C, Match 49)

- Generated: 2026-06-11T13:15:00Z | Kickoff: 2026-06-24T22:00:00Z (Hard Rock Stadium, Miami; 18:00 local)
- Event slug (resolution metadata only): `fifwc-sco-bra-2026-06-24`

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Scotland win | **15.8%** | 11% – 21% | Medium |
| Draw | **23.3%** | 19% – 28% | Medium |
| Brazil win | **60.9%** | 53% – 68% | Medium |

**One-line view**: A 209-point Elo gap, Scotland losing midfield hub Billy Gilmour, and Brazil's deep squad with Neymar expected back during the group stage give Brazil roughly a 60% win probability; a Scotland upset would likely require a low-event defensive game.

## 2. Definition

Three-way 90-minute result (win/draw/loss). No extra time or penalties in the group stage; stoppage time counts toward the 90-minute result.

## 3. Strength Profile

| Metric | Scotland | Brazil |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1782 (#26) | 1991 (#5) |
| Head coach | Steve Clarke | Carlo Ancelotti |
| Recent form | Chasing first-ever group-stage exit progression (Sky Sports, 2026-06) | Ancelotti 7W-2D-3L in 12; latest a 2-1 win over Egypt (Al Jazeera, 2026-05-28) |
| Pedigree | Never past the group stage | Five-time champions |

Venue: Hard Rock Stadium, Miami Gardens — neutral ground (neither side is a host nation; no home bonus in the model). Scotland's base camp is in Charlotte, NC (ESPN, 2026-06).

## 4. Key Factors

1. **Billy Gilmour ruled out of the World Cup with a knee injury**, replaced by Tyler Fletcher — Scotland lose their midfield distribution hub (Scottish FA, 2026-06).
2. **Ché Adams in a fitness race with a thigh injury**, limiting Scotland's forward options (ESPN / The Scotsman, 2026-06).
3. **Neymar has a grade 2 muscle strain (2-3 weeks out)**; Ancelotti: "If he's not fit for the first match, he'll be fit for the second" — likely available by matchday 3 on June 24, though sharpness is uncertain (ESPN, 2026-06).
4. **Brazil's 26-man squad is exceptionally deep**: Vinicius Jr, Raphinha, Casemiro, Bruno Guimaraes, Matheus Cunha, Martinelli all included; Ederson replaced the injured Wesley (FourFourTwo / beIN, 2026-05-18 to 2026-06-07).
5. **Matchday-3 dynamics**: Brazil face Morocco and Haiti first; if already qualified they may rotate, marginally helping the draw and Scotland — schedule inference only, so only a small adjustment (FIFA fixtures, 2026-06).
6. **Miami heat and humidity at an 18:00 local June kickoff** is a bigger adaptation challenge for Scotland than for Brazil (venue/kickoff are public schedule facts; impact treated conservatively).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Scotland 17.8% / Draw 22.8% / Brazil 59.4%
- **Evidence-based adjustment (total |delta| ~4pp, cap +-8pp)**:
  - Scotland -2.0pp: Gilmour out + Adams doubt (factors 1-2)
  - Brazil +1.5pp: full squad depth, Neymar likely back (factors 3-4)
  - Draw +0.5pp: potential Brazil matchday-3 rotation (factor 5)
- **p_final**: Scotland 15.8% / Draw 23.3% / Brazil 60.9%
- The 80% intervals reflect drawNu 0.6-0.8 sensitivity (draw +-2.5pp), Elo input uncertainty (+-25-50 points), and the fact that lineups and qualification stakes are unsettled 13 days out.
- **This is a market-blind forecast**: fully independent of any betting line, odds, or prediction-market price; no such data was consulted or cited.

## 6. Method and Sources

Method: same-day Elo from eloratings.net fed into a Davidson three-way model (identical to `packages/sports-model/src/elo.ts` eloToOneXTwo in this repo) for the statistical baseline, then a bounded adjustment of at most +-8pp justified only by dated, sourced public facts, renormalized. No betting or prediction-market data is used.

Sources:
1. eloratings.net World.tsv (fetched 2026-06-11, `elo-table.json`)
2. Scottish FA — FIFA World Cup 2026 squad update (Gilmour out): https://www.scottishfa.co.uk/en/news/fifa-world-cup-2026-squad-update (2026-06)
3. ESPN — Scotland at the 2026 World Cup (schedule/base camp/Adams): https://www.espn.com/soccer/story/_/id/48701669/ (2026-06)
4. ESPN — Ancelotti on Neymar injury (grade 2 strain, return window): https://www.espn.com/soccer/story/_/id/48922562/ (2026-06)
5. FourFourTwo — Brazil World Cup 2026 squad: https://www.fourfourtwo.com/team/brazil-world-cup-2026-squad (2026-06)
6. beIN Sports — Brazil official squad (2026-05-18): https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/carlo-ancelotti-s-official-brazil-squad-for-the-2026-fifa-world-cup-2026-05-18
7. Al Jazeera — Brazil team preview (Ancelotti record, form, 2026-05-28): https://www.aljazeera.com/sports/2026/5/28/brazils-world-cup-2026-team-preview-players-to-watch-group-matches-squad
8. Sky Sports — Scotland at World Cup 2026 (Clarke's goal, 2026-06): https://www.skysports.com/football/news/36621/13551871/

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
