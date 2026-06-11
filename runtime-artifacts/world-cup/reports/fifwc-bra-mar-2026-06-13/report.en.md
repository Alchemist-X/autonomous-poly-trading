# World Cup Group C: Brazil vs Morocco (2026-06-13) — Market-Blind Forecast

> Generated: 2026-06-11T13:15:00Z | Kickoff: 2026-06-13T22:00:00Z (18:00 EDT, MetLife Stadium, New Jersey)
> This is a **market-blind** forecast: fully independent of any betting odds or prediction-market prices; based solely on a public statistical model plus sourced news evidence.

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Brazil win | **57.8%** | 49% – 66% | Medium |
| Draw | **22.9%** | 19% – 27% | Medium |
| Morocco win | **19.3%** | 14% – 25% | Medium |

**One-sentence view:** Brazil hold the Elo and warm-up-form edge while Morocco lost two squad players within 48 hours of kickoff; we favour Brazil at ~58%, though Morocco's defensive resilience keeps the draw and upset live.

## 2. Definition

- Target: 90-minute three-way result (win/draw/loss); no extra time in the group stage.
- Event metadata (resolution reference only): `fifwc-bra-mar-2026-06-13`.

## 3. Team Profiles

| Team | Elo (2026-06-11) | Elo rank | Recent form |
| --- | --- | --- | --- |
| Brazil | 1991 | 5 | Warm-up wins over Panama and Egypt (2-1 vs Egypt on Jun 6); Ancelotti's 4-3-3 settled |
| Morocco | 1827 | 24 | 1-1 final warm-up draw vs Norway, with three players injured in that match (two withdrawn from squad) |

Sources: eloratings.net (fetched 2026-06-11); ESPN (2026-06-10); Morocco World News (2026-06-08).

## 4. Key Factors

1. **Major late losses for Morocco**: winger Ezzalzouli out of the World Cup with a right-knee MCL sprain (Sbai called up); starting centre-back Aguerd also withdrawn injured (Saadane replaces him) — both within 48 hours of kickoff (Morocco World News, 2026-06-11; ESPN, 2026-06-11).
2. **Mazraoui shoulder doubt but expected to play**: Morocco optimistic on his recovery after the Norway match (ESPN, 2026-06-09).
3. **Brazil missing Neymar, but not a core starter**: Neymar (calf) out of the opener, targeted for the Haiti match on Jun 20; Militão, Rodrygo and Estêvão ruled out earlier (ESPN, 2026-06-10).
4. **Brazil's settled XI and form**: the 2-1 win over Egypt on Jun 6 confirmed the 4-3-3 framework (Casemiro single pivot, Vinicius/Raphinha wide); two warm-up wins (ESPN, 2026-06-10).
5. **Neutral venue**: MetLife Stadium, New Jersey — neither side is a host, so no home-advantage bonus in the model (ESPN, 2026-06-10).

## 5. Model and Adjustment

- **p_stat (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus)**:
  Brazil 54.8% / Draw 23.9% / Morocco 21.3% (Elo 1991 vs 1827, gap 164).
- **Evidence adjustment (cap ±8pp; ~±3pp applied)**:
  - Morocco's last-minute loss of a starting centre-back plus a rotation winger, and Mazraoui's knock: Morocco -2pp, Draw -1pp;
  - Partially offset by Brazil's own absences (Neymar/Militão/Rodrygo), so the net shift is kept conservative: Brazil +3pp.
- **p_final (renormalized)**: Brazil 57.8% / Draw 22.9% / Morocco 19.3%.
- The 80% intervals reflect parameter sensitivity (drawNu 0.6–0.8, ±35 Elo noise on both ratings) plus lineup uncertainty before official team sheets.
- **This forecast is market-blind: no betting odds or prediction-market data were consulted at any point.**

## 6. Method

World Elo ratings from eloratings.net are converted to win/draw/loss probabilities via a Davidson three-way extension (draw parameter ν=0.7); a bounded adjustment of at most ±8pp, justified only by dated, sourced public news (injuries, lineups, form, venue), is then applied and renormalized. No betting or prediction-market information is used.

### Sources

1. eloratings.net World.tsv (fetched 2026-06-11) — https://www.eloratings.net/World.tsv
2. Morocco World News: Ezzalzouli out, Sbai called up (2026-06-11) — https://www.moroccoworldnews.com/2026/06/317983/
3. ESPN: Morocco cut Aguerd and Ezzalzouli (2026-06-11) — https://www.espn.com/soccer/story/_/id/49027277/
4. ESPN: Mazraoui to resume training; Ezzalzouli assessed within 48h (2026-06-09) — https://www.espn.com/espn/story/_/id/48999527/
5. ESPN: match info / Brazil injuries / venue (2026-06-10) — https://www.espn.com/soccer/story/_/id/49026946/
6. Morocco World News: Brazil resume training (2026-06-08) — https://www.moroccoworldnews.com/2026/06/317249/
7. Sports Mole: Brazil World Cup preview, earlier injury list (2026-06) — https://www.sportsmole.co.uk/football/brazil/world-cup/feature/brazil-2026-world-cup-preview-squad-fixtures-and-prediction_598785.html

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
