# 上线页面样式样本：dashboard-sample

> 最后更新：2026-08-24
> 英文版见 [`dashboard-style-reference.en.md`](dashboard-style-reference.en.md)

**样本仓库：https://github.com/Alchemist-X/dashboard-sample**（MIT，自家代码，可随意搬）

一个"模型用量实时面板"风格的深色 metrics 页设计习作（对 poolside.ai/pulse 版式的复刻研究，内容全部为虚构 mock 数据）。零依赖零构建：纯 HTML + CSS + vanilla JS，图表是手写 SVG 字符串生成。**本仓库以后给对外上线的服务/产品做公开数据页时，优先考虑套用这套视觉语言**——效果专业、实现轻、没有图表库依赖。

## 适合用在哪

- **paper-fleet 公开面板**：Huginn 上 5 个模拟账本（fable / opus / sonnet / kimi-k3 / ds-flash）的余额曲线对比 + 排行——样本里的"堆叠柱状图 + 排行榜（名次升降箭头 + 自家条目高亮）"几乎原样可用
- **/world-cup/performance 视觉升级**：Brier / Mock PNL 的统计块（stat tiles）与带事件标注的时间序列
- **delta / delta-pm 对外只读视图**：新闻→影响引擎的吞吐/命中指标页
- 未来任何"since launch"性质的公开指标页（token 量、调用量、下载量、准确率跟踪）

## 这套风格的构成（可直接抄的部分）

| 要素 | 取值 / 模式 |
| --- | --- |
| 底色 / 文字 | `#1a1a1a` 底；正文白，次级 `#d6d5cf` → `#878580` 三档灰 |
| 强调色 | 冰蓝 `#ace2ef`（品牌/高亮）+ 绿 `#9bd85b`（链接/上涨）+ 橙红 `#ff7a59`（下跌） |
| 图表系列色 | 冰蓝 / 青 `#18a9b6` / 黄 `#fed354` / 紫 `#bb56ff` / 绿 `#67ae00` / 橙 `#ff8040` |
| 字体 | 正文 grotesque（Inter）；**所有数据标签/坐标轴/脚注编号用 JetBrains Mono** |
| 大标题 | 白色粗句首 + 灰色弱化后半句（`32px/500`），例："**11.6 trillion** tokens … <span style="color:#878580">since our first launch.</span>" |
| 图表标题 | 图下方、全大写等宽小字 + `*` 星号，脚注段落解释口径（数据口径透明是这个风格的核心气质） |
| 统计块 | 4 列 grid，顶部 1px 分隔线，大数字 + 两行灰色标签 |
| 图表模式 | 100% 堆叠面积图（份额）、每日堆叠柱（含发布事件虚线标注、今日柱"斜线阴影投影尖端"按当日已过时间外推）、排行榜列表 |
| 交互 | 顶部 radio 胶囊筛选器联动全部图表与数字；hover 竖线 + tooltip；滚动淡入（尊重 `prefers-reduced-motion`） |

## 搬运方式

- 设计 token：`css/style.css` 顶部 `:root` 变量块整段可抄
- 图表：`js/charts.js` 是无依赖的 SVG 字符串生成器（堆叠面积 / 堆叠柱 / 网格 / 事件标注 / hatch pattern / tooltip），Next.js 里可直接把生成的 markup 塞进 `dangerouslySetInnerHTML`，或照它的坐标逻辑改写成 JSX；静态页直接整文件搬
- mock 数据层 `js/data.js` 展示了"种子 PRNG + 时间轴锚定今天"的手法，做 demo/占位页时好用
- ⚠️ 样本里的品牌（meridian / Lumen / GatewayHub）与全部数字是虚构的，搬运时只取样式与组件，不要把假品牌词带进产品文案
- ⚠️ 接入 predict-raven 的 `apps/web` 时照常执行 CLAUDE.md 前端三件套（i18n 三语 / 移动端适配 / 本地 build + 截图自评）
