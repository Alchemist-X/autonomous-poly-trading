# TODO Loop

最后更新：2026-03-13

这份清单只记录接下来真正需要推进的事项，分成两类：

- 一定需要做：不做就没法稳定上线，或者上线后风险过高
- Nice to have：不影响首版闭环，但会显著提升可靠性、可观测性或产品完成度

## 一定需要做

### 1. 打通真实 Claude Code 决策闭环

- 把 `services/orchestrator` 里的 runtime 抽象真正接到 Claude Code headless 命令
- 明确输入上下文：
  - 当前资金
  - 当前持仓
  - 风控状态
  - market pulse 输出
  - portfolio review 输出
- 明确输出只允许结构化 `TradeDecisionSet`
- 失败时必须有降级策略：
  - 本轮不下单
  - 记录失败原因
  - 不影响同步和止损任务继续运行

完成标准：

- orchestrator 可以定时拉起 Claude
- Claude 输出通过 schema 校验
- 合法 decision 能进入 executor 队列

### 2. 把外部 repo 的核心能力真正接进运行链路

- `polymarket-market-pulse`
  - 接成定时输入源，而不是停留在 vendor 目录
- `all-polymarket-skill`
  - 至少把 backtesting、monitor、resolution tracking 接起来
- `alert-stop-loss-pm`
  - 再核对一次当前服务化后的止损逻辑和原逻辑是否一致
- `polymarket-trading-TUI`
  - 对照它的交易参数、精度、报错处理，补齐 executor 的边角

完成标准：

- 每个外部仓库都有明确接入点
- 不是“放在 vendor 里”，而是真正在定时任务或执行流程里被调用

### 3. 让数据库从样例数据切到真实运行数据

- 检查 `packages/db` 和 web 端是否还有 mock/seed-only 展示路径
- 让首页、持仓页、交易页、runs 页都直接展示真实运行数据
- agent run、decision、execution、risk event、portfolio snapshot 必须完整落库

完成标准：

- 启动后即使不 seed，也能看到真实同步出来的数据
- 页面展示与钱包状态、执行记录一致

### 4. 部署真实基础设施

- 选定托管 Postgres
- 选定 Redis
- 在云主机部署 `orchestrator + executor`
- 在 Vercel 部署 `apps/web`
- 配好只读数据库凭据给 web，读写凭据只给后台服务

完成标准：

- 公网可访问 spectator site
- 后台服务持续运行
- 站点能看到真实仓位和真实成交

### 5. 补齐生产环境 secrets 和权限边界

- 整理 `.env` 分层：
  - 本地开发
  - 云主机生产
  - Vercel 生产
- 确保网站端永远拿不到私钥和签名材料
- 管理员动作必须校验内部 token / 密码
- Claude 运行容器不能直接接触钱包私钥

完成标准：

- 私钥只存在 executor 运行环境
- 前端和 Claude artifact 不会泄露任何敏感值

### 6. 做完整 dry-run / paper-run

- 增加 dry-run 模式，允许完整跑决策、风控、执行流程但不真实下单
- 连续跑至少 72 小时
- 记录：
  - 运行频率是否稳定
  - 是否有重复下单
  - 是否有任务堆积
  - 是否有异常 halt

完成标准：

- 干跑期间没有明显稳定性问题
- 切真钱前关键日志和状态机都可读

### 7. 加强执行安全

- 下单前增加更多检查：
  - token 是否存在
  - 市场是否 active
  - 买卖方向是否正确
  - 金额是否超过上限
  - 盘口 spread 是否异常
  - 滑点是否超阈值
- 止损卖出和人工 flatten 必须优先级最高
- drawdown halt 后禁止新开仓

完成标准：

- executor 不会因为 Claude 输出异常而直接乱下单
- 关键风控路径都有硬限制

### 8. 补齐生产可观测性

- 为 orchestrator 和 executor 增加结构化日志
- 给关键流程打事件：
  - run started
  - run failed
  - decision accepted/rejected
  - order submitted
  - order filled/rejected
  - stop loss triggered
  - drawdown halted
- 网站上至少能看到最近错误和系统状态

完成标准：

- 出问题时能快速定位是 Claude、策略、数据库还是交易执行层

## Nice to have

### 1. OpenClaw Runtime

- 按现有 `AgentRuntime` 抽象新增 `OpenClawRuntime`
- 不改 DB、不改 executor、不改 web

### 2. 更好的围观体验

- 首页加更清晰的 equity 曲线和回撤展示
- run detail 页展示更强的决策链路和引用来源
- 报告页支持按日期、类型筛选
- 手机端做更顺手的卡片布局

### 3. 实时刷新升级

- 现在是 5 秒轮询
- 后续可以换成 SSE 或 websocket
- 但只在确认 Vercel 和后端部署复杂度可接受时再做

### 4. 回测体系增强

- 保存每日回测结果快照
- 支持对比实盘与回测偏差
- 增加简单 leaderboard 或策略版本对比

### 5. 风控面板增强

- 展示高水位、当前回撤、剩余可开仓额度
- 单独列出止损事件和 halt 历史
- 增加人工恢复时的备注记录

### 6. 更强的管理员能力

- 支持只平某个仓位
- 支持禁用某类市场
- 支持临时关闭某个 runtime
- 支持手工触发某个 report/backtest job

### 7. 延迟和成交质量分析

- 用 `pm-PlaceOrder` 做机房延迟 benchmark
- 记录下单到撮合完成的延迟
- 记录 FOK 成功率和成交价格偏差

### 8. 自动对账

- 每日自动对账：
  - 数据库持仓
  - 网站展示
  - Polymarket 账户实际状态
- 出现偏差时自动告警

### 9. 报警通知

- 接 Telegram / Slack / Email
- 重点通知：
  - halt
  - stop loss
  - run failure
  - executor 连接失败
  - 数据同步失败

## 建议执行顺序

1. 先打通 Claude 决策闭环
2. 再把 market pulse / backtest / resolution 真正接进调度
3. 然后完成 dry-run
4. 再做真实云端部署
5. 最后再补 UI、SSE、OpenClaw 和报警增强
