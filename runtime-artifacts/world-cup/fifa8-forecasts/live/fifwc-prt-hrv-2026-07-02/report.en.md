# Portugal vs Croatia — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Portugal favoured, ~51% — Portugal 51% / Draw 27.4% / Croatia 21.6% (confidence: medium)

## All nine forecasters

| Forecaster | Portugal win | Draw | Croatia win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 54% | 30.8% | 15.2% | Portugal |
| xG-corrected Elo | 46.6% | 25.3% | 28.1% | Portugal |
| PRODEGY split attack/defence Elo | 39.6% | 21.1% | 39.3% | Portugal |
| Physical-decay dynamic-K Elo | 45.3% | 25.5% | 29.2% | Portugal |
| Tactical style-clash mElo | 42% | 29.4% | 28.6% | Portugal |
| Line-breaks & offers efficiency (gradient-boosted) | 63.9% | 36.1% | 0% | Portugal |
| Passing-network structure (random forest) | 68.1% | 23.2% | 8.6% | Portugal |
| Stacked Ensemble | 48.3% | 27.5% | 24.2% | Portugal |
| Multi-calibrated 8-in-1 | 51% | 27.4% | 21.6% | Portugal |

## Disagreement

Of 9 forecasters: 9 lean Portugal, 0 lean Croatia, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+17.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Portugal at 51%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Portugal's win chance by 0 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
