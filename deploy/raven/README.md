# Raven Forecasting Engine — 服务器部署

> English version: [`README.en.md`](README.en.md)

一台长驻服务器 + Docker 跑整套服务：Next.js 三屏 app + 预测引擎（引擎以子进程形式在容器内运行，档案持久化在 volume）。**不要部署到 serverless**（run 要跑几分钟、要写本地磁盘）。

## 前置

- 服务器装好 Docker（`curl -fsSL https://get.docker.com | sh`）
- 一个指到服务器的域名（可选但推荐，配 HTTPS 用）

## 步骤

**1. 在你自己的电脑上生成订阅 token**（复用 Claude Pro/Max 订阅，不走 API 计费）：

```bash
claude setup-token
# 按提示在浏览器完成一次授权，复制输出的长期 token
```

也可以不用订阅、改用 API key（`ANTHROPIC_API_KEY`，按量计费）。

**2. 服务器上拉代码并配置：**

```bash
git clone -b feat/iterative-forecaster https://github.com/Alchemist-X/predict-raven.git
cd predict-raven/deploy/raven
cp .env.example .env
# 编辑 .env：
#   RAVEN_ACCESS_TOKEN=<自己定一个访问码>
#   CLAUDE_CODE_OAUTH_TOKEN=<第 1 步的 token>
```

**3. 构建并启动：**

```bash
docker compose up -d --build     # 首次构建要装全套依赖，几分钟
docker compose logs -f raven     # 看到 "Ready" 即已启动（127.0.0.1:3200）
```

**4. 配 HTTPS 反代**（推荐 Caddy，自动签证书）：

```bash
sudo apt install caddy
# 把 Caddyfile.example 的内容（改成你的域名）放进 /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**5. 首次访问**：打开 `https://你的域名/?token=<RAVEN_ACCESS_TOKEN>` —— 通过一次后种 cookie（90 天），之后直接访问。API 调用带 `x-raven-token` 头。

## 日常运维

| 操作 | 命令 |
| --- | --- |
| 更新版本 | `git pull && docker compose up -d --build` |
| 看日志 | `docker compose logs -f raven` |
| 备份档案 | 卷 `raven-artifacts`（`docker volume inspect` 找路径） |
| 换访问码 | 改 `.env` 后 `docker compose up -d` |

## Forecast API + MCP（第二个服务，端口 8787）

compose 里的 `forecast-api` 服务把同一个预测引擎抽象成对外 API：**POST 一个问题 → 拿到事件概率 + 分析思路 + 证据清单**，三种形态：JSON、纯文字、PDF 档案。与 raven app 共享档案卷——API 发起的预测在网页上也能看到（反之亦然）。

鉴权：`Authorization: Bearer <FORECAST_API_TOKEN>`（或 `x-api-key` / `?token=`；未设时回落到 `RAVEN_ACCESS_TOKEN`）。

```bash
BASE=http://<服务器IP>:8787; TOKEN=<FORECAST_API_TOKEN>

# 发起预测（几分钟；加 "wait":true 则阻塞到出结果）
curl -X POST $BASE/v1/forecasts -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"question":"Will the Fed cut rates before September 2026?"}'
# → {"forecast":{"id":"<id>","status":"running",...}}

curl -H "Authorization: Bearer $TOKEN" $BASE/v1/forecasts/<id>        # JSON 答案
curl -H "Authorization: Bearer $TOKEN" $BASE/v1/forecasts/<id>/text   # 纯文字答案
curl -OJ -H "Authorization: Bearer $TOKEN" $BASE/v1/forecasts/<id>/pdf # PDF 档案
```

**MCP 接入**（同一端口 `/mcp`，streamable HTTP，工具：`forecast_start` / `forecast_status` / `forecast_result`）：

```bash
claude mcp add --transport http raven-forecast http://<服务器IP>:8787/mcp \
  --header "Authorization: Bearer <FORECAST_API_TOKEN>"
```

限流：并发 run 上限 `FORECAST_API_MAX_CONCURRENT`（默认 2），超出返回 429。PDF 由容器内 headless Chromium 渲染并缓存在事件目录（`answer.pdf`）。

**每日配额 + 邀请码**：网页 app 和 API **各自**每天（UTC 日）最多 `FORECAST_DAILY_QUOTA`（默认 20）个引擎 run——只有真正发起 run 计数，轮询/取结果不算。超过后必须带**有效邀请码**：网页端在提问框下方输入（解锁成功记 localStorage）；API 加 `x-invite-code: <code>` 头或 body 里 `"invite"` 字段；MCP 的 `forecast_start` 传 `invite_code` 参数。计数存在 `runtime-artifacts/quota/`，重启不清零。

**邀请码管理（文件事件库，零依赖）**：码存在 artifacts 卷的 `runtime-artifacts/invites/events.jsonl`（追加式事件日志，两个容器共用，原子追加），每码支持 label / 次数上限 / 过期日 / 吊销 / 用量计量；**只有在超额解锁时才扣用量**，免费额度内不扣。`FORECAST_INVITE_CODE`（默认 `raven-labs`）只作**首次启动种子**（无限次码），之后以库为准：

```bash
docker exec raven-forecast-api-1 pnpm --filter @autopoly/forecast-api invite list
docker exec raven-forecast-api-1 pnpm --filter @autopoly/forecast-api invite create -- --label "for-alice" --max-uses 10 --expires 2026-08-01
docker exec raven-forecast-api-1 pnpm --filter @autopoly/forecast-api invite revoke -- <code>
```

**公网暴露**：仓库 compose 只绑 `127.0.0.1:8787`。要对外提供服务，在服务器上加一个 `docker-compose.override.yml` 把端口改绑公网（`ports: !override ["8787:8787"]`）+ 云防火墙放行 8787；有域名后建议改走 Caddy 反代（见 `Caddyfile.example` 的模式）。⚠️ 未配 TLS 前 token 走 HTTP 明文——只发给你信任的调用方，泄漏就轮换。

## 成本与安全

- **订阅模式**：run 消耗你订阅的用量窗口（Max 5 小时滚动窗），无额外账单；一个联网 run 通常几分钟。**token 等同你的账号身份，只放在这台你信任的服务器上。**
- 访问门是全站的（页面 + API）；`RAVEN_ACCESS_TOKEN` 不设则完全开放，公网部署务必设置。
- 引擎产物在 `runtime-artifacts/forecasts/<eventId>/`（state.json / report.md / analyst.json），全部可审计。
