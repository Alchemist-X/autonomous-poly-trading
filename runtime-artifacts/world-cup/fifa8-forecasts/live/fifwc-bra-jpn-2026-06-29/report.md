# Brazil vs Japan — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Brazil，约 59.6% — Brazil 59.6% / 平 21.4% / Japan 18.9%（信心：中）

## 九个预测者对比

| Forecaster | Brazil 胜 | Draw | Japan 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 52% | 31.3% | 16.7% | Brazil |
| xG-corrected Elo | 45.7% | 25.4% | 28.8% | Brazil |
| PRODEGY split attack/defence Elo | 55.6% | 17.5% | 26.9% | Brazil |
| Physical-decay dynamic-K Elo | 46.6% | 25.3% | 28.1% | Brazil |
| Tactical style-clash mElo | 53.2% | 27.3% | 19.4% | Brazil |
| Line-breaks & offers efficiency (gradient-boosted) | 92.2% | 7% | 0.7% | Brazil |
| Passing-network structure (random forest) | 81.4% | 11.6% | 7% | Brazil |
| Stacked Ensemble | 50.4% | 25.9% | 23.7% | Brazil |
| Multi-calibrated 8-in-1 | 59.6% | 21.4% | 18.9% | Brazil |

## 分歧

9 个预测者中：9 个看好 Brazil、0 个看好 Japan、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+26.3pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Brazil at 60%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Brazil's win chance by 0 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
