# Switzerland vs Algeria — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Switzerland favoured, ~55.5% — Switzerland 55.5% / Draw 24.4% / Algeria 20.2% (confidence: medium)

## All nine forecasters

| Forecaster | Switzerland win | Draw | Algeria win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 62.2% | 22.8% | 15% | Switzerland |
| xG-corrected Elo | 48.5% | 25.1% | 26.4% | Switzerland |
| PRODEGY split attack/defence Elo | 46.2% | 20.8% | 33% | Switzerland |
| Physical-decay dynamic-K Elo | 49.4% | 24.9% | 25.7% | Switzerland |
| Tactical style-clash mElo | 37.9% | 29.8% | 32.3% | Switzerland |
| Line-breaks & offers efficiency (gradient-boosted) | 70.1% | 29.6% | 0.3% | Switzerland |
| Passing-network structure (random forest) | 80.2% | 14.9% | 4.9% | Switzerland |
| Stacked Ensemble | 49.1% | 27% | 23.9% | Switzerland |
| Multi-calibrated 8-in-1 | 55.5% | 24.4% | 20.2% | Switzerland |

## Disagreement

Of 9 forecasters: 9 lean Switzerland, 0 lean Algeria, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+22.1pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Switzerland at 55%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Switzerland's win chance by 0 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
