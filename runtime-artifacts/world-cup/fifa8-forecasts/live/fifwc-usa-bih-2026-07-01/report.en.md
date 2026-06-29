# United States vs Bosnia-Herzegovina — Round-of-32 forecast (FIFA eight-model engine)

**Headline call (multi-calibrated 8-in-1):** United States favoured, ~55% — United States 55% / Draw 22.9% / Bosnia-Herzegovina 22.1% (confidence: medium)

## All nine forecasters

| Forecaster | United States win | Draw | Bosnia-Herzegovina win | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 58.5% | 26.1% | 15.4% | United States |
| xG-corrected Elo | 55.9% | 23.7% | 20.5% | United States |
| PRODEGY split attack/defence Elo | 40.8% | 33.2% | 26% | United States |
| Physical-decay dynamic-K Elo | 51.8% | 24.5% | 23.7% | United States |
| Tactical style-clash mElo | 59% | 25.6% | 15.4% | United States |
| Line-breaks & offers efficiency (gradient-boosted) | 67.1% | 13.3% | 19.6% | United States |
| Passing-network structure (random forest) | 57.9% | 10.2% | 31.9% | United States |
| Stacked Ensemble | 49.2% | 26.7% | 24.1% | United States |
| Multi-calibrated 8-in-1 | 55% | 22.9% | 22.1% | United States |

## Disagreement

Of 9 forecasters: 9 lean United States, 0 lean Bosnia-Herzegovina, 0 lean draw.

## Why (forecasting engine)

- **Consensus of all models** (+21.7pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours United States at 55%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting United States's win chance by 0 points.

_Method: Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_Market-blind: FIFA on-pitch stats + pre-tournament Elo only; no betting line or market-implied probability was consulted._
