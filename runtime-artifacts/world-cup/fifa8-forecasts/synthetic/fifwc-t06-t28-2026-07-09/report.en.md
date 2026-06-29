# T06 vs T28 — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** T06 favoured, ~77.9% — T06 77.9% / Draw 21.7% / T28 0.4% (confidence: high)

## All nine forecasters

| Forecaster | T06 win | Draw | T28 win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 62% | 23.8% | 14.2% | T06 |
| xG-corrected Elo | 72.6% | 18.1% | 9.3% | T06 |
| PRODEGY split attack/defence Elo | 49.9% | 21.8% | 28.3% | T06 |
| Physical-decay dynamic-K Elo | 70.4% | 19.1% | 10.5% | T06 |
| Tactical style-clash mElo | 65.5% | 23.2% | 11.3% | T06 |
| Line-breaks & offers efficiency (gradient-boosted) | 96.5% | 3.5% | 0% | T06 |
| Passing-network structure (random forest) | 64.5% | 35.3% | 0.2% | T06 |
| Stacked Ensemble | 47% | 21.4% | 31.6% | T06 |
| Multi-calibrated 8-in-1 | 77.9% | 21.7% | 0.4% | T06 |

## Disagreement

Of 9 forecasters: 9 lean T06, 0 lean T28, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+44.5pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T06 at 78%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T06's win chance by 0 points.

_Method: Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
