# Netherlands vs Morocco — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Netherlands，约 52.1% — Netherlands 52.1% / 平 23.4% / Morocco 24.5%（信心：中）

## 九个预测者对比

| Forecaster | Netherlands 胜 | Draw | Morocco 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 38.7% | 31.3% | 30% | Netherlands |
| xG-corrected Elo | 49.4% | 24.9% | 25.6% | Netherlands |
| PRODEGY split attack/defence Elo | 42.4% | 20.2% | 37.4% | Netherlands |
| Physical-decay dynamic-K Elo | 49.8% | 24.9% | 25.3% | Netherlands |
| Tactical style-clash mElo | 32.4% | 29.8% | 37.9% | Morocco |
| Line-breaks & offers efficiency (gradient-boosted) | 90.6% | 8.2% | 1.2% | Netherlands |
| Passing-network structure (random forest) | 64.3% | 21.6% | 14% | Netherlands |
| Stacked Ensemble | 49.4% | 26.3% | 24.3% | Netherlands |
| Multi-calibrated 8-in-1 | 52.1% | 23.4% | 24.5% | Netherlands |

## 分歧

9 个预测者中：8 个看好 Netherlands、1 个看好 Morocco、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+18.8pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Netherlands at 52%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Netherlands's win chance by 0 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
