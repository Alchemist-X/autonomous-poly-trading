# T00 vs T07 — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** T00 favoured, ~64% — T00 64% / Draw 34.1% / T07 1.9% (confidence: high)

## All nine forecasters

| Forecaster | T00 win | Draw | T07 win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 65.1% | 21.8% | 13.2% | T00 |
| xG-corrected Elo | 83.5% | 12.6% | 3.9% | T00 |
| PRODEGY split attack/defence Elo | 59% | 20% | 21% | T00 |
| Physical-decay dynamic-K Elo | 79.8% | 14.7% | 5.5% | T00 |
| Tactical style-clash mElo | 46.6% | 28.8% | 24.6% | T00 |
| Line-breaks & offers efficiency (gradient-boosted) | 83.6% | 4.5% | 12% | T00 |
| Passing-network structure (random forest) | 58.7% | 41.1% | 0.2% | T00 |
| Stacked Ensemble | 46.1% | 21.8% | 32.1% | T00 |
| Multi-calibrated 8-in-1 | 64% | 34.1% | 1.9% | T00 |

## Disagreement

Of 9 forecasters: 9 lean T00, 0 lean T07, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+38.4pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T00 at 72%.
- **Bias correction** (-7.7pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T00's win chance by -7.7 points.

_Method: Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
