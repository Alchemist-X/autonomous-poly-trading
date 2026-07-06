# Argentina vs Cabo Verde — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Argentina，约 64.6% — Argentina 64.6% / 平 25.7% / Cabo Verde 9.7%（信心：高）

## 九个预测者对比

| Forecaster | Argentina 胜 | Draw | Cabo Verde 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 70.3% | 25.3% | 4.4% | Argentina |
| xG-corrected Elo | 77.3% | 19.2% | 3.6% | Argentina |
| PRODEGY split attack/defence Elo | 47.4% | 26.7% | 25.9% | Argentina |
| Physical-decay dynamic-K Elo | 76.9% | 19.4% | 3.7% | Argentina |
| Tactical style-clash mElo | 77.2% | 20% | 2.8% | Argentina |
| Line-breaks & offers efficiency (gradient-boosted) | 69.7% | 26% | 4.3% | Argentina |
| Passing-network structure (random forest) | 51.8% | 36.3% | 12% | Argentina |
| Stacked Ensemble | 46.5% | 32.7% | 20.8% | Argentina |
| Multi-calibrated 8-in-1 | 64.6% | 25.7% | 9.7% | Argentina |

## 分歧

9 个预测者中：9 个看好 Argentina、0 个看好 Cabo Verde、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+36.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Argentina at 70%.
- **Bias correction** (-5.3pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Argentina's win chance by -5.3 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
