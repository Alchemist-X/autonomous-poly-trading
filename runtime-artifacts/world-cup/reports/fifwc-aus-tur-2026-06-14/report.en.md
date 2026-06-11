# Australia vs Türkiye — 2026 World Cup Group D (Market-Blind Forecast)

- Match: 2026-06-14 04:00 UTC, BC Place (Vancouver, neutral venue)
- Event slug (resolution metadata only): `fifwc-aus-tur-2026-06-14`
- Generated: 2026-06-11T13:15:00Z | Confidence tier: **Medium**

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval |
| --- | --- | --- |
| Australia win | **22.0%** | 17% – 27% |
| Draw | **24.5%** | 20% – 30% |
| Türkiye win | **53.5%** | 46% – 60% |

**One-line view**: Türkiye hold a 134-point Elo edge, a full-strength squad and 7W1D in their last 8; with Australia missing a forward and a key centre-back just back from long-term injury, Türkiye win sits around 53.5%.

## 2. Definition

Three-way result over 90 minutes (win/draw/loss). World Cup group matches have no extra time or penalties; the regulation-time score settles the outcome.

## 3. Team Profiles

| | Australia | Türkiye |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1777 (rank 28) | 1911 (rank 13) |
| Recent form | Lost to Colombia/Venezuela/USA in late 2025; rebounded with a 5-1 FIFA Series win over Curaçao in March 2026 | 7W1D in last 8; five-match winning streak in qualifying |
| Background | 6th consecutive World Cup; Round of 16 in 2022 | First World Cup in 24 years (since 3rd place in 2002) |

Sources: eloratings.net (2026-06-11); Squawka / Goal.com match previews (2026-06).

## 4. Key Factors

1. **134-point Elo gap**: 1911 vs 1777; the statistical model gives Türkiye ~51.6% baseline win probability at a neutral venue. (eloratings.net, 2026-06-11)
2. **Türkiye at full strength**: the 26-man squad announced June 2 includes Çalhanoğlu, Güler, Yıldız and Aktürkoğlu, with no key injuries reported at time of research. (turkiyetoday.com, fifa.com, 2026-06-02)
3. **Australia lose a forward**: striker Nick D'Agostino departed the Sarasota pre-camp injured. (socceroos.com.au, 2026-06)
4. **Souttar freshly back from long-term injury**: the first-choice centre-back only just regained fitness after nearly 500 days out with an Achilles injury. (sbs.com.au, 2026-06)
5. **Türkiye in form but short on tournament experience**: 24 years since their last World Cup and a young core (Güler, Yıldız); a possible opening-game adjustment cost partially offsets the form edge. (uefa.com, 2026-06)
6. **Neutral, covered venue**: BC Place is a Canadian stadium — no home advantage for either side, minimal weather impact. (bcplace.com, 2026-06)

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Australia 23.9% / Draw 24.6% / Türkiye 51.6%
- **Adjustment delta** (cap ±8pp; ~2pp applied): Australia -1.9pp → Türkiye +1.9pp, draw roughly unchanged.
  Rationale: Türkiye full-strength and in clearly better form; Australia missing a forward plus a key defender early in his return. Recent results are partly baked into Elo already, so only a small correction; Türkiye's tournament-experience gap offsets part of the form edge.
- **p_final**: Australia **22.0%** / Draw **24.5%** / Türkiye **53.5%**
- This forecast is **market-blind**: derived solely from the statistical model plus dated, sourced public evidence; no betting or prediction-market information was consulted.

## 6. Method, Sources, Disclaimer

**Method**: eloratings.net world Elo feeds a Davidson three-way model (drawNu=0.7) for baseline probabilities, followed by a bounded (≤±8pp), evidence-cited adjustment, then renormalization. The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (which alone spans AUS 23.0–24.7% / Draw 21.8–27.1% / TUR 49.8–53.5%) widened for evidence thinness.

**Sources**:
1. eloratings.net World.tsv (fetched 2026-06-11; repo `runtime-artifacts/world-cup/elo-table.json`)
2. https://socceroos.com.au/news/commbank-socceroos-squad-update-0 (2026-06)
3. https://www.sbs.com.au/news/article/socceroos-australia-world-cup-2026-explained/5w41ackgb (2026-06)
4. https://www.fifa.com/en/articles/turkiye-preliminary-world-cup-squad-announced (2026-06)
5. https://www.turkiyetoday.com/sports/turkiye-names-26-man-squad-for-2026-fifa-world-cup-after-final-cuts-3221129 (2026-06-02)
6. https://www.uefa.com/european-qualifiers/news/02a6-20d15969649d-c1471bfa3c52-1000--turkiye-at-the-world-cup-2026-squad-fixtures-group-and-hi/ (2026-06)
7. https://www.bcplace.com/?event=fifa-world-cup-2026-australia-vs-tbc (2026-06)

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
