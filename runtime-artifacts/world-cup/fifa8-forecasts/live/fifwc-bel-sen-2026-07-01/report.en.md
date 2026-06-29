# Belgium vs Senegal — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** Belgium favoured, ~52.9% — Belgium 52.9% / Draw 24.1% / Senegal 23% (confidence: medium)

## All nine forecasters

| Forecaster | Belgium win | Draw | Senegal win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 54.5% | 26.1% | 19.4% | Belgium |
| xG-corrected Elo | 40.3% | 25.9% | 33.8% | Belgium |
| PRODEGY split attack/defence Elo | 40.4% | 19.4% | 40.2% | Belgium |
| Physical-decay dynamic-K Elo | 41.1% | 25.8% | 33.1% | Belgium |
| Tactical style-clash mElo | 53.3% | 27.3% | 19.4% | Belgium |
| Line-breaks & offers efficiency (gradient-boosted) | 75% | 23.8% | 1.2% | Belgium |
| Passing-network structure (random forest) | 69.4% | 17.8% | 12.8% | Belgium |
| Stacked Ensemble | 49.1% | 26.8% | 24.1% | Belgium |
| Multi-calibrated 8-in-1 | 52.9% | 24.1% | 23% | Belgium |

## Disagreement

Of 9 forecasters: 9 lean Belgium, 0 lean Senegal, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+19.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Belgium at 53%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Belgium's win chance by 0 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
