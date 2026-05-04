# Raven Managed — 设计元素清单

> 关联：[`2026-05-04-raven-managed-product-plan.md`](2026-05-04-raven-managed-product-plan.md)
> 状态：spec — 等用户对 §2 拍板后开干
> 来源：4 份并行 sub-agent 调研合并整理（visual asset audit / reference research / brand identity / component library）

## 0. 给你看的总结

**做什么**：把 Raven Managed Product 的设计任务摊开成一张清单——每个资产怎么来、AI 生图用什么 prompt、不用 AI 生图时用什么替代、按什么优先级执行。

**先看哪几节**：
- §1 → **设计思路（why before what）**——所有下游决策的根
- §2 → 5 个待你拍板的核心方向（color / logo / typography / iconography / tone）
- §4 → 你点名要的 AI 生图 prompt 集合
- §9 → 执行顺序

**关于 AI 生图我的总立场**：调研结论一致——**产品界面内不用 AI 生图**。Crypto-native 用户看一眼就划走（Midjourney 的奇怪反光 / 6 个手指 / 通用 SaaS 抽象图都是 trust-killer）。但 **off-product marketing**（X/Twitter 帖、blog 头图、广告素材、newsletter）可以用，本文档第 §4 节给你两类 prompt：on-product 极少几处（仅限抽象背景纹理）+ off-product（aspirational raven 视觉，能用得多一点）。

---

## 1. 设计思路（why before what）

> 4 条规则，每条配 ✅"长这样" / ❌"不长这样"对照。读完应该能在脑子里预演出页面长相，而不是去解读一段宣言。**对哪条规则有异议，下游所有决策同步重做。**

### 1.1 不做 gamification

适用：所有页面（landing / dashboard / onboard / track-record）。Raven 是真钱托管，且目标用户是 Polymarket 老玩家——他们见过 100 个 rug 项目，对 "Web3 革命 / 3D 角色 / 彩色烟花" 的容忍度是负的。任何让产品看起来像赌场或 launchpad 的元素都是**反信号**。

✅ **长这样**：暗背景 `#07090D` / 主字体 Inter + 数字 JetBrains Mono / 等宽数字对齐 / 紫色 accent 仅在 CTA 和 link / Lucide line icon `strokeWidth={1.75}` / 视觉参考 Hyperliquid + Bloomberg + Linear

❌ **不长这样**：橘红色 CTA / 霓虹紫光晕 / 3D 角色或吉祥物 / 动态粒子背景 / emoji 当 icon 用（除产品文档） / 大眼卡通 raven / Disney style / 抽奖动画 / "AI-Powered Web3 Revolution" 这种文案

### 1.2 默认展示真数据

适用：landing / track-record / OG 图 / 任何想说"我们可信"的位置。每个信任声明都必须能点开看到具体记录——tx hash、推理日志 markdown、真实曲线。装饰图（stock photo / illustration / AI 抽象渲染）一律不进产品页面，那些位置留给真数据可视化。

✅ **长这样**：track-record 页直接渲染 `equity-history.json` 真曲线 / 每仓位 row 带 tx hash 链接 / OG 图自动注入最新 NAV 数字（`@vercel/og` build-time）/ empty state 用 Lucide 64px icon + 一行灰文案 / section 分隔用 1px border + 渐变条 / "since 2026-03-15, 47 trades, 62% win rate" 这种具体数字

❌ **不长这样**：stock photo / stock illustration library / hero 用 AI 生成的抽象渐变 / empty state 配卡通插画 / 模糊形容词如 "battle-tested" "proven" "trusted" / mockup 假数据当 hero / 占位 chart 图片

### 1.3 Marketing 页和 app 内是两套规则

适用：marketing 表面（`/`、`/track-record`）vs 产品内（`/dashboard`、`/onboard`）。Linear 的玩法（大标题 + 真产品截图当 hero）适合营销，Hyperliquid 的玩法（暗背景 + 高密度数字 + 几乎无 chrome）适合产品内。强行一致只会两边都妥协——同一品牌色，**不同密度**。

✅ **长这样**：marketing body 16-18px / app body 13-15px / marketing topbar 透明 + 大 lockup logo / app topbar 实体 + 小 mark + 用户菜单 / marketing 可以 hero 大渐变 + display 48px / app 内最大标题 32px 且禁用大渐变 / marketing 留白宽松 / app 内表格密集

❌ **不长这样**：dashboard 顶上一片白屏 hero（Vercel 风） / landing 用 13px body 像 Bloomberg 终端 / 同一个 topbar 复用到两端 / app 内 section 之间留 80px 空白 / marketing 用 12px label 当正文

### 1.4 解释机制，不只说 benefit

适用：onboard 流程 / landing "How it works" 节 / 所有涉及"非托管"或"安全"的文案。技术受众里"非托管"四个字本身没意义——必须把 **Safe 边界 + session signer scope + Raven 摸不到什么** 三段链路讲清楚。同时和 Polymarket 自己的视觉做最低耦合（他们改 brand / 升级 SDK 不该带 Raven 一起重做）。

✅ **长这样**：onboard 嵌一张 mechanism 图（Safe 边界 / session 权限 scope / 资金路径只能流向 Polymarket 合约）/ 文案 "trade-only session key, revocable, no withdrawal access" / "How it works" 4 步做成 landing 二级 hero / Raven 用紫色（不抄 Polymarket 蓝）/ 引用 Polymarket 用 hyperlink + 文字（不嵌他们的 logo）

❌ **不长这样**："Safe and easy" "Set and forget" 这种纯 benefit / 把机制解释藏在 FAQ 折叠里 / 抄 Polymarket 蓝当主色 / Raven 视觉里嵌 Polymarket logo / 组件 token 写死某个 SDK 版本的假设 / "We use military-grade security" 这种空话

---

### 一句话总结

**真钱不做赌场感 + 真数据胜过装饰图 + 营销和 app 是两套密度 + 讲机制不讲 benefit**——4 条规则同时满足，下游所有决策自动锁定。

---

## 2. 5 个核心方向（拍板后下游全自动）

| # | 方向 | 推荐方案 | 理由 | 你确认 |
| --- | --- | --- | --- | --- |
| 1 | **品牌色** | Raven Violet `#8B5CF6` 替换现 `#5b8def` | 现 accent 通用 SaaS 蓝（Linear / Vercel / Stripe-clone 一样），Polymarket 也是蓝。Violet 不撞色 + 暗合 raven "观察 / 智能 / 神秘" 的隐喻。完整 palette 见 §3 | ☐ |
| 2 | **主字体** | Inter (display+body) + JetBrains Mono (numbers/addresses) | 两者 `next/font/google` 直出免审核；Inter 通用易读、JetBrains Mono 数字辨识度高（slashed zero 防 0/O 混淆，正好交易场景） | ☐ |
| 3 | **图标库** | Lucide @ `strokeWidth={1.75}` line style | 已经在 Privy 的依赖图里（免费拿）；统一 line 风格，禁止混用 filled / duotone | ☐ |
| 4 | **Logo 概念** | 几何乌鸦头剪影 + 单色喙朝右 + 小圆眼，monospace 小写 wordmark `raven` | 备选：① "R-as-feather" 字母版；② "eye + horizon" 抽象版。本概念识别度 + 制作成本最优 | ☐ |
| 5 | **Tone of voice** | 8 条规则，详见 §6 | 关键：第二人称、不糖衣、避免炒作词（"seamless / revolutionary / supercharged" 全禁） | ☐ |

**任意一项你想换思路：直接告诉我"#X 我想要 Y"，我重新给方案。**

---

## 3. 完整品牌 token（建议落进 globals.css）

### 3.1 Color palette

```css
/* Background layers (原有，保留) */
--bg            #07090D;
--bg-soft       #0D1117;
--panel         #11161D;
--panel-soft    #161C25;
--panel-raised  #1B2330;   /* NEW — 模态框 / 下拉 */

/* Border layers */
--border        #1F2733;
--border-soft   #2A3340;
--border-strong #3A4555;   /* NEW — focus 输入 / 选中行 */

/* Text layers (保留) */
--text          #E8EDF2;
--text-soft     #A0ADBA;
--text-dim      #6B7785;

/* Accent — 切到 Raven Violet */
--accent        #8B5CF6;   /* CHANGED from #5b8def */
--accent-hover  #7C4DEE;   /* CHANGED from #4a7be0 */
--accent-soft   rgba(139, 92, 246, 0.15);
--accent-glow   rgba(139, 92, 246, 0.35);

/* Semantic states (rename for trading clarity) */
--pos           #4ADE80;   /* renamed from --good */
--pos-soft      rgba(74, 222, 128, 0.12);
--neg           #EF6262;   /* renamed from --bad，slightly desat from #f87171 */
--neg-soft      rgba(239, 98, 98, 0.12);
--warn          #FBBF24;   /* 保留 */
--warn-soft     rgba(251, 191, 36, 0.12);
--info          #60A5FA;   /* NEW — 区分纯信息（蓝）与品牌（紫）*/
--info-soft     rgba(96, 165, 250, 0.12);

/* Brand-only gradient — hero / login splash / OG image */
--brand-gradient: linear-gradient(135deg, #8B5CF6 0%, #C084FC 100%);
```

### 3.2 Type scale

| Token | Size / Line | Weight | Tracking | 用 |
| --- | --- | --- | --- | --- |
| `--font-display` | 48 / 52 px | 700 | -0.02em | Hero h1 |
| `--font-h1` | 32 / 40 px | 700 | -0.015em | 页标题 |
| `--font-h2` | 24 / 32 px | 600 | -0.01em | section h2（从 28 降到 24，避免和 h1 太近） |
| `--font-h3` | 18 / 26 px | 600 | -0.005em | 卡片标题（从 17 升到 18） |
| `--font-body` | 15 / 24 px | 400 | 0 | 默认正文 |
| `--font-body-sm` | 13 / 20 px | 400 | 0 | 免责声明、表格 |
| `--font-label` | 12 / 16 px | 500 | 0.04em uppercase | 表单 label / badge |
| `--font-mono` | 13 / 20 px | 400 | 0 | 地址 / 余额 / txid |
| `--font-mono-lg` | 24 / 32 px | 500 | -0.01em | dashboard 大数字 |

数字处全程 `font-feature-settings: 'tnum' 1, 'cv11' 1;`（tabular figures，对齐用）。

---

## 4. AI 生图 prompt（你点名要的）

### 4.1 On-product （产品页面内，仅 2 处可用）

#### 4.1.1 Landing hero 抽象背景纹理（可选，CSS 优先）

**首选方法：CSS radial-gradient + SVG 噪点叠加**——零成本、矢量、可主题化。AI 生图作为兜底。

**如果坚持 AI 生图**，目标尺寸 1920×1080（hero 全屏背景）：

```
Prompt:
abstract dark digital background, deep navy black #07090D base,
violet glow concentrated in the upper center, fading to pure black at
the corners, very subtle hexagonal grid overlay at 5% opacity, faint
data-curve lines crossing the lower third like a stock chart at 8%
opacity, no text, no characters, no objects, ultra minimalist,
fortune-500 trading terminal aesthetic, 4K, photorealistic gradient

Negative prompt:
text, letters, numbers, characters, people, hands, faces, logos,
3d renders, fantasy art, neon cyberpunk, glitch effects, particle
explosion, lens flare, depth of field blur, vignette

Recommended tool: Midjourney v7 with --ar 16:9 --stylize 50
Or Flux dev with guidance 3.5, 50 steps
```

#### 4.1.2 OG image background底纹（1200×630）

**首选**：纯代码 `@vercel/og` 生成（logo + 大数字 + 渐变条）。

**如果想要 AI 底纹**：

```
Prompt:
ultra-minimal abstract horizontal banner, deep black #07090D, single
violet glow #8B5CF6 emerging from center-left and fading right,
extremely subtle line-art equity-curve sketch at 6% opacity rising
from bottom-left to top-right, no foreground objects, financial
broadsheet aesthetic, sober, premium

Negative prompt:
(same as 3.1.1)

Aspect: 1200x630 (Midjourney --ar 40:21)
```

### 4.2 Off-product （X/Twitter / blog / ads — 这块可以放开）

#### 4.2.1 Aspirational raven imagery for X/Twitter posts

```
Prompt:
single jet-black raven perched on a thin horizontal data-line glowing
violet, set against a near-black background with deep violet ambient
light, photorealistic feathers, sharp eye highlight catching violet
light, dramatic but minimal, bloomberg-terminal-meets-nature, 4K
photo realism, side profile, looking right, centered composition,
clean negative space

Negative prompt:
multiple birds, cartoon, anime, low-poly, fantasy, magical effects,
text, watermark, logo, fairytale, cute, friendly mascot, big eyes,
disney style

Tool: Midjourney v7 --ar 16:9 --stylize 200
Variants to generate: 4 — flying / perched / looking forward / looking down
```

**用途**：feature announcement 推、ProductHunt 发布封面、blog 头图、newsletter banner。

#### 4.2.2 "Set-and-forget" lifestyle frame（用户视角）

```
Prompt:
overhead shot of a desk in early morning low light, single laptop
screen showing a sober dark dashboard with a violet equity curve
line trending upward, coffee cup off to one side, clean wood desk,
no person visible, no text on screen readable (just abstract chart
shapes), warm window light from upper left, depth, premium magazine
photography, 35mm

Negative prompt:
people, hands, faces, text, readable UI, multiple monitors,
crypto-bro chaos, neon, party, RGB lighting, gaming setup

Tool: Midjourney v7 --ar 16:9 --stylize 100
```

**用途**：landing 第二屏 narrative、blog 文章头图、 sales deck。

#### 4.2.3 数据可视化抽象（可作 case study 配图）

```
Prompt:
abstract violet candlestick chart silhouette receding into deep
black space, faint depth-of-book columns visible in background,
single bright fill-marker dot mid-frame, clinical financial
infographic aesthetic, no axes labels, no readable numbers, just
shapes and gradient

Negative prompt:
photo realism, people, cartoon, gradients of multiple colors,
rainbow, neon

Tool: Flux dev or Midjourney --ar 16:9
```

**用途**：track-record 页二级 banner、X 长帖配图。

### 4.3 不能用 AI 生图的清单（明确告诉你别试）

| 资产 | 为什么不能 | 用什么替代 |
| --- | --- | --- |
| Logo / brand mark | AI 生 logo 几乎都长得像 Web3 launchpad rug 项目 | 我直接写 SVG（§5.1） |
| Favicon | 16×16 太小，AI 出来全是噪点 | SVG → PNG 导出 |
| UI icon（钱包 / 余额 / AI 等） | 风格不统一、line weight 不一致 | Lucide icon set |
| 空状态插画 | 容易出现 6 个手指 / 错位 / 怪异透视 | Lucide icon @ 64px + 灰文案 |
| 数据可视化（真图表） | AI 不会生有意义的真数据 | Recharts / visx + 真数据 |
| 角色 / 吉祥物 | 信任度立刻崩塌 | 不要做吉祥物 |
| OG 图主体（logo + 数字） | 文字 / 数字 AI 经常拼错 | `@vercel/og` |

---

## 5. 自生成 SVG 清单（我能直接写代码出文件）

### 5.1 Logo system（P0）

我手写 SVG 给你看 6 个文件：

| 文件 | 用 |
| --- | --- |
| `public/brand/raven-mark.svg` | 仅图形（乌鸦头剪影） |
| `public/brand/raven-wordmark.svg` | 仅文字 `raven` |
| `public/brand/raven-lockup-h.svg` | 横排 lockup（topbar 用） |
| `public/brand/raven-lockup-v.svg` | 竖排 lockup（hero / OG 用） |
| `public/brand/raven-mono-white.svg` | 全白单色版（深色背景上） |
| `public/brand/raven-favicon.svg` | 单字 R + 圆角方形（fallback for tiny sizes） |

并衍生：
- `public/brand/favicon-32.png`、`favicon-180.png`（apple-touch-icon）
- `app/icon.tsx`（Next 16 自动生成 favicon route）

**等你 §2 拍板 logo 概念后我就生**。

### 5.2 Brand 背景元素（P1）

| 资产 | 方法 | 文件 |
| --- | --- | --- |
| Hero radial-glow 背景 | 纯 CSS `radial-gradient` | `app/globals.css` 内联 |
| 底层 grid 噪点纹理 | inline SVG `<pattern>` | `components/ui/grid-bg.tsx` |
| Section 分隔渐变条 | CSS gradient | `app/globals.css` |
| 真实 equity-curve 装饰 | 读 `equity-history.json` 生 SVG path | `components/decorative/equity-trace.tsx` |

### 5.3 OG 图（P0）

`apps/raven-managed/app/opengraph-image.tsx`：
- `@vercel/og` 静态生成
- 1200×630
- 左侧：vertical lockup（mark + wordmark）
- 右下：当前 track record 数字（从 equity-history.json 自动取最新 NAV / 累计收益率）
- 顶端 4px 高度的 brand gradient bar

每次构建自动重新生成，社交卡片永远显示最新数字。

---

## 6. Tone of voice（写文案时的 8 条铁律）

1. **具体数字，不要形容词**："15% per-position cap" beats "strict risk controls"
2. **永远不糖衣化风险**：不写"battle-tested"，写"running real-money trades since [date]"
3. **第二人称、现在时**："Your funds stay in your wallet" — 不写 "Users keep their funds safe"
4. **禁用炒作词**：seamless / revolutionary / cutting-edge / supercharged / unleash / leverage / journey / ecosystem / next-gen 全禁
5. **解释机制，不只说 benefit**："Privy provisions a non-custodial wallet" 好；"Sign in easily" 烂
6. **数字一定带单位、$ 一定要写**：`$5 minimum` 不写 `5 USD`
7. **Active voice 写 Raven 做的事，passive voice 写 Raven 不能做的事**："Raven trades on your behalf" / "Funds cannot be withdrawn by Raven"
8. **句首小写（除句子）**：所有按钮 / label / 标题用 sentence case，不用 Title Case

### 已识别需重写的现存文案（landing page）

| 位置 | 当前 | 改成 |
| --- | --- | --- |
| Hero subtitle | "Deposit USDC, set a strategy..." | "Deposit USDC into a Polymarket Safe you control. Raven's AI scans every market daily and trades through a session key — trade-only, revocable, no withdrawal access." |
| Feature "Battle-tested" | "...running real-money trades for months" | "...trading real money on Polymarket since [DATE]. Every position, fill, and reasoning report is in the public track record" |
| Feature "Just builder fees" | "...paid by Polymarket, not deducted from your balance" | "Raven earns a share of Polymarket's builder rewards on each trade — that's paid by Polymarket out of trading volume, never deducted from your balance." (现在文案其实接近正确，只需小修) |

---

## 7. 组件库提取（按 Tier）

### 7.1 Tier 1（立刻提取，已经在多处复用）

新建 `apps/raven-managed/components/ui/`，内容：

| 组件 | 当前散落位置 | 现有 CSS 类 | 备注 |
| --- | --- | --- | --- |
| `<Button>` | page.tsx / signup / onboard / dashboard / top-bar | `.btn .btn-primary .btn-ghost` | variants: primary / secondary / ghost / disabled / loading |
| `<Panel>` | onboard / dashboard / signup / track-record | `.panel` | generic 容器 |
| `<DataRow>` | onboard / dashboard | `.row .row-label .row-value` | 标签 + 值 |
| `<Badge>` | onboard / dashboard | `.badge .badge-pending .badge-active` | variants: pending / active / disabled |
| `<Hero>` / `<HeroCta>` | page / track-record | `.hero .hero-cta` | landing/marketing 用 |
| `<FeatureCard>` | page (×6) | `.feature-card` | 含 icon + title + body |
| `<StepCard>` | page (×4) | `.step` (含 CSS counter) | 自动编号 |
| `<AlertPanel>` | page / onboard / dashboard | `.disclaimer` | warning / info variants |
| `<Section>` | page | `.section` | 通用 section 容器 |

### 7.2 Tier 2（Phase 2 用得到时再提取）

| 组件 | 何时需要 |
| --- | --- |
| `<Modal>` / `<Dialog>` | session signer 授权 flow |
| `<FormField>` / `<TextInput>` | 配置 / 设置 |
| `<StatCard>` | balance + 实时 P&L 大数字 |
| `<PositionTable>` | 仓位列表（参考 `apps/web/components/dashboard-positions.tsx`） |
| `<EmptyState>` | 无仓位 / 无交易 |
| `<Skeleton>` | 加载占位 |

### 7.3 Tier 3（Phase 3 / 锦上添花）

`<Toast>` / `<Tooltip>` / `<Dropdown>` / `<Tabs>` / `<Switch>` / `<Drawer>` — 不在关键路径上，按需加。

### 7.4 实现约定

- **不引入 Tailwind**（和现有 globals.css 冲突），不引入 CSS-in-JS
- **不用默认导出**（命名导出方便 tree-shake）
- 增加 `lib/cn.ts`：`(...classes) => classes.filter(Boolean).join(" ")`
- variants 用简单 if-else + cn，**不引入 CVA / tailwind-variants**（5 variants 内 over-engineering）
- 现有 globals.css class 留作 base style，组件 className 透传

---

## 8. 关键决策："像谁不像谁"

来自 reference research，5 个标杆站对比后的定位：

| 维度 | 像谁 | 不像谁 |
| --- | --- | --- |
| 营销页（landing / track-record） | **Linear**：大字体声明 + 真实产品 UI 截图当 hero | 不像 Polymarket（无营销叙事用户也不懂） |
| 产品内（dashboard / onboard） | **Hyperliquid**：暗背景 + 等宽数字 + 极简 chrome | 不像 Vercel（hero 一片白对资管不可信） |
| 视觉 signature | **实时跳动的 violet equity 曲线**（已有 `equity-history.json` 数据） | 不像 Privy 的逗号停顿 typography（用户在 Privy 弹窗里见到 Raven，撞品牌） |
| 字体 | Inter + JetBrains Mono | 不用 Geist（撞 Vercel）、不用 Space Grotesk（太玩具感） |
| 颜色 | Raven Violet `#8B5CF6` | 不用 Hyperliquid mint、不用 Polymarket 蓝、不用 Vercel hot pink |

---

## 9. 执行优先级

### 9.1 这周（约 4-6h，等 §2 拍板就开干）

1. ✅ Color migration：`globals.css` 全套换成 §3.1 的 token
2. ✅ Typography：`app/layout.tsx` 加 `next/font/google` 装载 Inter + JetBrains Mono
3. ✅ Logo SVG：6 文件 + favicon + `app/icon.tsx`
4. ✅ Lucide icons：直接 npm install + 替换 landing page 6 个 emoji
5. ✅ OG image：`app/opengraph-image.tsx` + `@vercel/og`
6. ✅ Tone-of-voice 文案 3 处改写（§6 表格）

### 9.2 Phase 2 期间（功能开发并行做）

7. 组件库 Tier 1 提取（`components/ui/`）
8. 加载 skeleton + 错误状态卡片
9. CSS hero 背景（不用 AI 图）

### 9.3 Phase 3 之后再考虑

10. 1 张 X/Twitter aspirational raven 主图（用 §4.2 prompt）
11. 路由切换微动画
12. 真实 equity-curve 装饰（读真数据画 SVG）

### 9.4 不在路线图上（不做）

- AI 生图作为产品页面内主视觉
- 角色 / 吉祥物
- 3D 渲染元素
- Lottie 复杂动画
- Storybook（用户量上来再加）

---

## 10. 你需要提供的资源

| 资源 | 是否必须 | 备注 |
| --- | --- | --- |
| §2 五个核心方向的拍板 | ✅ 必须 | 五个之中任意一个换思路都会全文件链式重做 |
| Midjourney / Flux / DALL-E 订阅 | ⚠️ 仅当采用 §4 prompt | 我建议先做 §9.1-9.2 的代码部分，AI 图等真要做 marketing 时再说 |
| 现有 `assets/predict-raven.png` 1254×1254 banner | ✅ 已有 | 可作为 fallback 直到新 logo 出 |
| 用户的英文 vs 中文优先级 | ⚠️ 建议确认 | 现 landing 全英文，要不要双语？双语影响 hero copy 长度 |
| Brand 名字最终拼写 | ✅ 已有 | "Raven" / "raven" / "predict-raven" — 我推荐 wordmark 用小写 `raven`，正式表述用 "Raven" |

---

**下一步**：你回 §1 设计思路 4 条规则有没有异议 + §2 五个核心方向（或告诉我"全按你推荐的来"），我立刻开始 §9.1 的执行——先做 color + logo SVG + favicon + OG image 四件事，1 个 commit 落地，你 review 完再继续。
