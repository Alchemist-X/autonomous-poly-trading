# Colombia vs Ghana — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Colombia favoured, ~65.2% — Colombia 65.2% / Draw 22.9% / Ghana 11.9% (confidence: high)

## All nine forecasters

| Forecaster | Colombia win | Draw | Ghana win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 68.5% | 24.4% | 7.1% | Colombia |
| xG-corrected Elo | 79% | 15.1% | 5.9% | Colombia |
| PRODEGY split attack/defence Elo | 45.6% | 24.1% | 30.4% | Colombia |
| Physical-decay dynamic-K Elo | 79.1% | 15.1% | 5.9% | Colombia |
| Tactical style-clash mElo | 63.8% | 23.9% | 12.4% | Colombia |
| Line-breaks & offers efficiency (gradient-boosted) | 72.9% | 21.7% | 5.5% | Colombia |
| Passing-network structure (random forest) | 63.2% | 31.4% | 5.4% | Colombia |
| Stacked Ensemble | 49.9% | 27.3% | 22.9% | Colombia |
| Multi-calibrated 8-in-1 | 65.2% | 22.9% | 11.9% | Colombia |

## Disagreement

Of 9 forecasters: 9 lean Colombia, 0 lean Ghana, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+31.9pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Colombia at 65%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Colombia's win chance by 0 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
