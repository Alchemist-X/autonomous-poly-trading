# Côte d'Ivoire vs Norway — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Norway，约 40.7% — Côte d'Ivoire 29.5% / 平 29.8% / Norway 40.7%（信心：低）

## 九个预测者对比

| Forecaster | Côte d'Ivoire 胜 | Draw | Norway 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 31.7% | 34.4% | 33.9% | 平 |
| xG-corrected Elo | 16.1% | 27.9% | 56% | Norway |
| PRODEGY split attack/defence Elo | 28.9% | 28.4% | 42.7% | Norway |
| Physical-decay dynamic-K Elo | 16.9% | 28.2% | 54.8% | Norway |
| Tactical style-clash mElo | 17.2% | 32% | 50.8% | Norway |
| Line-breaks & offers efficiency (gradient-boosted) | 32.2% | 41.4% | 26.4% | 平 |
| Passing-network structure (random forest) | 50.1% | 13.3% | 36.6% | Côte d'Ivoire |
| Stacked Ensemble | 42.8% | 32.7% | 24.6% | Côte d'Ivoire |
| Multi-calibrated 8-in-1 | 29.5% | 29.8% | 40.7% | Norway |

## 分歧

9 个预测者中：2 个看好 Côte d'Ivoire、5 个看好 Norway、2 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (-1.7pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Norway at 44%.
- **Bias correction** (-2.2pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Côte d'Ivoire's win chance by -2.2 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
