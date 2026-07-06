# T17 vs T11 — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** T17 favoured, ~42.2% — T17 42.2% / Draw 22.1% / T11 35.6% (confidence: low)

## All nine forecasters

| Forecaster | T17 win | Draw | T11 win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 40.4% | 27.9% | 31.6% | T17 |
| xG-corrected Elo | 40.2% | 25.9% | 33.9% | T17 |
| PRODEGY split attack/defence Elo | 41.4% | 23.9% | 34.7% | T17 |
| Physical-decay dynamic-K Elo | 42.3% | 25.7% | 32% | T17 |
| Tactical style-clash mElo | 53% | 27.4% | 19.6% | T17 |
| Line-breaks & offers efficiency (gradient-boosted) | 45.1% | 5.8% | 49.1% | T11 |
| Passing-network structure (random forest) | 25.3% | 27.1% | 47.7% | T11 |
| Stacked Ensemble | 43.1% | 22.1% | 34.8% | T17 |
| Multi-calibrated 8-in-1 | 42.2% | 22.1% | 35.6% | T17 |

## Disagreement

Of 9 forecasters: 7 lean T17, 2 lean T11, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+8.9pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T17 at 42%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T17's win chance by 0 points.

_Method: Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
