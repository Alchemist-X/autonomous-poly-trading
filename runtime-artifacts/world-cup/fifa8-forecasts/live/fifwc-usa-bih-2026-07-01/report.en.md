# United States vs Bosnia-Herzegovina — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** United States favoured, ~48% — United States 48% / Draw 32.8% / Bosnia-Herzegovina 19.2% (confidence: medium)

## All nine forecasters

| Forecaster | United States win | Draw | Bosnia-Herzegovina win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 51% | 35.6% | 13.4% | United States |
| xG-corrected Elo | 48.7% | 33.5% | 17.8% | United States |
| PRODEGY split attack/defence Elo | 35.6% | 41.8% | 22.7% | 平 |
| Physical-decay dynamic-K Elo | 45.1% | 34.2% | 20.7% | United States |
| Tactical style-clash mElo | 51.4% | 35.2% | 13.4% | United States |
| Line-breaks & offers efficiency (gradient-boosted) | 58.5% | 24.5% | 17.1% | United States |
| Passing-network structure (random forest) | 50.5% | 21.7% | 27.8% | United States |
| Stacked Ensemble | 42.9% | 36.1% | 21% | United States |
| Multi-calibrated 8-in-1 | 48% | 32.8% | 19.2% | United States |

## Disagreement

Of 9 forecasters: 8 lean United States, 0 lean Bosnia-Herzegovina, 1 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+21.7pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours United States at 55%.
- **Bias correction** (-7.1pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting United States's win chance by -7.1 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
