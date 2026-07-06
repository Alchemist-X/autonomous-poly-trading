# T24 vs T31 — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 T24，约 80.7% — T24 80.7% / 平 19% / T31 0.3%（信心：高）

## 九个预测者对比

| Forecaster | T24 胜 | Draw | T31 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 60.2% | 24.6% | 15.2% | T24 |
| xG-corrected Elo | 70.6% | 19% | 10.4% | T24 |
| PRODEGY split attack/defence Elo | 51.6% | 21.5% | 26.9% | T24 |
| Physical-decay dynamic-K Elo | 72% | 18.4% | 9.6% | T24 |
| Tactical style-clash mElo | 93.5% | 5.9% | 0.5% | T24 |
| Line-breaks & offers efficiency (gradient-boosted) | 96.1% | 3.9% | 0% | T24 |
| Passing-network structure (random forest) | 58.7% | 41.1% | 0.2% | T24 |
| Stacked Ensemble | 47.4% | 21.5% | 31.1% | T24 |
| Multi-calibrated 8-in-1 | 80.7% | 19% | 0.3% | T24 |

## 分歧

9 个预测者中：9 个看好 T24、0 个看好 T31、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+47.4pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours T24 at 81%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting T24's win chance by 0 points.

_方法：Market-blind: equal-weight logarithmic opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 7 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
