# Colombia vs DR Congo — 2026 World Cup Group K (Market-Blind Forecast)

- **Fixture**: 2026 FIFA World Cup, Group K matchday 2 (Match 48)
- **Kickoff**: 2026-06-23 local evening (UTC 2026-06-24T02:00:00Z)
- **Venue**: Estadio Akron, Zapopan (Guadalajara), Mexico — neutral venue, neither team is a host nation
- **Generated**: 2026-06-11T13:15:00Z | Event slug (resolution metadata only): `fifwc-col-cdr-2026-06-23`

## 1. Forecast

| Outcome (90 minutes) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Colombia win | **0.72** | 0.66 – 0.78 | Medium |
| Draw | **0.18** | 0.13 – 0.23 | Medium |
| DR Congo win | **0.10** | 0.06 – 0.15 | Medium |

**One-line view**: With a 330-point Elo gap, hot form and a fully fit squad, Colombia are the clear stronger side; debutants DR Congo have Premier League experience in defence, but an upset would require an exceptional performance.

## 2. Definition

- The forecast covers the three-way result after 90 minutes (win/draw/loss); group-stage matches have no extra time or penalties — a draw stands as the final result.

## 3. Strength Profiles

| Metric | Colombia | DR Congo |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1982 (rank 7) | 1652 (rank 55) |
| World Cup pedigree | Multiple appearances, 2014 quarter-finalists | First appearance since 1974 (as Zaire); all 26 players are World Cup debutants |
| Recent form | A 28-match unbeaten run under Lorenzo (incl. wins over Germany, Brazil, Spain), 2024 Copa América runners-up, nine unbeaten in 2025 (Squawka, 2026-06) | Qualified via the African play-off path; coach Desabre named his 26 on 2026-05-18 (FIFA.com) |
| Key players | Luis Díaz (Bayern, 45 goal contributions in 2025-26), captain James Rodríguez (FIFA.com / Olympics.com, 2026-06-02) | Captain Mbemba (107 caps, Lille), plus Wissa, Wan-Bissaka, Sadiki, Tuanzebe from the Premier League (FourFourTwo, 2026-05/06) |

## 4. Key Factors

1. **330-point Elo gap**: 1982 vs 1652 — the statistical model already gives a strongly one-sided baseline (eloratings.net, 2026-06-11).
2. **No Colombian injury absences**: ESPN's World Cup injury tracker lists no Colombia players; the 26-man squad announced June 2 is at full strength (ESPN / FIFA.com, 2026-06).
3. **Colombia's form curve**: 28-match unbeaten run, 2024 Copa América final, nine unbeaten in 2025 (Squawka, 2026-06) — note this is largely already absorbed into the Elo rating.
4. **DR Congo are all debutants**: first finals since 1974, no player has World Cup experience; big-stage resilience is unproven (FourFourTwo / FIFA.com, 2026-05-18).
5. **DR Congo attacking concern**: Newcastle striker Wissa endured an injury-hit, inconsistent 2025-26 season (FourFourTwo, 2026-06).
6. **Neutral venue + schedule**: Estadio Akron (~49,850 capacity) is neutral, no host bonus applies; this is matchday 2 — DR Congo open against Portugal, adding fatigue/morale uncertainty (Sofascore stadium guide / Goal.com, 2026-06).

## 5. Model and Adjustment

- **p_stat (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus)**:
  - Colombia 0.704 / Draw 0.191 / DR Congo 0.105
- **Evidence-based adjustment (capped at ±8pp; ~±2pp applied)**: Colombia +2pp, Draw −1pp, DR Congo −1pp.
  - Rationale: Colombia fully fit (factor 2); opponents are all debutants with their main striker out of form (factors 4, 5). The shift is deliberately small because form is largely already priced into Elo.
- **p_final**: Colombia 0.72 / Draw 0.18 / DR Congo 0.10.
- **This is a market-blind forecast**: fully independent of any odds, bookmaker or prediction-market prices; probabilities come solely from the Elo statistical model plus a bounded evidence-based adjustment.
- The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (win 0.685–0.724 / draw 0.168–0.212) plus evidence thinness (limited sample on DR Congo's true level).

## 6. Method and Sources

**Method**: Using the eloratings.net snapshot of 2026-06-11 as input, a Davidson three-way model (identical to eloToOneXTwo in the repo's packages/sports-model/src/elo.ts) produces the statistical baseline; dated, sourced public facts then justify a bounded adjustment of at most ±8pp, renormalized. No betting or prediction-market data is used.

**Sources**:
1. eloratings.net — World.tsv snapshot (2026-06-11): https://www.eloratings.net/World.tsv
2. FIFA.com — Colombia squad announced (2026-06-02): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/colombia-squad-announced
3. FIFA.com — Congo DR squad announcement (2026-05-18): https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/congo-dr-squad-announcement-sebastien-desabre
4. Squawka — Colombia team analysis (2026-06): https://www.squawka.com/en/news/world-cup/colombia-world-cup-2026-fixtures-squad-analysis/
5. FourFourTwo — DR Congo 26-man squad analysis (2026-05/06): https://www.fourfourtwo.com/team/dr-congo-world-cup-2026-squad
6. ESPN — 2026 World Cup injuries tracker (2026-06): https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info
7. Sofascore — Estadio Akron stadium guide (2026): https://www.sofascore.com/news/2026-fifa-world-cup-stadium-guide-estadio-akron

**Disclaimer**: This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
