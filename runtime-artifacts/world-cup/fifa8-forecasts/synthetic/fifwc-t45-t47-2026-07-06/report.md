# T45 vs T47 — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 T45，约 69.9% — T45 69.9% / 平 20% / T47 10.1%（信心：高）

## 九个预测者对比

| Forecaster | T45 胜 | Draw | T47 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 51% | 27.4% | 21.6% | T45 |
| xG-corrected Elo | 67.6% | 20.1% | 12.2% | T45 |
| PRODEGY split attack/defence Elo | 46.8% | 22.5% | 30.7% | T45 |
| Physical-decay dynamic-K Elo | 65% | 21.1% | 13.9% | T45 |
| Tactical style-clash mElo | 46.2% | 28.9% | 25% | T45 |
| Line-breaks & offers efficiency (gradient-boosted) | 95.6% | 2.2% | 2.2% | T45 |
| Passing-network structure (random forest) | 78.1% | 21.8% | 0.2% | T45 |
| Stacked Ensemble | 46.8% | 21.1% | 32.1% | T45 |
| Multi-calibrated 8-in-1 | 69.9% | 20% | 10.1% | T45 |

## 分歧

9 个预测者中：9 个看好 T45、0 个看好 T47、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+36.5pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T45 at 70%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T45's win chance by 0 points.

_方法：Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
