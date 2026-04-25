# Vercel Web 部署运行手册

英文版见 [vercel-web-deploy-runbook.en.md](vercel-web-deploy-runbook.en.md)。

最后更新：2026-03-24

## 1. 这份文档解决什么问题

这份手册只覆盖 `apps/web` 在 Vercel 上的公开部署，不覆盖 Hostinger 上的后台栈。

它重点解决三件事：

- 怎么把 web 发布到 Vercel
- 围观模式依赖哪些环境变量
- 为什么“本地是对的，线上看起来却不是那一版”

## 2. 适用场景

- 你要把围观站或公开页面发到 Vercel
- 你要核对某次 `preview` / `production` 部署到底是不是预期版本
- 你发现线上页面和本地预览不一致

后台部署请看 [hostinger-vps-deploy-runbook.md](hostinger-vps-deploy-runbook.md)。

## 3. 围观模式的关键环境变量

如果首页要进入“围观真实钱包”的分支，至少要有下面两个变量中的一个；当前仓库为了兼容服务端和前端读取，建议两个都配：

```bash
POLYMARKET_PUBLIC_WALLET_ADDRESS=0x...
NEXT_PUBLIC_POLYMARKET_PUBLIC_WALLET_ADDRESS=0x...
```

当前代码读取入口在：

- [apps/web/lib/public-wallet.ts](../apps/web/lib/public-wallet.ts)

逻辑很直接：

- 变量存在且是合法地址：进入 spectator mode
- 变量缺失或格式不合法：回退到普通首页分支

## 4. 标准部署流程

### 本地检查

```bash
pnpm --filter @autopoly/web typecheck
pnpm --filter @autopoly/web build
```

### 发 preview

```bash
vercel deploy --yes -A vercel.json
```

### 发 production

```bash
vercel deploy --prod --yes -A vercel.json
```

## 5. 部署后必须做的验收

不能只看 CLI 返回的 URL，就宣布“部署好了”。  
这个仓库的 web 有明显的环境分支和布局分支，必须做真实页面验收。

每次公开部署后，至少执行这 4 步：

1. 打开部署后的真实 URL，而不是只看本地预览
2. 截图保存当前线上页面
3. 把线上截图和目标版本截图/本地预览做肉眼对比
4. 再核对一次公开 API 是否真在返回目标钱包的数据

推荐最小验收命令：

```bash
curl -I https://autopoly-pizza-spectator.vercel.app
curl https://autopoly-pizza-spectator.vercel.app/api/public/overview
```

如果需要浏览器级验收，直接用 Playwright 打开线上站并截图。

## 6. 2026-03-24 这次真实踩到的两个坑

### 坑 1：preview 没配钱包地址，结果线上回退成旧首页

现象：

- 本地已经是新的 `balancer-flow`
- Vercel `preview` 却还是旧首页

真实原因：

- `preview` 环境里没有 `POLYMARKET_PUBLIC_WALLET_ADDRESS`
- `preview` 环境里也没有 `NEXT_PUBLIC_POLYMARKET_PUBLIC_WALLET_ADDRESS`
- 所以 [public-wallet.ts](../apps/web/lib/public-wallet.ts) 判断 `spectatorMode=false`
- 首页自然走了旧的非围观分支

排查命令：

```bash
vercel env list preview
vercel env list production
```

处理原则：

- 不要假设 `production` 环境变量会自动覆盖 `preview`
- 在当前 CLI 行为下，`preview` 变量可能还会受分支范围影响
- 如果某次预览必须展示真实围观页，先核对目标 `preview` 是否真的有这两个变量

### 坑 2：首页已经切成新版本，但 layout 还包着旧 Shell

现象：

- 线上页面不是完全旧版
- 也不是干净的新版本
- 看起来像“旧 hero + 新 balancer 页面”被叠在一起

真实原因：

- [apps/web/app/page.tsx](../apps/web/app/page.tsx) 已经在 spectator mode 下返回了新首页
- 但 [apps/web/app/layout.tsx](../apps/web/app/layout.tsx) 仍然把页面包在旧的 `Shell` 外层
- 结果就是旧框架和新首页同时出现

处理原则：

- 如果首页是完整风格页或整页预览，不要再用 legacy shell 二次包裹
- 特别是 spectator mode 下，布局层必须和首页返回内容一起检查

## 7. 推荐的排查顺序

如果你看到“本地对，线上不对”，按这个顺序查：

1. 看部署 URL 对不对，是 `preview` 还是 `production`
2. 看目标环境有没有 spectator mode 需要的钱包变量
3. 看首页是否走了正确分支
4. 看 layout 有没有把新首页又套上一层旧壳
5. 用真实浏览器打开线上页面截图，不要只看 HTML 或接口

## 8. 对这个仓库的硬性约束

对 `apps/web` 的 Vercel 发布，默认应遵守：

- 发完后必须真实打开线上页面截图验收
- 没做截图比对前，不能说“部署已经匹配本地版本”
- 围观模式必须优先核对钱包地址变量
- 如果首页是完整定制风格，layout 不能继续叠 legacy shell

## 9. 当前相关文件

- [apps/web/app/page.tsx](../apps/web/app/page.tsx)
- [apps/web/app/layout.tsx](../apps/web/app/layout.tsx)
- [apps/web/lib/public-wallet.ts](../apps/web/lib/public-wallet.ts)
- [apps/web/components/preview-balancer-variants.tsx](../apps/web/components/preview-balancer-variants.tsx)
- [vercel.json](../vercel.json)

