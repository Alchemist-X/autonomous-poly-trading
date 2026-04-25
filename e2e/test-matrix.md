# 测试矩阵

英文版见 [test-matrix.en.md](test-matrix.en.md)。

## 环境矩阵

| 维度 | local-lite | remote-real |
| --- | --- | --- |
| Web 页面 | 是 | 是 |
| Admin 登录 | 是 | 是 |
| fake orchestrator | 是 | 否 |
| 真数据库 | 否 | 是 |
| 真钱包 | 否 | 是 |
| 视频录制 | 是 | 是 |

## 场景矩阵

| 场景 | local-lite | remote-real |
| --- | --- | --- |
| public-pages-render | 是 | 是 |
| admin-auth-flow | 是 | 是 |
| admin-action-proxy | 是 | 是 |
| mock-run-visibility | 是 | 否 |
| run-persisted-real | 否 | 是 |
| portfolio-sync-real | 否 | 是 |
| failure-video-demo | 是 | 占位 |
| success-video-demo | 是 | 是 |

## 护栏矩阵

| 护栏 | 说明 |
| --- | --- |
| `AUTOPOLY_E2E_REMOTE=1` | 显式开启远端真实模式 |
| `ALLOW_REAL_TRADING=1` | 显式允许真实交易 |
| `MAX_LIVE_TRADE_USD<=1` | 真实交易金额上限 |
| allowlist market slug | 只允许指定市场 |
| destructive case 分离 | flatten 等危险动作不并入默认回归 |
