# Polymarket CLOB V2 Cutover Runbook

> 英文版：尚未生成（cutover 后再补）
>
> 最后更新：2026-04-24
>
> 切换时刻：**2026-04-28 11:00 UTC** (~约 1 小时停机)

## 目标

把生产环境从 V1 SDK 平稳切到 V2，期间不下错单、不漏报。

## 前置条件 checklist（在 4/28 之前必须完成）

- [ ] commit `48181a5` 及后续 fee 改造已部署到 VPS（executor + orchestrator）
- [ ] commit `48181a5` 及后续 fee 改造已部署到 Vercel（apps/web）
- [ ] 真钱钱包（pizza / no1 等）已 wrap USDC.e → pUSD（见 main README 资金与账号配置一节）
- [ ] pUSD allowances 已授权给 V2 Exchange `0xE111180000d2663C0091e4f400237545B87B996B` 和 V2 NegRisk Exchange `0xe2222d279d744050d28e00520010520000310F59`
- [ ] 本地 `pnpm exec tsx scripts/v2-smoke-balance.ts` 跑过，输出非零 pUSD 余额

## 切换当天时间线

### T-30 分钟（10:30 UTC）

1. **暂停所有定时 job**：
   - VPS systemd timer：`sudo systemctl stop daily-pulse.timer pulse-live.timer`（按实际名字调）
   - Vercel cron：在 dashboard 关闭 cron 触发器
   - 本地 cron：`crontab -e` 注释掉相关行
2. **确认无 in-flight 订单**：登 Polymarket UI 或跑 `pnpm --filter @autopoly/executor exec tsx scripts/v2-smoke-balance.ts`，看 collateral allowance 没有挂单占用

### T-0（11:00 UTC）

3. **被动等待**——Polymarket 进入维护窗口，CLOB API 短暂不可用（约 1 小时）
4. **持续刷** https://status.polymarket.com 看官方公告

### T+完成（约 12:00 UTC）

5. **官方宣布切换完成后**，验证 production URL 已切到 V2：
   ```bash
   ENV_FILE=.env.pizza pnpm exec tsx scripts/v2-smoke-balance.ts
   ```
   - 期望：`host: https://clob.polymarket.com`（不带 `-v2`）
   - 期望：返回的 spender 包含 `0xE111180000d2663C0091e4f400237545B87B996B`（V2 Exchange）
   - 期望：pUSD `balance` 非零

6. **验证 USDC.e 不再被识别**：调一次 `getCollateralBalanceAllowance`，应返回 pUSD 数据

7. **跑一笔 dry-run（recommend-only）**：
   ```bash
   ENV_FILE=.env.live-test pnpm pulse:live -- --recommend-only
   ```
   - 期望：preflight 通过，pUSD 余额显示正确
   - 期望：候选生成正常，决策运行时无报错

8. **跑一笔超小额真单**（$0.05 量级）确认下单链路：
   ```bash
   ENV_FILE=.env.live-test pnpm --filter @autopoly/executor ops:trade -- --slug <some-liquid-market> --max-usd 0.05
   ```

9. **恢复定时 job**：上面 T-30 的反操作

10. **观察 24 小时**：盯 `runtime-artifacts/run-error/` 目录，看有没有新增的 v2 相关 error 归档

## 异常预案

### 切换后 SDK 报 401 / signature mismatch

- 原因：可能 API key 在 V2 域下无效，需要重新派生
- 修法：清空本地 cache（重启 executor 进程），SDK 会自动重新 deriveApiKey

### 切换后下单 4xx，提示 insufficient allowance

- 原因：pUSD allowance 没授权或不足
- 修法：去 polymarket.com UI 重新 approve，或调 `pUSD.approve(V2Exchange, max)`

### 切换后下单 4xx，提示 insufficient balance

- 原因：USDC.e 没 wrap 完，pUSD 余额不够
- 修法：UI wrap，或手动调 `CollateralOnramp.wrap()`

### Vercel 公开页显示余额 = 0

- 原因：可能 Vercel 还没拉到新 commit
- 修法：手动触发 redeploy，或确认 `POLYGON_PUSD_CONTRACT` 在 Vercel 环境变量里没被覆盖成 USDC.e 地址

### V1 仓位读不到了

- 不应该发生——CTF token 是链上资产，v2 切换不动它们
- 如果发生：先确认 ConditionalTokens 合约地址 `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` 没变，redeem.ts 调用方法没变；再去 polygonscan 看 owner 持仓

## 回滚预案

V2 上线后**没有**官方回滚路径——V1 SDK 直接停止工作。如果生产链路出问题：

- 短期：把所有 cron 暂停，进入"只看不下单"模式（`--recommend-only`），手工核对决策
- 中期：在 V2 SDK 上修 bug、补单测、再开实盘
- 不要：试图用 V1 SDK 反向兼容——切换之后 V1 的 host 都不再响应

## Cutover 后立即做的 P0 backlog

- [ ] **Builder Code 接入**：申请 https://polymarket.com/settings?tab=builder，配 `POLYMARKET_BUILDER_CODE` env，在 `polymarket-sdk.ts` 的 FOK/GTC 调用里带上 `builderCode` 字段
- [ ] **`Plan/2026-04-28-v2-cutover-runbook.en.md`**：英文版同步翻译
- [ ] **24 小时后**：把 `services/orchestrator/src/lib/fees.ts` 静态表删掉，全靠链上 `getClobMarketInfo`（如果切换时已改完则跳过）

## 联系人 / 信息源

- Polymarket 官方状态：https://status.polymarket.com
- Polymarket Discord 公告频道
- 迁移文档：https://docs.polymarket.com/v2-migration
- 合约地址：https://docs.polymarket.com/resources/contracts
