# Australia vs Egypt — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Egypt，约 43.8% — Australia 31.1% / 平 25.2% / Egypt 43.8%（信心：低）

## 九个预测者对比

| Forecaster | Australia 胜 | Draw | Egypt 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 34.1% | 36.2% | 29.7% | 平 |
| xG-corrected Elo | 45% | 25.5% | 29.5% | Australia |
| PRODEGY split attack/defence Elo | 27.5% | 29.2% | 43.3% | Egypt |
| Physical-decay dynamic-K Elo | 45.3% | 25.5% | 29.2% | Australia |
| Tactical style-clash mElo | 33.2% | 29.8% | 37% | Egypt |
| Line-breaks & offers efficiency (gradient-boosted) | 0% | 3.3% | 96.7% | Egypt |
| Passing-network structure (random forest) | 18.4% | 23.6% | 58% | Egypt |
| Stacked Ensemble | 45.1% | 28.1% | 26.8% | Australia |
| Multi-calibrated 8-in-1 | 31.1% | 25.2% | 43.8% | Egypt |

## 分歧

9 个预测者中：3 个看好 Australia、5 个看好 Egypt、1 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (-2.3pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Egypt at 44%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Australia's win chance by 0 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
