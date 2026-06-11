# Portugal vs DR Congo (2026 World Cup, Group K) — Market-Blind Forecast

- **Match**: 2026 FIFA World Cup group stage, Group K, 2026-06-17 17:00 UTC, NRG Stadium, Houston (neutral venue for both sides)
- **Resolution metadata**: event slug `fifwc-prt-cdr-2026-06-17` (settlement reference only; this forecast uses no market data)
- **Generated**: 2026-06-11

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Portugal win | **70.0%** | 64% – 76% | Medium |
| Draw | **19.8%** | 15% – 25% | Medium |
| DR Congo win | **10.2%** | 7% – 14% | Medium |

**One-line view**: A 337-point Elo gap plus a full-strength Portugal squad makes this a heavy mismatch; DR Congo's realistic path is grinding out a draw, with roughly a one-in-ten upset chance.

## 2. Definition

Three-way result after 90 minutes (plus stoppage time): win / draw / loss. World Cup group matches have no extra time or penalties; a draw stands as the final result.

## 3. Team Profiles

| Metric | Portugal | DR Congo |
| --- | --- | --- |
| Elo (eloratings.net, snapshot 2026-06-11) | 1989 (rank 6) | 1652 (rank 55) |
| Warm-ups | 2-1 vs Chile (Jun 6), 2-1 vs Nigeria (Jun 10, ESPN) | 0-0 vs Denmark (Jun 3), 1-2 vs Chile (Jun 9, ESPN) |
| Status | 26-man squad named May 19; Ronaldo captains a record 6th World Cup; no key absences (FIFA) | First World Cup in 52 years (since 1974 as Zaire); coach Desabre; Wan-Bissaka, Wissa, Mbemba included (FIFA) |

## 4. Key Factors

1. **337-point Elo gap**: Portugal 1989 vs DR Congo 1652 — elite side vs mid-tier opposition (eloratings.net, 2026-06-11).
2. **Portugal at full strength**: 26-man squad named 2026-05-19; Ronaldo recovered from his Feb–Mar right-thigh muscle injury and featured in the June friendlies; none of the early-2026 injury concerns (R. Dias, Leão, etc.) miss the tournament (FIFA 2026-05-19; OneFootball 2026-03; Plataforma 2026-03-25).
3. **Common-opponent reference**: within six days Chile lost 1-2 to Portugal then beat DR Congo 2-1, directionally confirming the gap (ESPN 2026-06-06 / 2026-06-09).
4. **DR Congo defensively organized**: held a strong Denmark side to 0-0 over 90 minutes — the draw path is real (ESPN 2026-06-03).
5. **Asymmetric tournament experience**: DR Congo's first World Cup in 52 years means little big-stage experience, though Premier League players (Wan-Bissaka, Wissa) add quality (FIFA 2026-05-18).
6. **Neutral venue**: NRG Stadium, Houston — no host bonus for either side (FIFA/OneFootball schedule, May 2026).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus; Ra=1989, Rb=1652):
  Portugal **70.97%** / Draw **18.83%** / DR Congo **10.20%**
- **Adjustment (within the ±8pp cap; actually ±1pp)**: Portugal −1pp → Draw +1pp.
  Rationale: DR Congo's 0-0 vs Denmark shows a functioning low block, and World Cup openers tend to be cautious; all other evidence (full-strength Portugal, two warm-up wins, common-opponent reference) aligns with the Elo direction and does not justify a larger shift.
- **p_final**: Portugal **70.0%** / Draw **19.8%** / DR Congo **10.2%**
- **This is a market-blind forecast**: fully independent of any odds, betting lines, or prediction-market prices; no such data was consulted.

## 6. Method and Sources

**Method**: same-day Elo ratings from eloratings.net fed into a Davidson three-way model (identical to eloToOneXTwo in the repo's packages/sports-model/src/elo.ts) for the statistical baseline; at most three public news searches collected dated facts for a bounded (≤ ±8pp) evidence-based adjustment; the 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (Portugal win 69.1%–72.9%) widened for evidence thinness (DR Congo has no recent major-tournament sample).

**Sources**
1. eloratings.net World.tsv (snapshot 2026-06-11) — https://www.eloratings.net/World.tsv
2. FIFA.com — Portugal squad announcement (2026-05-19) — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/cristiano-ronaldo-roberto-martinez-portugal-squad-announcement
3. FIFA.com — Congo DR squad announcement (2026-05-18) — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/congo-dr-squad-announcement-sebastien-desabre
4. ESPN — Congo DR 0-0 Denmark (2026-06-03) — https://www.espn.com/soccer/match/_/gameId/401871169/denmark-congo-dr
5. ESPN — Congo DR 1-2 Chile (2026-06-09) — https://www.espn.com/soccer/match/_/gameId/401871171/chile-congo-dr
6. ESPN — Portugal 2-1 Chile (2026-06-06) — https://www.espn.com/soccer/match/_/gameId/401862883/chile-portugal
7. ESPN — Portugal 2-1 Nigeria (2026-06-10) — https://www.espn.com/soccer/match/_/gameId/401867372/nigeria-portugal
8. OneFootball / Plataforma Media — Portugal injury roundup (2026-03) — https://onefootball.com/en/news/97-days-to-world-cup-ronaldo-injury-worry-for-portugal-42515839

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
