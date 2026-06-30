# Germany vs Paraguay — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Germany favoured, ~46.6% — Germany 46.6% / Draw 36% / Paraguay 17.4% (confidence: medium)

## All nine forecasters

| Forecaster | Germany win | Draw | Paraguay win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 47.9% | 37.6% | 14.5% | Germany |
| xG-corrected Elo | 43.3% | 35.4% | 21.3% | Germany |
| PRODEGY split attack/defence Elo | 44.6% | 32% | 23.4% | Germany |
| Physical-decay dynamic-K Elo | 39.8% | 35.9% | 24.2% | Germany |
| Tactical style-clash mElo | 34% | 39.6% | 26.3% | 平 |
| Line-breaks & offers efficiency (gradient-boosted) | 61.7% | 34.4% | 3.8% | Germany |
| Passing-network structure (random forest) | 59.7% | 35.6% | 4.7% | Germany |
| Stacked Ensemble | 41.9% | 37.4% | 20.7% | Germany |
| Multi-calibrated 8-in-1 | 46.6% | 36% | 17.4% | Germany |

## Disagreement

Of 9 forecasters: 8 lean Germany, 0 lean Paraguay, 1 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+21pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Germany at 54%.
- **Bias correction** (-7.7pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Germany's win chance by -7.7 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
