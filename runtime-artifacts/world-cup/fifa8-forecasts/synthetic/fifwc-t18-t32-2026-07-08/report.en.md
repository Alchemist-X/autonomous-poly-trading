# T18 vs T32 — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** T18 favoured, ~56.3% — T18 56.3% / Draw 22.1% / T32 21.6% (confidence: medium)

## All nine forecasters

| Forecaster | T18 win | Draw | T32 win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 41.4% | 30% | 28.6% | T18 |
| xG-corrected Elo | 60.4% | 22.5% | 17.1% | T18 |
| PRODEGY split attack/defence Elo | 47.4% | 21.2% | 31.5% | T18 |
| Physical-decay dynamic-K Elo | 57.8% | 23.2% | 19% | T18 |
| Tactical style-clash mElo | 27.8% | 29.3% | 42.8% | T32 |
| Line-breaks & offers efficiency (gradient-boosted) | 64.6% | 6.6% | 28.8% | T18 |
| Passing-network structure (random forest) | 80.5% | 17.8% | 1.7% | T18 |
| Stacked Ensemble | 45.1% | 21.4% | 33.5% | T18 |
| Multi-calibrated 8-in-1 | 56.3% | 22.1% | 21.6% | T18 |

## Disagreement

Of 9 forecasters: 8 lean T18, 1 lean T32, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+23pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T18 at 56%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T18's win chance by 0 points.

_Method: Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
