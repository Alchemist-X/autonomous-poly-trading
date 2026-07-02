# Mexico vs Ecuador — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Mexico，约 38% — Mexico 38% / 平 34.2% / Ecuador 27.8%（信心：低）

## 九个预测者对比

| Forecaster | Mexico 胜 | Draw | Ecuador 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 28.2% | 46.8% | 25% | 平 |
| xG-corrected Elo | 26.2% | 37.1% | 36.7% | 平 |
| PRODEGY split attack/defence Elo | 28.2% | 32.2% | 39.6% | Ecuador |
| Physical-decay dynamic-K Elo | 28.9% | 37.2% | 33.9% | 平 |
| Tactical style-clash mElo | 64.9% | 30.3% | 4.8% | Mexico |
| Line-breaks & offers efficiency (gradient-boosted) | 53.7% | 24% | 22.3% | Mexico |
| Passing-network structure (random forest) | 33% | 28% | 39% | Ecuador |
| Stacked Ensemble | 41% | 37.9% | 21.1% | Mexico |
| Multi-calibrated 8-in-1 | 38% | 34.2% | 27.8% | Mexico |

## 分歧

9 个预测者中：4 个看好 Mexico、2 个看好 Ecuador、3 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+11.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Mexico at 45%.
- **Bias correction** (-6.9pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Mexico's win chance by -6.9 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
