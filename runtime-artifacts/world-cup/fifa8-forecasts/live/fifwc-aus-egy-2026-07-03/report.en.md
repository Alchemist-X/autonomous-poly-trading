# Australia vs Egypt — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Egypt favoured, ~43.8% — Australia 31.1% / Draw 25.2% / Egypt 43.8% (confidence: low)

## All nine forecasters

| Forecaster | Australia win | Draw | Egypt win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 34.1% | 36.2% | 29.7% | 平 |
| xG-corrected Elo | 45% | 25.5% | 29.5% | Australia |
| PRODEGY split attack/defence Elo | 27.5% | 29.2% | 43.3% | Egypt |
| Physical-decay dynamic-K Elo | 45.3% | 25.5% | 29.2% | Australia |
| Tactical style-clash mElo | 33.2% | 29.8% | 37% | Egypt |
| Line-breaks & offers efficiency (gradient-boosted) | 0% | 3.3% | 96.7% | Egypt |
| Passing-network structure (random forest) | 18.4% | 23.6% | 58% | Egypt |
| Stacked Ensemble | 45.1% | 28.1% | 26.8% | Australia |
| Multi-calibrated 8-in-1 | 31.1% | 25.2% | 43.8% | Egypt |

## Disagreement

Of 9 forecasters: 3 lean Australia, 5 lean Egypt, 1 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (-2.3pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Egypt at 44%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Australia's win chance by 0 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
