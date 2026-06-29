# Spain vs Austria — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Spain，约 79.3% — Spain 79.3% / 平 16% / Austria 4.7%（信心：高）

## 九个预测者对比

| Forecaster | Spain 胜 | Draw | Austria 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 79.6% | 16.1% | 4.3% | Spain |
| xG-corrected Elo | 70.6% | 19% | 10.4% | Spain |
| PRODEGY split attack/defence Elo | 45.5% | 17.5% | 37% | Spain |
| Physical-decay dynamic-K Elo | 69.6% | 19.4% | 11% | Spain |
| Tactical style-clash mElo | 52.5% | 27.5% | 20% | Spain |
| Line-breaks & offers efficiency (gradient-boosted) | 68.4% | 27.5% | 4.1% | Spain |
| Passing-network structure (random forest) | 39.7% | 56.1% | 4.1% | 平 |
| Stacked Ensemble | 48.5% | 28.2% | 23.3% | Spain |
| Multi-calibrated 8-in-1 | 79.3% | 16% | 4.7% | Spain |

## 分歧

9 个预测者中：8 个看好 Spain、0 个看好 Austria、1 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+26pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Spain at 59%.
- **Bias correction** (+20pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Spain's win chance by +20 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
