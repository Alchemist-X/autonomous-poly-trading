# Germany vs Paraguay — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Germany，约 54.3% — Germany 54.3% / 平 25.4% / Paraguay 20.2%（信心：中）

## 九个预测者对比

| Forecaster | Germany 胜 | Draw | Paraguay 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 55.8% | 27.3% | 16.8% | Germany |
| xG-corrected Elo | 50.4% | 24.8% | 24.8% | Germany |
| PRODEGY split attack/defence Elo | 51.9% | 20.8% | 27.3% | Germany |
| Physical-decay dynamic-K Elo | 46.4% | 25.3% | 28.2% | Germany |
| Tactical style-clash mElo | 39.7% | 29.7% | 30.7% | Germany |
| Line-breaks & offers efficiency (gradient-boosted) | 71.9% | 23.6% | 4.5% | Germany |
| Passing-network structure (random forest) | 69.5% | 25% | 5.5% | Germany |
| Stacked Ensemble | 48.8% | 27.1% | 24.1% | Germany |
| Multi-calibrated 8-in-1 | 54.3% | 25.4% | 20.2% | Germany |

## 分歧

9 个预测者中：9 个看好 Germany、0 个看好 Paraguay、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+21pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Germany at 54%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Germany's win chance by 0 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
