# T21 vs T14 — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** T21 favoured, ~75.5% — T21 75.5% / Draw 23.9% / T14 0.6% (confidence: high)

## All nine forecasters

| Forecaster | T21 win | Draw | T14 win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 85.4% | 10.9% | 3.7% | T21 |
| xG-corrected Elo | 92.8% | 6.3% | 0.9% | T21 |
| PRODEGY split attack/defence Elo | 63.7% | 19.6% | 16.7% | T21 |
| Physical-decay dynamic-K Elo | 91% | 7.7% | 1.3% | T21 |
| Tactical style-clash mElo | 74.7% | 18.8% | 6.5% | T21 |
| Line-breaks & offers efficiency (gradient-boosted) | 95.4% | 3.5% | 1.1% | T21 |
| Passing-network structure (random forest) | 90.4% | 9.4% | 0.2% | T21 |
| Stacked Ensemble | 48.6% | 20.9% | 30.5% | T21 |
| Multi-calibrated 8-in-1 | 75.5% | 23.9% | 0.6% | T21 |

## Disagreement

Of 9 forecasters: 9 lean T21, 0 lean T14, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+52.4pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T21 at 86%.
- **Bias correction** (-10.2pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T21's win chance by -10.2 points.

_Method: Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
