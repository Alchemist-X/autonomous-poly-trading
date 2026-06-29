# T45 vs T47 — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** T45 favoured, ~69.9% — T45 69.9% / Draw 20% / T47 10.1% (confidence: high)

## All nine forecasters

| Forecaster | T45 win | Draw | T47 win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 51% | 27.4% | 21.6% | T45 |
| xG-corrected Elo | 67.6% | 20.1% | 12.2% | T45 |
| PRODEGY split attack/defence Elo | 46.8% | 22.5% | 30.7% | T45 |
| Physical-decay dynamic-K Elo | 65% | 21.1% | 13.9% | T45 |
| Tactical style-clash mElo | 46.2% | 28.9% | 25% | T45 |
| Line-breaks & offers efficiency (gradient-boosted) | 95.6% | 2.2% | 2.2% | T45 |
| Passing-network structure (random forest) | 78.1% | 21.8% | 0.2% | T45 |
| Stacked Ensemble | 46.8% | 21.1% | 32.1% | T45 |
| Multi-calibrated 8-in-1 | 69.9% | 20% | 10.1% | T45 |

## Disagreement

Of 9 forecasters: 9 lean T45, 0 lean T47, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+36.5pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T45 at 70%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T45's win chance by 0 points.

_Method: Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
