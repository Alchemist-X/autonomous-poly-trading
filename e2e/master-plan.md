# E2E 总体方案

英文版见 [master-plan.en.md](master-plan.en.md)。

## 目标

这个工作区要把当前项目拆成一套可以持续迭代的 E2E 模块，而不是一次性脚本。

第一阶段只要求把交易系统的关键闭环测通：

1. 验证当前状态
2. 启动或接入环境
3. 触发一次运行
4. 验证数据库或 mock state 更新
5. 验证网站页面回显
6. 验证管理员动作
7. 录制失败与成功视频

## 模块设计

当前测试模块按两个 phase 分组：

- `trading-system`
  - 首版真实实现
- `autonomous-dev-loop`
  - 二期接口占位

每个模块统一实现：

- `id`
- `phase`
- `run(context)`

并统一输出：

- `status`
- `assertions`
- `artifacts`
- `summary`
- `nextAction`

## local-lite

这套模式是给当前机器准备的。

实现方式：

- 不起真数据库
- 不起真 Redis
- 不起真 executor / orchestrator
- 由 `packages/db` 在无数据库时读取一个可变的 state file
- 由 fake orchestrator 修改这个 state file
- web 端继续通过自己的 route handlers 读取数据

这样可以保留：

- 真网页
- 真 admin 登录流程
- 真页面轮询
- 真浏览器录制

## remote-real

这套模式给远端环境准备。

要求：

- 已有 web / orchestrator / executor
- 已有真实 Postgres / Redis
- 已有真实钱包与风控护栏
- 由 suite 只做附着、触发、断言和录制

## 护栏

对于真实环境，默认要有以下限制：

- `AUTOPOLY_E2E_REMOTE=1`
- `ALLOW_REAL_TRADING=1`
- `MAX_LIVE_TRADE_USD <= 1`
- allowlist market slug
- destructive admin case 单独标记

## 二期

二期不在本次真正执行，但结构要预留：

- bug reproduction
- candidate fix
- post-fix verification
- resolution recording
- PR opening
- feedback ingestion
- build failure repair
- human escalation
- merge
