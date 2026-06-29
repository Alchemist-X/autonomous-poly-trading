# Spain vs Austria — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Spain favoured, ~79.3% — Spain 79.3% / Draw 16% / Austria 4.7% (confidence: high)

## All nine forecasters

| Forecaster | Spain win | Draw | Austria win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 79.6% | 16.1% | 4.3% | Spain |
| xG-corrected Elo | 70.6% | 19% | 10.4% | Spain |
| PRODEGY split attack/defence Elo | 45.5% | 17.5% | 37% | Spain |
| Physical-decay dynamic-K Elo | 69.6% | 19.4% | 11% | Spain |
| Tactical style-clash mElo | 52.5% | 27.5% | 20% | Spain |
| Line-breaks & offers efficiency (gradient-boosted) | 68.4% | 27.5% | 4.1% | Spain |
| Passing-network structure (random forest) | 39.7% | 56.1% | 4.1% | 平 |
| Stacked Ensemble | 48.5% | 28.2% | 23.3% | Spain |
| Multi-calibrated 8-in-1 | 79.3% | 16% | 4.7% | Spain |

## Disagreement

Of 9 forecasters: 8 lean Spain, 0 lean Austria, 1 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+26pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Spain at 59%.
- **Bias correction** (+20pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Spain's win chance by +20 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
