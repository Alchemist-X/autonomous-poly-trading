# Korea Republic vs Czechia — 2026 World Cup Group A (Market-Blind Forecast)

- Match: Korea Republic vs Czechia, Group A, Matchday 1
- Kickoff (UTC): 2026-06-12T02:00:00Z (Estadio Akron, Guadalajara/Zapopan, Mexico; 8pm local on June 11)
- Generated: 2026-06-11T13:15:00Z | Event id (resolution metadata only): `fifwc-kr-cze-2026-06-11`

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Korea Republic win | **0.41** | 0.34 – 0.48 | Medium |
| Draw | **0.26** | 0.21 – 0.31 | Medium |
| Czechia win | **0.33** | 0.27 – 0.40 | Medium |

**One-line view:** Korea hold a slight edge from an 18-point Elo gap and a steadier qualification path, but all three outcomes are close and the draw risk is material.

## 2. Definition

Three-way 90-minute result (including stoppage time): win/draw/loss. Group-stage matches have no extra time or penalties; a level score after regulation is a draw.

## 3. Strength Profile

| | Korea Republic | Czechia |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1758 (rank 33) | 1740 (rank 35) |
| Qualification path | Unbeaten through AFC qualifying (16/18 pts in round 2, 10 unbeaten in round 3); 11th consecutive World Cup | UEFA Path D play-offs: penalty-shootout wins over Ireland and Denmark; first World Cup in 20 years |
| Key players | Son Heung-min (captain, LAFC, fit and in form), Kim Min-jae, Lee Kang-in, Hwang Hee-chan | Schick (top-5 all-time Czech scorer), Soucek, captain Krejci |

Sources: eloratings.net (2026-06-11), Sports Mole preview (accessed 2026-06-11), olympics.com squad pages (2026-05/06).

## 4. Key Factors

1. **Elo gap is only 18 points** (1758 vs 1740): statistically near a coin flip; fine margins decide it. (eloratings.net, 2026-06-11)
2. **Korea's steadier path**: unbeaten direct qualification, while Czechia needed two penalty shootouts in the play-offs — a weaker underlying form signal. (Sports Mole preview, accessed 2026-06-11)
3. **Son Heung-min fit and in form**: named in the squad on 16 May 2026, strong MLS season, scored twice in a recent friendly; Korea's core is healthy with only Bae Jun-ho (ankle) doubtful. (beIN Sports, 2026-05-16; olympics.com/ESPN, 2026-06)
4. **Hlozek recovered for Czechia**: an extra attacking option, but the squad lacks recent major-tournament experience after a 20-year absence. (FIFA.com squad announcement, 2026-05/06)
5. **Neutral venue**: Guadalajara (~1,500 m altitude) is a long trip for both sides; no host bonus applies in the model. (FIFA.com match page, 2026-06)

## 5. Model and Adjustment

- **p_stat (Davidson three-way Elo model, scale=400, drawNu=0.7, no host bonus):** Korea 0.390 / Draw 0.259 / Czechia 0.351
- **Evidence adjustment (bounded at ±8pp):** Korea +2pp, Czechia −2pp, based on factors 2–4. Evidence volume is moderate, so the shift is kept small.
- **p_final (renormalized):** Korea 0.41 / Draw 0.26 / Czechia 0.33
- **This is a market-blind forecast**: probabilities come only from the statistical model plus the cited, dated public evidence; no external trading or pricing information was consulted.

## 6. Method, Sources, Disclaimer

**Method:** Davidson three-way model on same-day eloratings.net Elo (identical to `packages/sports-model/src/elo.ts` eloToOneXTwo), then a bounded (≤±8pp) evidence-based adjustment with renormalization. The 80% intervals reflect drawNu sensitivity over 0.6–0.8 (baseline ranges: Korea win 0.376–0.405, draw 0.231–0.285, Czechia win 0.339–0.365) plus extra widening for evidence thinness.

**Sources:**
- eloratings.net World.tsv (fetched 2026-06-11, local `elo-table.json`)
- Sports Mole match preview: sportsmole.co.uk/football/south-korea/world-cup-2026/preview/south-korea-vs-czech-republic-prediction-team-news-lineups_598881.html (accessed 2026-06-11)
- FIFA.com Czechia squad announcement (Hlozek recovery): fifa.com/en/articles/czechia-world-cup-squad-announced (2026-05/06)
- FIFA.com match page: fifa.com/en/match-centre/match/17/285023/289273/400021441 (2026-06)
- beIN Sports Korea coverage: beinsports.com (2026-05-16)
- olympics.com full squad pages for Korea Republic and Czechia (accessed 2026-06)
- Al Jazeera match report/preview: aljazeera.com/sports/2026/6/11/south-korea-vs-czechia-world-cup-group-match-teams-start-and-lineups (2026-06-11)

**Disclaimer:** This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
