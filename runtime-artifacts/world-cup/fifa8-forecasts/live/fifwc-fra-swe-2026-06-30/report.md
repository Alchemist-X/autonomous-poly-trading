# France vs Sweden — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 France，约 71.9% — France 71.9% / 平 15.8% / Sweden 12.3%（信心：高）

## 九个预测者对比

| Forecaster | France 胜 | Draw | Sweden 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 73% | 19% | 8% | France |
| xG-corrected Elo | 71.1% | 18.8% | 10.1% | France |
| PRODEGY split attack/defence Elo | 40.7% | 20.1% | 39.2% | France |
| Physical-decay dynamic-K Elo | 72.3% | 18.3% | 9.4% | France |
| Tactical style-clash mElo | 84.9% | 12.5% | 2.6% | France |
| Line-breaks & offers efficiency (gradient-boosted) | 94.1% | 5.1% | 0.8% | France |
| Passing-network structure (random forest) | 87.4% | 6.9% | 5.7% | France |
| Stacked Ensemble | 52% | 25.7% | 22.3% | France |
| Multi-calibrated 8-in-1 | 71.9% | 15.8% | 12.3% | France |

## 分歧

9 个预测者中：9 个看好 France、0 个看好 Sweden、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+38.6pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours France at 72%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting France's win chance by 0 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
