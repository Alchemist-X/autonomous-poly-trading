# T17 vs T11 — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 T17，约 42.2% — T17 42.2% / 平 22.1% / T11 35.6%（信心：低）

## 九个预测者对比

| Forecaster | T17 胜 | Draw | T11 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 40.4% | 27.9% | 31.6% | T17 |
| xG-corrected Elo | 40.2% | 25.9% | 33.9% | T17 |
| PRODEGY split attack/defence Elo | 41.4% | 23.9% | 34.7% | T17 |
| Physical-decay dynamic-K Elo | 42.3% | 25.7% | 32% | T17 |
| Tactical style-clash mElo | 53% | 27.4% | 19.6% | T17 |
| Line-breaks & offers efficiency (gradient-boosted) | 45.1% | 5.8% | 49.1% | T11 |
| Passing-network structure (random forest) | 25.3% | 27.1% | 47.7% | T11 |
| Stacked Ensemble | 43.1% | 22.1% | 34.8% | T17 |
| Multi-calibrated 8-in-1 | 42.2% | 22.1% | 35.6% | T17 |

## 分歧

9 个预测者中：7 个看好 T17、2 个看好 T11、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+8.9pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T17 at 42%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T17's win chance by 0 points.

_方法：Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
