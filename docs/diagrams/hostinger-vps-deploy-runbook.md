# Hostinger VPS 部署运行手册

英文版见 [hostinger-vps-deploy-runbook.en.md](hostinger-vps-deploy-runbook.en.md)。

最后更新：2026-03-23

## 目标

这份手册用于把本仓库的后台运行栈部署到 Hostinger VPS。

当前建议部署范围：

- `postgres`
- `redis`
- `orchestrator`
- `executor`

当前不把 `apps/web` 一起塞进这套 Hostinger 容器栈，原因如下：

- 仓库原始定位就是 web 更适合部署到 Vercel
- 管理接口不应该默认公开暴露
- 先把交易后台栈稳定跑起来，比先塞一个全家桶站点更重要

## 本仓库新增的 Hostinger 部署资产

- [docker-compose.hostinger.yml](../../deploy/hostinger/docker-compose.yml)
- [services/orchestrator/Dockerfile.hostinger](../services/orchestrator/Dockerfile.hostinger)
- [services/executor/Dockerfile.hostinger](../services/executor/Dockerfile.hostinger)
- [deploy/hostinger/stack.env.example](../deploy/hostinger/stack.env.example)

设计目标：

- 内部端口默认只绑定到 `127.0.0.1`
- `vendor/repos` 与 `runtime-artifacts` 使用持久卷
- 容器内健康检查、自动重启、依赖顺序明确
- `orchestrator` 启动时自动执行 `pnpm vendor:sync`

## Hostinger 侧前置条件

建议：

- VPS 选择 Docker 模板
- 系统使用较新的 Ubuntu 版本
- 先只开放公网端口：
  - `22`
  - `80`
  - `443`

不要默认公开这些内部端口：

- `4001`
- `4002`
- `5432`
- `6379`

## 关键 blocker

当前会话里没有远程 VPS 凭据，也没有 Hostinger 面板会话，因此我不能直接替你完成远程部署。

目前明确的 blocker：

- 缺少 Hostinger SSH 入口或面板访问
- 缺少生产用 `stack.env`
- 缺少生产域名 / TLS / 反向代理决定
- 如果要跑 provider runtime，还要确认对应 CLI 在容器外还是容器内可用

## 推荐部署步骤

### 1. 把仓库放到 VPS

```bash
git clone <your-repo-url> /opt/autopoly
cd /opt/autopoly
```

### 2. 创建专用环境文件

```bash
cp deploy/hostinger/stack.env.example deploy/hostinger/stack.env
chmod 600 deploy/hostinger/stack.env
```

必须至少填写：

- `POSTGRES_PASSWORD`
- `ORCHESTRATOR_INTERNAL_TOKEN`
- `PRIVATE_KEY`
- `FUNDER_ADDRESS`
- `APP_URL`

注意：

- `PULSE_SOURCE_REPO_DIR`、`CODEX_SKILL_ROOT_DIR`、`OPENCLAW_SKILL_ROOT_DIR` 在容器里都应保持 `/app/vendor/repos/all-polymarket-skill`
- `ARTIFACT_STORAGE_ROOT` 应保持 `/app/runtime-artifacts`
- live 路径必须显式 `AUTOPOLY_EXECUTION_MODE=live`

### 3. 启动后台栈

```bash
STACK_ENV_FILE=./deploy/hostinger/stack.env \
docker compose -f deploy/hostinger/docker-compose.yml up -d --build
```

### 4. 检查服务健康

```bash
STACK_ENV_FILE=./deploy/hostinger/stack.env \
docker compose -f deploy/hostinger/docker-compose.yml ps

curl -fsS http://127.0.0.1:4001/health
curl -fsS http://127.0.0.1:4002/health
```

### 5. 看日志

```bash
STACK_ENV_FILE=./deploy/hostinger/stack.env \
docker compose -f deploy/hostinger/docker-compose.yml logs -f orchestrator executor
```

## 运行约束

这套 Hostinger 部署默认遵守以下约束：

- 不默认公开 `orchestrator` / `executor`
- 不绕过现有 live preflight
- 不改变 `collateral=0 且 remote positions=0` 的拦截逻辑
- 不改变 `pulse-direct` 作为默认主决策路径

如果你要运行真实闭环，仍然建议先按下面顺序验证：

1. `paper`
2. `pulse:live --recommend-only`
3. `pulse:live`
4. `live:test`

## 当前已知限制

- 本机没有 Docker，所以这份 Hostinger compose 还没在本地执行 `docker compose config`
- 这份方案先覆盖后台栈，不包含 web 的公开部署
- 如果后续要让 Vercel 上的 web 访问 Hostinger 后台管理接口，需要单独设计内网访问或受保护代理，不能直接裸暴露 `4001`

## 下一步命令

如果你已经有 VPS SSH：

```bash
ssh root@<your-hostinger-vps-ip>
```

如果你已经把仓库放到 VPS：

```bash
cd /opt/autopoly
cp deploy/hostinger/stack.env.example deploy/hostinger/stack.env
vi deploy/hostinger/stack.env
STACK_ENV_FILE=./deploy/hostinger/stack.env docker compose -f deploy/hostinger/docker-compose.yml up -d --build
```

如果你要我继续推进，下一步最有效的是给我其中之一：

- VPS SSH 地址和可用登录方式
- 你准备使用的域名
- 你打算让 web 继续放在 Vercel，还是也放到 Hostinger
