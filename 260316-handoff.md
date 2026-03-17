# 260316 Handoff
英文版见 [260316-handoff.en.md](260316-handoff.en.md)。

## 1. 当前任务目标

当前主任务已经从“继续做交易系统功能”收敛到“把 Rough Loop 变成一个在当前仓库里真实持续运行的 Codex 任务循环”，并满足以下标准：

- 可以持续读取根目录 [rough-loop.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop.md) 中的任务卡片。
- 可以在当前脏工作树上启动，不因为严格护栏直接拒绝运行。
- 每次任务完成后会立即自动提交，但只提交“本轮任务真正触碰到的文件”，不把其他历史脏改动一起卷进 commit。
- 当前仓库里已经真的有一个 Rough Loop daemon 在运行，而不是只实现了代码。
- 后续新的 Agent 进入后，可以直接往 `rough-loop.md` 追加任务，让它继续推进项目。

完成标准：

- Rough Loop 代码、文档、测试、根脚本都已落地。
- `pnpm typecheck`、`pnpm test`、`pnpm build` 已通过。
- daemon 正在当前仓库运行。
- `runtime-artifacts/rough-loop/latest.json` 和 `heartbeat.json` 有更新。

## 2. 当前进展

- 已新增独立服务 `services/rough-loop`，不是复用交易 `orchestrator`。
- 已新增根入口文档：
  - [rough-loop.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop.md)
  - [rough-loop.en.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop.en.md)
  - [rough-loop-guide.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop-guide.md)
  - [rough-loop-guide.en.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop-guide.en.md)
- 已在 [package.json](/Users/Aincrad/dev-proj/autonomous-poly-trading/package.json) 增加根命令：
  - `pnpm rough-loop:once`
  - `pnpm rough-loop:dev`
  - `pnpm rough-loop:start`
  - `pnpm rough-loop:doctor`
- 已在 [packages/contracts/src/index.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/packages/contracts/src/index.ts) 增加 Rough Loop 共享 schema / types：
  - `roughLoopTaskSchema`
  - `roughLoopRunRecordSchema`
  - `roughLoopSelectionResultSchema`
  - `roughLoopVerificationResultSchema`
- 已实现 Rough Loop 核心模块：
  - [services/rough-loop/src/config.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/config.ts)
  - [services/rough-loop/src/cli.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/cli.ts)
  - [services/rough-loop/src/lib/markdown.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/markdown.ts)
  - [services/rough-loop/src/lib/loop.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/loop.ts)
  - [services/rough-loop/src/lib/provider.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/provider.ts)
  - [services/rough-loop/src/lib/verification.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/verification.ts)
  - [services/rough-loop/src/lib/git.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/git.ts)
  - [services/rough-loop/src/lib/doctor.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/doctor.ts)
- 已实现显式放宽护栏模式：
  - 环境变量 `ROUGH_LOOP_RELAX_GUARDRAILS=1`
  - 在该模式下允许脏工作树启动
  - 缺少 `Allowed Paths` 时默认放大到整个仓库
  - 缺少 `Verification` 时回退到默认验证命令
  - 不再因为越界改动或敏感路径改动直接转 `blocked`
- 已实现“任务完成后立即自动提交”的新规则，并且提交范围已经收紧为：
  - 本轮任务真实触碰到的文件
  - 加上 `rough-loop.md` / `rough-loop.en.md`
  - 不会把仓库中其他既有脏改动一并提交
- 已补测试：
  - [services/rough-loop/src/lib/markdown.test.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/markdown.test.ts)
  - [services/rough-loop/src/lib/loop.test.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/loop.test.ts)
  - [services/rough-loop/src/smoke.test.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/smoke.test.ts)
- 当前最新一轮校验已通过：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
- 当前确实有 daemon 在跑：
  - `ps` 看到 `node dist/cli.js daemon`
  - 当前 PID 记录在 `.rough-loop.lock`
  - 当前 lock 文件内容是 `pid: 38109`

## 3. 关键上下文

- 整个仓库的长期目标仍然是一个 Polymarket 云端自主交易系统，含公开围观站、orchestrator、executor、pulse、resolution、风控等。
- 但本轮用户最后明确聚焦在 Rough Loop，要让它成为“持续执行的 CodeX 系统”。
- 用户要求：
  - 不要给 Rough Loop 设置限制，或者显式放宽护栏。
  - 真的在当前仓库启动持续循环。
  - 记住“每次完成一项任务就提交”。
- 仓库存在大量未提交的已有改动，不全是 Rough Loop 本身：
  - `services/orchestrator`、`packages/db`、`apps/web` 等都有脏改动
  - 其中还有未跟踪文件，例如：
    - `services/orchestrator/src/pulse/full-pulse.ts`
    - `services/orchestrator/src/jobs/resolution.test.ts`
    - `packages/db/src/migrations/0001_tracked_sources.sql`
- 这些脏改动来自前面的连续工作，下一位 Agent 不应轻易回滚。
- 文档语言规则仍然有效：
  - 代码注释用英文
  - 面向阅读的 Markdown 中文为主文件
  - 需要同步维护英文副本
- 当前 Rough Loop 默认 provider 仍然是 `codex`，`openclaw` 只是兼容接口，并未实测完整可用。
- 当前 Rough Loop 实际运行命令是以放宽模式启动的：
  - `ROUGH_LOOP_RELAX_GUARDRAILS=1`
  - `ROUGH_LOOP_REQUIRE_CLEAN_TREE=0`
  - `ROUGH_LOOP_AUTO_COMMIT=1`
  - 然后运行 `pnpm rough-loop:start`

## 4. 关键发现

- Rough Loop 如果在严格模式下运行，会因为当前仓库脏工作树直接拒绝启动。这不是 bug，是护栏设计。
- 对当前仓库而言，必须显式使用 `ROUGH_LOOP_RELAX_GUARDRAILS=1` 才能无阻塞持续运行。
- 最开始的自动提交逻辑会把当前仓库所有脏改动一并加入 commit，这对现在这种脏工作树是不可接受的。
- 现在已经修正为“只提交本轮任务真实触碰到的文件”，根因解决逻辑在：
  - [services/rough-loop/src/lib/loop.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/loop.ts)
  - 核心方法：
    - `snapshotFileSignatures`
    - `detectTaskChangedFiles`
    - `stageCommitIfNeeded`
- 当前 `rough-loop.md` 还是空队列，所以 daemon 是活的，但状态为 `idle`，不会做任何任务。
- 当前 runtime 状态文件显示：
  - [runtime-artifacts/rough-loop/latest.json](/Users/Aincrad/dev-proj/autonomous-poly-trading/runtime-artifacts/rough-loop/latest.json)
  - [runtime-artifacts/rough-loop/heartbeat.json](/Users/Aincrad/dev-proj/autonomous-poly-trading/runtime-artifacts/rough-loop/heartbeat.json)
  - 两者都显示 `No todo tasks are available.`
- 当前 daemon 仍在运行，验证方式：
  - `ps -ax -o pid=,command= | rg 'node dist/cli.js daemon|pnpm rough-loop:start'`
  - `cat .rough-loop.lock`
- `pnpm rough-loop:doctor` 在当前默认环境下仍可能失败，因为它会诚实报告脏工作树；这不代表 daemon 没在跑。
- `rough-loop.en.md` 目前是 parser 序列化结果的英文镜像，不要手改成和 parser 格式不一致，否则 `doctor` 会报 `english-mirror` 不同步。

## 5. 未完成事项

优先级 P0：

- 往 [rough-loop.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop.md) 的 `Queue` 里真正添加任务卡片，让 daemon 开始干活。
- 明确下一阶段到底要让 Rough Loop 推进什么：
  - 继续集成 trading system 主线
  - 还是先清理并提交当前已有脏改动
  - 还是开始做部署、管理页、真实数据链路

优先级 P1：

- 决定是否把当前大量已有脏改动分批整理、测试并提交。
- 视需要把 Rough Loop 的运行摘要接进站内管理页，目前尚未接网站 UI。
- 视需要为 Rough Loop 增加任务模板 / 初始待办，不然空队列 daemon 没有业务价值。

优先级 P2：

- 决定是否要给 `rough-loop:doctor` 增加“在 relax 模式下不把 dirty tree 视为失败”的行为。
- 决定是否要让 Rough Loop 支持更强的 PR / review / merge 自动化，目前仍停留在二期占位概念，没有真实 GitHub side effects。

## 6. 建议接手路径

- 先看这些文件：
  - [rough-loop.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop.md)
  - [rough-loop-guide.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop-guide.md)
  - [services/rough-loop/src/lib/loop.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/loop.ts)
  - [services/rough-loop/src/config.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/config.ts)
  - [services/rough-loop/src/lib/loop.test.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/loop.test.ts)
  - [runtime-artifacts/rough-loop/latest.json](/Users/Aincrad/dev-proj/autonomous-poly-trading/runtime-artifacts/rough-loop/latest.json)
- 先验证这些事实：
  - daemon 是否仍在跑
  - `.rough-loop.lock` 里的 PID 是否对应活进程
  - `latest.json` / `heartbeat.json` 是否在更新
  - `rough-loop.md` 是否仍为空队列
- 推荐的第一批命令：
  - `ps -ax -o pid=,command= | rg 'node dist/cli.js daemon|pnpm rough-loop:start'`
  - `cat .rough-loop.lock`
  - `cat runtime-artifacts/rough-loop/latest.json`
  - `sed -n '1,220p' rough-loop.md`
  - `git status --short`
- 推荐下一步动作：
  - 直接在 `rough-loop.md` 里追加 1 个最小可执行任务卡片
  - 观察 daemon 是否在下一轮把任务移到 `Running`
  - 观察它是否生成 `runtime-artifacts/rough-loop/runs/...`
  - 若任务完成，验证它是否自动提交且 commit 范围正确

## 7. 风险与注意事项

- 不要把当前仓库的大量脏改动误认为是 Rough Loop 单独引入的；它们是前面多轮工作叠加的结果。
- 不要轻易执行破坏性 git 命令，例如：
  - `git reset --hard`
  - `git checkout --`
  - `git clean -fd`
- 当前 daemon 是在放宽模式下跑的，这意味着它不会再主动拦敏感路径、越界改动或脏工作树。下一位 Agent 往 `rough-loop.md` 加任务时要自己保持克制。
- 自动提交现在虽然已收紧到“本轮任务触碰文件”，但如果 provider 在一次任务里真的改了很多文件，这些文件仍然会全部进本轮 commit。
- `rough-loop.md` / `rough-loop.en.md` 由 parser 维护结构；手写时务必保持字段标题和区块结构稳定。
- `doctor` 的失败不一定表示服务坏了；在当前仓库里，最常见失败原因只是 dirty tree。
- 当前 PID `38109` 和 `.rough-loop.lock` 都是会变化的事实，接手时务必重新确认，不要盲信本文里的数字。
- `runtime-artifacts/rough-loop/latest.json` 显示 idle 是正常的，因为当前没有 `todo` 任务；不要把它误判成 daemon 没在工作。

## 下一位 Agent 的第一步建议

先不要继续改 Rough Loop 实现本身。先验证 daemon 还活着，然后直接往 [rough-loop.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop.md) 的 `Queue` 新增一个最小任务卡片，例如让它更新某一份文档或补一个小测试。确认它能被 daemon 自动拾取、执行、写 artifact，并在完成后只提交本轮触碰到的文件。只有这个闭环跑通之后，再继续更大的交易系统任务。
