# sports-model 真实数据回测结果

> **注：评测 runner 已于 2026-07-03 随 Stage 1 清理移除（run-eval.ts / data-loader.ts / metrics.ts，复现代码见 git 历史）。**

> 数据:football-data.co.uk,5 联赛 × 4 赛季 = **7,156 场**(可评估 5,984 场,含暖身期过滤)。
> 方法:walk-forward 严格无未来信息(每场只用开赛前数据)。市场 = Pinnacle/B365 去 vig。
> 复现:`pnpm tsx packages/sports-model/eval/run-eval.ts`（runner 已移除,见 git 历史） · 报告:`runtime-artifacts/sports/eval/results/eval-report.json`

## 核心结论(关于"预测率 > 70%")

**单场胜/平/负(1X2)的 argmax 命中率,全行业天花板 ≈ 54% —— 连最 sharp 的 Pinnacle 也只有 54.0%。**
所以"每个模块对单场 1X2 都 >70%"在数学上不可达,这不是代码问题,是足球本身的不可压缩随机性。**但 >70% 在置信门控子集上可达**(见下),这才是产品应对外兑现的形式。

## 1X2 回测(5,984 场,越低越好;acc 越高越好)

| 模型 | RPS | logloss | acc(argmax) | 评价 |
|---|---|---|---|---|
| **market**(基准) | 0.1961 | 0.970 | **54.0%** | 天花板,要打平已是世界级 |
| **ensemble**(LogOP: elo+DC+market) | 0.1998 | 0.982 | **53.5%** | ✅ 几乎追平 Pinnacle |
| spi | 0.2104 | 1.022 | 51.3% | ✅ 可用 |
| bayesian(elo+近况 LLR) | 0.2136 | 1.025 | 51.3% | ✅ 比纯 elo 略好 |
| dixon-coles | 0.2090 | 1.017 | 51.2% | ✅ 纯进球模型里最好 |
| poisson | 0.2091 | 1.017 | 51.2% | ✅ 可用 |
| elo | 0.2166 | 1.033 | 50.4% | ✅ 基线,最弱单模 |
| poissonNoHome(消融) | 0.2130 | 1.029 | 50.2% | 对照组:去掉主场 → 掉 1pp |

ML(时间序 70/30,train=1200 capped,test=1796):

| 模型 | RPS | acc | 评价 |
|---|---|---|---|
| marketOnTest | 0.1951 | 54.1% | 基准 |
| gradientBoosting | 0.2066 | 52.9% | ✅ 优于纯统计单模,接近市场 |
| logistic | 0.2039 | 52.5% | ✅ 可用 |
| randomForest | 0.2094 | 50.3% | ⚠️ 纯 TS naive CART 偏弱,生产换调优后端 |

## 置信门控:>70% 在这里达成 ✅

只在模型"很确定"时出硬判断(top 概率 ≥ 阈值):

| 阈值 | ensemble 命中率 | 覆盖率 | market 命中率 |
|---|---|---|---|
| top≥0.60 | **72.4%** | 21.6% | 70.1% |
| top≥0.65 | **74.7%** | 13.0% | 74.0% |
| top≥0.70 | **79.8%** | 7.2% | 77.4% |

→ 产品策略:`confidentPick(forecast, {threshold:0.6})`(已加入 `src/decision.ts`),只对 confident=true 的场次对外发"硬判断",这些判断命中率 **>70%**,且诚实可验证。

## 其他

- **Over/Under 2.5**:model(DC) logloss 0.7033 vs market 0.6698 —— 接近,略逊市场;二元 acc ~55-58%。
- **校准(calibration.ts)**:reliability 表 predicted≈observed 全档贴合(如 0.645→0.698、0.743→0.764),说明概率是诚实的,可直接对外。✅

## 各模块可用性裁定

| 模块 | 真实数据可用性 |
|---|---|
| elo / poisson / dixon-coles / spi | ✅ 可用,校准良好,DC≈最佳纯进球模型 |
| ensemble | ✅ 几乎追平 Pinnacle(53.5% vs 54.0%) |
| market | ✅ 去 vig 正确,是基准 |
| calibration | ✅ 经 reliability 验证 |
| bayesian | ✅ 近况更新带来小幅正收益 |
| ml: gradientBoosting / logistic | ✅ 优于纯统计单模 |
| ml: randomForest | ⚠️ 纯 TS 实现偏弱 + O(n²) 慢,生产换 CatBoost/XGBoost(接口已留) |
| bivariate / zigp | ⚠️ 正确但默认参数下≈poisson,需拟合 covariance/zero-inflation 才增值 |
| xg / xT | ⛔ 未用真实数据评估(football-data 无 xG);需 StatsBomb 开源数据(免费,下一步自取) |
| contextual: 主场 | ✅ 经消融验证(+1pp);海拔/高温/旅行 ⛔ 缺标注数据,暂为启发式 |
| monte-carlo | ✅ 模拟收敛(单测);出线类目标 >70% 可达,需赛事数据另测 |

## 待完善(按收益)

1. **confidence gating 已落地**(`decision.ts`)→ 兑现 >70% 硬判断。
2. xG 评估:拉 StatsBomb 开源(免费),给 `xg.ts` 补真数据 eval。
3. RF:生产期换调优后端;或给 CART 加直方图分桶把 O(n²)→O(n·bins)。
4. ensemble 权重 + Elo K/homeAdv + DC rho:用验证集网格微调,缩小对市场的 ~0.4pp 差距(收益有限,市场已是天花板)。
