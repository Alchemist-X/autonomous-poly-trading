# France vs Sweden — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** France favoured, ~71.9% — France 71.9% / Draw 15.8% / Sweden 12.3% (confidence: high)

## All nine forecasters

| Forecaster | France win | Draw | Sweden win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 73% | 19% | 8% | France |
| xG-corrected Elo | 71.1% | 18.8% | 10.1% | France |
| PRODEGY split attack/defence Elo | 40.7% | 20.1% | 39.2% | France |
| Physical-decay dynamic-K Elo | 72.3% | 18.3% | 9.4% | France |
| Tactical style-clash mElo | 84.9% | 12.5% | 2.6% | France |
| Line-breaks & offers efficiency (gradient-boosted) | 94.1% | 5.1% | 0.8% | France |
| Passing-network structure (random forest) | 87.4% | 6.9% | 5.7% | France |
| Stacked Ensemble | 52% | 25.7% | 22.3% | France |
| Multi-calibrated 8-in-1 | 71.9% | 15.8% | 12.3% | France |

## Disagreement

Of 9 forecasters: 9 lean France, 0 lean Sweden, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+38.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours France at 72%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting France's win chance by 0 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
