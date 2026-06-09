# @autopoly/sports-model

复现 Kimi《2026 世界杯赛事分析和预测报告》中提到的全部建模方法，作为**纯函数、可单测、可组合**的独立模块。每个模块确定性、不可变、无 I/O；所有随机性走可注入的种子化 `Rng`。

> Reproduces the full modeling stack named in Kimi's public 2026 World Cup report as pure, unit-tested, composable modules. 18 test files · 212 tests · `strict` + `noUncheckedIndexedAccess` clean.

## 方法 → 模块对照（Kimi method → module）

| Kimi 提到的方法 | 模块 | 关键导出 |
|---|---|---|
| Elo 强度模型 / FIFA SUM | `elo.ts` | `eloExpectedScore`, `eloUpdate`, `fifaSumExpected`, `eloToOneXTwo` (Davidson 平局模型) |
| FiveThirtyEight SPI（模型 3） | `spi.ts` | `spiExpectedGoals`, `spiMatchProbabilities` |
| Poisson 进球模型 | `poisson.ts` | `poissonPmf`, `scoreMatrix`, `outcomeProbabilities`, `overUnderProbabilities`, `bothTeamsToScore` |
| 零膨胀广义泊松 ZIGP（模型 7） | `zigp.ts` | `generalizedPoissonPmf`, `zigpPmf`, `zigpScoreMatrix` |
| Dixon-Coles 修正 | `dixon-coles.ts` | `dixonColesTau`, `dixonColesScoreMatrix`, `timeDecayWeight` |
| Bivariate Poisson | `bivariate-poisson.ts` | `bivariatePoissonPmf`, `bivariateScoreMatrix` |
| xG / xT 指标体系 | `xg.ts` | `xgEnhancedLambda` (α=0.7), `attackDefenseLambda`, `expectedThreatAdded`, `buildLinearThreatGrid` |
| 情境因子（模型 12–22：主场/海拔/高温/旅行/轮换） | `contextual.ts` | `namedVenueHomeAdvantage`, `altitudeAdjustmentFactor`, `heatPenaltyFactor`, `travelFatigueFactor`, `restAdvantageFactor`, `rotationDepthFactor`, `applyToLambda` |
| 机器学习增强（CatBoost 梯度提升 / 随机森林） | `ml/` | `fitGradientBoosting`, `fitRandomForest`, `fitRegressionTree`, `fitLogisticRegression` (+ `predict*`) |
| Monte Carlo 模拟 | `monte-carlo.ts` | `sampleMatchResult`, `estimateOutcomeProbabilities`, `simulateGroup`, `simulateKnockout`, `standardError` |
| 贝叶斯动态更新 | `bayesian.ts` | `logit`/`invLogit`, `bayesianUpdate`, `betaBinomialPosterior`, `normalCredibleInterval` |
| 市场-模型偏差分析 | `market.ts` | `impliedProbabilityFromDecimal`, `overround`, `devigNormalize`, `devigPower`, `edgeSignal` |
| 模型融合（合成算法） | `ensemble.ts` | `linearPool`, `logarithmicOpinionPool`, `logOpinionPoolOneXTwo` |
| 校准与回测指标 | `calibration.ts` | `brierBinary`, `brierMulticlass`, `logLoss`, `expectedCalibrationError` |
| 可复现随机源 | `rng.ts` | `mulberry32`, `randInt`, `sampleCategorical` |

共享契约见 `types.ts`（`OneXTwo`、`ScoreMatrix`、`GoalExpectation`、`normaliseOneXTwo`）。

## 5 层方法论栈（报告 §2 的组合方式）

```
Layer 1  实力      elo / spi            → 评级
Layer 2  过程特征   xg                   → λ（预期进球）
Layer 3  进球分布   poisson / dixon-coles / bivariate / zigp   → 比分矩阵 → 1X2 / 大小球 / BTTS
Layer 3b 情境调整   contextual           → 调整 λ（海拔/高温/旅行/轮换）
Layer 3c ML 增强    ml/*                 → 非线性修正
Layer 4  赛事模拟   monte-carlo          → 夺冠/出线分布 + 置信区间
Layer 5  动态更新   bayesian             → 按新证据更新先验
———————————————————————————————————————————————————
后处理   market（去 vig + 偏差信号） · ensemble（LogOP 融合） · calibration（Brier 记分）
```

## 用法示例

```ts
import {
  attackDefenseLambda, applyToLambda, namedVenueHomeAdvantage,
  dixonColesScoreMatrix, outcomeProbabilities,
  logOpinionPoolOneXTwo, edgeSignal, mulberry32, simulateKnockout
} from "@autopoly/sports-model";

const lambdaHome = applyToLambda(
  attackDefenseLambda(1.35, 1.0, 1.4, 1.0),
  namedVenueHomeAdvantage("mexico-city")
);
const matrix = dixonColesScoreMatrix({ home: lambdaHome, away: 0.95 }, -0.05);
const modelProbs = outcomeProbabilities(matrix); // OneXTwo

// 与市场/Kimi 融合，再算偏差信号（研究用，非投注建议）
const ensembled = logOpinionPoolOneXTwo([modelProbs, marketProbs], [0.55, 0.45]);
const signal = edgeSignal(ensembled.home, marketProbs.home);
```

## 开发

```bash
pnpm --filter @autopoly/sports-model typecheck
pnpm --filter @autopoly/sports-model build
pnpm exec vitest run packages/sports-model/
```

> 免责声明：本包用于体育概率研究，市场赔率仅作为“共识偏差研究变量”。不构成任何投注建议。
> ML 模块为紧凑参考实现，生产可经同一 fit/predict 接口替换为调优后端（CatBoost/XGBoost 级）。
