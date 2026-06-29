# Portugal vs Croatia — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Portugal，约 51% — Portugal 51% / 平 27.4% / Croatia 21.6%（信心：中）

## 九个预测者对比

| Forecaster | Portugal 胜 | Draw | Croatia 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 54% | 30.8% | 15.2% | Portugal |
| xG-corrected Elo | 46.6% | 25.3% | 28.1% | Portugal |
| PRODEGY split attack/defence Elo | 39.6% | 21.1% | 39.3% | Portugal |
| Physical-decay dynamic-K Elo | 45.3% | 25.5% | 29.2% | Portugal |
| Tactical style-clash mElo | 42% | 29.4% | 28.6% | Portugal |
| Line-breaks & offers efficiency (gradient-boosted) | 63.9% | 36.1% | 0% | Portugal |
| Passing-network structure (random forest) | 68.1% | 23.2% | 8.6% | Portugal |
| Stacked Ensemble | 48.3% | 27.5% | 24.2% | Portugal |
| Multi-calibrated 8-in-1 | 51% | 27.4% | 21.6% | Portugal |

## 分歧

9 个预测者中：9 个看好 Portugal、0 个看好 Croatia、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+17.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Portugal at 51%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Portugal's win chance by 0 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
