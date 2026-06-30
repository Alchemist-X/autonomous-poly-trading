# Argentina vs Cabo Verde — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Argentina favoured, ~64.6% — Argentina 64.6% / Draw 25.7% / Cabo Verde 9.7% (confidence: high)

## All nine forecasters

| Forecaster | Argentina win | Draw | Cabo Verde win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 70.3% | 25.3% | 4.4% | Argentina |
| xG-corrected Elo | 77.3% | 19.2% | 3.6% | Argentina |
| PRODEGY split attack/defence Elo | 47.4% | 26.7% | 25.9% | Argentina |
| Physical-decay dynamic-K Elo | 76.9% | 19.4% | 3.7% | Argentina |
| Tactical style-clash mElo | 77.2% | 20% | 2.8% | Argentina |
| Line-breaks & offers efficiency (gradient-boosted) | 69.7% | 26% | 4.3% | Argentina |
| Passing-network structure (random forest) | 51.8% | 36.3% | 12% | Argentina |
| Stacked Ensemble | 46.5% | 32.7% | 20.8% | Argentina |
| Multi-calibrated 8-in-1 | 64.6% | 25.7% | 9.7% | Argentina |

## Disagreement

Of 9 forecasters: 9 lean Argentina, 0 lean Cabo Verde, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+36.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Argentina at 70%.
- **Bias correction** (-5.3pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Argentina's win chance by -5.3 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
