# Spain vs Austria — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Spain，约 75.4% — Spain 75.4% / 平 20.1% / Austria 4.5%（信心：高）

## 九个预测者对比

| Forecaster | Spain 胜 | Draw | Austria 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 75.7% | 20.2% | 4.1% | Spain |
| xG-corrected Elo | 67.2% | 22.9% | 9.9% | Spain |
| PRODEGY split attack/defence Elo | 43.3% | 21.5% | 35.2% | Spain |
| Physical-decay dynamic-K Elo | 66.2% | 23.3% | 10.5% | Spain |
| Tactical style-clash mElo | 49.9% | 31% | 19% | Spain |
| Line-breaks & offers efficiency (gradient-boosted) | 65.1% | 31% | 3.9% | Spain |
| Passing-network structure (random forest) | 37.8% | 58.2% | 3.9% | 平 |
| Stacked Ensemble | 46.1% | 31.7% | 22.2% | Spain |
| Multi-calibrated 8-in-1 | 75.4% | 20.1% | 4.5% | Spain |

## 分歧

9 个预测者中：8 个看好 Spain、0 个看好 Austria、1 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+26pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Spain at 59%.
- **Bias correction** (+16.1pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Spain's win chance by +16.1 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
