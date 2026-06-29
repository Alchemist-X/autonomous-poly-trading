# T33 vs T27 — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 T33，约 57% — T33 57% / 平 32.4% / T27 10.6%（信心：中）

## 九个预测者对比

| Forecaster | T33 胜 | Draw | T27 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 53.3% | 25.4% | 21.2% | T33 |
| xG-corrected Elo | 68.1% | 20% | 12% | T33 |
| PRODEGY split attack/defence Elo | 48.3% | 22% | 29.7% | T33 |
| Physical-decay dynamic-K Elo | 66.2% | 20.7% | 13.1% | T33 |
| Tactical style-clash mElo | 55.9% | 26.6% | 17.5% | T33 |
| Line-breaks & offers efficiency (gradient-boosted) | 28% | 65.1% | 6.9% | 平 |
| Passing-network structure (random forest) | 52.5% | 47.4% | 0.1% | T33 |
| Stacked Ensemble | 42.9% | 23.8% | 33.2% | T33 |
| Multi-calibrated 8-in-1 | 57% | 32.4% | 10.6% | T33 |

## 分歧

9 个预测者中：8 个看好 T33、0 个看好 T27、1 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+23.7pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T33 at 57%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T33's win chance by 0 points.

_方法：Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
