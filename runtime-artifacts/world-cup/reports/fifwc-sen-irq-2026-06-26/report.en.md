# Senegal vs Iraq — 2026 World Cup Group I (Market-Blind Forecast)

- **Match**: 2026-06-26 19:00 UTC (15:00 local), BMO Field, Toronto, Canada (group matchday 3, match 62)
- **Generated**: 2026-06-11T13:15:00Z | **Method**: Elo + Davidson three-way model + bounded evidence adjustment (market-blind)

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Senegal win | **65%** | 57% – 72% | Medium |
| Draw | **22%** | 17% – 27% | Medium |
| Iraq win | **13%** | 9% – 19% | Medium |

**One-line view**: AFCON champions Senegal, at full strength and 253 Elo points ahead, hold a clear edge over the group's weakest side Iraq, though unknown matchday-3 qualification stakes add rotation risk.

## 2. Definition

90-minute three-way result (win/draw/loss); no extra time in the group stage; stoppage time counts. Neutral venue (Canada is not either side's home; no host bonus applied).

## 3. Strength Profile

| | Senegal | Iraq |
| --- | --- | --- |
| Elo (eloratings.net, 2026-06-11 snapshot) | 1860 (rank 21) | 1607 (rank 63) |
| Recent form | Won AFCON in Jan 2026; Mane named player of the tournament ([Al Jazeera, 2026-05-30](https://www.aljazeera.com/sports/2026/5/30/senegals-world-cup-2026-team-preview-players-to-watch-group-squad-list)) | Qualified via intercontinental playoff winner vs Bolivia; Graham Arnold took over in May 2025 and rescued the campaign ([Olympics.com](https://www.olympics.com/en/news/fifa-world-cup-2026-iraq-players-squad-list-key-stats-schedule)) |
| Key players | Mane (34, captain), Koulibaly, Pape Sarr | Aymen Hussein (8 goals in Asian qualifying), Ali Al-Hamadi (Ipswich) |

## 4. Key Factors

1. **253-point Elo gap**: 1860 vs 1607 gives Senegal a ~64% baseline win probability (eloratings.net, fetched 2026-06-11).
2. **Senegal injury returns**: Pape Sarr and Habib Diarra back fit for the tournament; Idrissa Gueye included despite missing the end of the club season ([Al Jazeera, 2026-05-30](https://www.aljazeera.com/sports/2026/5/30/senegals-world-cup-2026-team-preview-players-to-watch-group-squad-list)).
3. **Mane headlines the squad**: the list announced 21 May is led by Mane and Koulibaly ([Al Jazeera, 2026-05-21](https://www.aljazeera.com/sports/2026/5/21/sadio-mane-kalidou-koulibaly-star-picks-in-senegals-world-cup-squad)).
4. **Koulibaly ageing signs**: 34, sent off vs Benin in the AFCON group stage and missed the final ([Al Jazeera, 2026-05-30](https://www.aljazeera.com/sports/2026/5/30/senegals-world-cup-2026-team-preview-players-to-watch-group-squad-list)) — minor defensive risk.
5. **Iraq's limited depth**: Arnold confirmed his 26-man squad on 1 June; most players are based in domestic leagues, with Zidane Iqbal (Utrecht) and Al-Hamadi (Ipswich) among the few Europe-based regulars ([FIFA.com, 2026-06-01](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/iraq-preliminary-squad-announcement-graham-arnold)).
6. **Matchday-3 variance**: final round of Group I (France, Senegal, Norway, Iraq); qualification stakes at kickoff are unknown, and Senegal could rotate if already through ([Goal.com venue info](https://www.goal.com/en-us/news/how-to-buy-senegal-vs-iraq-world-cup-tickets/blt0f1c916245673614)).

## 5. Model and Adjustment

- **p_stat** (Davidson, scale=400, drawNu=0.7, neutral venue, no host bonus): Senegal 63.6% / Draw 21.5% / Iraq 14.8%.
- **Adjustment (total |delta| ~4pp, cap +/-8pp)**:
  - Senegal +1.4pp: AFCON-champion momentum plus key starters returning fit (factors 2, 3);
  - Draw +0.5pp: unknown matchday-3 stakes and possible rotation (factor 6);
  - Iraq -1.9pp: large squad-depth gap with no offsetting positive news (factor 5).
- **p_final**: Senegal 65% / Draw 22% / Iraq 13%.
- **This forecast is market-blind**: fully independent of any odds, prices, or prediction markets; it rests only on the statistical model and cited public news.

## 6. Method and Sources

Method: same-day eloratings.net Elo feeds a Davidson three-way model (drawNu=0.7) for baseline probabilities; a bounded adjustment of at most +/-8pp, justified only by dated sourced facts, is then applied and renormalized. The 80% intervals reflect drawNu 0.6-0.8 sensitivity, +/-25 Elo uncertainty, and evidence thinness.

Sources:
1. eloratings.net World.tsv (fetched 2026-06-11, repo elo-table.json)
2. [Al Jazeera Senegal team preview](https://www.aljazeera.com/sports/2026/5/30/senegals-world-cup-2026-team-preview-players-to-watch-group-squad-list) (2026-05-30)
3. [Al Jazeera Senegal squad](https://www.aljazeera.com/sports/2026/5/21/sadio-mane-kalidou-koulibaly-star-picks-in-senegals-world-cup-squad) (2026-05-21)
4. [FIFA.com Iraq squad announcement](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/iraq-preliminary-squad-announcement-graham-arnold) (2026-06-01)
5. [Olympics.com Iraq team profile](https://www.olympics.com/en/news/fifa-world-cup-2026-iraq-players-squad-list-key-stats-schedule) (2026-06)
6. [Goal.com venue / kickoff info](https://www.goal.com/en-us/news/how-to-buy-senegal-vs-iraq-world-cup-tickets/blt0f1c916245673614) (2026-06)

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
