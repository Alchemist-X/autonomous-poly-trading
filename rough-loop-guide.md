# Rough Loop 使用说明
英文版见 [rough-loop-guide.en.md](rough-loop-guide.en.md)。

## 目标

`Rough Loop` 是这个仓库里的代码任务持续执行器。

你只需要维护根目录的 [rough-loop.md](rough-loop.md)，不断往 `Queue` 里追加任务卡片；服务会自动读取任务、执行 Codex、运行验证、回写状态，并把过程产物写入 `runtime-artifacts/rough-loop/`。

## 启动命令

先检查环境：

```bash
pnpm rough-loop:doctor
pnpm rough-loop:doctor -- --json
```

只执行一个任务：

```bash
pnpm rough-loop:once
pnpm rough-loop:once -- --json
```

持续轮询执行：

```bash
pnpm rough-loop:start
```

开发模式监听：

```bash
pnpm rough-loop:dev
```

TTY 终端默认显示彩色分段输出；`--json`、CI、非 TTY 或 `NO_COLOR=1` 会退回机器可读或无颜色输出。

## 任务卡片格式

每个任务必须放在 `Queue` 区块下，并使用下面的固定结构：

```md
### RL-001 | 实现 Rough Loop 的 README 说明

#### Title（标题）
实现 Rough Loop 的 README 说明

#### Status（状态）
todo

#### Priority（优先级）
P1

#### Depends On（依赖任务）
- none

#### Allowed Paths（允许改动路径）
- README.md
- README.en.md

#### Definition of Done（完成定义）
- README 增加 Rough Loop 小节
- README.en.md 同步更新

#### Verification（验证命令）
- pnpm typecheck
- pnpm test

#### Context（上下文）
- 需要补充 Rough Loop 的使用入口和基本护栏说明

#### Latest Result（最近结果）
- 尚未开始

#### Attempts（尝试次数）
0
```

## 字段约束

- `Status` 只允许：
  - `todo`
  - `running`
  - `blocked`
  - `done`
  - `cancelled`
- `Priority` 只允许：
  - `P0`
  - `P1`
  - `P2`
- `Allowed Paths` 不能为空；用于限制本轮允许改动的文件或目录
- `Definition of Done` 不能为空
- `Verification` 不能为空
- `Depends On` 没有依赖时写 `- none`

如果 `Verification` 想复用默认命令，可以写：

```md
#### Verification（验证命令）
- default
```

默认会展开为：

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

如果你要在当前脏工作树里直接启动，并且不希望 Rough Loop 因为 `Allowed Paths`、敏感路径或干净工作树检查而阻断，可以显式开启：

```bash
ROUGH_LOOP_RELAX_GUARDRAILS=1
```

开启后：

- 脏工作树不会阻止启动
- 任务缺少 `Verification` 时会回退到默认验证命令
- 任务缺少 `Allowed Paths` 时默认允许整个仓库
- 不再因为敏感路径或越界改动直接转入 `Blocked`

## 运行行为

- 默认 provider 是 `codex`
- 默认要求工作树干净，但 `rough-loop.md` / `rough-loop.en.md` 的任务更新不算外部脏改动
- 默认自动 commit 到当前分支，并在每次任务完成后立即提交本轮任务实际触碰到的文件
- 默认不自动 push
- 如果出现敏感路径、越界改动、缺少验收条件，任务会被直接转入 `Blocked`
- 如果验证失败，会在同一轮内自动重试，最多 `3` 次

在 `ROUGH_LOOP_RELAX_GUARDRAILS=1` 模式下，上面的工作树和路径护栏会被显式放宽。

## 产物目录

每次尝试都会写出一个独立目录：

```text
runtime-artifacts/rough-loop/runs/YYYY/MM/DD/<timestamp>-<run-id>/
```

至少包含：

- `task-snapshot.md`
- `prompt.md`
- `provider-output.md`
- `verification.log`
- `git.diff.txt`
- `result.json`
- `summary.md`

同时会刷新：

- `runtime-artifacts/rough-loop/latest.json`
- `runtime-artifacts/rough-loop/heartbeat.json`

## 暂停方式

在仓库根目录创建一个空文件：

```bash
touch .rough-loop.pause
```

删除后恢复：

```bash
rm .rough-loop.pause
```
