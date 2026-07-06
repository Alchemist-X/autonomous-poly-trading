# @autopoly/sports-model

复现 Kimi《2026 世界杯赛事分析和预测报告》中提到的核心建模方法，作为**纯函数、可单测、可组合**的独立模块。每个模块确定性、不可变、无 I/O；所有随机性走可注入的种子化 `Rng`。

> Reproduces the core modeling stack named in Kimi's public 2026 World Cup report as pure, unit-tested, composable modules. `strict` + `noUncheckedIndexedAccess` clean.

> **2026-07-03 Stage 1 清理**：全仓零引用的 `zigp` / `spi` / `bivariate-poisson` / `monte-carlo` / `bayesian` / `market` / `decision` 模块及 `eval/` runner 已移除（复现代码见 git 历史，回测结论留档于 `eval/RESULTS.md`）。当前唯一 workspace 消费方是 `packages/fifa-models`。

## 方法 → 模块对照（Kimi method → module）

| Kimi 提到的方法 | 模块 | 关键导出 |
|---|---|---|
| Elo 强度模型 / FIFA SUM | `elo.ts` | `eloExpectedScore`, `eloUpdate`, `fifaSumExpected`, `eloToOneXTwo` (Davidson 平局模型) |
| Poisson 进球模型 | `poisson.ts` | `poissonPmf`, `scoreMatrix`, `outcomeProbabilities`, `overUnderProbabilities`, `bothTeamsToScore` |
| Dixon-Coles 修正 | `dixon-coles.ts` | `dixonColesTau`, `dixonColesScoreMatrix`, `timeDecayWeight` |
| xG / xT 指标体系 | `xg.ts` | `xgEnhancedLambda` (α=0.7), `attackDefenseLambda`, `expectedThreatAdded`, `buildLinearThreatGrid` |
| 情境因子（模型 12–22：主场/海拔/高温/旅行/轮换） | `contextual.ts` | `namedVenueHomeAdvantage`, `altitudeAdjustmentFactor`, `heatPenaltyFactor`, `travelFatigueFactor`, `restAdvantageFactor`, `rotationDepthFactor`, `applyToLambda` |
| 机器学习增强（CatBoost 梯度提升 / 随机森林） | `ml/` | `fitGradientBoosting`, `fitRandomForest`, `fitRegressionTree`, `fitLogisticRegression` (+ `predict*`) |
| 模型融合（合成算法） | `ensemble.ts` | `linearPool`, `logarithmicOpinionPool`, `logOpinionPoolOneXTwo` |
| 校准与回测指标 | `calibration.ts` | `brierBinary`, `brierMulticlass`, `logLoss`, `expectedCalibrationError` |
| 可复现随机源 | `rng.ts` | `mulberry32`, `randInt`, `sampleCategorical` |

共享契约见 `types.ts`（`OneXTwo`、`ScoreMatrix`、`GoalExpectation`、`normaliseOneXTwo`）。

## 5 层方法论栈（报告 §2 的组合方式）

```
Layer 1  实力      elo                  → 评级
Layer 2  过程特征   xg                   → λ（预期进球）
Layer 3  进球分布   poisson / dixon-coles → 比分矩阵 → 1X2 / 大小球 / BTTS
Layer 3b 情境调整   contextual           → 调整 λ（海拔/高温/旅行/轮换）
Layer 3c ML 增强    ml/*                 → 非线性修正
———————————————————————————————————————————————————
后处理   ensemble（LogOP 融合） · calibration（Brier 记分）
（spi / zigp / bivariate / monte-carlo / bayesian / market / decision 层已随 Stage 1 清理移除，见 git 历史）
```

## 用法示例

```ts
import {
  attackDefenseLambda, applyToLambda, namedVenueHomeAdvantage,
  dixonColesScoreMatrix, outcomeProbabilities,
  logOpinionPoolOneXTwo
} from "@autopoly/sports-model";

const lambdaHome = applyToLambda(
  attackDefenseLambda(1.35, 1.0, 1.4, 1.0),
  namedVenueHomeAdvantage("mexico-city")
);
const matrix = dixonColesScoreMatrix({ home: lambdaHome, away: 0.95 }, -0.05);
const modelProbs = outcomeProbabilities(matrix); // OneXTwo

// 多模型 LogOP 融合（研究用，非投注建议）
const ensembled = logOpinionPoolOneXTwo([modelProbs, otherModelProbs], [0.55, 0.45]);
```

## 开发

```bash
pnpm --filter @autopoly/sports-model typecheck
pnpm --filter @autopoly/sports-model build
pnpm exec vitest run packages/sports-model/
```

> 免责声明：本包用于体育概率研究，市场赔率仅作为“共识偏差研究变量”。不构成任何投注建议。
> ML 模块为紧凑参考实现，生产可经同一 fit/predict 接口替换为调优后端（CatBoost/XGBoost 级）。
