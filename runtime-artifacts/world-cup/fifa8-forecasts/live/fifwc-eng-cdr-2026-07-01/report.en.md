# England vs DR Congo — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** England favoured, ~58% — England 58% / Draw 29.5% / DR Congo 12.4% (confidence: medium)

## All nine forecasters

| Forecaster | England win | Draw | DR Congo win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 63% | 28% | 9% | England |
| xG-corrected Elo | 68.1% | 23.2% | 8.7% | England |
| PRODEGY split attack/defence Elo | 50% | 24.1% | 25.8% | England |
| Physical-decay dynamic-K Elo | 67.3% | 23.5% | 9.2% | England |
| Tactical style-clash mElo | 54% | 30.6% | 15.4% | England |
| Line-breaks & offers efficiency (gradient-boosted) | 49.3% | 46.3% | 4.4% | England |
| Passing-network structure (random forest) | 66.7% | 28.1% | 5.1% | England |
| Stacked Ensemble | 45.8% | 32.3% | 21.8% | England |
| Multi-calibrated 8-in-1 | 58% | 29.5% | 12.4% | England |

## Disagreement

Of 9 forecasters: 9 lean England, 0 lean DR Congo, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+28.5pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours England at 62%.
- **Bias correction** (-3.8pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting England's win chance by -3.8 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
