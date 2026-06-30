# Belgium vs Senegal — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Belgium favoured, ~44.2% — Belgium 44.2% / Draw 36.6% / Senegal 19.2% (confidence: low)

## All nine forecasters

| Forecaster | Belgium win | Draw | Senegal win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 45.5% | 38.2% | 16.2% | Belgium |
| xG-corrected Elo | 33.7% | 38% | 28.3% | 平 |
| PRODEGY split attack/defence Elo | 33.8% | 32.7% | 33.6% | Belgium |
| Physical-decay dynamic-K Elo | 34.3% | 38% | 27.6% | 平 |
| Tactical style-clash mElo | 44.5% | 39.3% | 16.2% | Belgium |
| Line-breaks & offers efficiency (gradient-boosted) | 62.6% | 36.3% | 1% | Belgium |
| Passing-network structure (random forest) | 58% | 31.3% | 10.7% | Belgium |
| Stacked Ensemble | 41.1% | 38.8% | 20.1% | Belgium |
| Multi-calibrated 8-in-1 | 44.2% | 36.6% | 19.2% | Belgium |

## Disagreement

Of 9 forecasters: 7 lean Belgium, 0 lean Senegal, 2 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+19.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Belgium at 53%.
- **Bias correction** (-8.7pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Belgium's win chance by -8.7 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
