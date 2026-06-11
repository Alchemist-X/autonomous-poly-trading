# Sweden vs Tunisia (2026 World Cup Group F, 2026-06-14) — Market-Blind Forecast

> Generated: 2026-06-11T13:15:00Z | Event slug (resolution metadata only): `fifwc-swe-tun-2026-06-14` | Kickoff: 2026-06-15T02:00:00Z (8 pm June 14 local, Monterrey)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Sweden win | **48%** | 42% – 54% | Medium |
| Draw | **26%** | 21% – 31% | Medium |
| Tunisia win | **26%** | 21% – 31% | Medium |

**One-line view**: Sweden hold a modest edge on the Gyokeres + Isak forward line, but Tunisia's rock-solid defence and Sweden's own volatility make this a thin-margin match — no outcome should be ruled out.

## 2. Definition

- Target is the three-way result over 90 minutes (plus stoppage time); no extra time or penalties in the group stage.
- Neutral venue: Estadio BBVA, Monterrey, Mexico. Neither side is a host nation, so no host bonus is applied.

## 3. Strength Profile

| | Sweden | Tunisia |
| --- | --- | --- |
| Elo (eloratings.net, 2026-06-11 snapshot) | 1712 (rank 43) | 1628 (rank 58) |
| Manager | Graham Potter (took over during qualifying) | Sabri Lamouchi (appointed January 2026) |
| Recent trajectory | Bottom of qualifying group with 2 points, then beat Ukraine and Poland in the playoffs (Gyokeres hat-trick + 88th-minute winner) | Qualified without conceding a single goal (first nation to do so), but sacked their coach after a January AFCON last-16 exit |

Sources: eloratings.net (2026-06-11), The Analyst/Opta Sweden preview, FIFA.com Tunisia squad announcement.

## 4. Key Factors

1. **Sweden's forward line is clearly above their Elo rank**: Gyokeres just won the 2025-26 Premier League with Arsenal, scored a playoff hat-trick vs Ukraine and an 88th-minute winner vs Poland; Isak is also in the squad (The Analyst, accessed 2026-06-11).
2. **Isak fitness is a question mark**: an injury-plagued season at Liverpool with only 8 league starts in 2025-26 (Sky Sports, accessed 2026-06-11).
3. **Kulusevski left out injured** from Sweden's squad, reducing midfield creativity (FourFourTwo squad page, accessed 2026-06-11).
4. **Tunisia: elite defence but a late coaching change**: zero goals conceded in qualifying, yet Sami Trabelsi was fired after the AFCON last-16 loss to Mali in January; Lamouchi took over with limited preparation time, a much-changed squad, and only a March friendly win over Haiti (FIFA.com / Squawka, accessed 2026-06-11).
5. **Sweden's regular qualifying campaign was dire** (bottom of group, winless vs Switzerland/Kosovo/Slovenia), showing a low floor — largely already priced into Elo (BigDSoccer, accessed 2026-06-11).
6. **Monterrey heat on June 14** (daytime highs around 37–39 C); the 8 pm local kickoff mitigates much of it; heat marginally favours the North African side (weather.com monthly forecast, accessed 2026-06-11).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, Elo 1712 vs 1628, neutral, no host bonus): Sweden 46.2% / Draw 25.4% / Tunisia 28.5%.
- **Evidence-based adjustment (total |delta| ~4.9pp, cap +/-8pp)**:
  - Sweden +1.8pp: forward talent (factor 1) above Elo-implied level and proven clutch goals in the playoffs; partly offset by factors 2 and 3.
  - Draw +0.6pp: Tunisia's zero-concession defensive style (factor 4) raises low-scoring/draw likelihood.
  - Tunisia -2.5pp: post-coaching-change cohesion deficit and squad overhaul (factor 4) lower their win ceiling; the heat factor (6) gives only a small offset.
- **p_final**: Sweden 48% / Draw 26% / Tunisia 26%.
- 80% intervals reflect drawNu 0.6-0.8 sensitivity (statistical layer: Sweden 44.6-47.9%, Draw 22.6-28.0%, Tunisia 27.5-29.5%) plus evidence thinness (3 days before kickoff, lineups unannounced).
- **This is a market-blind forecast**: fully independent of any betting line, odds, or prediction-market price. Probabilities come solely from the Elo/Davidson statistical model plus the cited, bounded adjustments above.

## 6. Method and Sources

Method: the eloratings.net 2026-06-11 Elo snapshot is fed into the Davidson three-way model (identical to eloToOneXTwo in the repo's packages/sports-model/src/elo.ts; scale=400, drawNu=0.7; host nations get +100 in group matches — not applicable here) to obtain p_stat; six sourced facts from a capped three-search web pass justify a bounded adjustment of at most +/-8pp, then renormalize; intervals come from parameter sensitivity plus evidence thinness.

Sources (all accessed 2026-06-11):
1. https://www.eloratings.net/World.tsv (Elo snapshot)
2. https://theanalyst.com/articles/sweden-world-cup-2026-preview-gyokeres-isak-potter
3. https://www.skysports.com/football/news/11095/13463183/jonas-olsson-on-isak-gyokeres
4. https://www.fourfourtwo.com/team/sweden-world-cup-2026-squad
5. https://www.bigdsoccer.com/sweden-2026-world-cup-preview/
6. https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/tunisia-squad-named-sabri-lamouchi
7. https://www.squawka.com/en/news/world-cup/tunisia-world-cup-2026-fixtures-squad-analysis/
8. https://www.mlssoccer.com/news/2026-fifa-world-cup-group-f-preview-netherlands-japan-sweden-tunisia
9. https://weather.com/weather/monthly/l/17234:25:MX

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
