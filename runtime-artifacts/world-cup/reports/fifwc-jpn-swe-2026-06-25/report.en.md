# Japan vs Sweden — 2026 World Cup Group F (Market-Blind Forecast)

- Generated: 2026-06-11T13:15:00Z | Kickoff: 2026-06-25T23:00:00Z (Arlington, Texas, USA)
- Event slug (resolution metadata only): `fifwc-jpn-swe-2026-06-25`

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Japan win | **0.55** | 0.49 – 0.62 | Medium |
| Draw | **0.24** | 0.20 – 0.28 | Medium |
| Sweden win | **0.21** | 0.16 – 0.26 | Medium |

**One-sentence view**: A near-200-point Elo gap plus Japan's unbeaten run make Japan clear favourites, but the absences of Mitoma/Minamino and a Sweden front line (Gyökeres + Isak) stronger than its Elo rank keep the upset probability non-trivial.

## 2. Definition

Three-way 90-minute result (win/draw/loss). No extra time or penalties in the group stage.

## 3. Team Profiles

| Item | Japan | Sweden |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1906 (14th) | 1712 (43rd) |
| Coach | Hajime Moriyasu | Graham Potter |
| Recent form | Unbeaten since Sept 2025, incl. wins over Brazil, Scotland 1-0, England 1-0 at Wembley (Daily Maverick, 2026-06-08) | Qualified via an 88th-minute playoff winner vs Poland; first World Cup since 2018 (BigDSoccer, May 2026) |
| Context | Matchday 3; both sides face Netherlands/Tunisia first, so stakes are unknown today | Same |

## 4. Key Factors

1. **Japan's attacking absences**: Kaoru Mitoma (hamstring) missed the final squad; Takumi Minamino is out after an ACL tear last December (Al Jazeera, 2026-05-15).
2. **Kubo fit and available**: recovered from a January hamstring injury after a Copa del Rey-winning season; Takehiro Tomiyasu returns to the 26-man squad after nearly two years (Al Jazeera, 2026-05-22).
3. **Sweden's twin strikers**: Gyökeres won the Premier League with Arsenal as the club's top scorer (19 goals in all comps); Isak made the squad but had an injury-hit season with only 8 league starts (Free Malaysia Today, 2026-05-14; Tribuna, 2026-05-12).
4. **Sweden absence**: Dejan Kulusevski left out of the 26-man squad (Tribuna, 2026-05-12).
5. **Location effects roughly offset — treated as neutral**: the match is in Arlington (Dallas area); Japan also plays its opener in Dallas, and Sweden's base camp is in Frisco, Texas, so both sides know the local conditions (Al Jazeera, 2026-05-22; FMT, 2026-05-14).
6. **Matchday-3 variance**: results of the June 14/20 rounds are unknown; either side could be already through (rotation) or needing a result — the largest unmodellable uncertainty in this forecast.

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus; Japan 1906 vs Sweden 1712):
  Japan 0.579 / Draw 0.232 / Sweden 0.190
- **Bounded adjustment (net -3pp from Japan, +1pp draw, +2pp Sweden; within the ±8pp cap)**:
  - Japan loses two key attackers in Mitoma and Minamino (Factor 1), weakening its ability to break down a low block → Japan -3pp;
  - Sweden's forward talent (Gyökeres/Isak) exceeds what its 43rd Elo rank implies (Sweden missed two straight tournaments, so Elo reflects older squads) → Sweden +2pp, Draw +1pp;
  - Japan's unbeaten run is already priced into its 1906 Elo — no double counting.
- **p_final (renormalized)**: Japan 0.55 / Draw 0.24 / Sweden 0.21
- **This is a market-blind forecast**: fully independent of any betting odds, prediction-market prices, or implied probabilities; no such data was consulted.

## 6. Method and Sources

Method: same-day Elo from eloratings.net feeds a Davidson three-way model (identical to eloToOneXTwo in this repo's `packages/sports-model/src/elo.ts`) for the statistical baseline; a bounded adjustment of at most ±8pp total, justified only by dated, sourced facts, is then applied and renormalized. The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (Japan win 0.560–0.599) widened for evidence thinness (matchday-3 stakes unknown; two weeks to kickoff).

Sources:
1. eloratings.net World.tsv (fetched 2026-06-11; repo elo-table.json)
2. Al Jazeera, 2026-05-15 — Mitoma out / Minamino ACL: https://www.aljazeera.com/sports/2026/5/15/mitoma-fails-to-make-japans-2026-world-cup-squad-due-to-hamstring-injury
3. Al Jazeera, 2026-05-22 — Japan team preview / schedule / Tomiyasu return: https://www.aljazeera.com/sports/2026/5/22/japans-world-cup-2026-team-preview-players-to-watch-group-squad
4. Free Malaysia Today, 2026-05-14 — Sweden squad / Isak 8 league starts / Frisco base: https://www.freemalaysiatoday.com/category/sports/2026/05/14/isak-and-gyokeres-make-swedens-world-cup-roster
5. Tribuna, 2026-05-12 — Kulusevski left out: https://tribuna.com/en/news/2026-05-12-alexander-isak-viktor-gyokeres-named-in-sweden-squad-for-world-cup-dejan-kulusevski-out/
6. Daily Maverick, 2026-06-08 — Japan's unbeaten run (Brazil/Scotland/England wins): https://www.dailymaverick.co.za/article/2026-06-08-japan-favourites-in-tough-group-f-with-holland-sweden-and-tunisia/
7. BigDSoccer, May 2026 — Gyökeres playoff winner vs Poland / PL title top scorer: https://www.bigdsoccer.com/sweden-2026-world-cup-preview/

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
