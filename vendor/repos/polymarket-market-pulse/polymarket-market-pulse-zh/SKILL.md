---
name: polymarket-market-pulse-zh
description: "发现 Polymarket 上有利可图的预测市场。通过 AI 概率估算与市场隐含赔率的对比，识别定价偏差最大的前 3 个市场，从信息流、结算清晰度、流动性和波动性四个维度进行分析，并给出仓位建议。当用户提到 Polymarket 机会、预测市场推荐、每日市场脉搏、市场分析、找到错误定价的市场时使用此技能。"
---

# Polymarket 每日市场推荐

扫描 Polymarket 上的错误定价预测市场。通过网络搜索估算真实概率，对比市场赔率，推荐前 3 个最具盈利潜力的机会，并提供仓位建议。

## 工作流程

以下 7 个步骤是推荐的推理脚手架，不是硬性配方：你可以按事件特性调整各步的深度与顺序，文中出现的量化参数（证据更新幅度、edge 分档、排序公式）都是默认值——若你有更好的判断，可以偏离，但必须在报告中写明偏离理由。

两类要求不属于可调整范围：
- **认知红线**（任何最终推荐都不可省略）：第 3 步的结算规则获取、A0 resolution source 实时查验、A1.5 事实溯源。
- **程序接口与风控**：报告的可解析字段格式、流动性硬性门槛。仓位最终以代码层按概率重算的结果为准，报告中的仓位数字是人工审计字段。

你的概率估算是唯一进入交易管道的数字，把主要精力花在“把概率做准”上。

### 第 1 步：获取市场数据

运行市场数据获取脚本，从 Polymarket Gamma API 拉取活跃市场：

```bash
python scripts/fetch_markets.py --pages 5 --min-liquidity 5000
```

脚本通过 `/events` 端点获取数据（每个事件包含嵌套市场），按交易量、流动性、上线时间和竞争度四个维度各分页 5 页（每页 50 个事件），扫描约 1,000 个事件。自动合并去重、展开为独立市场。

如需深度扫描（如每周全面复盘），使用 `--pages 20` 覆盖最多 4,000 个事件。

如果脚本执行失败（网络错误、API 变更），改用手动 API 调用。端点详情见 [references/polymarket-api.md](references/polymarket-api.md)。

### 第 2 步：初筛候选市场

从获取的市场中，用以下条件筛选至 10-15 个候选。

注意：脚本已自动过滤以下垃圾市场，无需手动处理：
- 加密涨跌赌盘（标题含 "Up or Down" 或时间段格式）
- 24 小时内到期的市场
- Coin flip 市场（所有 outcome 价格在 0.48-0.52 范围）

**排除：**
- 最大 outcome price > 0.95 或最小 < 0.05 的市场（已近定论，无 edge 空间）
- 流动性 < $5,000 的市场（太薄无法交易）
- 问题模糊或无法通过网络搜索研究的市场

**优先选择：**
- 7 天内新建的市场 — 定价效率较低
- 24 小时交易量高的市场 — 说明有活跃的信息流和关注度
- 能通过网络搜索获取强证据的主题

**Longshot Bias 提醒（先验，不是配额）：**
统计规律表明，Yes 价格 < 20% 的市场，Yes 侧常被系统性高估，No 侧是最常见的系统性 edge 来源。
筛选候选时把这一先验纳入考虑（Yes < 20% 且流动性 > $50k 的市场值得专门看一眼 No 侧），
但是否入选、选几个由证据决定——不要为满足数量而凑。

**多结果市场（Top-N 偏差扫描）：**
部分市场有 2 个以上结果（如选举、锦标赛冠军）。**不要跳过这些市场。** 多结果市场往往流动性最深、参与者最多，
但因为 outcome 数量多，个别 outcome 的定价效率反而更低。

处理方式：
1. 对每个多结果市场，计算所有 outcome 的隐含概率之和（应接近 100%）。如果总和显著 > 100%，
   说明存在系统性溢价（vig），No 侧更有优势。
2. 提取定价偏差最大的 2-3 个 outcome 作为候选，其余跳过。
   偏差判定：与快速 Web 搜索得到的粗略基准概率对比，偏差最大的即为候选。
3. 每个被选中的 outcome 按照单独的二元市场处理——买入该 outcome 的 Yes 或 No。
4. 流动性分析使用对应 outcome 代币的订单簿（取自 `clob_token_ids`）。
5. 在报告元数据中注明：扫描了 N 个多结果市场，从中提取了 M 个 outcome 候选。

### 第 3 步：信息搜集与概率估算

对每个候选市场（约 10 个），进行网络调研并形成独立的概率估算。这是最关键的步骤。

**结算规则获取（必须在概率估算之前执行）：**

对每个通过初筛的候选市场（~10 个），必须获取完整结算规则和 annotations。

**优先方式 — scrape 脚本（推荐）：**

```bash
cd ~/.claude/skills/api-trade-polymarket/scripts && npx tsx scrape-market.ts --slug <event_slug> --sections context,rules
```

脚本通过 HTTP 获取页面 SSR HTML 中的 `__NEXT_DATA__`，返回 JSON 包含：
- `rules.description` — 完整结算规则（比 API description 更完整，不截断）
- `rules.resolution_source` — 官方数据源
- `market_context.annotations[]` — 市场注释（含 summary、date、hidden 状态）
- `market_data` — volume、liquidity、各 outcome 的 bid/ask

纯 HTTP 方案，无浏览器依赖，速度快。

**回退方式 — WebFetch：**

如果 scrape 脚本返回数据不足（如 `rules.description` 为空），回退使用 WebFetch 访问 `https://polymarket.com/event/{event_slug}` 提取规则。

从返回数据中提取：
1. 基本结算条件（`rules.description`）
2. Annotations 中的规则澄清和上下文信息（`market_context.annotations`）
3. 具体的定量门槛（如"80% 下降"、"连续 3 天"等）
4. 官方数据源（如 IMF PortWatch、Binance、CME 等）
5. 边界情况处理

将提取到的完整规则存储，在后续概率估算中直接引用。

**注意：** 页面 "Market Context" 标签的可见内容由客户端 JS 渲染，scrape 脚本返回的是 `__NEXT_DATA__` 中的原始 annotations 数据（可能标记为 `hidden: true`）。Playwright 方案因 macOS 沙盒限制不可用。

**为什么这一步是强制的：** 市场页面上的 "Additional context" 经常包含创建后追加的定量门槛和数据源定义，
这些信息直接决定结算结果。仅靠 API description（截断 500 字符）做判断会导致严重误估。

**Resolution Source 实时查验（A0 模块 — 必须在 A1 之前执行）：**

如果 resolution rule 指定了具体的数据源（CDC case counter、FIDE 官网、AP/Fox/NBC、FIFA 官方、选举委员会等），**必须直接访问该数据源获取当前状态**，而不是依赖 AI 记忆或推测。

- 对每个候选市场，从 `rules.resolution_source` 中提取官方数据源 URL
- 访问该 URL（或搜索最新数据），获取当前真实状态
- 如果能查到具体数据，将其作为概率估算的硬约束输入；如果数据源不可访问或无明确当前状态，标注"resolution source 当前状态未确认"并在证据链中降低相关主张的权重
- 在报告中列出：数据源名称 + URL + 查询时间 + 查到的关键数据

示例：
- 麻疹市场：访问 CDC 页面 → 2026 年至今 1,575 例 → 距 12,500 差 10,925 例
- FIDE 候选人赛：访问 FIDE 官网 → Caruana 2.5/3 并列领先 → 不存在"两连败"
- 加州州长：搜索最新民调 → Swalwell 13-17% 领先

**为什么这一步是强制的：** AI 对正在进行中的事件（赛事、选举、疫情）的事实认知经常过时或错误。直接查验 resolution source 可以防止基于错误事实做出的交易决策。

**信息搜集（A1 模块）：**
- 对每个市场执行 2-3 个定向网络搜索
- 记录每个信息源的 URL 和关键发现
- 优先级：**resolution source 指定的官方数据（A0 已获取）** > 权威媒体 > 专家分析 > 社交情绪

**事实校验（A1.5 模块 — 在 A2 之前执行）：**

在开始概率推理之前，必须对自己即将使用的核心事实主张做交叉验证：

- 列出将用于概率估算的每个关键事实主张（如"Caruana 两连败""SC 麻疹爆发已结束"）
- 对每个主张，确认至少有一个可溯源的信息来源（URL + 日期）
- 如果某个主张无法溯源 → 标记为"未验证"，在证据链中降低其权重
- **禁止使用无法溯源的事实主张作为主要证据**

**推理与预测（A2 模块）：**
- 从 resolution rule 的触发条件出发（不是从"事件本身"出发）
- 先评估 resolution 定义的触发条件被满足的概率
- 根据每条**已验证的**证据进行更新。参考幅度（默认值）：强证据 10-20% 偏移、中等 5-10%、弱 1-5%——证据的真实分量由你判断，可以偏离这些幅度，但要写明为什么这条证据值这么多
- 标注置信度：高 / 中 / 低
- **Longshot 校准**：对市场价 < 20% 的事件，默认假设市场高估了 Yes 概率。
  从历史基准率出发，而非从市场价出发。问自己："同类事件在给定时间窗口内
  发生的历史频率是多少？" 通常远低于市场定价。

详细方法论见 [references/analysis-framework.md](references/analysis-framework.md)。

### 第 4 步：计算价值偏差（Edge）

对每个候选市场计算：

```
Edge = AI估算概率 - 市场隐含概率
```

其中 `市场隐含概率` 是第 1 步中 `outcome_prices` 的值（如 0.35 = 35%）。

**筛选参考分档（默认值，可按证据质量偏离并说明理由）：**
- Edge > 20%：强信号 — 高优先级推荐
- Edge 10-20%：中等 — 标准推荐
- Edge 5-10%：弱 — 仅在其他维度表现突出时才提及
- Edge < 5%：通常跳过

**综合得分排序（默认排序方法）：**

```
综合得分 = |Edge| × log10(Liquidity + 1)
```

示例：Edge 20% + $10k 流动性 = 0.20 × 4.0 = 0.80；Edge 10% + $500k 流动性 = 0.10 × 5.7 = 0.57。Edge 仍然主导但流动性极差的市场会被降权。

市场数据中已预计算 `liquidity_score` 字段（= log10(liquidity + 1)），直接使用即可。若你认为另一种排序更能反映真实机会（例如证据确定性极高的中等 edge 优于证据薄弱的大 edge），说明理由后可偏离。

**硬性门槛（风控，不可偏离）：** 流动性 < $5,000 的市场不得进入最终推荐。

选取最值得交易的市场，**最多 3 个**——达不到你的标准就少推荐，不要为凑数纳入弱推荐；一个都没有时明确说明本轮无推荐。

**月化收益估算：**

对每个通过 edge 阈值的候选市场，计算：
1. 持有期 `d`：取自 `end_date`（如存在）；否则默认 90 天（标注"假设值"）。下限取 7 天。
2. `expected_return = (p - c) / c`
3. `monthly_return = (1 + expected_return) ^ (30 / d) - 1`

在逐市场分析中显示。标注：d<7 → "极短期仅供参考"；d>365 → "长期资金锁定"；无 end_date → "(假设 90d)"。

**Longshot Bias 提醒：**
不要仅仅因为"买 No 利润看起来少"而忽略这类机会——高胜率 × 适当仓位 = 稳定收益。
最终推荐里有没有"买 No"、有几个，由证据决定，不设配额；但如果你的候选里没有任何 No 侧机会，
值得回头检查一遍是否漏掉了被高估的 longshot。

### 第 4.5 步：评论区校验

对通过 Edge 筛选的前 3 个推荐市场，执行评论区校验。这是概率估算的最终验证环节，独立于第 3 步的网络调研。

**获取评论：**

对每个 Top 3 市场，运行 scrape 脚本获取评论（优先方式，自动处理 Series/Event ID 查找）：

```bash
cd ~/.claude/skills/api-trade-polymarket/scripts && npx tsx scrape-market.ts --slug <event_slug> --sections comments --comment-limit 20 --comment-sort likes
```

返回 JSON 中 `comments.items[]` 包含每条评论的 `user`、`body`、`likes`、`created_at`、`is_holder`、`positions`。
如需按时间排序：`--comment-sort newest`。

**为什么优先用 scrape 脚本：** 很多市场的评论挂在 Series entity 下（而非 Event），脚本会自动从 Gamma API 的 `series[].id` 字段提取 numeric Series ID 进行查询。

**回退方式 — polymarket CLI：**

```bash
# 1. slug → numeric ID
polymarket events get <event_slug> -o json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])"

# 2. 获取评论
polymarket comments list --entity-type event --entity-id <id> --limit 20 -o json
```

注意：CLI 仅通过 Event entity type 查询，部分 Series 维度的评论可能无法获取。

如果返回 0 条评论（部分事件确实没有评论），在报告中标注"该市场无用户评论"并跳过评论校验。

**分析维度：**

逐条审查评论，寻找以下信号：

1. **新闻源引用：** 评论中是否引用了第 3 步搜索未覆盖的新闻来源？如有，点开验证。
2. **定量分析：** 评论者是否提供了具体的数据、统计、或模型？逻辑是否成立？
3. **内部信息信号：** 评论者是否暗示掌握非公开信息（需谨慎评估可信度）？
4. **对立观点：** 与当前 AI 判断相反的评论，其推理是否合理？是否引用了被忽略的证据？
5. **结算规则讨论：** 评论者是否就结算标准的模糊地带展开讨论？这些讨论是否揭示了潜在风险？

**概率修正：**

- 如果评论揭示了第 3 步未覆盖的实质性新信息 → 重新评估概率
- 如果评论区存在关于结算标准的广泛争议 → 降低置信度
- 如果多位持仓者的推理一致支持某方向，且逻辑成立 → 作为佐证（非决定性）
- 如果未发现新的实质信息 → 维持原判断

**输出要求：**

在报告的每个推荐市场中，添加"评论区校验"区块，记录校验结果。
如果校验导致概率修正，在修正后的概率旁标注"（评论区校验后调整：原 XX% → 现 YY%）"。

### 第 5 步：流动性分析与仓位定量

对前 3 个市场分别获取订单簿：

```bash
python scripts/fetch_orderbook.py <token_id> --slippage 0.02
```

使用市场数据中的 `clob_token_ids`。看涨 Yes 用第一个 token ID；看涨 No 用第二个。

脚本输出：
- 买卖价差和中间价
- 2% 滑点内可执行的最大订单量
- 流动性等级和建议仓位范围

**1/4 凯利仓位管理：**

对前 3 个推荐市场分别计算：
1. `f* = (p - c) / (1 - c)` — p = AI 估算的买入方向胜率，c = 买入方向的入场价格
2. `f_q = f* / 4`
3. `kelly_amount = f_q × 资金总额`（默认资金 $10,000；如用户指定则使用用户值）
4. `liquidity_cap = 0.10 × buy_capacity.max_cost_usd`
5. `recommended_size = min(kelly_amount, liquidity_cap)`，用于人类可读报告中的建议仓位

6. Pulse Direct 在 live 执行前会在代码里重算 quarter Kelly，且 live 风控可能继续把这个数字往下裁
7. `position_pct = recommended_size / bankroll`（实际分配的资金比例）

显示：完整凯利 %、1/4 凯利 %、凯利金额（% → $）、流动性上限（% → $）、**建议仓位以资金百分比为主**（附 $ 等值），并说明 live 执行可能进一步下调。

安全规则：若 p ≤ c → 凯利 ≤ 0，不推荐。f* 显示上限 100%。

### 第 6 步：生成推荐报告

按 [references/output-template.md](references/output-template.md) 中的模板格式化最终输出。

每个推荐市场必须包含：
1. 市场链接（`https://polymarket.com/event/{event_slug}`，使用事件级 slug 而非市场 slug）
2. 当前隐含概率和价差
3. AI 估算概率、置信度和 edge 值
4. 结算规则摘要 + resolution source URL（从 A0 模块获取的数据源及当前状态）
5. 四维分析（信息流、结算清晰度、流动性、波动性）— 各 1-5 分并附简要说明
6. 仓位建议（方向、规模范围、限价、下单策略）
7. 完整的信息源列表（URL + 关键要点）
8. 事实校验清单（A1.5 模块输出：每个关键事实主张 + 溯源 URL + 验证状态）

**时间戳要求（重要）：**
- 报告头部：记录报告生成时间和市场数据获取时间
- 每个市场：记录市场数据时间和 AI 判断时间
- 每个信息源：记录信息获取时间
- 所有时间使用 UTC 时区，格式：`YYYY-MM-DD HH:MM:SS`

### 第 7 步：保存报告文件

将完整报告保存为 Markdown 文件：

```bash
mkdir -p ~/polymarket-reports
```

**文件路径：** `~/polymarket-reports/market-pulse-{YYYY-MM-DD}-{HHMMSS}.md`

使用 Write 工具将报告保存到上述路径。保存后向用户确认文件路径。

**示例文件名：** `market-pulse-2026-02-23-134500.md`

**追加推荐历史：**

保存报告后，追加到 `~/polymarket-reports/recommendation-history.md`：

1. 若文件不存在，创建并写入表头：

| Date | Market | Link | Direction | Entry Price | AI Prob | Edge | Full Kelly | 1/4 Kelly | Position | Mo. Return | End Date | Status |
|------|--------|------|-----------|-------------|---------|------|-----------|-----------|----------|------------|----------|--------|

2. 每个推荐市场追加 1 行（每次运行 3 行）。市场问题截断至 50 字符。Link 列填写 Polymarket 事件链接（如 `https://polymarket.com/event/{slug}`）。
3. 禁止覆盖 — 始终追加。
4. 先读取文件确认表头存在，再追加行。

**终端摘要输出（重要）：**

保存报告后，在终端（非文件）中向用户输出简明摘要，**必须包含可点击链接**：

Top 3 推荐市场逐个输出格式：
```
### {排名}. {市场问题} — {方向} @ {入场价}
- **链接：** https://polymarket.com/event/{event_slug}
- **Edge:** {edge} | AI {ai_prob}% vs 市场 {market_prob}% | 置信度：{confidence}
- **建议仓位：** {position}（{position_pct}% of bankroll）
- **EMR:** {monthly_return}%（{d}天）
```

然后输出一张**候选池总览表**，包含 Top 3 + 次优 5 个（共 8 个），按综合得分排序：

```
| # | 市场 | 方向 | 市场价 | AI 估计 | Edge | EMR | 链接 |
|---|------|------|--------|---------|------|-----|------|
| 1 | {问题，截断50字符} | {Buy Yes/No} | {market}% | {ai}% | {+X%} | {X%} | [link](https://polymarket.com/event/{slug}) |
| ... | ... | ... | ... | ... | ... | ... | ... |
| 8 | ... | ... | ... | ... | ... | ... | ... |
```

注：EMR = Estimated Monthly Return（预估月化收益）。第 4-8 名未做深度流动性分析和评论区校验，仅供参考。

## 依赖

- **polymarket CLI** (Rust, `~/.cargo/bin/polymarket`)：`fetch_orderbook.py` 和评论回退方案均依赖此工具。确认已安装：`polymarket --version`
- **scrape-market.ts**：位于 `~/.claude/skills/api-trade-polymarket/scripts/`，用于获取结算规则和评论。需要 `npx tsx`。
- **fetch_markets.py** 仍直接调用 Gamma API（CLI 无法替代其并发多维度扫描逻辑）。

## CLI 快捷工具

以下 `polymarket` CLI 命令可在工作流中按需使用，无需额外脚本：

| 命令 | 用途 | 适用步骤 |
|------|------|----------|
| `clob batch-prices <ids> --side buy` | 批量价格查询 | Step 2 快速筛选候选价格 |
| `clob spreads <ids>` | 批量 spread 查询 | Step 2 流动性快筛 |
| `clob price-history <id> --interval 1d` | 价格历史 | Step 3 波动性分析 |
| `markets search "query"` | 市场搜索 | 按关键词定向查找 |
| `markets get <slug>` | 单个市场详情 | 任意步骤补充数据 |

## 故障排除

- **脚本返回空结果**：降低 `--min-liquidity` 阈值或增加 `--pages`（如 `--pages 20`）以扫描更多市场
- **获取速度慢**：`--pages 20` 需要 80 次 API 调用（20 页 × 4 维度），约需 30-40 秒。可用 `--pages 5` 加速
- **订单簿获取失败**：token ID 可能无效；通过 Gamma API 确认 `enableOrderBook` 为 true。`fetch_orderbook.py` 依赖 `polymarket` CLI，确认 CLI 可用。
- **通过筛选的市场太少**：将 edge 阈值放宽至 5%，或纳入 edge 中等但流动性好的市场
- **`--limit` 参数**：已废弃但仍兼容，会自动映射为 `--pages`
- **CLI 不可用**：`fetch_orderbook.py.bak` 是原始 urllib 版本，可在 CLI 不可用时回退

## 参考文件

- [references/polymarket-api.md](references/polymarket-api.md) — 完整的 API 端点文档
- [references/analysis-framework.md](references/analysis-framework.md) — 详细的 A1/A2/B1/B2 分析方法论
- [references/output-template.md](references/output-template.md) — 报告格式模板
