# Forecasting Eval Backlog

最后更新：2026-05-07

## 当前整体 plan 状态

仓库现在有一个轻量总入口：[`docs/agent-handoff.md`](../docs/agent-handoff.md)，按 P0 / P1 / P2 维护当前项目待办。更细的产品或工程计划放在 `docs/internal/plan/`。目前没有统一维护 P00 / P0 / P1 / P2 / P3 五级分类的全局 plan。

本文件只维护 forecasting agent / eval 质量相关 backlog，并采用 P00 / P0 / P1 / P2 / P3 五级分类。

## P00 — 任何 live 前必须修

- [x] **Market binding identity 校验**：2026-05-05 已实现。报告和执行计划的 `marketSlug`、`tokenId`、`outcomeLabel`、规则阈值必须完全一致；同一 event 下不同 strike / team / candidate 不能只靠 `eventSlug` 绑定。
- [x] **价格容差校验**：2026-05-05 已实现。bestBid/bestAsk、decision price、expected fill price 允许 3% 以内误差；超过 3% 必须重新 quote 或进入人工复核。

## P0 — 下一轮 live 前应优先修

- [ ] **已有仓位真实外部证据复审**：2026-05-07 已把 review 结果结构化为 `freshEvidence` / `adverseSignals` / `stopOrReduceTriggers` / `pnlSnapshot`，但对没有 Pulse 覆盖的已有仓位仍只是明确标记 `not-refreshed`。下一步要让 pulse 研究阶段对每个已有仓位拉取规则、评论、外部来源和盘口，不能只靠当前 mark。
- [x] **逐仓 PnL 归因 + calibration ledger**：2026-05-07 已实现。`pulse-live` 会保存 `position-mark-snapshot.json`、每轮 `calibration-ledger.jsonl`，并追加全局 `runtime-artifacts/evaluation/pulse-calibration-ledger.jsonl`，供未来 backtesting / 单次 run 复盘使用。

## P1 — 本周质量提升

- [ ] **深研覆盖门槛**：进入 live 的 open 决策必须完成 rules、resolution source、comments、orderbook、source citations；未完整深研只能进入 watchlist。
- [ ] **低 edge policy**：低于策略阈值的交易要么 skip/watchlist，要么明确写出为什么策略允许小 edge。

## P2 — 报告可读性和证据质量

- [ ] **Citation 结构化**：关键 claim 统一写成 source / retrieved_at / credibility / viewpoint / short quote。
- [ ] **评论区抽样增强**：覆盖 latest、top-liked、holder、opposition 四类；记录评论是否改变概率。

## P3 — 体育数据收集 TODO

- [ ] **Football / World Cup 数据源**：接入或至少手动采集 FIFA ranking、Elo / SPI 类评分、博彩公司赔率、伤病与大名单、赛程路径、同事件兄弟市场概率总和。
- [ ] **Eurovision 数据源**：接入或至少手动采集 Eurovisionworld / bookmaker odds、歌曲发布反馈、半决赛抽签、出场顺序、媒体与社区反应。
- [ ] **体育市场 sensitivity**：对低 edge 体育仓位补 “若外部赔率 / Elo / 伤病假设变化，edge 是否仍存在”。
