# Australia vs Egypt — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 两队势均力敌，平局是单一最可能结果，约 38.2% — Australia 25.7% / 平 38.2% / Egypt 36.2%（信心：低）

## 九个预测者对比

| Forecaster | Australia 胜 | Draw | Egypt 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 28.2% | 47.3% | 24.5% | 平 |
| xG-corrected Elo | 37.2% | 38.4% | 24.4% | 平 |
| PRODEGY split attack/defence Elo | 22.7% | 41.5% | 35.8% | 平 |
| Physical-decay dynamic-K Elo | 37.4% | 38.4% | 24.2% | 平 |
| Tactical style-clash mElo | 27.4% | 42% | 30.6% | 平 |
| Line-breaks & offers efficiency (gradient-boosted) | 0% | 20.1% | 79.9% | Egypt |
| Passing-network structure (random forest) | 15.2% | 36.9% | 47.9% | Egypt |
| Stacked Ensemble | 37.3% | 40.6% | 22.1% | 平 |
| Multi-calibrated 8-in-1 | 25.7% | 38.2% | 36.2% | 平 |

## 分歧

9 个预测者中：0 个看好 Australia、2 个看好 Egypt、7 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (-2.3pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Egypt at 44%.
- **Bias correction** (-5.4pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Australia's win chance by -5.4 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
