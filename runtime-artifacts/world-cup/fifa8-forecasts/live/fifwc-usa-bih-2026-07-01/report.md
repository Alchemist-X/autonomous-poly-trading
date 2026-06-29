# United States vs Bosnia-Herzegovina — 32 强预测（FIFA 八模型）

**头条判断（多校准 8 合 1）：** 看好 United States，约 55% — United States 55% / 平 22.9% / Bosnia-Herzegovina 22.1%（信心：中）

## 九个预测者对比

| Forecaster | United States 胜 | Draw | Bosnia-Herzegovina 胜 | Lean |
|---|---|---|---|---|
| Dixon-Coles (Bayesian-shrunk) | 58.5% | 26.1% | 15.4% | United States |
| xG-corrected Elo | 55.9% | 23.7% | 20.5% | United States |
| PRODEGY split attack/defence Elo | 40.8% | 33.2% | 26% | United States |
| Physical-decay dynamic-K Elo | 51.8% | 24.5% | 23.7% | United States |
| Tactical style-clash mElo | 59% | 25.6% | 15.4% | United States |
| Line-breaks & offers efficiency (gradient-boosted) | 67.1% | 13.3% | 19.6% | United States |
| Passing-network structure (random forest) | 57.9% | 10.2% | 31.9% | United States |
| Stacked Ensemble | 49.2% | 26.7% | 24.1% | United States |
| Multi-calibrated 8-in-1 | 55% | 22.9% | 22.1% | United States |

## 分歧

9 个预测者中：9 个看好 United States、0 个看好 Bosnia-Herzegovina、0 个看平。

## 头条依据（forecasting engine）

- **Consensus of all models** (+21.7pp): The eight model views are pooled into one balanced consensus before any adjustment, which favours United States at 55%.
- **Bias correction** (0pp): The consensus is nudged to fix biases the models showed on group matches of this type, shifting United States's win chance by 0 points.

_方法：Market-blind: equal-weight linear (arithmetic) opinion pool of all 8 model views (seven base models + the stacked ensemble), then MCBoost multicalibration (alpha=0.15, 5 correction round(s)) learned on the group stage across overlapping style/strength subgroups, replayed on this fixture and bounded to within 12pp per outcome of the consensus. No betting or market-implied probabilities were used at any stage._

_市场盲测：仅使用 FIFA 场上统计 + 赛前 Elo，未读取任何市场价格或隐含概率。_
