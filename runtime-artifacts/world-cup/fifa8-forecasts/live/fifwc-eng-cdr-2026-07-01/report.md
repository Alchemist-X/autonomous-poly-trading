# England vs DR Congo — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 England，约 58% — England 58% / 平 29.5% / DR Congo 12.4%（信心：中）

## 九个预测者对比

| Forecaster | England 胜 | Draw | DR Congo 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 63% | 28% | 9% | England |
| xG-corrected Elo | 68.1% | 23.2% | 8.7% | England |
| PRODEGY split attack/defence Elo | 50% | 24.1% | 25.8% | England |
| Physical-decay dynamic-K Elo | 67.3% | 23.5% | 9.2% | England |
| Tactical style-clash mElo | 54% | 30.6% | 15.4% | England |
| Line-breaks & offers efficiency (gradient-boosted) | 49.3% | 46.3% | 4.4% | England |
| Passing-network structure (random forest) | 66.7% | 28.1% | 5.1% | England |
| Stacked Ensemble | 45.8% | 32.3% | 21.8% | England |
| Multi-calibrated 8-in-1 | 58% | 29.5% | 12.4% | England |

## 分歧

9 个预测者中：9 个看好 England、0 个看好 DR Congo、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+28.5pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours England at 62%.
- **Bias correction** (-3.8pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting England's win chance by -3.8 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
