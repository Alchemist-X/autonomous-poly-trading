# Canada vs Qatar (2026 World Cup Group B, 2026-06-18, BC Place, Vancouver)

> Market-blind report - generated 2026-06-11 - fully independent of any betting or prediction-market data

## 1. Forecast

| Outcome | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Canada win | **0.770** | 0.70 - 0.83 | Medium |
| Draw | **0.166** | 0.12 - 0.21 | Medium |
| Qatar win | **0.064** | 0.04 - 0.10 | Medium |

**One-sentence view:** Hosting in Vancouver with an Elo edge of nearly 470 points (host bonus included), Canada are heavy favourites on the numbers despite an injury cloud around Davies and others; Qatar are out of form under Lopetegui, leaving limited upset room though a draw is not negligible.

## 2. Definition

- Target: 90-minute three-way result (win/draw/loss); no extra time in the group stage.
- Resolution metadata: event slug `fifwc-can-qat-2026-06-18` (settlement identifier only, not a data source).
- Kickoff: 2026-06-18T22:00:00Z (15:00 local, Vancouver).

## 3. Strength profile

| Dimension | Canada | Qatar |
| --- | --- | --- |
| Elo (eloratings.net, fetched 2026-06-11) | 1788 (world #25) | 1421 (world #96) |
| Host bonus | +100 (hosts play all group matches at home) | None |
| Coach | Jesse Marsch | Julen Lopetegui (since summer 2025, only 2 wins) |
| Key players | Jonathan David, Alphonso Davies (injured), Tajon Buchanan | Akram Afif (11 assists in AFC qualifying), Almoez Ali (12 goals) |

Head-to-head: only one prior meeting, a 2-0 Canada friendly win (Goal.com).

## 4. Key factors (sourced + dated)

1. **Davies out of the opener, June 18 availability uncertain:** Marsch confirmed Davies (hamstring strain) misses the June 12 opener vs Bosnia but "will play in the tournament" - his role vs Qatar is undecided (ESPN https://www.espn.com/soccer/story/_/id/48914937/ ; FOX Sports, early June 2026, accessed 2026-06-11).
2. **Wider Canadian injury list:** Starting centre-back Moise Bombito reportedly removed from the roster, not fit to contribute (SI https://www.si.com/soccer/canada-loses-star-player-injury-eve-2026-world-cup , accessed 2026-06-11).
3. **Jonathan David's modest form:** Just 6 Serie A goals in his first Juventus season, one since early February, and freshly back ahead of schedule from a hip-tendon injury (Goal.com / Yahoo Sports, accessed 2026-06-11).
4. **Qatar's poor run:** Only 2 wins under Lopetegui since summer 2025; scraped through Asian qualifying (Squawka https://www.squawka.com/en/news/world-cup/qatar-world-cup-2026-fixtures-squad-analysis/ , accessed 2026-06-11).
5. **A true home fixture:** BC Place, Vancouver (~54,000, retractable roof); Canada play all group games on home soil - real crowd and travel advantages (BC Place https://www.bcplace.com/?event=fifa-world-cup-2026-canada-vs-qatar , accessed 2026-06-11).
6. **Stakes:** Canada are chasing a first-ever group-stage exit ticket with Switzerland also in Group B, making this close to a must-win (Destination Vancouver / OneSoccer, accessed 2026-06-11).

## 5. Model and adjustment

- **p_stat (Davidson three-way model, scale=400, drawNu=0.7, +100 host bonus for Canada):**
  Canada 0.800 / Draw 0.146 / Qatar 0.054
- **Evidence adjustment (capped at +/-8pp total):** Canada -3.0pp, Draw +2.0pp, Qatar +1.0pp.
  Rationale: Canada's injury cloud (Davies doubtful, Bombito out, David below form) materially weakens both ends, so the win probability is trimmed; but Qatar's own poor form and the huge Elo gap keep the shift small.
- **p_final (normalized):** Canada 0.770 / Draw 0.166 / Qatar 0.064
- **Market-blind:** no betting odds, prediction-market prices, or implied probabilities were consulted; the numbers come solely from the Elo statistical model plus a bounded evidence adjustment.

## 6. Method, sources, disclaimer

**Method:** eloratings.net current Elo feeds a Davidson three-way model (drawNu=0.7); hosts get +100 Elo in group matches. Public news evidence then drives an adjustment bounded at +/-8pp, renormalized. The 80% intervals reflect parameter sensitivity (drawNu 0.6-0.8, host bonus +/-35 gives Canada-win 0.761-0.835; removing the host bonus entirely gives 0.733) plus evidence thinness (a week out, lineups unpublished).

**Sources:**
1. eloratings.net World.tsv (fetched 2026-06-11)
2. ESPN - Canada 26-player World Cup roster / Davies injury (accessed 2026-06-11)
3. FOX Sports - Davies named to squad despite hamstring injury (accessed 2026-06-11)
4. SI - Canada loses star player (Bombito) on eve of World Cup (accessed 2026-06-11)
5. Goal.com / Yahoo Sports - Jonathan David form and injury comeback (accessed 2026-06-11)
6. Squawka - Qatar squad and Lopetegui record (accessed 2026-06-11)
7. Olympics.com - Qatar squad, Afif/Ali qualifying stats (accessed 2026-06-11)
8. BC Place / Destination Vancouver - venue and fixture info (accessed 2026-06-11)

**Disclaimer:** This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
