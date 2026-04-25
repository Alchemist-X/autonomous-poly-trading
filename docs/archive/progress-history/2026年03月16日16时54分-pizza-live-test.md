# 2026年03月16日16时54分 Pizza 钱包真钱测试进展

## 本轮目标

- 使用 `pizza` 钱包启动一轮真钱测试准备
- 验证钱包连通性、余额识别和 `live:test` 自动链路
- 记录当前自主运行实际走到哪一步、卡在哪一步

## 本轮实际执行

1. 创建专用 live env 文件：
   - 路径：`.env.live-test`
   - 关键设置：
     - `AUTOPOLY_EXECUTION_MODE=live`
     - `INITIAL_BANKROLL_USD=20`
     - `MAX_TRADE_PCT=0.1`
     - `MAX_EVENT_EXPOSURE_PCT=0.3`
     - `FUNDER_ADDRESS` 使用 `pizza`

2. 运行只读钱包检查：

```bash
ENV_FILE=/Users/Aincrad/dev-proj/autonomous-poly-trading/.env.live-test \
pnpm --filter @autopoly/executor ops:check -- --json
```

3. 运行完整自动真钱测试：

```bash
ENV_FILE=.env.live-test pnpm live:test -- --json
```

## 结果

### 1. Pizza 钱包客户端连通成功

`ops:check` 成功拿到了以下信息：

- `envFilePath`：`/Users/Aincrad/dev-proj/autonomous-poly-trading/.env.live-test`
- `funderAddressPreview`：`0x9938***8250`
- CLOB order book 读取成功
- 能成功选出一个候选市场

这说明：

- `pizza` 私钥和地址格式有效
- Polymarket client 可以初始化
- 只读市场检查链路是通的

### 2. 当前 Polymarket 识别到的可交易 USDC 余额为 0

`ops:check` 返回：

- `usdcBalance = 0`

进一步直接读取 CLOB `balance-allowance` 的原始返回，结果也是：

```json
{
  "balance": "0",
  "allowances": {
    "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E": "0",
    "0xC5d563A36AE78145C45a50134d48A1215220f80a": "0",
    "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296": "0"
  }
}
```

这说明当前至少有一个问题存在：

- 钱包里还没有被 Polymarket 识别为可交易抵押品的 USDC
- 或者资金还没通过官方 deposit / bridge 流程沉淀成可交易余额
- 或者你转入的是 gas 资产而不是可用于下单的 USDC 抵押品

结论：

- 当前不能把 `pizza 有钱` 直接等价为 `pizza 已可交易`

### 3. 全自动真钱链路没有进入推荐阶段

`live:test` 返回失败：

- `message`: `Failed query: select 1`
- 归档目录：
  - `runtime-artifacts/live-test/2026-03-16T085359Z-pending`
- 错误文件：
  - `runtime-artifacts/live-test/2026-03-16T085359Z-pending/error.json`

这说明自动链路在最前面的数据库探活阶段就停止了。

## 当前自主运行包含的步骤

现在 `pnpm live:test` 的设计步骤是：

1. 加载专用 env 文件
2. 执行 preflight
   - 检查 live 模式
   - 检查私钥和 funder address
   - 检查数据库
   - 检查 Redis
   - 检查 Polymarket client
   - 检查远端地址是否空仓
   - 检查本地数据库是否已有未平仓持仓
   - 检查 bankroll 和风控参数
3. 初始化组合状态
4. 运行 recommend
5. 按顺序入队执行交易
6. 执行 sync
7. 输出 summary 和归档

## 本轮实际走到的位置

本轮只走到了：

1. env 加载
2. preflight 的数据库探活

没有走到：

- recommend
- queue execute
- sync
- summary 成功态

## 当前阻塞点

### 阻塞点 1：本机 PostgreSQL 未就绪

从 `live:test` 的错误看，当前默认数据库地址不可用：

- `postgres://postgres:postgres@localhost:5432/autopoly`

### 阻塞点 2：本机 Redis 未就绪

前面单独探测 Redis 时也连接失败，说明即使数据库修好，Redis 仍然会挡住后续 preflight。

### 阻塞点 3：Pizza 的可交易 USDC 余额仍为 0

即使 DB/Redis 启动成功，当前 `ops:check` 的结果也说明：

- `pizza` 暂时还不具备下第一笔 Polymarket 订单的抵押余额条件
- CLOB 原始 `collateral balance` 和 `allowances` 也都为 `0`

## 这次没有发生的事情

- 没有生成真钱推荐 run
- 没有实际下单
- 没有触发任何真实成交
- 没有修改远端持仓

## 下一步建议

1. 先把 PostgreSQL 和 Redis 启动起来，或者提供可用的远端 `DATABASE_URL` / `REDIS_URL`
2. 确认 `pizza` 钱包里的是 Polymarket 可识别的 USDC 抵押品，而不只是原生 gas 资产
3. 再次运行：

```bash
ENV_FILE=/Users/Aincrad/dev-proj/autonomous-poly-trading/.env.live-test \
pnpm --filter @autopoly/executor ops:check -- --json

ENV_FILE=/Users/Aincrad/dev-proj/autonomous-poly-trading/.env.live-test \
pnpm live:test -- --json
```

## 本轮结论

本轮不是策略或下单逻辑失败，而是运行基础设施和资金形态尚未满足真钱测试条件。

当前状态可以概括为：

- `pizza` 钱包身份有效
- Polymarket 只读检查链路有效
- 自动真钱链路已具备执行入口
- 但数据库、Redis、以及可交易 USDC 余额三项条件仍未满足
