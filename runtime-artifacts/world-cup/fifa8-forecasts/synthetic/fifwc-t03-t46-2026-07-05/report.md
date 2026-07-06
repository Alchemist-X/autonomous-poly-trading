# T03 vs T46 — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 T03，约 69.9% — T03 69.9% / 平 28.8% / T46 1.2%（信心：高）

## 九个预测者对比

| Forecaster | T03 胜 | Draw | T46 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 54.8% | 25.4% | 19.9% | T03 |
| xG-corrected Elo | 52% | 24.5% | 23.5% | T03 |
| PRODEGY split attack/defence Elo | 40% | 23.9% | 36.1% | T03 |
| Physical-decay dynamic-K Elo | 50.5% | 24.8% | 24.8% | T03 |
| Tactical style-clash mElo | 35.3% | 29.8% | 34.9% | T03 |
| Line-breaks & offers efficiency (gradient-boosted) | 89.6% | 10.4% | 0% | T03 |
| Passing-network structure (random forest) | 69.4% | 19.9% | 10.7% | T03 |
| Stacked Ensemble | 45.8% | 21.3% | 32.9% | T03 |
| Multi-calibrated 8-in-1 | 69.9% | 28.8% | 1.2% | T03 |

## 分歧

9 个预测者中：9 个看好 T03、0 个看好 T46、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+36.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T03 at 70%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T03's win chance by 0 points.

_方法：Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
