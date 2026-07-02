# T30 vs T23 — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** T30 favoured, ~66.1% — T30 66.1% / Draw 19.6% / T23 14.3% (confidence: high)

## All nine forecasters

| Forecaster | T30 win | Draw | T23 win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 57.7% | 22.6% | 19.7% | T30 |
| xG-corrected Elo | 75.1% | 17% | 7.9% | T30 |
| PRODEGY split attack/defence Elo | 52.1% | 21.7% | 26.3% | T30 |
| Physical-decay dynamic-K Elo | 72.3% | 18.3% | 9.4% | T30 |
| Tactical style-clash mElo | 54.9% | 26.9% | 18.2% | T30 |
| Line-breaks & offers efficiency (gradient-boosted) | 85.5% | 3.8% | 10.7% | T30 |
| Passing-network structure (random forest) | 58.7% | 37.3% | 4.1% | T30 |
| Stacked Ensemble | 46.2% | 21.6% | 32.2% | T30 |
| Multi-calibrated 8-in-1 | 66.1% | 19.6% | 14.3% | T30 |

## Disagreement

Of 9 forecasters: 9 lean T30, 0 lean T23, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+32.8pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T30 at 66%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T30's win chance by 0 points.

_Method: Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
