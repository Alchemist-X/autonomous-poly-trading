# Brazil vs Japan — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Brazil，约 50.8% — Brazil 50.8% / 平 33.1% / Japan 16.1%（信心：中）

## 九个预测者对比

| Forecaster | Brazil 胜 | Draw | Japan 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 44.3% | 41.5% | 14.2% | Brazil |
| xG-corrected Elo | 39% | 36.5% | 24.6% | Brazil |
| PRODEGY split attack/defence Elo | 47.3% | 29.8% | 22.9% | Brazil |
| Physical-decay dynamic-K Elo | 39.7% | 36.4% | 23.9% | Brazil |
| Tactical style-clash mElo | 45.3% | 38.1% | 16.6% | Brazil |
| Line-breaks & offers efficiency (gradient-boosted) | 78.6% | 20.8% | 0.6% | Brazil |
| Passing-network structure (random forest) | 69.4% | 24.7% | 6% | Brazil |
| Stacked Ensemble | 43% | 36.9% | 20.2% | Brazil |
| Multi-calibrated 8-in-1 | 50.8% | 33.1% | 16.1% | Brazil |

## 分歧

9 个预测者中：9 个看好 Brazil、0 个看好 Japan、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+26.3pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Brazil at 60%.
- **Bias correction** (-8.8pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Brazil's win chance by -8.8 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
