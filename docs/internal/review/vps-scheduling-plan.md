# VPS 定时交易系统方案比较

英文版见 [vps-scheduling-plan.en.md](vps-scheduling-plan.en.md)。

最后更新：2026-03-29

## 人类 Review 入口

1. **`services/orchestrator/src/index.ts` 第 43 行** -- 已有内置 cron 调度器（`node-cron`），用 `agentPollCron` 每 3 小时触发 `runAgentCycle`。这是有状态路径（依赖 DB + Redis）。
2. **`docker-compose.hostinger.yml`** -- 已有完整的 Hostinger 部署方案，包含 orchestrator/executor/postgres/redis 四个容器，带健康检查和自动重启。
3. **`scripts/pulse-live.ts`** -- 无状态路径的入口脚本，单次执行后 `process.exit`。这是你要定时运行的目标命令。
4. **`deploy/hostinger/stack.env.example`** -- 已有环境变量模板，包含所有必要配置。

核心事实：**有状态路径已经内置了调度器**；无状态路径目前是"跑一次就退出"的设计。

---

## 问题是什么

`pnpm pulse:live` 是一个一次性运行脚本：启动 -> preflight -> pulse -> 决策 -> 下单 -> 归档 -> 退出。想让它在远程 VPS 上每隔 3 小时自动执行。

## 会影响什么

- 交易频率和及时性：定时执行 = 每 3 小时扫描全市场一次
- 资金安全：VPS 上存放私钥，调度器异常可能导致重复下单或遗漏
- 运维成本：需要监控调度器本身是否存活

## 准备怎么处理

下面列出六个方案，逐一分析，最后给出推荐。

---

## 方案对比表

| 维度 | A: cron + shell | B: systemd timer | C: PM2 cron | D: Docker + 内置调度 | E: Orchestrator 有状态路径 | F: Claude Code Agentic |
|------|----------------|------------------|-------------|---------------------|-------------------------|----------------------|
| **复杂度** | 最低 | 低 | 中 | 中高 | 中高 | 高 |
| **上手时间** | 10 分钟 | 20 分钟 | 15 分钟 | 1-2 小时 | 1-2 小时 | 半天以上 |
| **依赖** | cron (系统自带) | systemd (Ubuntu 自带) | PM2 (npm 安装) | Docker + compose | Docker + Redis + Postgres | Claude Code CLI |
| **日志** | 需要手动重定向 | journald 自动收集 | PM2 内置日志 + rotation | Docker logs | Docker logs + DB 记录 | CLI stdout |
| **错误恢复** | 无 (下次照跑) | 无 (下次照跑) | 可配 restart | 容器 restart | 容器 restart + DB 状态 | AI 自主判断重试 |
| **并发保护** | 需要 flock | 需要手动 | PM2 单实例 | 单容器保证 | 内部保证 | 无 |
| **监控** | 无 (需自建) | systemctl status | pm2 monit | docker stats | /health 端点 | 无标准方案 |
| **适合 pulse-live** | 完美 | 完美 | 适合 | 需额外封装 | 不适合（为有状态设计） | 过度设计 |
| **私钥管理** | .env 文件 | .env 文件 | .env 文件 | Docker secret/env | Docker secret/env | .env 文件 |
| **可靠性** | 高 (cron 极稳) | 很高 | 高 | 高 | 高 | 不确定 |

---

## 方案 A: cron + shell 脚本

### 工作方式

在 VPS 上通过 `crontab -e` 设置定时任务，调用一个 wrapper shell 脚本来执行 `pnpm pulse:live`。

### 具体实现

```bash
# /opt/autopoly/scripts/cron-pulse-live.sh
#!/usr/bin/env bash
set -euo pipefail

LOCK_FILE="/tmp/autopoly-pulse-live.lock"
LOG_DIR="/opt/autopoly/runtime-artifacts/cron-logs"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="${LOG_DIR}/${TIMESTAMP}.log"

mkdir -p "${LOG_DIR}"

# 并发保护：如果上一次还没跑完，跳过
exec 200>"${LOCK_FILE}"
if ! flock -n 200; then
  echo "[WARN] Previous run still active, skipping." >> "${LOG_DIR}/skipped.log"
  exit 0
fi

cd /opt/autopoly

# 加载 nvm 或确保 node 在 PATH 中
export PATH="/root/.local/share/pnpm:$PATH"
export PATH="/usr/local/bin:$PATH"

echo "[INFO] $(date) Starting pulse:live" >> "${LOG_FILE}"
pnpm pulse:live 2>&1 | tee -a "${LOG_FILE}"
EXIT_CODE=${PIPESTATUS[0]}

if [ "${EXIT_CODE}" -ne 0 ]; then
  echo "[ERR] $(date) Exit code ${EXIT_CODE}" >> "${LOG_FILE}"
  # 可选：发送告警
  # curl -X POST "https://your-webhook" -d "autopoly pulse-live failed at $(date)"
fi

echo "[INFO] $(date) Finished with exit code ${EXIT_CODE}" >> "${LOG_FILE}"

# 清理 30 天以上的日志
find "${LOG_DIR}" -name "*.log" -mtime +30 -delete 2>/dev/null || true
```

crontab 条目：
```
0 */3 * * * /opt/autopoly/scripts/cron-pulse-live.sh
```

### 优点

- **最简单**：5 行 crontab + 一个 shell 脚本，10 分钟搞定
- **最可靠**：cron 是 Linux 基础设施，几乎不会挂
- **零额外依赖**：不需要安装任何东西
- **易调试**：日志就是纯文本文件，`tail -f` 即可

### 缺点

- 日志需要自己管理（上面脚本已包含 rotation）
- 没有内置监控仪表盘
- 环境变量加载需要在脚本中显式处理（cron 的 PATH 和交互 shell 不同）

---

## 方案 B: systemd timer

### 工作方式

创建一个 systemd service unit（定义要运行什么）和一个 timer unit（定义什么时候运行）。

### 具体实现

```ini
# /etc/systemd/system/autopoly-pulse-live.service
[Unit]
Description=AutoPoly Pulse Live Live Trading Run
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/autopoly
ExecStart=/usr/local/bin/pnpm pulse:live
EnvironmentFile=/opt/autopoly/.env.pizza
TimeoutStartSec=1800
# 30 分钟超时，pulse 可能很慢

# 安全加固
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/autopoly/runtime-artifacts
```

```ini
# /etc/systemd/system/autopoly-pulse-live.timer
[Unit]
Description=Run AutoPoly pulse-live every 3 hours

[Timer]
OnCalendar=*-*-* 00/3:00:00
RandomizedDelaySec=300
Persistent=true
# Persistent=true: 如果 VPS 重启导致错过一次，开机后补跑

[Install]
WantedBy=timers.target
```

启用：
```bash
systemctl daemon-reload
systemctl enable --now autopoly-pulse-live.timer
```

### 优点

- **日志自动收集**：`journalctl -u autopoly-pulse-live` 就能看，自动 rotation
- **并发保护天然支持**：systemd oneshot 不会重叠执行
- **安全沙箱**：可以用 `ProtectSystem`/`NoNewPrivileges` 限制权限
- **开机补跑**：`Persistent=true` 确保不遗漏
- **超时控制**：`TimeoutStartSec` 自动杀超时进程

### 缺点

- 比 cron 稍复杂（两个文件）
- 需要 root 权限来安装 unit 文件（或使用 user-level systemd）
- 调试 systemd 的 PATH/环境变量问题偶尔比较折腾

---

## 方案 C: PM2 + cron 表达式

### 工作方式

用 PM2 管理进程，通过 `--cron` 参数指定执行频率。

### 具体实现

```javascript
// /opt/autopoly/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "autopoly-pulse-live",
      script: "pnpm",
      args: "pulse:live",
      cwd: "/opt/autopoly",
      cron_restart: "0 */3 * * *",
      autorestart: false,     // 跑完就停，等下一次 cron 触发
      max_restarts: 0,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/opt/autopoly/runtime-artifacts/pm2-logs/error.log",
      out_file: "/opt/autopoly/runtime-artifacts/pm2-logs/out.log",
      merge_logs: true,
      max_memory_restart: "2G"
    }
  ]
};
```

启动：
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # 开机自启
```

### 优点

- **日志管理好**：PM2 内置日志 rotation（`pm2-logrotate`）
- **监控界面**：`pm2 monit` 实时看
- **Node.js 生态原生**：不需要学 systemd
- **远程监控**：可以接入 PM2 Plus（付费）

### 缺点

- PM2 的 `cron_restart` 实际行为是"按 cron 触发 restart"，不是"按 cron 触发一次性执行"。需要注意 `autorestart: false` 的配合。如果进程已经退出，`cron_restart` 不会重新启动它 -- 这是 PM2 的已知行为限制。
- **并发保护不完美**：如果上次执行超过 3 小时没结束，PM2 的 restart 行为可能导致问题
- 额外安装 PM2（`npm install -g pm2`）
- PM2 本身可能挂（虽然罕见）

### 重要注意

PM2 的 `cron_restart` 对"一次性执行 + 退出"的脚本并不理想。更好的用法是让 PM2 管理一个 wrapper 脚本：

```javascript
// 更可靠的方案：PM2 只负责保活，定时用系统 cron
{
  name: "autopoly-pulse-live-wrapper",
  script: "/opt/autopoly/scripts/cron-pulse-live.sh",
  cron_restart: "0 */3 * * *",
  autorestart: false,
  watch: false
}
```

但这实际上等于 cron + PM2 日志，意义不大。

---

## 方案 D: Docker 容器 + 内置调度

### 工作方式

构建一个专门的 Docker 镜像，内部包含 cron 或 node-cron 调度器，容器常驻运行。

### 具体实现

需要新建 `Dockerfile.pulse-live-scheduler`：

```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache bash git python3
COPY . .
RUN corepack enable \
  && pnpm install --frozen-lockfile \
  && pnpm --filter @autopoly/contracts build \
  && pnpm --filter @autopoly/terminal-ui build

# 内置一个 node-cron 调度器
CMD ["node", "scripts/pulse-live-scheduler.js"]
```

还需要写一个 `pulse-live-scheduler.ts`，内部用 `node-cron` 每 3 小时调用 `runPulseLive()`。

### 优点

- 与现有 `docker-compose.hostinger.yml` 统一管理
- 容器 restart policy 保活
- 环境隔离

### 缺点

- **要写新代码**：需要新建 scheduler 包装层
- 镜像体积大（整个 monorepo 都要 COPY 进去）
- 无状态路径本来就不需要 DB/Redis，硬塞进 Docker stack 有点重
- 构建时间长

---

## 方案 E: 使用 Orchestrator 内置调度

### 现状分析

`services/orchestrator/src/index.ts` 已经实现了：
```typescript
cron.schedule(config.agentPollCron, () => {
  void runAgentCycle({ runtime, executionQueue, config });
});
```

默认 `agentPollCron = "0 */3 * * *"`（每 3 小时）。

但这个路径是**有状态的**：
- 依赖 PostgreSQL（持久化 run/decision/artifact 记录）
- 依赖 Redis（BullMQ 队列分发交易执行）
- 执行器（executor）是独立服务，通过队列消费交易指令

### 要让它跑 pulse-live 需要改什么

1. 需要启动完整的 Docker stack（postgres + redis + orchestrator + executor）
2. 或者修改 orchestrator 代码，加一个 pulse-live 模式的 cron 调度

### 结论

**不推荐用于 pulse-live 路径**。如果未来你想切到有状态路径（`live:test`），这就是现成的方案 -- 只需部署 `docker-compose.hostinger.yml` 即可。但现阶段你的目标是先把 pulse-live 跑起来。

---

## 方案 F: Claude Code / Codex Agentic 模式

### 工作方式

在 VPS 上安装 Claude Code CLI，让它作为常驻 agent 运行，每 3 小时醒来执行交易流程。

### CLAUDE.md 第 18 节的愿景

> Codex/OpenClaw 部署在远程 VPS，定时执行 Pulse + 下单。
> 运行范式应为 API Key-free 的 Agentic 模式。

### 现实评估

- Claude Code CLI 当前需要认证（API key 或 OAuth），"API Key-free" 目前不存在
- 让 AI agent 当调度器是 over-engineering：调度本身是确定性任务，不需要 AI 参与
- `rough-loop` 服务（`services/rough-loop`）已经实现了类似思路：用 codex CLI 执行任务循环。但它的定位是开发辅助，不是生产交易调度
- 可靠性不确定：AI agent 可能误判、超时、输出不可控

### 结论

**现阶段不推荐**。这是正确的长期方向（AI 驱动的自主交易），但作为调度层，先用确定性方案（cron/systemd）把交易跑起来，AI 的价值应该放在决策层（pulse-direct 已经在做），而不是调度层。

---

## 推荐方案

### 首选：方案 B (systemd timer)

理由：

1. **Ubuntu 原生**：Hostinger VPS 跑 Ubuntu，systemd 是标配，零额外安装
2. **并发保护天然支持**：oneshot 类型的 service 不会重叠，不需要 flock
3. **日志零配置**：journald 自动收集、自动 rotation、按时间查询
4. **超时保护**：`TimeoutStartSec` 自动终止卡死的运行（pulse 有时候很慢）
5. **开机补跑**：`Persistent=true` 确保 VPS 重启后不遗漏
6. **安全沙箱**：`NoNewPrivileges`、`ProtectSystem` 限制进程权限
7. **与 Docker 路径互不干扰**：未来切到方案 E（有状态路径）时，只需 `systemctl disable` 然后起 Docker stack

### 备选：方案 A (cron)

如果你觉得 systemd 太麻烦，cron 是最简方案。功能上差异不大，主要少了并发保护和开机补跑。

---

## 推荐方案详细搭建指南 (systemd timer)

### 前置条件

| 需求 | 说明 |
|------|------|
| 操作系统 | Ubuntu 22.04+ |
| Node.js | >= 20.0.0（推荐用 nvm 或 fnm 安装） |
| pnpm | 10.28.1（corepack 安装） |
| Git | 用于 clone 仓库和 vendor:sync |
| Python3 | 部分依赖的构建需要 |
| 磁盘空间 | >= 5 GB（仓库 + node_modules + artifacts） |
| 内存 | >= 2 GB（pulse 生成期间内存峰值较高） |

### 第 1 步：准备 VPS 环境

```bash
# 以 root 或 sudo 用户登录 VPS

# 安装 Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# 启用 corepack（自带 pnpm）
corepack enable

# 安装必要工具
apt-get install -y git python3 build-essential
```

### 第 2 步：部署仓库

```bash
# 用专用用户（bootstrap-autopulse.sh 已经设计了 AutoPulse 用户）
# 或直接放 /opt/autopoly
git clone <your-repo-url> /opt/autopoly
cd /opt/autopoly

# 安装依赖
pnpm install

# 预构建必要的 workspace 包
pnpm --filter @autopoly/contracts build
pnpm --filter @autopoly/terminal-ui build

# 同步 vendor repos
pnpm vendor:sync
```

### 第 3 步：配置环境变量

```bash
# 创建生产环境文件
cp deploy/hostinger/stack.env.example /opt/autopoly/.env.pizza
chmod 600 /opt/autopoly/.env.pizza
```

必须填写的关键变量：

```env
# .env.pizza 最小必填项
AUTOPOLY_EXECUTION_MODE=live
PRIVATE_KEY=0x...
FUNDER_ADDRESS=0x...
SIGNATURE_TYPE=1
POLYMARKET_HOST=https://clob.polymarket.com
CHAIN_ID=137
DEFAULT_ORDER_TYPE=FOK

# 风控参数（根据资金量调整）
INITIAL_BANKROLL_USD=20
MIN_TRADE_USD=5
MAX_TRADE_PCT=0.15
MAX_TOTAL_EXPOSURE_PCT=0.8
MAX_EVENT_EXPOSURE_PCT=0.3
MAX_POSITIONS=22
DRAWDOWN_STOP_PCT=0.3

# Pulse 配置
PULSE_SOURCE_REPO=all-polymarket-skill
AGENT_DECISION_STRATEGY=pulse-direct
AGENT_RUNTIME_PROVIDER=none

# Artifact 归档
ARTIFACT_STORAGE_ROOT=/opt/autopoly/runtime-artifacts
```

### 第 4 步：手动验证一次

```bash
cd /opt/autopoly
pnpm pulse:live --recommend-only
```

确认能正常运行到最后、输出 recommendation 报告、归档文件写入 `runtime-artifacts/` 后再继续。

### 第 5 步：创建 systemd service

```bash
cat > /etc/systemd/system/autopoly-pulse-live.service << 'UNIT'
[Unit]
Description=AutoPoly Pulse Live Live Trading Run
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/autopoly
# 确保 pnpm 在 PATH 中
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=/usr/local/bin/pnpm pulse:live
EnvironmentFile=/opt/autopoly/.env.pizza

# 超时：pulse 生成 + 决策 + 执行，给 30 分钟
TimeoutStartSec=1800

# 安全沙箱
NoNewPrivileges=true
ProtectHome=read-only
ReadWritePaths=/opt/autopoly/runtime-artifacts

# 如果失败，写一个标记文件供监控脚本检测
ExecStopPost=/bin/bash -c 'if [ "$EXIT_STATUS" != "0" ]; then echo "$(date -Iseconds) exit=$EXIT_STATUS" >> /opt/autopoly/runtime-artifacts/cron-failures.log; fi'
UNIT
```

### 第 6 步：创建 systemd timer

```bash
cat > /etc/systemd/system/autopoly-pulse-live.timer << 'UNIT'
[Unit]
Description=Run AutoPoly pulse-live trading every 3 hours

[Timer]
OnCalendar=*-*-* 00/3:00:00
# 在准点后随机延迟 0-5 分钟，避免和其他定时任务撞车
RandomizedDelaySec=300
# VPS 重启后如果错过了上一次执行，开机后立即补跑
Persistent=true

[Install]
WantedBy=timers.target
UNIT
```

### 第 7 步：启用并验证

```bash
systemctl daemon-reload
systemctl enable --now autopoly-pulse-live.timer

# 确认 timer 已激活
systemctl list-timers autopoly-pulse-live.timer

# 手动触发一次测试
systemctl start autopoly-pulse-live.service

# 看日志
journalctl -u autopoly-pulse-live.service -f

# 检查下一次执行时间
systemctl status autopoly-pulse-live.timer
```

### 第 8 步：监控和告警（可选但推荐）

#### 方案 1：简单的失败告警脚本

```bash
# /opt/autopoly/scripts/check-health.sh
#!/usr/bin/env bash

FAILURE_LOG="/opt/autopoly/runtime-artifacts/cron-failures.log"
LAST_SUCCESS_DIR="/opt/autopoly/runtime-artifacts/pulse-live"

# 检查最近 6 小时内是否有成功的运行
RECENT=$(find "${LAST_SUCCESS_DIR}" -maxdepth 2 -name "run-summary.json" -mmin -360 2>/dev/null | head -1)

if [ -z "${RECENT}" ]; then
  echo "[ALERT] No successful run in the last 6 hours"
  # curl -X POST "https://your-webhook-url" -d '{"text":"AutoPoly: No successful run in 6h"}'
fi
```

用另一个 cron 或 timer 每 6 小时检查一次。

#### 方案 2：Healthchecks.io（免费 tier 够用）

在 `cron-pulse-live.sh` 成功后 ping 一个 Healthchecks.io URL：

```bash
# 在 service 文件的 ExecStartPost 中加
ExecStartPost=/usr/bin/curl -fsS -m 10 --retry 5 https://hc-ping.com/your-uuid-here
```

Healthchecks.io 如果 4 小时没收到 ping，会发邮件/Slack 告警。

---

## 安全注意事项

### 私钥管理

1. **`.env.pizza` 文件权限**：必须 `chmod 600`，只有运行用户可读
2. **不要用 root 运行**：建议创建专用用户（`bootstrap-autopulse.sh` 已设计了 `AutoPulse` 用户）
3. **考虑使用 systemd 的 `LoadCredential`**（进阶）：可以把私钥放在加密目录，运行时注入
4. **VPS 本身的安全**：
   - 禁用密码登录，只用 SSH key
   - 开启 `fail2ban`
   - 只开放 22 端口（不需要 web 端口，pulse-live 路径没有 HTTP 服务）
   - 定期更新系统包

### 防重复下单

- systemd oneshot 天然保证同一时刻只有一个实例在跑
- pulse-live 脚本本身是幂等的：每次运行独立获取最新状态，不存在"接着上次继续"的问题
- 但如果 pulse 生成极慢（超过 3 小时），timer 不会强制启动新实例（oneshot 未完成时 timer 触发会被跳过）

### 风控

- VPS 上的风控参数通过 `.env.pizza` 控制，与本地开发环境隔离
- 建议 VPS 上用更保守的参数（例如 `MAX_TOTAL_EXPOSURE_PCT=0.5`、`MAX_POSITIONS=10`）
- `DRAWDOWN_STOP_PCT=0.3` 会在回撤 30% 时停止交易

---

## 演进路径

```
阶段 1（现在）：systemd timer + pulse:live
    - 最快上线，验证定时交易是否可行
    - 无 DB/Redis 依赖

阶段 2（稳定后）：docker-compose.hostinger.yml
    - 切到有状态路径（live:test）
    - 内置 agentPollCron 调度
    - 交易记录持久化到 PostgreSQL
    - Web 仪表盘可看历史数据

阶段 3（长期）：Agentic 模式
    - AI agent 不仅做决策，还做执行策略调整
    - 基于历史表现自动调整风控参数
    - 异常检测和自愈
```

---

## 需要用户决定的事项

1. **VPS 上是否已有 Node.js 22 和 pnpm？** 如果 VPS 是全新的，需要先装环境。
2. **用 root 还是专用用户运行？** 推荐专用用户（`AutoPulse`），但需要确保该用户有权读写仓库目录。
3. **是否需要告警通知？** 如果要，需要一个 webhook URL（Slack/Discord/Telegram bot）。
4. **`.env.pizza` 中的风控参数**：VPS 上用什么值？建议先用保守参数跑 recommend-only 一两天，确认稳定后再开启实际下单。
5. **执行频率**：默认 3 小时一次（`OnCalendar=*-*-* 00/3:00:00`），需要调整吗？
