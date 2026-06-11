# Paraguay vs Australia — 2026 World Cup Group D (Market-Blind Forecast)

- Match: 2026-06-25 local (UTC 2026-06-26T02:00)
- Venue: Levi's Stadium, Santa Clara, California, USA (neutral venue, Match 60)
- Resolution metadata: event slug `fifwc-par-aus-2026-06-25` (identifier only; this forecast references no market data)

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Paraguay win | **41%** | 35% – 47% | Low |
| Draw | **27%** | 21% – 32% | Low |
| Australia win | **32%** | 26% – 38% | Low |

**One-line view:** Elo gives Paraguay a modest edge, but with each side missing a key midfielder and Australia exceptionally well prepared, the 41/27/32 split means this match remains wide open.

## 2. Definition

Three-way result after 90 minutes (plus stoppage time): Paraguay win / draw / Australia win. No extra time or penalties in the group stage.

## 3. Team Profiles

- Paraguay: Elo 1834 (world #22), coached by Gustavo Alfaro; known for defensive discipline, physicality, and set-piece threat. Key players include Miguel Almirón and defenders Gustavo Gómez / Omar Alderete. Sources: eloratings.net (fetched 2026-06-11); FIFA.com Paraguay squad coverage (2026-06).
- Australia: Elo 1777 (world #28), coached by Tony Popovic; 26-man squad announced 2026-06-01. The Socceroos have trained in Sarasota, Florida since April — the first of the 48 teams to begin US-based preparation. Sources: eloratings.net (2026-06-11); fifaworldcupnews.com / fifa-26.com (2026-06-01).
- The 57-point Elo gap is a modest edge, far from a dominant strength differential.

## 4. Key Factors

1. **Paraguay without Villasanti**: starting midfielder Mathías Villasanti misses out after a 2025 ACL tear; as an older injury, its effect is already partly baked into Paraguay's recent Elo results. Sources: asunciontimes.com / beinsports.com (2026-06-01).
2. **Australia without McGree**: midfielder Riley McGree is out of the World Cup with a hamstring injury; he was expected to start, and this fresher loss is not yet reflected in Elo. Source: ESPN 2026 World Cup injuries tracker (2026-06, ongoing).
3. **Australia's acclimatization edge**: long-cycle Sarasota camp since April plus earliest US arrival means strong climate/jet-lag adaptation. Source: fifaworldcupnews.com (2026-06-01).
4. **Schedule position (final round)**: this is Group D's Match 60 (third group-stage round); the standings at that point may amplify or dampen either side's motivation, adding rotation/settle-for-a-draw variance. Sources: Wikipedia "2026 FIFA World Cup Group D"; fox.com match page (accessed 2026-06-11).
5. **Stylistic matchup**: Paraguay's defensive counter-attacking and set-piece approach against a near-peer opponent tends to keep draw probability elevated. Source: mlssoccer.com Group D preview (2026-06).

## 5. Model and Adjustment

- p_stat (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus):
  Paraguay 43.2% / draw 25.7% / Australia 31.1%
- Evidence-based adjustment (2pp total, well within the ±8pp cap):
  - Paraguay −2pp: the McGree and Villasanti absences roughly offset, but Villasanti's is already partly absorbed by Elo while McGree's is not; Australia's preparation edge adds slightly.
  - Draw +1pp, Australia +1pp: stylistic matchup and final-round variance modestly raise draw and upset probability.
- p_final: **Paraguay 41% / draw 27% / Australia 32%**
- This is a **market-blind** forecast: fully independent of any betting odds, prediction-market prices, or implied probabilities; no odds data was consulted.

## 6. Method

Baseline from eloratings.net world Elo (fetched 2026-06-11) plus the Davidson three-way draw model (identical to eloToOneXTwo in the repo's `packages/sports-model/src/elo.ts`: scale=400, drawNu=0.7; the +100 host bonus applies only to Mexico/USA/Canada home group matches — not applicable here). A bounded adjustment of at most ±8pp is applied only on cited, dated public facts. The 80% intervals reflect drawNu 0.6–0.8 parameter sensitivity (Paraguay win 41.7%–44.9%) plus the extra uncertainty of unsettled lineups 14 days out and final-round motivational variance.

### Sources

1. eloratings.net World.tsv (fetched 2026-06-11) — https://www.eloratings.net/World.tsv
2. FIFA.com — Paraguay squad announcement (Gustavo Alfaro), 2026-06 — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/paraguay-squad-announcement-gustavo-alfaro
3. beIN Sports — Gustavo Alfaro and Paraguay Squad for the FIFA World Cup 2026, 2026-06-01 — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/gustavo-alfaro-and-paraguay-squad-for-the-fifa-world-cup-2026-2026-06-01
4. Asuncion Times — Paraguay's 2026 World Cup Squad Revealed, 2026-06 — https://asunciontimes.com/sport/international-sport/26-names-one-nation-paraguays-2026-world-cup-squad-revealed/
5. fifaworldcupnews.com — Australia World Cup 2026 Squad, 2026-06-01 — https://www.fifaworldcupnews.com/australia-world-cup-2026-squad/
6. ESPN — 2026 World Cup injuries tracker, 2026-06 — https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info
7. Wikipedia — 2026 FIFA World Cup Group D (accessed 2026-06-11) — https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_D ; FOX match page — https://www.fox.com/soccer/fifa-world-cup/paraguay-vs-australia-jun-25-2026-group-d

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
