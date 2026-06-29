# Germany vs Paraguay — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Germany favoured, ~54.3% — Germany 54.3% / Draw 25.4% / Paraguay 20.2% (confidence: medium)

## All nine forecasters

| Forecaster | Germany win | Draw | Paraguay win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 55.8% | 27.3% | 16.8% | Germany |
| xG-corrected Elo | 50.4% | 24.8% | 24.8% | Germany |
| PRODEGY split attack/defence Elo | 51.9% | 20.8% | 27.3% | Germany |
| Physical-decay dynamic-K Elo | 46.4% | 25.3% | 28.2% | Germany |
| Tactical style-clash mElo | 39.7% | 29.7% | 30.7% | Germany |
| Line-breaks & offers efficiency (gradient-boosted) | 71.9% | 23.6% | 4.5% | Germany |
| Passing-network structure (random forest) | 69.5% | 25% | 5.5% | Germany |
| Stacked Ensemble | 48.8% | 27.1% | 24.1% | Germany |
| Multi-calibrated 8-in-1 | 54.3% | 25.4% | 20.2% | Germany |

## Disagreement

Of 9 forecasters: 9 lean Germany, 0 lean Paraguay, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+21pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Germany at 54%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Germany's win chance by 0 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
