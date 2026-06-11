# Jordan vs Algeria (2026 World Cup Group J, 2026-06-22) — Market-Blind Forecast

> Generated: 2026-06-11 | Kickoff (UTC): 2026-06-23T03:00:00Z | Venue: Levi's Stadium (Santa Clara, USA, neutral)
> Event slug (resolution metadata only): `fifwc-jor-alg-2026-06-22`

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Jordan win | **26%** | 20% – 32% | Medium |
| Draw | **25%** | 20% – 30% | Medium |
| Algeria win | **49%** | 42% – 56% | Medium |

**One-line view**: Algeria's 92-point Elo edge, intact squad, and strong qualifying attack make them a clear but not overwhelming favourite on merit; Jordan's warm-up defeats and a forward injury nudge Algeria's win probability to near 50%.

## 2. Outcome definition

- Three-way result over 90 minutes (plus stoppage time): Jordan win / draw / Algeria win.
- No extra time or penalties in the group stage; a draw stands as the final result.

## 3. Team profiles

| Metric | Jordan | Algeria |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1680 (rank 52) | 1772 (rank 29) |
| World Cup pedigree | First-ever finals appearance | Multiple appearances; 8 qualifying wins |
| Key players | Mousa Tamari (Rennes, only top-5-league player) | Mahrez (captain, 113 caps, 38 goals), Amoura (10 qualifying goals) |
| Recent form | Friendly losses 1-4 vs Switzerland (May 31), 0-2 vs Colombia | 26-man squad named May 31, core intact (Bennacer omitted) |

The two sides have never met before (MLSSoccer Group J preview).

## 4. Key factors

1. **92-point Elo gap**: Algeria 1772 vs Jordan 1680, yielding a ~47% baseline win probability for Algeria in the statistical model (eloratings.net, 2026-06-11).
2. **Jordan's warm-up losses and injury**: 1-4 vs Switzerland (May 31) and 0-2 vs Colombia; forward Ibrahim Sabra ruptured left ankle ligaments in training and was replaced by 20-year-old defender Mohammad Taha (Al Jazeera 2026-06-06; OneFootball, June 2026).
3. **Algeria intact and potent**: Petkovic named his squad on May 31; Mahrez leads what he calls his last World Cup; Amoura scored 10 in 8 qualifiers (beIN Sports 2026-05-31).
4. **Group stakes**: with holders Argentina in the group, both sides treat this as the key battle for second place — strong win incentives on both sides, so no upward draw adjustment (MLSSoccer Group J preview, June 2026).
5. **Neutral venue**: Levi's Stadium, Santa Clara, 8 p.m. local kickoff on June 22; no host bonus for either side (levisstadium.com).
6. **Jordan's debut**: an experience deficit exists, but their rank-52 Elo already partially reflects recent form.

## 5. Model and adjustment

- **p_stat (Davidson three-way model, scale=400, drawNu=0.7, no host bonus — neither side is a host)**:
  - Jordan 27.7% / Draw 25.3% / Algeria 47.0%
- **Evidence adjustment (total |delta| ~4pp, within the 8pp cap)**:
  - Jordan -1.7pp: two warm-up defeats (-5 goal difference), forward lost to injury, debut-tournament experience gap;
  - Algeria +2.0pp: intact squad, settled core, strong qualifying attack;
  - Draw -0.3pp: both sides strongly incentivised to win; renormalized.
- **p_final**: Jordan 26% / Draw 25% / Algeria 49%.
- **This is a market-blind forecast**: fully independent of any betting line, odds, or prediction-market price. Numbers come solely from the Elo statistical model plus the bounded, cited adjustments above.

## 6. Method

Baseline probabilities from a Davidson three-way model (identical to `eloToOneXTwo` in the repo's `packages/sports-model/src/elo.ts`) on eloratings.net ratings fetched 2026-06-11, followed by a bounded (max +/-8pp) evidence-based adjustment with renormalization. The 80% intervals reflect parameter sensitivity (drawNu 0.6-0.8 moves the draw between 22.5%-27.9%; Elo +/-25 moves Algeria's win between 44.3%-49.8%) plus extra uncertainty from thin evidence (no prior head-to-head; Jordan has no major-tournament sample).

### Sources

1. eloratings.net (World.tsv, fetched 2026-06-11) — Elo ratings and ranks
2. Al Jazeera (2026-06-06) — Jordan warm-up results, debut context: https://www.aljazeera.com/sports/2026/6/6/jordan-world-cup-2026-preview-players-to-watch-group-matches-and-squad
3. OneFootball (June 2026) — Sabra injury withdrawal, Taha call-up: https://onefootball.com/en/news/ibrahim-sabra-out-mohammad-taha-completes-jordans-2026-world-cup-squad-42984089
4. beIN Sports (2026-05-31) — Algeria 26-man squad, Mahrez/Bennacer news: https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/vladimir-petkovi-s-official-algeria-squad-for-the-2026-fifa-world-cup-2026-05-31
5. MLSSoccer Group J preview (June 2026) — group stakes, no prior meeting, Tamari/Amoura roles: https://www.mlssoccer.com/news/2026-fifa-world-cup-group-j-preview-argentina-algeria-austria-jordan
6. Levi's Stadium official site — venue and kickoff: https://levisstadium.com/event/fifa-world-cup-group-stage-2026-06-22/

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
