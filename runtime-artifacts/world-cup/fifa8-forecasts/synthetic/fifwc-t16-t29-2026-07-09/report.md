# T16 vs T29 — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 T16，约 61.4% — T16 61.4% / 平 21.4% / T29 17.2%（信心：高）

## 九个预测者对比

| Forecaster | T16 胜 | Draw | T29 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 48.8% | 27.2% | 24% | T16 |
| xG-corrected Elo | 58% | 23.2% | 18.9% | T16 |
| PRODEGY split attack/defence Elo | 41.2% | 22.5% | 36.2% | T16 |
| Physical-decay dynamic-K Elo | 56.9% | 23.4% | 19.7% | T16 |
| Tactical style-clash mElo | 52.3% | 27.6% | 20.1% | T16 |
| Line-breaks & offers efficiency (gradient-boosted) | 90.3% | 5.5% | 4.2% | T16 |
| Passing-network structure (random forest) | 73.7% | 21.7% | 4.6% | T16 |
| Stacked Ensemble | 46.4% | 21.2% | 32.4% | T16 |
| Multi-calibrated 8-in-1 | 61.4% | 21.4% | 17.2% | T16 |

## 分歧

9 个预测者中：9 个看好 T16、0 个看好 T29、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+28.1pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T16 at 61%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T16's win chance by 0 points.

_方法：Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
