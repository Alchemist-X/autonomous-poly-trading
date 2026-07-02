# T25 vs T02 — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** T25 favoured, ~79.8% — T25 79.8% / Draw 19.9% / T02 0.3% (confidence: high)

## All nine forecasters

| Forecaster | T25 win | Draw | T02 win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 64% | 23.7% | 12.3% | T25 |
| xG-corrected Elo | 78.9% | 15.2% | 6% | T25 |
| PRODEGY split attack/defence Elo | 55.5% | 22.7% | 21.7% | T25 |
| Physical-decay dynamic-K Elo | 76.7% | 16.3% | 7% | T25 |
| Tactical style-clash mElo | 79.3% | 16.2% | 4.6% | T25 |
| Line-breaks & offers efficiency (gradient-boosted) | 96.5% | 3.5% | 0% | T25 |
| Passing-network structure (random forest) | 58% | 41.8% | 0.2% | T25 |
| Stacked Ensemble | 47.2% | 21.5% | 31.2% | T25 |
| Multi-calibrated 8-in-1 | 79.8% | 19.9% | 0.3% | T25 |

## Disagreement

Of 9 forecasters: 9 lean T25, 0 lean T02, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+46.5pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T25 at 80%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T25's win chance by 0 points.

_Method: Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
