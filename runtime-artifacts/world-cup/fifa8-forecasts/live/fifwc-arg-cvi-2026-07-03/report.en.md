# Argentina vs Cabo Verde — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Argentina favoured, ~69.9% — Argentina 69.9% / Draw 19.6% / Cabo Verde 10.5% (confidence: high)

## All nine forecasters

| Forecaster | Argentina win | Draw | Cabo Verde win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 76% | 19.3% | 4.7% | Argentina |
| xG-corrected Elo | 83.6% | 12.6% | 3.9% | Argentina |
| PRODEGY split attack/defence Elo | 51.3% | 20.7% | 28% | Argentina |
| Physical-decay dynamic-K Elo | 83.2% | 12.8% | 4% | Argentina |
| Tactical style-clash mElo | 83.5% | 13.5% | 3% | Argentina |
| Line-breaks & offers efficiency (gradient-boosted) | 75.4% | 19.9% | 4.6% | Argentina |
| Passing-network structure (random forest) | 56% | 31.1% | 13% | Argentina |
| Stacked Ensemble | 50.3% | 27.2% | 22.5% | Argentina |
| Multi-calibrated 8-in-1 | 69.9% | 19.6% | 10.5% | Argentina |

## Disagreement

Of 9 forecasters: 9 lean Argentina, 0 lean Cabo Verde, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+36.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Argentina at 70%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Argentina's win chance by 0 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
