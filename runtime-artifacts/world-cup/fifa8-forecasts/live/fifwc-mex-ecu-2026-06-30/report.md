# Mexico vs Ecuador — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Mexico，约 44.9% — Mexico 44.9% / 平 22.3% / Ecuador 32.8%（信心：低）

## 九个预测者对比

| Forecaster | Mexico 胜 | Draw | Ecuador 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 33.3% | 37.2% | 29.5% | 平 |
| xG-corrected Elo | 31% | 25.7% | 43.4% | Ecuador |
| PRODEGY split attack/defence Elo | 33.3% | 20% | 46.8% | Ecuador |
| Physical-decay dynamic-K Elo | 34.1% | 25.9% | 40% | Ecuador |
| Tactical style-clash mElo | 76.6% | 17.7% | 5.7% | Mexico |
| Line-breaks & offers efficiency (gradient-boosted) | 63.4% | 10.3% | 26.3% | Mexico |
| Passing-network structure (random forest) | 39% | 15% | 46% | Ecuador |
| Stacked Ensemble | 48.4% | 26.7% | 24.9% | Mexico |
| Multi-calibrated 8-in-1 | 44.9% | 22.3% | 32.8% | Mexico |

## 分歧

9 个预测者中：4 个看好 Mexico、4 个看好 Ecuador、1 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+11.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Mexico at 45%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Mexico's win chance by 0 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
