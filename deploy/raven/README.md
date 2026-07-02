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

## 成本与安全

- **订阅模式**：run 消耗你订阅的用量窗口（Max 5 小时滚动窗），无额外账单；一个联网 run 通常几分钟。**token 等同你的账号身份，只放在这台你信任的服务器上。**
- 访问门是全站的（页面 + API）；`RAVEN_ACCESS_TOKEN` 不设则完全开放，公网部署务必设置。
- 引擎产物在 `runtime-artifacts/forecasts/<eventId>/`（state.json / report.md / analyst.json），全部可审计。
