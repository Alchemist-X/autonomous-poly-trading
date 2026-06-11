# Bosnia-Herzegovina vs Qatar — 2026 World Cup Group B (Market-Blind Forecast)

- **Match**: 2026-06-24 19:00 UTC, Lumen Field (Seattle, neutral venue), Group B matchday 3
- **Generated**: 2026-06-11T13:15:00Z | Nature: **market-blind** (fully independent of any betting/prediction-market prices)

## 1. Forecast

| Outcome (90 min) | p_final | 80% interval | Confidence |
| --- | --- | --- | --- |
| Bosnia-Herzegovina win | **53.8%** | 46% – 61% | Medium |
| Draw | **24.7%** | 19% – 30% | Medium |
| Qatar win | **21.5%** | 15% – 28% | Medium |

**One-line view**: A 174-point Elo gap makes Bosnia-Herzegovina the clear stronger side, but Dzeko's unresolved injury and final-matchday variables cap conviction; BIH win probability is about 54%.

## 2. Definition

Three-way 90-minute result (win/draw/loss); no extra time or penalties in the group stage; stoppage time counts within the 90-minute result.

## 3. Strength Profile

- **Bosnia-Herzegovina**: Elo 1595 (world No. 65), from eloratings.net (fetched 2026-06-11). Qualified via a playoff penalty-shootout win over Italy (2026-03-31). Talisman Edin Dzeko (40, all-time top scorer with 73 goals) has fitness doubts. Sources: eloratings.net; mlssoccer.com (Group B preview).
- **Qatar**: Elo 1421 (world No. 96), same source and date. Coach Julen Lopetegui has only 2 wins since taking over in summer 2025; no competitive match since December 2025; lost 1-0 to Ireland in an early-June friendly. Sources: fourfourtwo.com (2026-06); mlssoccer.com.

## 4. Key Factors

1. **Dzeko's shoulder injury**: only 64 cumulative minutes since the March injury; sat out the final pre-tournament warm-up; return timing uncertain (northerntribune.ca, 2026-06; sportsmole.co.uk, 2026-06). This is matchday 3, roughly 12 extra recovery days versus the opener, so the impact is discounted.
2. **BIH attacking depth weakened**: Tabakovic recovering from a fractured metatarsal, Sunjic has muscle problems; backup striker Demirovic (Stuttgart) can deputize (sportsmole.co.uk, 2026-06).
3. **Qatar in poor form**: only 2 wins under Lopetegui; 26-man squad named June 2; lost 1-0 to Ireland in an early-June friendly (fourfourtwo.com, 2026-06; qna.org.qa, 2026-06-02).
4. **Qatar short of competitive rhythm**: no competitive match since December 2025; attack relies on Almoez Ali (12 goals in AFC qualifying) and Akram Afif (mlssoccer.com, 2026; olympics.com, 2026).
5. **Neutral venue**: Lumen Field, Seattle — no home advantage for either side (soundersfc.com, 2025-12).
6. **Final-matchday variables**: June 24 is Group B's last matchday (simultaneous kickoffs); qualification scenarios may change rotation and motivation — unknowable now, reflected in the intervals, not the point estimates.

## 5. Model and Adjustment

- **p_stat (Davidson three-way model, scale=400, drawNu=0.7, neutral venue, no host bonus)**:
  BIH 55.8% / Draw 23.7% / Qatar 20.5% (Ra=1595, Rb=1421).
- **Evidence-based adjustment (cap +/-8pp, applied +/-2pp)**: Dzeko's injury and BIH's weakened forward depth create downside risk (-2pp BIH); Qatar's poor form and long competitive layoff are already largely priced into their low 1421 Elo, so no double-counting; Draw +1pp, Qatar +1pp.
- **p_final**: BIH 53.8% / Draw 24.7% / Qatar 21.5%.
- This forecast is **market-blind**: no betting or prediction-market prices were read or referenced at any point; probabilities come solely from the Elo statistical model plus the bounded, sourced adjustment above.

## 6. Method and Sources

Method: eloratings.net snapshot (2026-06-11) fed into the Davidson three-way model (identical to eloToOneXTwo in the repo's packages/sports-model/src/elo.ts) for baseline probabilities; then a bounded adjustment of at most +/-8pp based on dated, sourced team intelligence, renormalized. The 80% intervals reflect drawNu 0.6-0.8 parameter sensitivity (BIH win 54.0%-57.8%), injury uncertainty, and final-matchday motivation variables.

Sources:
1. https://www.eloratings.net/World.tsv (fetched 2026-06-11)
2. https://northerntribune.ca/world-cup-2026-edin-dzeko-injury/ (2026-06)
3. https://www.sportsmole.co.uk/football/canada/world-cup-2026/predicted-lineups/dzeko-seeking-an-improbable-return-predicted-bosnia-herzegovina-lineup-vs-canada_598905.html (2026-06)
4. https://www.fourfourtwo.com/team/qatar-world-cup-2026-squad (2026-06)
5. https://qna.org.qa/en/News-Area/News/2026-6/2/2026-world-cup-qatar-coach-announces-final-squad (2026-06-02)
6. https://www.mlssoccer.com/news/2026-fifa-world-cup-group-b-preview-canada-bosnia-herzegovina-qatar-switzerland (2026-06)
7. https://www.soundersfc.com/news/bosnia-and-herzegovina-to-face-qatar-at-lumen-field-after-securing-final-group-b-spot-for-2026-fifa-world-cup (2025-12)

> This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
