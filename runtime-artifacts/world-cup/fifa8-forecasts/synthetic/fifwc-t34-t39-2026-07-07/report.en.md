# T34 vs T39 — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** T34 favoured, ~82.4% — T34 82.4% / Draw 17% / T39 0.7% (confidence: high)

## All nine forecasters

| Forecaster | T34 win | Draw | T39 win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 56.7% | 28.3% | 15.1% | T34 |
| xG-corrected Elo | 62.6% | 21.8% | 15.5% | T34 |
| PRODEGY split attack/defence Elo | 40.4% | 23.3% | 36.3% | T34 |
| Physical-decay dynamic-K Elo | 62.1% | 22% | 15.9% | T34 |
| Tactical style-clash mElo | 79.2% | 16.2% | 4.6% | T34 |
| Line-breaks & offers efficiency (gradient-boosted) | 99.6% | 0.4% | 0% | T34 |
| Passing-network structure (random forest) | 78.9% | 18.4% | 2.7% | T34 |
| Stacked Ensemble | 47.8% | 20.9% | 31.4% | T34 |
| Multi-calibrated 8-in-1 | 82.4% | 17% | 0.7% | T34 |

## Disagreement

Of 9 forecasters: 9 lean T34, 0 lean T39, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+49pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T34 at 82%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T34's win chance by 0 points.

_Method: Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
