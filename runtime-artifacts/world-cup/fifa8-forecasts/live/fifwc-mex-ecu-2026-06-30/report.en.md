# Mexico vs Ecuador — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Mexico favoured, ~44.9% — Mexico 44.9% / Draw 22.3% / Ecuador 32.8% (confidence: low)

## All nine forecasters

| Forecaster | Mexico win | Draw | Ecuador win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 33.3% | 37.2% | 29.5% | 平 |
| xG-corrected Elo | 31% | 25.7% | 43.4% | Ecuador |
| PRODEGY split attack/defence Elo | 33.3% | 20% | 46.8% | Ecuador |
| Physical-decay dynamic-K Elo | 34.1% | 25.9% | 40% | Ecuador |
| Tactical style-clash mElo | 76.6% | 17.7% | 5.7% | Mexico |
| Line-breaks & offers efficiency (gradient-boosted) | 63.4% | 10.3% | 26.3% | Mexico |
| Passing-network structure (random forest) | 39% | 15% | 46% | Ecuador |
| Stacked Ensemble | 48.4% | 26.7% | 24.9% | Mexico |
| Multi-calibrated 8-in-1 | 44.9% | 22.3% | 32.8% | Mexico |

## Disagreement

Of 9 forecasters: 4 lean Mexico, 4 lean Ecuador, 1 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+11.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Mexico at 45%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Mexico's win chance by 0 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
