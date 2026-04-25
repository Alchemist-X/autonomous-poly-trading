# 风险控制说明

英文版见 [risk-controls.en.md](risk-controls.en.md)。

最后更新：2026-03-27

## 目标

这份文档定义的是服务层硬规则，不是提示词建议。

无论上层使用的是 `codex` 还是 `openclaw`，只要进入 orchestrator / executor 链路，就必须被这里的约束覆盖。

## 一、系统级停机规则

- 组合净值相对高水位回撤达到 `20%`，系统进入 `halted`
- 进入 `halted` 后，禁止任何新的 `open`
- `pause` 和 `halted` 都是 fail-closed 状态，默认不继续新开仓
- 只有管理员明确 `resume`，系统才允许恢复常规调度

## 二、仓位级风控

- 单个仓位浮亏达到 `30%`，触发止损
- 止损优先级高于常规策略动作
- `flatten` 和止损都可以覆盖普通的持仓建议
- `hold`、`close`、`reduce` 只能针对当前真实持仓里的 `token_id`

## 三、Pulse 级约束

- 运行时不再使用 mock pulse fallback
- Pulse 必须来自真实 `fetch_markets.py` 抓取结果
- Pulse 超过配置的最大年龄阈值时，视为 stale
- 可交易候选数低于阈值时，视为风险状态
- 任何候选缺少 `clobTokenIds` 时，视为风险状态
- 只要 pulse 上存在风险标记，本轮禁止任何新的 `open`
- `open` 动作的 `token_id` 必须来自 pulse candidates
- `pulse-direct` 主流程里的 `open` 金额必须由程序按 `ai_prob / market_prob` 重新计算 `1/4 Kelly`，Markdown 里的“建议仓位”只作为人工审计字段，不能直接信任为最终下注额
- `open` 决策里的 `notional_usd` 统一表示原始 `1/4 Kelly` 目标额，`liquidity_cap_usd` 单独表示流动性上限，执行层再统一裁剪

## 四、执行级额度约束

- 只允许 `FOK` 下单
- `notional_usd` 不能超过 `bankroll_usd`
- 最大总敞口默认不超过资金的 `50%`
- 最大并发持仓默认不超过 `10`
- 单笔最大下单默认不超过资金的 `5%`
- `applyTradeGuards()` 只负责把 Kelly 目标金额按 `maxTradePct / maxTotalExposurePct / maxEventExposurePct / maxPositions / liquidity_cap_usd` 向下裁剪到当前允许的最大值，不再额外按 edge 再做第二套缩放
- 被风控裁剪后的开仓金额如果低于内部最小下单额，必须直接丢弃，不能为了凑够门槛再反向加仓
- 被风控裁剪后的开仓金额如果低于 Polymarket 最小可执行门槛，必须直接丢弃，不能为了凑够交易所门槛而上调超过 Kelly
- `close` / `reduce` 的 `notional_usd` 口径代表仓位价值影响；`position_value_usd` 记录当前整仓市值，`execution_amount` + `execution_unit=shares` 记录真实卖出股数，并单独校验交易所最小 shares 门槛

## 五、Provider 输出约束

- provider 必须输出合法 `TradeDecisionSet` JSON
- provider 返回的 `artifacts` 不作为最终事实源
- 系统会强制注入规范化的 `pulse-report` 和 `runtime-log`
- provider 产出的非法开仓、越权 token、超额度动作会在服务层被过滤
- 如果 provider 没有配置命令、skill 缺失或 pulse 抓取失败，运行应直接失败，不做降级 mock

## 六、Pulse 存储命名规范

Pulse 产物必须写入统一命名空间，便于网页展示、排查和审计。

Markdown 路径：

```text
reports/pulse/YYYY/MM/DD/pulse-<timestamp>-<runtime>-<mode>-<runId>.md
```

JSON 路径：

```text
reports/pulse/YYYY/MM/DD/pulse-<timestamp>-<runtime>-<mode>-<runId>.json
```

其中：

- `<timestamp>` 使用 UTC 格式 `YYYYMMDDTHHMMSSZ`
- `<runtime>` 例如 `codex`、`openclaw`
- `<mode>` 例如 `full`、`review`、`scan`
- `<runId>` 使用本次运行的 UUID

## 七、试运行约束

- 试运行默认只验证“真实 pulse + provider 输出 + 风控过滤”
- 是否真实下单，不由 trial run 默认决定
- 任何 live smoke trade 都必须显式开启，并限制到不超过 `$1`
- 真实交易只允许在 allowlist 市场和专用测试钱包上进行

## 八、审计要求

- 风险文档必须保留中英文双份
- Pulse Markdown、Pulse JSON、runtime log 都要可追溯
- 风险状态、停机状态和管理员动作必须落库或留痕
- 新增 provider 或新增 skill 时，必须先复核这份文档
