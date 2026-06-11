# Uzbekistan vs Colombia — 2026 World Cup Group K (Market-Blind Forecast)

- **Match**: 2026-06-17 (kickoff 2026-06-18T02:00:00Z UTC), Estadio Azteca, Mexico City (neutral venue, ~2,200 m altitude)
- **Event slug** (resolution metadata only): `fifwc-uzb-col-2026-06-17`
- **Generated**: 2026-06-11T13:15:00Z

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Uzbekistan win | **12.5%** | 8% – 18% | Medium |
| Draw | **22.0%** | 17% – 28% | Medium |
| Colombia win | **65.5%** | 57% – 74% | Medium |

**One-line view**: Colombia hold a comprehensive edge in strength, form and squad availability (~65% to win); World Cup debutants Uzbekistan, with captain Shomurodov an injury doubt, are most likely to aim for a defensive draw.

## 2. Outcome definition

Three-way result over 90 minutes plus stoppage time (win/draw/loss); no extra time or penalties in the group stage.

## 3. Team profiles

| | Uzbekistan | Colombia |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1714 (rank 42) | 1982 (rank 7) |
| Form | 2W-1D-2L in last 5 friendlies; lost 1-2 to Netherlands on Jun 8 | 3 wins in last 5; beat Jordan 2-0 on Jun 8 |
| Key players | Shomurodov (captain, all-time top scorer, 44 goals, injury doubt), Khusanov (Man City CB) | James Rodríguez (captain), Luis Díaz (Bayern; 2nd-top scorer in CONMEBOL qualifying with 7 goals) |
| Coach / style | Fabio Cannavaro, defensive 5-4-1 | Néstor Lorenzo, attack-minded |
| Background | First-ever World Cup finals | Full-strength squad, 2014 QF pedigree |

Sources: eloratings.net (2026-06-11); ESPN (2026-06-08); Goal.com preview (2026-06); FIFA.com Colombia squad announcement (2026-06).

## 4. Key factors

1. **268-point Elo gap** (1982 vs 1714); the statistical model alone gives Colombia ~65% baseline win probability. (eloratings.net, 2026-06-11)
2. **Shomurodov injury doubt**: Uzbekistan's captain went off injured in the 24th minute of the Jun 8 friendly vs the Netherlands; he is their primary finisher. (ESPN, 2026-06-08)
3. **Colombia at full strength and in form**: no reported injuries in the 26-man squad; James and Díaz lead the side, with a 2-0 win over Jordan on Jun 8. (FIFA.com / beIN Sports, 2026-06-08)
4. **Cannavaro's defensive 5-4-1**: low-block underdog setups historically raise draw likelihood in World Cup group openers. (heavy.com lineup report, 2026-06-08)
5. **Neutral high-altitude venue**: Estadio Azteca sits at ~2,200 m; both sides are visitors. Colombian domestic-league players have altitude experience, Uzbekistan none in particular — broadly neutral, marginally pro-Colombia. (Goal.com / Yahoo Sports, 2026-06)
6. **Debut psychology**: Uzbekistan's first-ever World Cup match — high motivation, zero tournament experience; direction unclear, so no adjustment applied. (Goal.com, 2026-06)

## 5. Model and adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Uzbekistan 13.9% / draw 21.1% / Colombia 65.0%
- **Adjustment (total |delta| ≈ 2.8pp, cap ±8pp)**:
  - Shomurodov injury doubt + Colombia fully fit and in form: Uzbekistan −1.4pp, Colombia +0.5pp
  - Defensive 5-4-1 + typically cautious World Cup openers: draw +0.9pp
- **p_final**: Uzbekistan **12.5%** / draw **22.0%** / Colombia **65.5%**
- **Market-blind**: this forecast is fully independent of any betting or prediction-market prices; probabilities come solely from the Elo statistical model plus the bounded, evidence-based adjustment above.

## 6. Method

World Elo from eloratings.net feeds a Davidson three-way model (identical to eloToOneXTwo in packages/sports-model/src/elo.ts: scale=400, drawNu=0.7). The +100 host bonus applies only to host nations (Mexico, USA, Canada) in group matches; neither team here is a host, so the venue is treated as neutral. A bounded adjustment of at most ±8pp total, justified only by dated, sourced facts, is then applied and renormalized. The 80% intervals reflect parameter sensitivity (drawNu 0.6–0.8 shifts the baseline by roughly ±2–3pp per outcome) plus lineup/injury uncertainty a week before kickoff.

### Sources

1. eloratings.net World.tsv (fetched 2026-06-11) — Elo ratings and ranks
2. ESPN: Netherlands 2-1 Uzbekistan (2026-06-08) — friendly result, Shomurodov injury — https://www.espn.com/soccer/match/_/gameId/401871814/uzbekistan-netherlands
3. Goal.com: Uzbekistan vs Colombia World Cup Preview (2026-06) — schedule, venue, form — https://www.goal.com/en-us/news/uzbekistan-colombia-world-cup-preview/bltd5f07d2b89067908
4. FIFA.com: Diaz and James headline Colombia squad (2026-06) — Colombia 26-man squad — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/colombia-squad-announced
5. beIN Sports: James Rodríguez shining against Jordan (2026-06-08) — Colombia form — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/james-rodr%C3%ADguez-undisputed-leader-of-colombia-on-the-road-to-the-2026-world-cup-after-shining-against-jordan-2026-06-08
6. heavy.com: Netherlands vs Uzbekistan team news (2026-06-08) — Cannavaro's 5-4-1 — https://heavy.com/sports/soccer/how-to-watch-netherlands-vs-uzbekistan-live-today-team-news-lineups-stats-and-tv-guide/

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
