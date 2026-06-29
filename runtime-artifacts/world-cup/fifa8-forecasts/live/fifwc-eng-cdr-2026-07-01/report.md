# England vs DR Congo — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 England，约 61.8% — England 61.8% / 平 24.9% / DR Congo 13.2%（信心：高）

## 九个预测者对比

| Forecaster | England 胜 | Draw | DR Congo 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 67.1% | 23.3% | 9.5% | England |
| xG-corrected Elo | 72.6% | 18.2% | 9.3% | England |
| PRODEGY split attack/defence Elo | 53.3% | 19.2% | 27.5% | England |
| Physical-decay dynamic-K Elo | 71.6% | 18.6% | 9.8% | England |
| Tactical style-clash mElo | 57.5% | 26.1% | 16.4% | England |
| Line-breaks & offers efficiency (gradient-boosted) | 52.5% | 42.8% | 4.7% | England |
| Passing-network structure (random forest) | 71% | 23.5% | 5.5% | England |
| Stacked Ensemble | 48.8% | 27.9% | 23.3% | England |
| Multi-calibrated 8-in-1 | 61.8% | 24.9% | 13.2% | England |

## 分歧

9 个预测者中：9 个看好 England、0 个看好 DR Congo、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+28.5pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours England at 62%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting England's win chance by 0 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
