# Forecasting 流程开销画像

> 原则：对时间和 token 的预期**以实测为准，不靠传闻**。每个 session 结束后把当轮数据追加到本表；原始逐步 CSV 在 `runtime-artifacts/pulse-live-cost-ledger/`，世界杯批量数据在 `runtime-artifacts/world-cup/run-ledger/`。
>
> 英文版：[`forecasting-cost-profile.en.md`](forecasting-cost-profile.en.md)
>
> 最后更新：2026-06-12

## 一次完整实盘 forecasting run 的形状（2026-06-10 实测，3 轮完整 run）

| 阶段 | 实测耗时 | token | 备注 |
| --- | --- | --- | --- |
| geoblock / 持仓读取 / 下单门探针 | 各 1–2s | 0 | 探针合计 < 5s |
| **研究 + 渲染（主体）** | **719–750s（约 12 分钟）** | **每轮 ~41–42k in + ~5k out** | 占整轮 ~95%；渲染期 `claude --print` **静默 0 字节 5+ 分钟属正常**，内部 timeout 30 分钟 |
| 决策解析 + 风控裁剪 + 下单 | 秒级 | 0 | 失败常见原因：P00 价漂门、流动性下限 |

**单 session 合计参考**（2026-06-10，3 轮完整 run + 2 次修复回放）：61 分钟、~125k in + ~15k out token、9 个深研样本、2 笔真实成交。

派生结论：

- 预算一轮 live run 按 **12–15 分钟、~50k token** 估；连跑 3 轮约 1 小时
- 渲染是唯一的慢点——优化方向在渲染（typed pipeline / 模板瘦身），不在探针和执行
- 静默期 ≠ 失败：0 字节挂 5 分钟以内不要杀进程；超过 15 分钟再查

## 世界杯盲测批量管线（2026-06-11/12 实测，87 题全量）

| 单元 | n | 中位耗时 | 中位 token（out） |
| --- | --- | --- | --- |
| 单场比赛预测 agent | 71 | 264s | ~14.2k |
| 组头名 writer | 12 | 317s | ~19k |
| 池子 writer（八强/四强/冠军） | 3 | 651s | ~34k |
| 10 万次 Monte Carlo 模拟 | 1 | 296s | ~22k |

全量 87 题（10 并发）：约 75 分钟、生产侧 ~150 万 out token。明细见 `runtime-artifacts/world-cup/run-ledger/summary.md`。

## 追加规则

- 每个实盘 session 结束：往 `runtime-artifacts/pulse-live-cost-ledger/` 加当日 CSV，并把显著偏离本表的数字（±50% 以上）更新进上表
- 渲染耗时若持续突破 15 分钟，视为性能回归，记 issue 而不是调高容忍度
