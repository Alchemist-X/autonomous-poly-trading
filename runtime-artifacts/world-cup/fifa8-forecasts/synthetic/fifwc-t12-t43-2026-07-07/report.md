# T12 vs T43 — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 T12，约 80.3% — T12 80.3% / 平 1.4% / T43 18.3%（信心：高）

## 九个预测者对比

| Forecaster | T12 胜 | Draw | T43 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 43.6% | 27% | 29.4% | T12 |
| xG-corrected Elo | 75.6% | 16.8% | 7.6% | T12 |
| PRODEGY split attack/defence Elo | 51% | 22.2% | 26.8% | T12 |
| Physical-decay dynamic-K Elo | 73.3% | 17.8% | 8.9% | T12 |
| Tactical style-clash mElo | 58.5% | 25.8% | 15.7% | T12 |
| Line-breaks & offers efficiency (gradient-boosted) | 27.1% | 0% | 72.9% | T43 |
| Passing-network structure (random forest) | 58% | 41.8% | 0.2% | T12 |
| Stacked Ensemble | 44% | 22.3% | 33.7% | T12 |
| Multi-calibrated 8-in-1 | 80.3% | 1.4% | 18.3% | T12 |

## 分歧

9 个预测者中：8 个看好 T12、1 个看好 T43、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+47pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T12 at 80%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T12's win chance by 0 points.

_方法：Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
