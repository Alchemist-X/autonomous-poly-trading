# E2E Test Driven Development

英文版见 [README.en.md](README.en.md)。

这个目录是当前仓库的端到端测试驱动开发工作区，目标不是只放几条测试，而是把“如何验证系统、如何录制证据、如何逐步提高自主水平”系统化。

当前首版聚焦交易系统本身：

- `apps/web`
- `services/orchestrator`
- `services/executor`
- 风控逻辑
- 数据落库与围观站回显

同时，这里也为二期“自主开发闭环”保留了接口和占位规范。

## 目录结构

- `master-plan.md`
  - 总体 E2E TDD 设计
- `capability-ladder.md`
  - 自主能力阶梯
- `test-matrix.md`
  - 场景、环境、护栏矩阵
- `suite/`
  - 真正的测试 runner package
- `artifacts/`
  - 视频、截图、trace、报告输出目录
- `fixtures/`
  - 风控案例和受控输入
- `prompts/`
  - 二期自主修复循环的提示模板占位

## 模式

### `local-lite`

特点：

- 不依赖本机 Docker / Redis / Postgres
- 用动态 mock state 驱动网页数据
- 启动 fake orchestrator 测 admin 代理、页面轮询和录屏
- 可以在当前机器上直接跑

### `remote-real`

特点：

- 对接真实 web / orchestrator / executor
- 对接真实数据库和真实钱包
- 用于远端烟雾测试和真实主链路验证

## 常用命令

安装 Playwright 浏览器：

```bash
pnpm e2e:install-browsers
```

运行本地降级 E2E：

```bash
pnpm e2e:local-lite
```

运行远端真实 E2E：

```bash
AUTOPOLY_E2E_REMOTE=1 pnpm e2e:remote-real
```

## 当前已实现

- 双语文档骨架
- `suite` 独立 package
- local-lite fake orchestrator
- 动态 mock state 驱动
- Playwright 浏览器录屏
- failure / success walkthrough 录制
- 风控 deterministic fixture 验证
- remote-real 场景入口与护栏占位

## 当前限制

- 当前机器没有 Docker / Redis / Postgres，所以本地只跑 `local-lite`
- `remote-real` 需要显式环境变量和远端基础设施
- GitHub PR / 自动合并 / 反馈闭环目前仍是二期占位
