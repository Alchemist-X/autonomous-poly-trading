# Switzerland vs Algeria — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Switzerland，约 49.4% — Switzerland 49.4% / 平 32.7% / Algeria 18%（信心：中）

## 九个预测者对比

| Forecaster | Switzerland 胜 | Draw | Algeria 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 55.4% | 31.3% | 13.3% | Switzerland |
| xG-corrected Elo | 43.2% | 33.3% | 23.5% | Switzerland |
| PRODEGY split attack/defence Elo | 41.1% | 29.5% | 29.4% | Switzerland |
| Physical-decay dynamic-K Elo | 43.9% | 33.2% | 22.9% | Switzerland |
| Tactical style-clash mElo | 33.8% | 37.5% | 28.8% | 平 |
| Line-breaks & offers efficiency (gradient-boosted) | 62.4% | 37.3% | 0.3% | Switzerland |
| Passing-network structure (random forest) | 71.4% | 24.2% | 4.4% | Switzerland |
| Stacked Ensemble | 43.7% | 35% | 21.3% | Switzerland |
| Multi-calibrated 8-in-1 | 49.4% | 32.7% | 18% | Switzerland |

## 分歧

9 个预测者中：8 个看好 Switzerland、0 个看好 Algeria、1 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+22.1pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Switzerland at 55%.
- **Bias correction** (-6.1pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Switzerland's win chance by -6.1 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus, then a knockout 90-minute draw calibration (target ~31% draws, the 2022 Qatar knockout rate) lifting the draw on even ties. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
