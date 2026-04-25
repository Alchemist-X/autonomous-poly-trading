# 市场筛选策略计划

## 一、问题

当前的市场筛选是**纯机械的**：`fetch_markets.py` 按流动性、价格范围、到期时间做硬过滤，然后按流动性/成交量排序取 top 12。这种方式有几个根本问题：

1. **不区分市场类型** — 政治预测、体育赛事、加密货币涨跌、天气预报被混在一起排序，但 AI 在这些类型上的 edge 完全不同
2. **短期市场浪费资源** — 24 小时内到期的市场已被过滤，但 1-7 天的短期涨跌类市场仍然进入候选池，AI 对这类市场没有 edge
3. **没有"AI 擅长什么"的自我认知** — 系统不知道自己在哪些领域有推理优势
4. **候选排序不考虑回报周期** — 流动性高的市场排在前面，但流动性高不代表 edge 大或回报周期好

## 二、当前筛选链路

```
Polymarket Gamma API
  ↓ fetch_markets.py (Python)
  ↓ 4 维度排序（volume24hr, liquidity, startDate, competitive）
  ↓ 硬过滤：
  │   - enable_order_book = true
  │   - liquidity >= $5000
  │   - 价格 0.05 ~ 0.95
  │   - 非 junk（标题模式匹配 + 到期 > 24h）
  │   - 非 coin flip（所有 outcome 都在 0.48-0.52）
  ↓ 约 700-900 个市场通过
  ↓ 取 top 12（按候选池排序）
  ↓ 深度研究 top 4（full-pulse 渲染）
```

## 三、市场分类体系

### 3.1 按 AI edge 强弱分类

| 类型 | AI Edge | 理由 | 处理策略 |
|------|---------|------|---------|
| **政治/地缘** | 高 | 信息分散、需要综合推理、无清晰定价模型、公众情绪偏差大 | 重点投入 |
| **科技/产品** | 高 | 需要技术理解、发布周期可预测、信息不对称 | 重点投入 |
| **监管/法律** | 中-高 | 先例分析、流程推理、公众不熟悉细节 | 正常投入 |
| **经济/宏观** | 中 | 数据公开、专业分析师已定价、但 AI 能综合更多数据源 | 正常投入 |
| **体育** | 中 | 统计模型成熟、但赛事临场变量多、AI 可辅助 | 正常投入 |
| **加密货币短期价格** | 低 | 高度随机、无信息优势、5 分钟/1 小时涨跌 = 噪音 | **过滤掉** |
| **天气/自然事件** | 低 | 专业气象模型已存在、AI 无增量 | 降权或过滤 |

### 3.2 按时间维度分类

| 时间范围 | AI Edge | 理由 | 处理策略 |
|---------|---------|------|---------|
| < 24h | 无 | 已被 `fetch_markets.py` 过滤 | 保持过滤 |
| 1-7 天 | 低-中 | 如果是价格涨跌类，AI 没有 edge；如果是事件类（"X 会在本周发生吗"），可能有 edge | 按类型决定 |
| 1-4 周 | 高 | **最佳窗口** — 足够的推理空间 + 合理的资金回报周期 | 优先 |
| 1-6 个月 | 中-高 | 推理空间大，但资金占用周期长，月化回报被稀释 | 正常 |
| > 6 个月 | 中 | edge 可能存在但资金效率低，除非 edge 极大 | 降权 |

### 3.3 关键洞察：AI edge 的来源

AI 的 edge **不是**"预测得更准"，而是：

1. **信息综合** — 能同时处理数十个信息源，人类通常只看 1-3 个
2. **先例匹配** — 能快速检索历史类似情境（"上次类似的地缘事件，市场怎么反应的"）
3. **规则解读** — 仔细阅读结算规则（很多人不读），发现 Yes/No 的精确边界
4. **情绪偏差修正** — 公众容易对恐惧/贪婪事件过度定价，AI 相对冷静
5. **覆盖面** — 人类不可能同时监控 9000 个市场

AI **没有** edge 的地方：
- 短期价格走势（本质是随机游走）
- 需要内幕信息的市场
- 高度依赖实时物理观测的市场（天气、体育临场）

## 四、实施方案

### Phase A：机械层过滤增强（修改 `fetch_markets.py`）

在现有 `filter_markets()` 之后加一层，利用已有的 category/tag 元数据做分类过滤：

```python
# 新增过滤规则
CRYPTO_PRICE_PATTERNS = [
    re.compile(r"price.*above|below|hit|reach|dip", re.IGNORECASE),
    re.compile(r"BTC|ETH|SOL|DOGE.*\$[\d,]+", re.IGNORECASE),
    re.compile(r"Bitcoin.*\$|Ethereum.*\$", re.IGNORECASE),
]

SHORT_TERM_PRICE_CATEGORIES = ["crypto-prices", "stocks"]

MIN_DAYS_FOR_PRICE_MARKETS = 7  # 价格类市场至少 7 天才有意义

def is_short_term_price_market(question, end_date, category_slug, tags):
    """过滤短期价格涨跌类市场 — AI 在这类市场没有 edge"""
    # 检查是否是价格类市场
    is_price_market = any(p.search(question) for p in CRYPTO_PRICE_PATTERNS)
    is_price_category = category_slug in SHORT_TERM_PRICE_CATEGORIES

    if not (is_price_market or is_price_category):
        return False

    # 价格类市场需要至少 7 天到期
    if end_date:
        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        days_left = (end_dt - datetime.now(timezone.utc)).days
        if days_left < MIN_DAYS_FOR_PRICE_MARKETS:
            return True  # 过滤掉

    return False
```

**影响：** 预估会额外过滤掉 50-100 个短期价格市场，让候选池质量提升。

### Phase B：候选排序改进（修改候选选择逻辑）

当前 top 12 是按流动性/成交量排序。改为综合评分：

```
score = edge_potential × time_efficiency × type_weight

其中：
- edge_potential = |0.5 - marketProb| × 2  （越偏离 0.5 的市场越可能存在 mispricing）
- time_efficiency = 1 / max(monthsToResolution, 0.1)  （越快结算越好）
- type_weight = 按 3.1 表的分类权重（政治 1.5, 科技 1.5, 监管 1.2, 经济 1.0, 体育 1.0, 加密价格 0.3, 天气 0.5）
```

**注意：** 这一步仍然是机械评分，不是 AI 分析。AI 分析在 Phase C。

### Phase C：AI 参与的候选筛选（修改 full-pulse 流程）

在 Pulse 报告生成前增加一个 **AI 预筛选** 步骤：

```
top 12 候选（机械排序）
  ↓ AI 预筛选（轻量 prompt，只做 Yes/No 判断）
  ↓ "这个市场 AI 能产生有意义的 edge 吗？"
  ↓ 过滤掉 AI 自己认为没有 edge 的市场
  ↓ 剩余候选进入深度研究（top 4）
```

AI 预筛选的 prompt 结构：

```
给定以下 12 个市场候选，快速判断每个市场是否适合 AI 交易：
- 适合：AI 能通过推理、信息综合、先例匹配产生有意义的 edge
- 不适合：市场结果高度随机、依赖内幕信息、或已被充分定价

对每个候选回答：TRADE / SKIP + 一句话理由
```

**耗时预估：** 额外 10-15 秒（轻量 prompt，不需要深度分析）。

### Phase D：回报时间线的 AI 分析

当前 `monthlyReturn = edge / monthsToResolution` 是纯机械计算。但"多快会 converge 到我的价格"不仅取决于到期日，还取决于：

- **催化事件时间线** — 什么时候会有新信息改变市场价格？
- **市场关注度** — 高关注度市场价格调整更快
- **信息不对称窗口** — AI 的 edge 在信息公开后会消失

在 Pulse 报告中增加一个字段：

```markdown
### 回报时间线分析
- 预期价格收敛触发事件：[具体事件]
- 预计触发时间：[日期或时间范围]
- AI edge 持续窗口：[估计]
- 调整后 EMR：[基于以上分析的月化回报]
```

## 五、实施优先级

```
Phase A（机械过滤增强）     → 1 小时  → 立即过滤短期价格市场
Phase B（候选排序改进）     → 2 小时  → 按类型 + 时间效率综合排序
Phase C（AI 预筛选）        → 3 小时  → 让 AI 自己判断哪些市场值得研究
Phase D（回报时间线分析）   → 纳入 Pulse 报告模板  → 每个推荐都带催化事件分析
```

## 六、需要确认的决策

1. **加密货币价格市场** — 全部过滤还是只过滤 < 7 天的？有些长期价格目标（如"BTC 年底到 $150k"）可能有 edge。
2. **体育市场** — 保留还是降权？体育统计模型已很成熟，AI 增量可能不大。
3. **Phase C 的 AI 预筛选成本** — 愿意每轮多花 10-15 秒和一次轻量 API 调用吗？
4. **候选池大小** — 当前是 12 个。过滤增强后可能只剩 6-8 个有效候选。要扩大初始池（比如 20 个）吗？

## 七、文件影响

| 文件 | 改动 |
|------|------|
| `vendor/.../fetch_markets.py` | Phase A：增加 `is_short_term_price_market()` |
| `services/orchestrator/src/pulse/market-pulse.ts` | Phase B：候选排序逻辑 |
| `services/orchestrator/src/pulse/full-pulse.ts` | Phase C：AI 预筛选步骤；Phase D：报告模板 |
| `services/orchestrator/src/runtime/pulse-entry-planner.ts` | Phase D：解析回报时间线字段 |
