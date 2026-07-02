# Netherlands vs Morocco — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Netherlands，约 46.1% — Netherlands 46.1% / 平 32.2% / Morocco 21.7%（信心：中）

## 九个预测者对比

| Forecaster | Netherlands 胜 | Draw | Morocco 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 34.3% | 39.2% | 26.5% | 平 |
| xG-corrected Elo | 43.8% | 33.5% | 22.7% | Netherlands |
| PRODEGY split attack/defence Elo | 37.5% | 29.4% | 33.1% | Netherlands |
| Physical-decay dynamic-K Elo | 44.1% | 33.5% | 22.4% | Netherlands |
| Tactical style-clash mElo | 28.7% | 37.8% | 33.5% | 平 |
| Line-breaks & offers efficiency (gradient-boosted) | 80.2% | 18.7% | 1.1% | Netherlands |
| Passing-network structure (random forest) | 56.9% | 30.6% | 12.4% | Netherlands |
| Stacked Ensemble | 43.7% | 34.8% | 21.5% | Netherlands |
| Multi-calibrated 8-in-1 | 46.1% | 32.2% | 21.7% | Netherlands |

## 分歧

9 个预测者中：7 个看好 Netherlands、0 个看好 Morocco、2 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+18.8pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Netherlands at 52%.
- **Bias correction** (-6pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Netherlands's win chance by -6 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
