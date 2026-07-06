# Germany vs Paraguay — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Germany，约 46.6% — Germany 46.6% / 平 36% / Paraguay 17.4%（信心：中）

## 九个预测者对比

| Forecaster | Germany 胜 | Draw | Paraguay 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 47.9% | 37.6% | 14.5% | Germany |
| xG-corrected Elo | 43.3% | 35.4% | 21.3% | Germany |
| PRODEGY split attack/defence Elo | 44.6% | 32% | 23.4% | Germany |
| Physical-decay dynamic-K Elo | 39.8% | 35.9% | 24.2% | Germany |
| Tactical style-clash mElo | 34% | 39.6% | 26.3% | 平 |
| Line-breaks & offers efficiency (gradient-boosted) | 61.7% | 34.4% | 3.8% | Germany |
| Passing-network structure (random forest) | 59.7% | 35.6% | 4.7% | Germany |
| Stacked Ensemble | 41.9% | 37.4% | 20.7% | Germany |
| Multi-calibrated 8-in-1 | 46.6% | 36% | 17.4% | Germany |

## 分歧

9 个预测者中：8 个看好 Germany、0 个看好 Paraguay、1 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+21pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Germany at 54%.
- **Bias correction** (-7.7pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Germany's win chance by -7.7 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
