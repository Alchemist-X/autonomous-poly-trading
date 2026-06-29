# T00 vs T07 — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 T00，约 64% — T00 64% / 平 34.1% / T07 1.9%（信心：高）

## 九个预测者对比

| Forecaster | T00 胜 | Draw | T07 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 65.1% | 21.8% | 13.2% | T00 |
| xG-corrected Elo | 83.5% | 12.6% | 3.9% | T00 |
| PRODEGY split attack/defence Elo | 59% | 20% | 21% | T00 |
| Physical-decay dynamic-K Elo | 79.8% | 14.7% | 5.5% | T00 |
| Tactical style-clash mElo | 46.6% | 28.8% | 24.6% | T00 |
| Line-breaks & offers efficiency (gradient-boosted) | 83.6% | 4.5% | 12% | T00 |
| Passing-network structure (random forest) | 58.7% | 41.1% | 0.2% | T00 |
| Stacked Ensemble | 46.1% | 21.8% | 32.1% | T00 |
| Multi-calibrated 8-in-1 | 64% | 34.1% | 1.9% | T00 |

## 分歧

9 个预测者中：9 个看好 T00、0 个看好 T07、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+38.4pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T00 at 72%.
- **Bias correction** (-7.7pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T00's win chance by -7.7 points.

_方法：Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
