# Market-Blind Forecast: England vs Croatia (2026 World Cup, Group L)

- Kickoff: 2026-06-17 20:00 UTC (AT&T Stadium, Arlington, Texas)
- Event identifier (resolution metadata only): `fifwc-eng-hrv-2026-06-17`
- Generated: 2026-06-11 | Type: **market-blind** (fully independent of any betting/prediction-market data)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| England win | **52%** | 46% – 58% | Medium |
| Draw | **24%** | 20% – 29% | Medium |
| Croatia win | **24%** | 19% – 29% | Medium |

**One-line view:** England's ~112-point Elo edge, unbeaten warm-ups and intact squad against an aging, injury-hampered Croatia coming off weak friendlies put England at ~52%, with draw and Croatia win at ~24% each.

## 2. Definition

Three-way 90-minute result (including stoppage time); no extra time or penalties in the group stage. Outcomes are mutually exclusive and exhaustive.

## 3. Strength Profile

| | England | Croatia |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 2024 (4th) | 1912 (12th) |
| Coach | Thomas Tuchel | Zlatko Dalić |
| Recent friendlies | 1-0 New Zealand (Jun 6), 3-0 Costa Rica (final warm-up) | 0-2 Belgium (Jun 2), 2-1 Slovenia (Jun 7), 1-3 Brazil (Mar 31) |
| Head-to-head | England 1-0 (Euro 2020 group) | Croatia 2-1 (2018 WC semifinal) |

Sources: eloratings.net (via repo elo-table.json); ESPN and VAVEL match pages (see source list).

## 4. Key Factors

1. **England's preparation is on track with warm-up wins**: 1-0 over New Zealand (Jun 6), then a 3-0 win over Costa Rica in the final warm-up (Rice scored). Sources: ESPN (2026-06-06), Sports Mole (2026-06).
2. **Tuchel named a pared-down 26-man squad on May 22, led by Kane**: Foden, Palmer and Alexander-Arnold omitted; Saka carries an Achilles concern requiring minute management, Stones short of club minutes. Sources: englandfootball.com (2026-05-22), ESPN (2026-05).
3. **Croatia's core is aging and carrying injuries**: Modrić, 40, included after an April cheekbone fracture; Gvardiol just recovered from a fractured tibia; Kovačić missed most of the season with Achilles problems. Sources: Croatia Week / extratime.com (2026-05-18).
4. **Croatia's warm-up form is weak**: 0-2 loss to Belgium (Jun 2), narrow 2-1 win over Slovenia (Jun 7), 1-3 loss to Brazil in late March. Sources: ESPN (2026-06-02), VAVEL (2026-06-07), ESPN (2026-03-31).
5. **Neutral, climate-controlled venue**: AT&T Stadium in Arlington has a retractable roof, limiting the impact of June afternoon Texas heat; neither side gets a host bonus. Source: Wikipedia, 2026 FIFA World Cup Group L (accessed 2026-06).
6. **Croatia's tournament resilience is the counter-risk**: 2018 runners-up and 2022 third place — a long record of outperforming on paper in big matches, which caps the adjustment toward England. Source: Wikipedia (accessed 2026-06).

## 5. Model and Adjustment

- **p_stat** (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  England 49.2% / Draw 25.0% / Croatia 25.8%
- **Adjustment delta (6pp total, cap ±8pp)**: England +3.0pp, Draw −1.0pp, Croatia −2.0pp.
  Justified by factors 1, 3, 4 (England's form and squad availability vs Croatia's injuries and weak friendlies); factor 6 (Croatia's tournament resilience) caps the shift at 3pp.
- **p_final**: England 52.2% / Draw 24.0% / Croatia 23.8% (rounded in the table).
- This forecast is **market-blind**: no betting odds or prediction-market prices were fetched or referenced at any point; probabilities come solely from the Elo statistical model plus the bounded, evidence-cited adjustment above.

## 6. Method

World Elo ratings from eloratings.net feed a Davidson three-way model (drawNu=0.7) to produce baseline probabilities; a bounded adjustment of at most ±8pp total, justified only by dated, sourced public facts, is then applied and renormalized. The 80% intervals reflect parameter sensitivity (drawNu 0.6–0.8 moves the England baseline between 47.5% and 51.0%) and evidence thinness (pre-tournament friendlies are noisy signals). Confidence "Medium": Elo data is reliable, but friendlies have limited predictive power for tournament play.

### Sources

1. eloratings.net World.tsv (fetched 2026-06-11, repo elo-table.json)
2. https://www.englandfootball.com/articles/2026/May/22/england-mens-world-cup-2026-squad-named-by-thomas-tuchel-20262205 (2026-05-22)
3. https://www.espn.com/soccer/story/_/id/48823863/meet-england-2026-world-cup-squad-26-players-picked-thomas-tuchel-why (2026-05)
4. https://www.sportsmole.co.uk/football/england/world-cup-2026/news/england-injury-boost-four-players-join-wc-camp-as-tuchels-lineup-questioned_598790.html (2026-06)
5. https://www.espn.com/soccer/match/_/gameId/401860828/new-zealand-england (2026-06-06)
6. https://www.croatiaweek.com/croatia-2026-world-cup-squad-zlatko-dalic/ (2026-05-18)
7. https://www.espn.com/soccer/match/_/gameId/401856361/belgium-croatia (2026-06-02)
8. https://www.vavel.com/en-us/soccer/2026/06/07/1262763-croatia-vs-slovenia-live-score-friendly.html (2026-06-07)
9. https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_L (accessed 2026-06)

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
