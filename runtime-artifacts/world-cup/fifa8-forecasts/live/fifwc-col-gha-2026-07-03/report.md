# Colombia vs Ghana — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Colombia，约 60.2% — Colombia 60.2% / 平 28.8% / Ghana 11%（信心：高）

## 九个预测者对比

| Forecaster | Colombia 胜 | Draw | Ghana 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 63.2% | 30.2% | 6.5% | Colombia |
| xG-corrected Elo | 73% | 21.6% | 5.4% | Colombia |
| PRODEGY split attack/defence Elo | 42.1% | 29.9% | 28% | Colombia |
| Physical-decay dynamic-K Elo | 73% | 21.6% | 5.4% | Colombia |
| Tactical style-clash mElo | 58.9% | 29.7% | 11.4% | Colombia |
| Line-breaks & offers efficiency (gradient-boosted) | 67.3% | 27.7% | 5.1% | Colombia |
| Passing-network structure (random forest) | 58.4% | 36.7% | 5% | Colombia |
| Stacked Ensemble | 46% | 32.9% | 21.1% | Colombia |
| Multi-calibrated 8-in-1 | 60.2% | 28.8% | 11% | Colombia |

## 分歧

9 个预测者中：9 个看好 Colombia、0 个看好 Ghana、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+31.9pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Colombia at 65%.
- **Bias correction** (-5pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Colombia's win chance by -5 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
