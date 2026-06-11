# @autopoly/sports-data

Polymarket 世界杯市场缓存 + WebSocket 实时订阅基建。

## 能力
- **抓取并缓存全部世界杯市场**(finals tag `102232` + pre-WC friendlies tag `102539`),归一化每个市场:`event_slug` / `market_slug` / `conditionId` / `questionID` / `clobTokenIds`(WS 订阅用的 asset_ids)/ outcomes / prices / category / subtype / 状态 / 流动性 等。
- **分类**到参考表的 6 大类(match / group_ko / champion / award / player / special)+ 细分 subtype。
- **WS 客户端**:连 `wss://ws-subscriptions-clob.polymarket.com/ws/market`,按 asset_ids 分批订阅,自动 ping + 断线重连(原生 `WebSocket`,Node ≥22,无新依赖)。
- **增量检查**:重新抓取并和缓存做 diff(新增 / 消失 / 状态变化 / 价格移动)。

## 缓存产物(gitignored)
`runtime-artifacts/world-cup/polymarket/`
- `snapshot.json` — 全量归一化市场 + 计数(按 category/subtype)。
- `index.json` — 快查索引:`byEventSlug` / `byConditionId` / `byMarketSlug` / **`byTokenId`**(asset_id → {marketId, outcome, ...})。
- `meta.json` — generated_at + counts + 来源。
- `updates-log.jsonl` — 每次 `--apply` 的 diff 摘要追加。

## 命令
```bash
# 1) 全量抓取并缓存(~30-60s,~4.6k 活跃市场 / ~9.3k asset_ids)
pnpm tsx scripts/world-cup/cache-markets.ts

# 2) 每次访问检查有没有更新(report-only;加 --apply 写回缓存 + 记 log)
pnpm tsx scripts/world-cup/check-updates.ts
pnpm tsx scripts/world-cup/check-updates.ts --apply

# 3) 连 WS 看实时盘口(证明链路;--slug 限定某 event,--limit/--seconds 可调)
pnpm tsx scripts/world-cup/ws-listen.ts --limit 200 --seconds 30
pnpm tsx scripts/world-cup/ws-listen.ts --slug world-cup-winner
```

## 程序化用法
```ts
import {
  fetchAllWorldCupMarkets, buildSnapshot, buildIndex, allTokenIds,
  diffSnapshots, PolymarketMarketWs
} from "@autopoly/sports-data";

const markets = await fetchAllWorldCupMarkets();        // 全量
const snap = buildSnapshot(markets, [102232, 102539], new Date().toISOString());
const idx = buildIndex(snap, snap.generatedAt);

const ws = new PolymarketMarketWs({
  assetIds: allTokenIds(snap),
  onEvent: (e) => { /* e.event_type: book | price_change | last_trade_price; e.asset_id */ },
  onStatus: console.log
});
ws.start();   // 自动分批 + 重连
// ws.stop();
```

## 已验证(2026-06-09 实跑)
- 抓取:**4,654 活跃市场 / 9,308 asset_ids**(match 3098 / group_ko 810 / award 406 / champion 55 / special 285)。
- WS:订阅 120 assets,22s 收到 **928 个实时事件**,asset_id 正确映射回 market+outcome。
- diff:重抓后报 `unchanged=4654`(diff 路径正确)。

## 已知范围
- 默认只抓 active(Gamma `tag_id` 默认口径)。要含已结算/closed(参考表 5141 含部分 closed),给 fetcher 加 `closed=true` 第二趟即可(WS 只对 active 有意义)。
- `special/other` 约 285 条为关键词未命中,`categorize.ts` 可继续细化。
