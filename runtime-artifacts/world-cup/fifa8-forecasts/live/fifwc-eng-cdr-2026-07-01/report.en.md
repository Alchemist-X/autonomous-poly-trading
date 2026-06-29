# England vs DR Congo — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** England favoured, ~61.8% — England 61.8% / Draw 24.9% / DR Congo 13.2% (confidence: high)

## All nine forecasters

| Forecaster | England win | Draw | DR Congo win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 67.1% | 23.3% | 9.5% | England |
| xG-corrected Elo | 72.6% | 18.2% | 9.3% | England |
| PRODEGY split attack/defence Elo | 53.3% | 19.2% | 27.5% | England |
| Physical-decay dynamic-K Elo | 71.6% | 18.6% | 9.8% | England |
| Tactical style-clash mElo | 57.5% | 26.1% | 16.4% | England |
| Line-breaks & offers efficiency (gradient-boosted) | 52.5% | 42.8% | 4.7% | England |
| Passing-network structure (random forest) | 71% | 23.5% | 5.5% | England |
| Stacked Ensemble | 48.8% | 27.9% | 23.3% | England |
| Multi-calibrated 8-in-1 | 61.8% | 24.9% | 13.2% | England |

## Disagreement

Of 9 forecasters: 9 lean England, 0 lean DR Congo, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+28.5pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours England at 62%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting England's win chance by 0 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
