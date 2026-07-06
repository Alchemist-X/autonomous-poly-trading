# T03 vs T46 — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** T03 favoured, ~69.9% — T03 69.9% / Draw 28.8% / T46 1.2% (confidence: high)

## All nine forecasters

| Forecaster | T03 win | Draw | T46 win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 54.8% | 25.4% | 19.9% | T03 |
| xG-corrected Elo | 52% | 24.5% | 23.5% | T03 |
| PRODEGY split attack/defence Elo | 40% | 23.9% | 36.1% | T03 |
| Physical-decay dynamic-K Elo | 50.5% | 24.8% | 24.8% | T03 |
| Tactical style-clash mElo | 35.3% | 29.8% | 34.9% | T03 |
| Line-breaks & offers efficiency (gradient-boosted) | 89.6% | 10.4% | 0% | T03 |
| Passing-network structure (random forest) | 69.4% | 19.9% | 10.7% | T03 |
| Stacked Ensemble | 45.8% | 21.3% | 32.9% | T03 |
| Multi-calibrated 8-in-1 | 69.9% | 28.8% | 1.2% | T03 |

## Disagreement

Of 9 forecasters: 9 lean T03, 0 lean T46, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+36.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T03 at 70%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T03's win chance by 0 points.

_Method: Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
