# Cabo Verde vs Saudi Arabia — 2026 World Cup Group H (Market-Blind Forecast)

- **Match**: 2026 FIFA World Cup group stage, Match 65, Group H round 3
- **Kickoff**: 2026-06-27T00:00:00Z (June 26, 19:00 local, Houston)
- **Venue**: NRG Stadium, Houston (neutral venue, retractable roof)
- **Generated**: 2026-06-11 · Event identifier (resolution metadata only): `fifwc-cvi-ksa-2026-06-26`

## 1. Forecast Summary

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Cabo Verde win | **36.2%** | 31% – 42% | Low |
| Draw | **25.9%** | 21% – 31% | Low |
| Saudi Arabia win | **37.9%** | 32% – 44% | Low |

**One-sentence view**: A genuine coin-flip with only 2 Elo points between them (1578 vs 1576) — Saudi Arabia edges ahead on World Cup tournament experience while debutants Cabo Verde carry an aging core; the draw is far from negligible.

## 2. Definition

Forecast target is the three-way 90-minute result (including stoppage time): Cabo Verde win / draw / Saudi Arabia win. No extra time or penalties in the group stage.

## 3. Strength Profile

| Metric | Cabo Verde | Saudi Arabia |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1578 (rank 68) | 1576 (rank 69) |
| World Cup pedigree | First-ever appearance | Third consecutive finals (2022 core that beat Argentina largely retained) |
| Head coach | Bubista (long, stable tenure) | Georgios Donis (appointed mid-April; only 3 matches in charge: 1W 1D 1L) |

Sources: eloratings.net (via repo `elo-table.json`, 2026-06-11); FourFourTwo / Al Arabiya (2026-05-25); FIFA.com (2026-05-18).

## 4. Key Factors

1. **Near-identical Elo**: 1578 vs 1576, ranks 68 vs 69 — the pure model sees this as close to a coin flip. (eloratings.net, 2026-06-11)
2. **Saudi coaching upheaval**: Herve Renard sacked on April 17; Greek coach Georgios Donis took over only weeks before the finals, with just 3 matches in charge (1W 1D 1L) — a real cohesion risk. (Al Arabiya / FourFourTwo, 2026-05-25)
3. **Cabo Verde's aging spine**: Vozinha (40), Stopira (38), Ryan Mendes (36), Rodrigues (35); fitness in a third high-intensity match is a concern, and defender Logan Costa only returned from a long-term ACL injury on May 17. (Olympics.com / FIFA.com, from 2026-05-18)
4. **Saudi experience and continuity**: captain Salem Al-Dawsari (108 caps) leads a squad retaining most of the 2022 group that beat Argentina; Firas Al-Buraikan was the qualifying goal threat. (Al Arabiya, 2026-05-25)
5. **Round-3 stakes**: with Spain and Uruguay the other Group H teams, this match could well decide a knockout/third-place berth — incentives are broadly symmetric. (Squawka / ESPN, May-June 2026)
6. **Neutral, climate-controlled venue**: NRG Stadium's retractable roof neutralizes late-June Houston heat for both sides. (NRG Park event page, 2026-06)

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Cabo Verde 37.25% / Draw 25.93% / Saudi Arabia 36.82%
- **Evidence-based adjustment (within the ±8pp cap; only 1pp applied)**: Saudi Arabia's tournament experience plus Cabo Verde's debutant status and aging spine (factors 3-4) → Cabo Verde −1pp, Saudi Arabia +1pp; Saudi's late coaching change (factor 2) is countervailing evidence that capped the shift. Evidence is thin and largely offsetting, hence a minimal correction.
- **p_final**: Cabo Verde 36.2% / Draw 25.9% / Saudi Arabia 37.9% (normalized).
- **This is a market-blind forecast**: fully independent of any betting line, odds, or prediction-market price; based solely on the statistical model and cited public news evidence.

## 6. Method, Sources, and Disclaimer

**Method**: eloratings.net world Elo feeds a Davidson three-way model (drawNu=0.7) to produce the statistical baseline; a bounded adjustment of at most ±8pp, justified only by dated, sourced facts, is then applied and normalized. The 80% intervals reflect parameter sensitivity (drawNu 0.6-0.8 moves the draw baseline between 23.1% and 28.6%) and the thinness of the evidence.

**Sources**:

1. eloratings.net World.tsv (via `runtime-artifacts/world-cup/elo-table.json`, fetched 2026-06-11)
2. FIFA.com — Cabo Verde squad announcement (2026-05-18): https://www.fifa.com/en/tournaments/mens/worldcup/articles/cabo-verde-squad-announcement-world-cup-bubista
3. Olympics.com — Cabo Verde at FIFA World Cup 2026: https://www.olympics.com/en/news/fifa-world-cup-2026-cabo-verde-all-players-full-squad-list-key-stats-schedule
4. Al Arabiya — Saudi Arabia's FIFA World Cup 2026 squad (2026-05-25): https://english.alarabiya.net/amp/sports/2026/05/25/saudi-arabia-s-fifa-world-cup-2026-squad-who-s-in-and-who-s-out
5. FourFourTwo — Saudi Arabia World Cup 2026 squad: https://www.fourfourtwo.com/team/saudi-arabia-world-cup-2026-squad
6. Squawka — Saudi Arabia World Cup 2026 fixtures & analysis: https://www.squawka.com/en/news/world-cup/saudi-arabia-world-cup-2026-fixtures-squad-analysis/
7. NRG Park — event page (venue confirmation): https://www.nrgpark.com/event/cabo-verde-vs-saudi-arabia/

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
