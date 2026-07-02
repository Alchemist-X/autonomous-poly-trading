# T20 vs T38 — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** T20 favoured, ~58.2% — T20 58.2% / Draw 25.3% / T38 16.5% (confidence: medium)

## All nine forecasters

| Forecaster | T20 win | Draw | T38 win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 36.7% | 28% | 35.3% | T20 |
| xG-corrected Elo | 55.5% | 23.7% | 20.7% | T20 |
| PRODEGY split attack/defence Elo | 43.2% | 24.4% | 32.4% | T20 |
| Physical-decay dynamic-K Elo | 56.4% | 23.6% | 20.1% | T20 |
| Tactical style-clash mElo | 74% | 19.2% | 6.9% | T20 |
| Line-breaks & offers efficiency (gradient-boosted) | 60.5% | 36.3% | 3.2% | T20 |
| Passing-network structure (random forest) | 74.6% | 16.4% | 9% | T20 |
| Stacked Ensemble | 45.4% | 22% | 32.5% | T20 |
| Multi-calibrated 8-in-1 | 58.2% | 25.3% | 16.5% | T20 |

## Disagreement

Of 9 forecasters: 9 lean T20, 0 lean T38, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+24.9pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T20 at 58%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T20's win chance by 0 points.

_Method: Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
