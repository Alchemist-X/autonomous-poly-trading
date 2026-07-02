# Portugal vs Croatia — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Portugal，约 43.3% — Portugal 43.3% / 平 38.3% / Croatia 18.4%（信心：低）

## 九个预测者对比

| Forecaster | Portugal 胜 | Draw | Croatia 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 45.8% | 41.3% | 12.9% | Portugal |
| xG-corrected Elo | 39.6% | 36.6% | 23.8% | Portugal |
| PRODEGY split attack/defence Elo | 33.6% | 33% | 33.4% | Portugal |
| Physical-decay dynamic-K Elo | 38.5% | 36.7% | 24.8% | Portugal |
| Tactical style-clash mElo | 35.7% | 40.1% | 24.3% | 平 |
| Line-breaks & offers efficiency (gradient-boosted) | 54.3% | 45.7% | 0% | Portugal |
| Passing-network structure (random forest) | 57.9% | 34.8% | 7.3% | Portugal |
| Stacked Ensemble | 41% | 38.4% | 20.5% | Portugal |
| Multi-calibrated 8-in-1 | 43.3% | 38.3% | 18.4% | Portugal |

## 分歧

9 个预测者中：8 个看好 Portugal、0 个看好 Croatia、1 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+17.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Portugal at 51%.
- **Bias correction** (-7.7pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Portugal's win chance by -7.7 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
