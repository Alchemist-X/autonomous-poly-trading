# Mexico vs Ecuador — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Mexico favoured, ~38% — Mexico 38% / Draw 34.2% / Ecuador 27.8% (confidence: low)

## All nine forecasters

| Forecaster | Mexico win | Draw | Ecuador win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 28.2% | 46.8% | 25% | 平 |
| xG-corrected Elo | 26.2% | 37.1% | 36.7% | 平 |
| PRODEGY split attack/defence Elo | 28.2% | 32.2% | 39.6% | Ecuador |
| Physical-decay dynamic-K Elo | 28.9% | 37.2% | 33.9% | 平 |
| Tactical style-clash mElo | 64.9% | 30.3% | 4.8% | Mexico |
| Line-breaks & offers efficiency (gradient-boosted) | 53.7% | 24% | 22.3% | Mexico |
| Passing-network structure (random forest) | 33% | 28% | 39% | Ecuador |
| Stacked Ensemble | 41% | 37.9% | 21.1% | Mexico |
| Multi-calibrated 8-in-1 | 38% | 34.2% | 27.8% | Mexico |

## Disagreement

Of 9 forecasters: 4 lean Mexico, 2 lean Ecuador, 3 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+11.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Mexico at 45%.
- **Bias correction** (-6.9pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Mexico's win chance by -6.9 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
