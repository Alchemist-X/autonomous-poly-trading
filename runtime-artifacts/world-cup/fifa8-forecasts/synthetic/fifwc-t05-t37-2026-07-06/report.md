# T05 vs T37 — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 T05，约 60.8% — T05 60.8% / 平 37.7% / T37 1.5%（信心：高）

## 九个预测者对比

| Forecaster | T05 胜 | Draw | T37 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 37.3% | 29.1% | 33.6% | T05 |
| xG-corrected Elo | 50% | 24.8% | 25.1% | T05 |
| PRODEGY split attack/defence Elo | 40.1% | 23.6% | 36.2% | T05 |
| Physical-decay dynamic-K Elo | 46.3% | 25.4% | 28.4% | T05 |
| Tactical style-clash mElo | 16.3% | 26% | 57.7% | T37 |
| Line-breaks & offers efficiency (gradient-boosted) | 59.9% | 40.1% | 0% | T05 |
| Passing-network structure (random forest) | 70.2% | 22.8% | 7.1% | T05 |
| Stacked Ensemble | 43.7% | 22.3% | 34% | T05 |
| Multi-calibrated 8-in-1 | 60.8% | 37.7% | 1.5% | T05 |

## 分歧

9 个预测者中：8 个看好 T05、1 个看好 T37、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+27.4pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T05 at 61%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T05's win chance by 0 points.

_方法：Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
