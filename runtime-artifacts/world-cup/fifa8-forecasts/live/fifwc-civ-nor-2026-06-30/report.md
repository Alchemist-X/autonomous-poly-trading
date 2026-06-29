# Côte d'Ivoire vs Norway — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 Norway，约 43.8% — Côte d'Ivoire 31.7% / 平 24.6% / Norway 43.8%（信心：低）

## 九个预测者对比

| Forecaster | Côte d'Ivoire 胜 | Draw | Norway 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 34.1% | 29.6% | 36.4% | Norway |
| xG-corrected Elo | 17.3% | 22.6% | 60.2% | Norway |
| PRODEGY split attack/defence Elo | 31% | 23.1% | 45.9% | Norway |
| Physical-decay dynamic-K Elo | 18.2% | 22.9% | 58.9% | Norway |
| Tactical style-clash mElo | 18.4% | 27% | 54.6% | Norway |
| Line-breaks & offers efficiency (gradient-boosted) | 34.6% | 37.1% | 28.3% | 平 |
| Passing-network structure (random forest) | 53.8% | 6.9% | 39.3% | Côte d'Ivoire |
| Stacked Ensemble | 45.9% | 27.7% | 26.4% | Côte d'Ivoire |
| Multi-calibrated 8-in-1 | 31.7% | 24.6% | 43.8% | Norway |

## 分歧

9 个预测者中：2 个看好 Côte d'Ivoire、6 个看好 Norway、1 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (-1.7pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours Norway at 44%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting Côte d'Ivoire's win chance by 0 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
