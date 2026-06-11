# Ecuador vs Curaçao (2026 World Cup, Group E) — Market-Blind Forecast

- **Match**: 2026 FIFA World Cup group stage, Group E, Kansas City (USA), kickoff 2026-06-21T00:00:00Z (evening of June 20 local time)
- **Generated**: 2026-06-11T13:15:00Z | **Nature**: market-blind (no odds or market prices consulted)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Ecuador win | **84%** | 78% – 89% | Medium |
| Draw | **12%** | 8% – 17% | Medium |
| Curaçao win | **4%** | 2% – 7% | Medium |

**One-line view**: With a 504-point Elo gap, a full-strength in-form Ecuador, and Curaçao — the smallest nation ever at a World Cup — arriving after coaching turmoil, an Ecuador win is highly likely; the real question is the margin, not the result.

## 2. Definition

Three-way 90-minute result (win/draw/loss); no extra time or penalties in the group stage.

## 3. Strength Profile

| Item | Ecuador | Curaçao |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1938 (rank 9) | 1434 (rank 91) |
| Qualifying | 2nd in CONMEBOL behind Argentina; finished unbeaten over last 6 (beat Argentina) | Historic first qualification; smallest nation ever (~160k population) |
| Key players | Caicedo (Chelsea), Pacho (UCL-winning CB), captain Valencia | Captain Bacuna; Tahith Chong (Sheffield United) |
| Coach | Beccacece (stable setup) | Advocaat (78; returned after two pre-tournament coaching changes) |

## 4. Key Factors

1. **504-point Elo gap**: 1938 vs 1434 — the statistical model alone gives Ecuador over 80% (source: eloratings.net snapshot, 2026-06-11).
2. **Ecuador's form and full squad**: final squad announced May 31 led by Caicedo and Pacho, no reported injuries as of June 11; beat Saudi Arabia 2-1 in a friendly (May 31), final tune-up vs Guatemala (June 7) (sources: FIFA.com squad announcement, 2026-05-31; fantasyfootballscout.co.uk, 2026-06-09; bolavip.com, 2026-06-07).
3. **Unbeaten qualifying finish**: 2nd in CONMEBOL, beat Argentina and drew with Brazil/Peru (source: fantasyfootballscout.co.uk, 2026-06-09).
4. **Curaçao coaching turmoil**: Advocaat resigned in Feb 2026 for family reasons; successor Fred Rutten stepped down a month before the tournament; Advocaat then returned — two coaching changes in four months (source: Sky Sports, 2026-06).
5. **Dutch-developed core**: 16 of Curaçao's squad played for Netherlands youth teams; Chong is the main attacking threat — a competent defensive-counter floor (sources: Sky Sports / FIFA.com, 2026-05/06).
6. **Neutral venue**: Kansas City is neutral for both sides; no host bonus applies (source: khelnow.com schedule page, 2026-06).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, no host bonus — neither team is a host): Ecuador 82.0% / Draw 13.5% / Curaçao 4.5%.
- **Adjustment delta (total +2pp, cap ±8pp)**: Ecuador +2.0pp, Draw −1.5pp, Curaçao −0.5pp. Rationale: Ecuador's intact squad and sustained unbeaten run (factors 2, 3) versus Curaçao's coaching instability (factor 4). The shift is kept small because Curaçao's Elo is calibrated mostly against CONCACAF opposition (uncertainty cuts both ways) and Ecuador's attack is not prolific (several 0-0s in qualifying).
- **p_final**: Ecuador **84%** / Draw **12%** / Curaçao **4%**.
- **This is a market-blind forecast**: fully independent of any odds, bookmaker, or prediction-market prices; built only from the statistical model plus cited public evidence.

## 6. Method and Sources

**Method**: Elo ratings from eloratings.net feed a Davidson three-way model (identical to eloToOneXTwo in the repo's `packages/sports-model/src/elo.ts`) to produce p_stat; a bounded (<= +/-8pp) evidence-based adjustment is then applied and renormalized. The 80% intervals reflect drawNu sensitivity (0.6-0.8), +/-25 Elo input uncertainty, and the thin data on debutant Curaçao.

**Sources**:
1. eloratings.net (World.tsv snapshot, 2026-06-11)
2. FIFA.com — Ecuador squad announcement (~2026-05-31)
3. FIFA.com — Curaçao squad announcement (2026-05/06)
4. Sky Sports — Curaçao feature (2026-06)
5. fantasyfootballscout.co.uk — Ecuador preview (2026-06-09)
6. bolavip.com — Ecuador vs Guatemala friendly (2026-06-07)
7. khelnow.com — Ecuador schedule/venue (2026-06)

**Disclaimer**: This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
