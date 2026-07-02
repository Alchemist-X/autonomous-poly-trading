# France vs Sweden — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** France favoured, ~67.6% — France 67.6% / Draw 20.8% / Sweden 11.5% (confidence: high)

## All nine forecasters

| Forecaster | France win | Draw | Sweden win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 68.6% | 23.8% | 7.6% | France |
| xG-corrected Elo | 66.9% | 23.6% | 9.5% | France |
| PRODEGY split attack/defence Elo | 38.3% | 24.9% | 36.8% | France |
| Physical-decay dynamic-K Elo | 68% | 23.1% | 8.8% | France |
| Tactical style-clash mElo | 79.8% | 17.8% | 2.4% | France |
| Line-breaks & offers efficiency (gradient-boosted) | 88.5% | 10.8% | 0.8% | France |
| Passing-network structure (random forest) | 82.2% | 12.4% | 5.4% | France |
| Stacked Ensemble | 48.9% | 30.2% | 21% | France |
| Multi-calibrated 8-in-1 | 67.6% | 20.8% | 11.5% | France |

## Disagreement

Of 9 forecasters: 9 lean France, 0 lean Sweden, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+38.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours France at 72%.
- **Bias correction** (-4.3pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting France's win chance by -4.3 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
