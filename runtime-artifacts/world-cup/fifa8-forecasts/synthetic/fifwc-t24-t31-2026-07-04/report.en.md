# T24 vs T31 — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** T24 favoured, ~80.7% — T24 80.7% / Draw 19% / T31 0.3% (confidence: high)

## All nine forecasters

| Forecaster | T24 win | Draw | T31 win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 60.2% | 24.6% | 15.2% | T24 |
| xG-corrected Elo | 70.6% | 19% | 10.4% | T24 |
| PRODEGY split attack/defence Elo | 51.6% | 21.5% | 26.9% | T24 |
| Physical-decay dynamic-K Elo | 72% | 18.4% | 9.6% | T24 |
| Tactical style-clash mElo | 93.5% | 5.9% | 0.5% | T24 |
| Line-breaks & offers efficiency (gradient-boosted) | 96.1% | 3.9% | 0% | T24 |
| Passing-network structure (random forest) | 58.7% | 41.1% | 0.2% | T24 |
| Stacked Ensemble | 47.4% | 21.5% | 31.1% | T24 |
| Multi-calibrated 8-in-1 | 80.7% | 19% | 0.3% | T24 |

## Disagreement

Of 9 forecasters: 9 lean T24, 0 lean T31, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+47.4pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T24 at 81%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T24's win chance by 0 points.

_Method: Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
