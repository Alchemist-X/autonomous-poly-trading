# New Zealand vs Egypt — 2026 World Cup Group G (Market-Blind Forecast)

- **Match**: 2026-06-21 (kickoff 2026-06-22T01:00:00Z UTC), BC Place, Vancouver (neutral venue)
- **Settlement definition**: 90-minute three-way result (win/draw/loss); no extra time in the group stage
- **Event identifier (resolution metadata only)**: `fifwc-nzl-egy-2026-06-21`
- **Generated**: 2026-06-11

## 1. Forecast Summary

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| New Zealand win | **22.5%** | 17% – 29% | Medium |
| Draw | **24.0%** | 19% – 29% | Medium |
| Egypt win | **53.5%** | 46% – 60% | Medium |

**One-sentence view**: Egypt hold the upper hand (~53.5%) on the back of a ~134-point Elo edge and a Salah-led front line, but with a fully assembled New Zealand squad and Chris Wood back fit, the combined upset-plus-draw probability is close to half — this is far from decided.

## 2. Definition

The forecast covers the three-way result within 90 minutes (including stoppage time, excluding extra time/penalties); World Cup group-stage matches have no extra time, so a draw stands as the final result.

## 3. Team Profiles

| Metric | New Zealand | Egypt |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1562 (72nd) | 1696 (48th) |
| FIFA ranking (as cited by ESPN, 2026-06) | ~50+ range | 29th |
| Final friendly (2026-06-06) | 0-1 vs England (Tampa) | 1-2 vs Brazil (Cleveland) |
| Key players | Chris Wood (Nottingham Forest, 34, back from December knee surgery) | Mohamed Salah (captain), Omar Marmoush (Man City) |

Both sides lost narrowly to elite opposition in their final warm-ups; Egypt briefly equalised against Brazil through Ziko.

## 4. Key Factors

1. **134-point Elo gap**: Egypt 1696 vs New Zealand 1562; the statistical model gives Egypt a ~51.6% baseline win probability (eloratings.net, 2026-06-11).
2. **Salah recovered and leading**: out roughly four weeks with a May hamstring injury, he has since recovered and captains the squad, partnering Man City's Marmoush up front (Al Jazeera, 2026-05-21; olympics.com, 2026-06).
3. **Egypt competitive against elite opposition**: narrow 1-2 loss to Brazil on June 6, equalising early through Ziko — form looks serviceable (ESPN, 2026-06-06).
4. **Wood back, but sharpness unproven**: New Zealand's captain had left-knee surgery in December; he says he is "fully back to full fitness," but at 34 with a short post-surgery run-in, his sharpness at international intensity is uncertain (ESPN / Flashscore, 2026-05/06).
5. **New Zealand lost only 0-1 to England** (2026-06-06, Tampa), showing defensive resilience (ESPN, 2026-06-06).
6. **Neutral venue**: BC Place (Vancouver) is home to neither side; no host bonus applies. Both teams play their group-stage openers on June 15 (NZ vs Iran, Egypt vs Belgium), so this is each side's second match and the stakes depend on those results (schedule: nzfootball.co.nz / vanfc26.com).

## 5. Model and Adjustment

- **p_stat (Davidson three-way model, scale=400, drawNu=0.7, no host bonus)**: New Zealand 23.9% / Draw 24.6% / Egypt 51.6%.
- **Adjustment (total ~3.8pp, cap ±8pp)**: Egypt +1.9pp, New Zealand −1.4pp, Draw −0.6pp. Rationale: Egypt's individual attacking quality (recovered Salah plus Marmoush) and their showing against Brazil slightly exceed what the Elo baseline encodes; New Zealand's top scorer Wood has had a short post-surgery run-in with questionable match rhythm. Evidence overall is thin, so the shift is kept modest.
- **p_final**: New Zealand 22.5% / Draw 24.0% / Egypt 53.5%.
- **This is a market-blind forecast**: fully independent of any odds, betting lines, or prediction-market prices; no such data was consulted or referenced.

## 6. Method

Baseline probabilities come from World Football Elo Ratings (eloratings.net, 2026-06-11 snapshot) fed into a Davidson three-way model (identical to eloToOneXTwo in the repo's `packages/sports-model/src/elo.ts`: scale=400, drawNu=0.7), followed by a bounded evidence-based adjustment of at most ±8pp, then renormalisation. The 80% intervals reflect model parameter sensitivity (Egypt's win probability spans roughly 49.8%–53.5% across drawNu 0.6–0.8) plus evidence thinness (group openers not yet played; limited form information).

### Sources

1. eloratings.net World.tsv (snapshot 2026-06-11, local `elo-table.json`)
2. Al Jazeera — Salah named captain, Egypt squad announced (2026-05-21): https://www.aljazeera.com/sports/2026/5/21/mohamed-salah-to-captain-egypt-as-squad-announced-for-fifa-world-cup-2026
3. olympics.com — Egypt full squad, schedule, Salah recovery (2026-06): https://www.olympics.com/en/news/fifa-world-cup-2026-mohamed-salah-and-egypt-chase-first-ever-quarter-final-berth-all-players-full-squad-list-key-stats-and-schedule
4. ESPN — Brazil 2-1 Egypt (2026-06-06): https://www.espn.com/soccer/match/_/gameId/401861998/egypt-brazil
5. ESPN — Chris Wood headlines New Zealand squad (2026-05/06): https://www.espn.com/soccer/story/_/id/48764554/chris-wood-headlines-new-zealand-2026-world-cup-squad
6. Flashscore — Wood says fully fit (2026-06): https://www.flashscore.com/news/soccer-world-cup-new-zealand-captain-chris-wood-fully-fit-for-2026-world-cup-after-injury-battles/xj5tDLMN/
7. ESPN — England 1-0 New Zealand friendly (2026-06-06): https://www.espn.com/soccer/story/_/id/48967413/england-new-zealand-kickoff-how-watch-stats-team-news-pre-fifa-world-cup-2026-international-friendly
8. Vancouver BC Place schedule (2026-06): https://vanfc26.com/schedule

### Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
