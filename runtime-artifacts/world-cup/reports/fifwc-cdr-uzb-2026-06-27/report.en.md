# 2026 World Cup Group K: DR Congo vs Uzbekistan (Market-Blind Forecast)

- Event slug (resolution metadata only): `fifwc-cdr-uzb-2026-06-27`
- Kickoff: 2026-06-27 23:30 UTC (group-stage matchday 3)
- Generated: 2026-06-11 (~16 days before kickoff)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| DR Congo win | **31%** | 25% – 37% | Low |
| Draw | **26%** | 21% – 31% | Low |
| Uzbekistan win | **43%** | 36% – 50% | Low |

**One-sentence view:** Uzbekistan, 62 Elo points stronger and in steadier warm-up form, are modest favourites, but DR Congo bring a higher-valued European-league core — all three outcomes are genuinely live.

## 2. Definition

Three-way result after 90 minutes of regulation (group stage: no extra time, no penalties); stoppage time counts.

## 3. Team Profiles

| Item | DR Congo (A) | Uzbekistan (B) |
| --- | --- | --- |
| Elo | 1652 (rank 55) | 1714 (rank 42) |
| World Cup history | First finals since 1974 (52 years) | First-ever finals |
| Coach | Sébastien Desabre | Fabio Cannavaro (since Oct 2025) |
| Key players | Wan-Bissaka, Wissa, Mbemba, Bakambu, Pickel | Shomurodov (all-time top scorer, 44 goals), Khusanov (Man City) |
| Latest friendlies | Lost 1-2 to Chile in Orléans on Jun 9 (ESPN, 2026-06-09) | Beat Kuwait and Egypt; narrow 0-1 loss to the Netherlands (Olympics.com, 2026-06) |

Elo source: eloratings.net (via repo `elo-table.json`, fetched 2026-06-11).

## 4. Key Factors

1. **62-point Elo gap mildly favours Uzbekistan** (eloratings.net, 2026-06-11): roughly 44% vs 31% under the neutral-venue Davidson model.
2. **Uzbekistan's warm-up form is better**: under Cannavaro they beat Kuwait and Egypt, and only a late Gakpo goal gave the Netherlands a 0-1 win on the eve of the tournament; Man City centre-back Khusanov anchors the defence (Olympics.com / beIN SPORTS, 2026-06-02).
3. **DR Congo's squad plays at a higher club level**: Premier League players such as Wan-Bissaka and Wissa, with a friendly-match squad valued around EUR 143m versus an Uzbekistan list built on 15/26 domestic-league players (VAVEL / Olympics.com, 2026-06-09 / 2026-06-02) — suggesting Elo may slightly understate DR Congo's individual quality.
4. **DR Congo lost their final warm-up 1-2 to Chile**, played behind closed doors in Orléans over health concerns linked to the Ebola outbreak in the DRC — a disrupted preparation environment (ESPN / VAVEL, 2026-06-09).
5. **Matchday-3 qualification stakes**: both sides face Portugal and Colombia (the group's top two seeds) first, so this match is likely a direct duel for third place and advancement; both teams have strong incentives to win (beIN SPORTS, 2026-06-02).
6. **Venue is Atlanta, USA (neutral)**, listed by beIN as the site of Uzbekistan vs DR Congo on this matchday; an indoor, climate-controlled setting limits weather impact (beIN SPORTS, 2026-06-02).

## 5. Model and Adjustment

- **p_stat (Davidson three-way Elo, scale=400, drawNu=0.7, neutral venue, no host bonus):** DR Congo 30.6% / Draw 25.6% / Uzbekistan 43.8%.
- **Evidence adjustment (total |delta| ~1.6pp, well within the +/-8pp cap):** A +0.4pp, Draw +0.4pp, B -0.8pp. Rationale: DR Congo's European-based core may be slightly understated by Elo (factor 3), but this is largely offset by Uzbekistan's better form (factor 2) and DR Congo's friendly defeat and disrupted preparation (factor 4); evidence is thin and mutually offsetting, so only a minimal shift is applied.
- **p_final:** DR Congo 31% / Draw 26% / Uzbekistan 43%.
- **This forecast is market-blind: fully independent of any betting odds or prediction-market data; no such sources were consulted or cited.**

## 6. Method, Sources, Disclaimer

**Method:** National-team Elo from eloratings.net feeds a Davidson three-way model (scale=400, drawNu=0.7) to produce the statistical baseline; a bounded adjustment of at most +/-8pp, justified only by dated, sourced public facts, is then applied and renormalized. The 80% intervals reflect parameter sensitivity (drawNu 0.6-0.8 moves each leg by ~1-3pp) plus evidence thinness (limited coverage of both teams, lineups and rotation unknown 16 days out; ~+/-4pp extra width). Confidence tier "Low": an evenly matched game with thin evidence.

**Sources:**
1. eloratings.net (Elo and rankings, fetched 2026-06-11)
2. FIFA.com — Congo DR squad announcement (2026-06)
3. Olympics.com — Uzbekistan at FIFA World Cup 2026: full squad, key stats (2026-06)
4. beIN SPORTS — Uzbekistan at the 2026 FIFA World Cup (2026-06-02)
5. ESPN — Congo DR 1-2 Chile, Jun 9, 2026 Final Score (2026-06-09)
6. VAVEL — DR Congo vs Chile (1-2) friendly report (2026-06-09)
7. BSS News — DR Congo to play final World Cup warm up in France (2026-06)

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
