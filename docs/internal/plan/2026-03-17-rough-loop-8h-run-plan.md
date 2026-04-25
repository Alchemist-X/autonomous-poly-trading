# Rough Loop 8h 持续运行方案

英文版见 [2026-03-17-rough-loop-8h-run-plan.en.md](2026-03-17-rough-loop-8h-run-plan.en.md)。

最后更新：2026-03-17

## Goal

- 本方案按“`Ralph loop` = 当前仓库中的 `Rough Loop`”理解。
- 目标不是让 Rough Loop 去碰真实交易或私钥，而是让它在未来一轮 `8h` 连续运行中，持续推进本项目的主目标：
  - Polymarket 云端自主交易
  - Portfolio Monitor / Review / Rebalance 能力
  - Stop Loss / 风控硬规则
  - 远程部署与长期运行准备
- 这份方案要解决两个核心问题：
  - `8h` 内不能任务断档
  - 每张任务卡都必须有足够硬的验收标准，避免“看似做了，实际上没闭环”

## Outcome

这份方案落地后，应该能做到：

- 为 Rough Loop 准备一套足够跑满 `8h` 的任务池，而不是只塞 1 到 3 张卡片
- 让任务优先服务当前项目主线，而不是被零散文档修补耗尽时间
- 每张任务都有明确的 `Allowed Paths`、`Definition of Done`、`Verification`
- 让运行结果可以按“完成数、通过率、主线推进度、产物质量”来验收
- 在不中断用户控制权的前提下，让 Rough Loop 先作为“8h 自主编码推进器”稳定运行

这份方案不直接做到：

- 不让 Rough Loop 直接接管真实交易
- 不在本轮方案里实现自动任务生成器；先用高质量预制任务池解决供给问题

补充说明：

- 你现在已经原则上允许我接触：
  - 真实私钥
  - 真实 live trading
  - 系统级安全配置
  - 覆盖线上服务
- 但这不等于“无条件直接放开”
- 计划会把这些能力收进一个明确的风险包络里，只有在你给出止损和仓位额度限制后，才进入真实执行阶段

如果你额外提供一台 `VPS` 和 `SSH` 权限，这份方案还会扩展成：

- 让我直接在远程工作空间里做 build、test、smoke run、部署演练
- 把“本地 8h Rough Loop 持续推进”扩展为“本地推进 + 远程验证 + 远程部署准备”双轨模式
- 让目标不只是“写任务”，而是“逐步把项目推进到真正可远程长期运行”

## Implementation

### 1. 运行模型

建议把这轮 `8h` run 当成一次“有配额、有补货线、有验收门槛”的受控批处理，而不是无限自转。

推荐目标：

- 总时长：`8h`
- 目标完成任务数：`10` 到 `14`
- 单任务理想耗时：`20` 到 `40` 分钟
- 允许的任务类型：
  - 代码修复
  - 测试补强
  - 文档与运维说明
  - 产物归档链路补全
- 默认禁止：
  - 真实交易
  - 生产部署
  - 私钥与敏感 env 操作

推荐节奏：

1. 第 0 阶段：Bootstrap `15` 到 `30` 分钟
   - 验证 daemon、lock、heartbeat、artifact 正常
   - 先跑 1 张最小 smoke 卡
2. 第 1 阶段：主线推进 `5h`
   - 优先做与交易主线最相关的代码 / 测试 / 归档任务
3. 第 2 阶段：硬化与补洞 `2h`
   - 补 monitor、stop-loss、deployment、doc gaps
4. 第 3 阶段：收口 `30` 到 `45` 分钟
   - 保证最后一批任务不留下半成品
   - 产出本轮 handoff / summary / remaining backlog

### 1.5 远程 VPS / SSH 执行轨道

如果你提供：

- `VPS`
- `SSH host`
- `port`
- `user`
- 认证方式
- 远程工作目录

那么推荐把这轮计划升级成“两条并行目标”：

- 本地：
  - Rough Loop 连续 `8h` 推进代码、测试、文档和任务池
- 远程：
  - 对当前主线做真实 build / test / smoke / deploy 验证

推荐远程执行边界：

- 默认允许：
  - clone / pull repo
  - 安装依赖
  - build / test / run pulse-live smoke
  - 配置 `cron` 或 `systemd`
  - 写非敏感运行日志和归档
- 你已原则上授权：
  - 写入真实私钥
  - 打开真实 live trading
  - 修改防火墙、云网络或系统级安全配置
  - 覆盖线上已有生产服务
- 真正执行这些高风险动作之前，仍然必须先满足：
  - 你给出明确的止损和仓位额度限制
  - 远程归档与 fail-fast 路径已验证
  - 紧急 halt / rollback 路径已准备好
  - 当前执行模式、钱包、额度、风险参数都能在输出中明确打印

推荐远程路径优先级：

1. 先拿远程 build 成功
2. 再拿 pulse-live recommend-only 跑通
3. 再拿受限 live execute smoke 跑通
4. 再拿 daily scheduler 跑通
5. 最后才考虑完整 `orchestrator + executor + Postgres + Redis`

### 1.6 真实执行的风险包络

既然你已经允许我碰真实执行，这里需要把“允许”收敛成“允许在明确限制内执行”。

上线前必须固定的参数：

- `POSITION_STOP_LOSS_PCT`
- `DRAWDOWN_STOP_PCT`
- `MAX_TRADE_PCT`
- `MAX_EVENT_EXPOSURE_PCT`
- `MAX_TOTAL_EXPOSURE_PCT`
- `MAX_POSITIONS`
- 单日最大可接受亏损阈值
- 测试钱包或正式钱包的地址边界
- 紧急停机命令和回滚方式

推荐首轮默认值：

- 单仓止损：`20%` 到 `30%`
- 单笔最大下单比例：`1%` 到 `3%`
- 单事件最大敞口：`10%` 到 `20%`
- 总敞口上限：`20%` 到 `35%`
- 最大并发持仓：`3` 到 `5`
- 单日最大容忍亏损：`2%` 到 `5%`

没有这些值，就不进入真实 live trading 阶段。

### 1.7 当前已确认的首轮参数

根据你刚刚给出的要求，这轮计划先按下面这组值落：

- `DRAWDOWN_STOP_PCT=0.3`
  - 理由：总损失超过 `30%` 就停掉实盘
- `POSITION_STOP_LOSS_PCT=0.3`
  - 理由：先与当前仓位级止损保持同一阈值
- `MAX_TRADE_PCT=0.2`
  - 理由：你明确要求单笔不要超过 `20%`
- `MAX_EVENT_EXPOSURE_PCT=0.3`
  - 理由：你明确要求 `30%`
- `MAX_TOTAL_EXPOSURE_PCT=1.0`
  - 理由：当前代码里不能忽略这个参数；最接近“全仓也没啥问题”的可执行值就是 `100%`
- `MAX_POSITIONS=5`
  - 理由：账户只有 `20 USD` 不能严格限制“持仓个数”，所以仍然保留一个温和上限，避免无限开很多小仓
- `INITIAL_BANKROLL_USD=20`
  - 理由：测试账号起始就是 `20 USD`
- 单日最大亏损阈值
  - 当前代码里没有独立 daily-loss 开关；暂时沿用 `DRAWDOWN_STOP_PCT=0.3` 作为有效硬停机线

兼容性说明：

- 当前仓库的 `live:test` preflight 明确要求：
  - `MAX_TRADE_PCT<=0.1`
  - `MAX_EVENT_EXPOSURE_PCT<=0.3`
- 这意味着你给的 `MAX_TRADE_PCT=0.2` 会让现有 `live:test` 直接失败
- 所以首轮真实执行 smoke 应优先走：
  - `pulse:live`
- 如果后面要走完整 `live:test` 路径，要么：
  - 临时把 `MAX_TRADE_PCT` 降回 `0.1`
  - 要么修改 full live preflight 契约

### 2. 任务供给设计

不要只准备 `Queue`；要准备三层供给。

推荐三层结构：

- `Active Queue`
  - 开跑时直接放入 `8` 张任务卡
  - 保证 Rough Loop 一开始就不饿
- `Warm Reserve`
  - 额外准备 `6` 到 `8` 张任务卡
  - 当前批次快见底时手动补入 `rough-loop.md`
- `Cold Backlog`
  - 再准备 `6` 到 `10` 个候选任务
  - 作为临时替补，避免因依赖阻塞导致整个 loop 空转

推荐补货线：

- 当 `todo` 少于 `4` 张时，立即补货到 `8` 张
- 当连续 `2` 张任务进入 `blocked`，立即切到备用批次
- 当连续 `2` 张任务只产出 doc 价值、没有代码 / 测试推进，下一批必须回到主线代码任务

### 3. 任务配比

为了让 `8h` run 真正服务本项目目标，任务比例不要失控。

推荐配比：

- `35%`：交易主线与 runtime 稳定性
  - `provider-runtime`
  - `pulse-direct`
  - `pulse:live`
  - `trial:run`
- `25%`：Portfolio Monitor / Review / Stop Loss
  - `queue-worker`
  - snapshot
  - risk events
  - report artifacts
- `20%`：部署与运行可观测性
  - remote deployment docs
  - health / status / summary
  - artifact discoverability
- `20%`：文档 / 回归 / 收口
  - bilingual docs
  - missing tests
  - handoff / operator guidance

硬约束：

- docs-only 任务不超过总任务数的 `30%`
- 任意时刻至少有 `3` 张代码或测试任务在 `todo`
- 不允许连续 `3` 张任务都只改文档

### 4. 任务准入标准

任何候选任务在进入 `Queue` 前，都必须同时满足：

1. 明确对当前项目目标有帮助
   - 不是泛泛的“整理一下”
2. 能在 Rough Loop 的单轮时限内完成
   - 默认以 `45` 分钟为上限设计
3. `Allowed Paths` 尽量收窄
   - 理想是 `1` 到 `5` 个文件
4. `Definition of Done` 必须可验证
   - 不能写成“看起来更好了”
5. `Verification` 必须具体
   - 优先 targeted test / smoke command
   - 不要只丢一个笼统 `default`
6. 不依赖用户实时补充秘密信息
   - 例如私钥、线上 token、生产 credentials
7. 不和前一批任务大面积写集冲突
   - 降低 merge / auto-commit 风险

### 5. 验收标准设计

这是本方案最关键的部分。验收必须分两层。

#### A. 单任务验收

每张任务卡都必须满足：

- 有清晰的输出物
  - 代码、测试、文档或产物链路变化
- 有清晰的验证命令
  - 并且验证命令真的能覆盖本次改动
- 有清晰的结果摘要
  - `Latest Result` 不能只写 “done”
- 如果动了人类可读文档
  - 中文主文件和英文镜像同步
- 如果动了 CLI / 运行输出契约
  - 至少补 1 个回归测试或 smoke check

不合格示例：

- “优化一下文案”
- “补一点测试”
- “完善部署”
- “清理代码”

这些表述太宽，不适合 Rough Loop。

#### B. 本轮 8h run 验收

整轮 run 建议用下面的硬指标：

- 存活时长
  - daemon 连续运行接近 `8h`
- 任务完成数
  - 完成 `10` 到 `14` 张
- 验证通过率
  - `>= 80%`
- 主线任务占比
  - 与交易主线 / monitor / risk 直接相关的任务 `>= 60%`
- 阻塞率
  - `blocked` 不超过 `20%`
- 归档完整度
  - `runtime-artifacts/rough-loop/latest.json`
  - `heartbeat.json`
  - 每轮 run artifact 都存在
- commit 质量
  - 没有把无关脏改动卷入自动 commit

推荐把整轮 run 的成功定义写成：

- `8h` 内没有任务饥饿
- 至少完成 `10` 张高价值任务
- 至少 `8` 张任务带有效验证通过
- 至少 `3` 张任务直接推进交易主线
- 至少 `2` 张任务直接推进 portfolio monitor / stop-loss / review
- 最后还能交付一份下一轮 backlog 和 handoff

### 5.5 我的阶段目标与量化指标

既然你准备给远程 `VPS + SSH`，那我需要对自己设定“分阶段可交付目标”，而不是只说我会持续做。

建议把我的目标拆成四级。

#### Level 0：远程接管工作空间

目标：

- 成功通过 `SSH` 登录
- 确认远程工作目录
- clone / pull 当前 repo
- 跑通 `pnpm install`、`pnpm vendor:sync`
- 记录远程环境基线

验收指标：

- 远程仓库目录存在
- `node`、`pnpm`、`git`、`codex` 可用性已确认
- 基线命令日志已保存
- 至少一份远程环境 handoff 文档已落盘

#### Level 1：远程验证 pulse-live 闭环

目标：

- 在远程环境中跑通：
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `ENV_FILE=... pnpm pulse:live -- --recommend-only`

验收指标：

- 四类命令至少成功一次
- pulse markdown / json 归档已生成
- recommendation artifact 已生成
- runtime log 已生成
- 错误信息若失败，必须可执行且包含足够上下文

#### Level 1.5：远程受限真实执行 smoke

目标：

- 在你给出的止损和仓位限制内，完成一次到少量几次真实执行 smoke
- 验证：
- 真实钱包
- 真实 live path
- 真实归档
- 真实失败保护

首选路径：

- 优先使用 `pulse:live`
- 暂不把 `live:test` 当成首轮真实 smoke 主路径
  - 因为当前 `live:test` preflight 与 `MAX_TRADE_PCT=0.2` 不兼容

验收指标：

- 至少 `1` 次真实执行在限制内完成
- 每次真实执行都输出：
  - execution mode
  - decision strategy
  - wallet / env
  - requested USD
  - archive dir
- 每次真实执行都保留：
  - preflight
  - recommendation
  - execution summary
  - error artifact（若失败）
- 没有任何一笔订单突破你设定的止损和仓位额度限制
- 如果触发关键失败，系统能 fail-fast，并保留中间产物

#### Level 2：远程 daily run 可持续运行

目标：

- 把受限执行路径接到 `cron` 或 `systemd`
- 保证它能够按固定频率无人值守运行
- 保证失败时能留下可追溯归档

验收指标：

- 计划任务已安装
- 连续 `3` 次计划运行成功率 `>= 90%`
- 每次运行都产出：
  - preflight
  - recommendation
  - pulse artifacts
  - runtime log
- 如果本轮允许真实执行：
  - execution summary
  - 错误时的 error artifact
- 最近一次运行时间、退出状态、归档目录可快速定位

#### Level 3：远程部署推进到项目主目标

目标：

- 在远程环境里继续推进：
  - Portfolio Monitor / Review / Rebalance
  - Stop Loss / 风控
  - full live service path 的准备度
- 把“可每日执行”逐步提升为“可长期运行的交易系统雏形”

验收指标：

- 至少 `3` 个远程验证过的高价值改动直接推进交易主线
- 至少 `2` 个远程验证过的高价值改动直接推进 monitor / stop-loss / review
- 至少 `1` 份最新远程 handoff 明确：
  - 现在能做什么
  - 还不能做什么
  - 下一步卡点是什么

#### Level 4：可考虑放开真实执行

这个等级现在已被原则上授权，但仍然不是“无条件直接放开”。

前置条件：

- 专用钱包、额度、风险阈值都已单独确认
- 远程归档、失败保护、halt 路径都已先验证
- 覆盖线上服务前，已有当前线上状态备份和回滚方案
- 系统级安全配置变更前，已有目标清单与回退命令

验收指标：

- preflight 能稳定识别执行模式、钱包、风险参数
- 每次真实执行都有完整归档
- 失败时可以 fail-fast，并保留中间产物
- 没有任何真实下单突破你给出的风险包络
- 没有无法回退的线上服务覆盖

### 6. 建议的首批任务池

这里给的是“任务池方案”，不是要求你现在立刻全部落卡。

推荐第一批共准备 `14` 张：

1. `pulse-direct-runtime` 回归补强
   - 目标：锁定“已有仓位默认 hold、新推荐转 open”的当前行为
2. `pulse:live` artifact / error path 回归补强
   - 目标：让 pulse-live 运行更适合长期 unattended run
3. `provider-runtime` 过滤与 explanatory decisions 补强
   - 目标：减少空输出或不合法输出导致的假成功
4. `queue-worker` stop-loss + snapshot 回归补强
   - 目标：把 monitor / stop-loss 主链路打实
5. `queue-worker` remote/local mismatch 检测
   - 目标：提前发现组合状态不一致
6. `portfolio review / rebalance` 报告落盘最小实现
   - 目标：把设计说明开始接成真实 artifact
7. `live:test` 失败上下文与 halt 写入错误摘要增强
   - 目标：让 full live path 更可排查
8. `README` / `handoff` 增补远程 daily run 操作说明
   - 目标：推进远程部署闭环
9. `systemd / cron` operator doc
   - 目标：服务远程长期运行
10. `runtime summary` / run index discoverability
   - 目标：让站内或 operator 更容易看到“最近跑了什么”
11. `rough-loop` 任务补货指南
   - 目标：把 `8h` 队列管理规则文档化
12. `rough-loop` run closeout 模板
   - 目标：确保最后一小时能收口
13. bilingual doc debt 清理
   - 目标：避免因为镜像不同步拖慢后续任务
14. pending test debt 清理
   - 目标：提升回归覆盖，减少假推进

### 7. 建议的任务卡写法

为了让 Rough Loop 真能跑满 `8h`，任务卡应该尽量长这样：

- 标题足够窄
  - 只做一件事
- `Allowed Paths` 足够小
  - 降低误伤
- `Definition of Done` 是结果导向
  - 例如“新增 X 回归覆盖并让 Y 输出稳定”
- `Verification` 是最短有效命令
  - 优先 `vitest` 单测、模块导入 smoke、`rg` 契约检查
- `Context` 明确为什么这个任务此时值得做
  - 让 Rough Loop 不会把精力浪费在边缘价值上

### 8. Run 前检查表

在真正启动 `8h` run 之前，先确认：

- `rough-loop.md` 当前 `Queue` 已经至少放入 `8` 张卡
- `Warm Reserve` 已写好，随时可贴入
- 当前工作树的已有脏改动已知且可接受
- `ROUGH_LOOP_RELAX_GUARDRAILS`、`ROUGH_LOOP_REQUIRE_CLEAN_TREE`、`ROUGH_LOOP_AUTO_PUSH` 的策略已定
- 预期分支已定，不会把实验性 commit 打到错误分支
- 至少一张 smoke 卡已验证过完整闭环

如果本轮同时包含远程轨道，再额外确认：

- `SSH host / port / user / auth` 已给到
- 是否允许安装系统依赖已经说清楚
- 是否允许 `sudo`、`docker`、`systemctl` 已说清楚
- 远程工作目录和日志目录已说清楚
- 真实执行时使用哪套止损和仓位额度限制，已明确
- `MAX_TRADE_PCT=0.2` 与现有 full live preflight 的冲突，已知晓并选定绕行方案
- 是否允许覆盖线上已有服务，已明确
- 系统级安全配置能改到哪一层，已明确
- 远程机上是否已有旧服务在跑，已先盘点

## User Decisions

- 决策：`Ralph loop` 是否就是当前仓库里的 `Rough Loop`
  - Why it matters：这决定我们是继续用现有 daemon，还是另起一个 loop 体系
  - Recommended default：是，直接基于现有 `Rough Loop`

- 决策：这轮 `8h` run 是否只允许“安全代码任务”
  - Why it matters：当前 Rough Loop 文档默认就排除了真实交易、生产部署和私钥操作
  - Recommended default：是，只做代码 / 测试 / 文档 / 归档

- 决策：是否允许 auto-push
  - Why it matters：`8h` run 产出会很多，auto-push 能减轻人工，但也会提高分支污染风险
  - Recommended default：首轮不 auto-push，先只 auto-commit 到独立分支

- 决策：是否接受 docs-only 任务作为补位
  - Why it matters：完全禁止 docs-only 会导致 queue 容易断粮；完全放开又会稀释主线价值
  - Recommended default：接受，但上限 `30%`

- 决策：本轮是否优先推进 remote deployment，还是优先推进 portfolio monitor / stop-loss
  - Why it matters：两条线都重要，但 `8h` 内不适合同时平均用力
  - Recommended default：先把 `portfolio monitor / stop-loss / pulse-live runtime` 放前面，deployment 文档放后半程

- 决策：本轮成功阈值是否采用“完成 `>=10` 张 + 验证通过率 `>=80%`”
  - Why it matters：没有量化阈值，run 结束时很难判断值不值
  - Recommended default：采用

- 决策：是否正式给远程 `VPS + SSH` 权限
  - Why it matters：这会把本轮从“本地计划与代码推进”升级为“远程验证与部署推进”
  - Recommended default：已视为原则上允许，并进入受限真实执行轨道

- 决策：是否允许我在远程机上创建 `cron` 或 `systemd` 服务
  - Why it matters：没有这项权限，就只能做手工 smoke，无法验证长期运行
  - Recommended default：允许

- 决策：是否允许我安装远程系统依赖
  - Why it matters：如果缺 `node`、`pnpm`、`git`、`docker` 或其他依赖，远程就无法闭环
  - Recommended default：允许，但限定在项目需要的依赖

- 决策：是否允许我接触真实 live trading env
  - Why it matters：这是最高风险边界，必须显式授权
  - Recommended default：允许，但必须绑定到你给出的风险包络

- 决策：你给我的真实执行限制具体是多少
  - Why it matters：没有具体值，就无法把“允许真实执行”转成可操作的安全边界
  - 当前先按下面这组值执行：
    - `DRAWDOWN_STOP_PCT=0.3`
    - `POSITION_STOP_LOSS_PCT=0.3`
    - `MAX_TRADE_PCT=0.2`
    - `MAX_EVENT_EXPOSURE_PCT=0.3`
    - `MAX_TOTAL_EXPOSURE_PCT=1.0`
    - `MAX_POSITIONS=5`
    - `INITIAL_BANKROLL_USD=20`

- 决策：是否允许我覆盖线上已有服务
  - Why it matters：这已经不是纯 smoke，而是实际线上变更
  - Recommended default：允许，但要求先备份当前版本并准备回滚命令

- 决策：是否允许我修改系统级安全配置
  - Why it matters：这会影响整台远程机的安全面
  - Recommended default：允许，但只改与本项目部署直接相关的配置，并记录变更前后状态

## Risks and Assumptions

- 假设：当前仓库里的 `Rough Loop` 仍然是唯一 loop 主体
- 假设：本轮不要求让 Rough Loop 直接操作真实交易或生产 secrets
- 风险：如果任务写得太宽，`8h` 会被 `blocked` / retry 吞掉
- 风险：如果连续多张任务改同一片文件，auto-commit 和后续人工整合会很痛苦
- 风险：如果任务几乎全是文档，run 看起来很忙，但对项目主线推进有限
- 风险：如果 `Warm Reserve` 没提前准备好，`Queue` 很容易在第 `3` 到 `5` 小时断粮
- 风险：当前 repo 的 bilingual 文档规则会提高文档任务成本，需要提前计入估时
- 风险：远程机如果环境漂移严重，可能把大量时间花在基础设施修复，而不是项目主线推进
- 风险：如果远程权限边界不清晰，很容易把“可做 smoke”误解为“可做真实交易”
- 风险：如果没有远程目标指标，持续运行会退化成“有事就做”，而不是朝项目主目标收敛
- 风险：即使你已授权真实交易，如果风险包络设置过宽，仍然可能出现超预期损失
- 风险：系统级安全配置和线上服务覆盖一旦没有回滚方案，故障会被放大
- 风险：真实私钥一旦进入远程机，日志、权限和文件留存策略就必须同步收紧
- 风险：如果不处理 `MAX_TRADE_PCT=0.2` 与 full live preflight 的冲突，远程 smoke 会卡在 preflight，而不是交易逻辑本身

## Execution Gate

- 先不要按这份方案直接开跑。
- 先由你确认：
  - `Ralph = Rough Loop`
  - 本轮优先级顺序
  - 是否接受推荐的成功阈值
  - 是否接受 docs-only 上限与 auto-push 默认值
  - 是否正式开启远程 `VPS + SSH` 轨道
  - 远程权限边界到哪一层
  - 是否接受 `MAX_TOTAL_EXPOSURE_PCT=1.0` 与 `MAX_POSITIONS=5` 这两个代填值
- 你确认后，下一步再把这份方案转成真正的 `rough-loop.md` 任务池与 reserve backlog；如果远程权限到位，再补一份远程执行 checklist、真实执行保护清单和阶段里程碑。
