# Switzerland vs Bosnia-Herzegovina (2026 World Cup Group B) — Market-Blind Forecast

- Match: 2026-06-18 19:00 UTC (SoFi Stadium, Los Angeles; 12:00 noon local)
- Event slug (resolution metadata only): `fifwc-che-bih-2026-06-18`
- Generated: 2026-06-11T13:15:00Z | Nature: **market-blind forecast** (fully independent of any betting/market odds data)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Switzerland win | **65.0%** | 58% – 72% | Medium |
| Draw | **22.5%** | 16% – 29% | Medium |
| Bosnia-Herzegovina win | **12.5%** | 8% – 18% | Medium |

**One-sentence view:** Switzerland's near-300-point Elo edge makes them clear favourites on strength, but Bosnia's stubborn defence and Switzerland's recent draws against mid-tier sides keep the draw risk material.

## 2. Definition

Three-way result over 90 minutes (plus stoppage time, no extra time/penalties); World Cup group matches cannot go to extra time, so a draw is a valid outcome.

## 3. Strength Profile

| Team | Elo (eloratings.net, fetched 2026-06-11) | Elo rank | Recent form |
| --- | --- | --- | --- |
| Switzerland | 1891 | 17 | 4-1 vs Jordan (May 31), 1-1 vs Australia (Jun 6; ESPN, 2026-06-06) |
| Bosnia-Herzegovina | 1595 | 65 | 1W-3D-1L in last 5; 1-1 vs Panama on Jun 6 (Goal.com preview) |

- Switzerland: coach Murat Yakin, captain Granit Xhaka; final squad confirmed May 20 with no injury withdrawals recorded as of Jun 11 (FIFA.com, 2026-05-20; Wikipedia 2026 World Cup squads, accessed 2026-06-11).
- Bosnia: coach Sergej Barbarez named 26; Edin Dzeko (40, Schalke) remains the focal point — 6 qualifying goals including a stoppage-time playoff semifinal equaliser vs Wales (FIFA.com / FourFourTwo, May 2026).

## 4. Key Factors

1. **296-point Elo gap**: the Davidson model on neutral ground gives Switzerland a ~67.5% baseline win probability (eloratings.net, 2026-06-11).
2. **Bosnia patchy but resilient**: only 1 win in their last 5 (1W3D1L), 1-1 vs Panama on Jun 6; yet they eliminated Italy in the playoffs with a stubborn defensive blueprint (Goal.com preview, June 2026; UEFA.com).
3. **Swiss struggles vs compact blocks**: 0-0 vs Norway (March) and 1-1 vs Australia (Jun 6) suggest difficulty breaking down deep-sitting mid-tier opponents (ESPN, 2026-06-06) → small upward shift to the draw.
4. **Both squads intact**: no injury withdrawals recorded for either side since final squads were named (Wikipedia 2026 World Cup squads, accessed 2026-06-11).
5. **Neutral venue, midday kickoff**: SoFi Stadium, Los Angeles, 12:00 local (SoFi Stadium official site / SeatGeek); no host bonus applies to either team in the model.
6. **Matchday 2 context**: opening results (Switzerland vs Qatar Jun 13, Bosnia vs Canada) may shape psychology, but this forecast was generated before matchday 1 and contains no such information (UEFA.com schedule).

## 5. Model and Adjustment

- **p_stat** (three-way Davidson, scale=400, drawNu=0.7, neutral venue, no host bonus): Switzerland 67.5% / Draw 20.2% / Bosnia 12.3%.
- **Adjustment delta** (total |delta| ~5pp, within the ±8pp cap): Switzerland −2.5pp, Draw +2.3pp, Bosnia +0.2pp. Rationale: Bosnia's low-block durability around the Dzeko focal point, combined with Switzerland twice failing to beat mid-tier sides recently, implies more draw tail-risk than pure Elo suggests; evidence for a Bosnia win is thin, so only a marginal bump.
- **p_final**: Switzerland 65.0% / Draw 22.5% / Bosnia 12.5%.
- This is a **market-blind** forecast: no betting odds, prediction-market prices, or implied probabilities were consulted at any point.

## 6. Method

World Elo ratings from eloratings.net (fetched 2026-06-11) feed a three-way Davidson model (identical to eloToOneXTwo in the repo's packages/sports-model/src/elo.ts, scale=400, drawNu=0.7) for the statistical baseline; a bounded (≤±8pp), renormalized adjustment is then applied using only dated, sourced public facts. The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (Swiss win 65.7%–69.6%) plus extra uncertainty for thin pre-tournament evidence.

### Sources

1. eloratings.net World.tsv (fetched 2026-06-11)
2. FIFA.com — Switzerland squad announcement (2026-05-20)
3. FIFA.com — Dzeko headlines Bosnia and Herzegovina World Cup squad (May 2026)
4. UEFA.com — Switzerland / Bosnia and Herzegovina at the World Cup 2026 (fixtures and group info)
5. Goal.com — Switzerland vs Bosnia and Herzegovina World Cup 2026 Preview (form and H2H)
6. ESPN — Switzerland 1-1 Australia (2026-06-06) and friendly results pages
7. Wikipedia — 2026 FIFA World Cup squads (injury withdrawals, accessed 2026-06-11); SoFi Stadium official site / SeatGeek (venue and kickoff time)

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
