# Market Intelligence Module

Polymarket 市场标签分类 + World Monitor 地缘情报融合 + Pace 策略模块。

## 状态与定位（2026-06-15）

> **这是一个可选的研究 / 增强模块,目前未接入实盘 Pulse 抓取路径。** 它独立于 TS 主代码(纯 Python,只依赖 `requests`),引入不影响现有构建。下面的"drop-in 替换"是**未来兼容目标**,不是当前已启用状态。

接入实盘 fetch 路径前,有两个已知缺口需要先补齐:

1. **未输出 `neg_risk` / `fees_enabled` / `fee_schedule`**:当前 `services/orchestrator/src/pulse/market-pulse.ts` 会读取这三个字段(`toPulseFeeSchedule` / `toPulseCandidate`)。main 端做了防御性默认(`neg_risk=false`、fees 缺省),所以**不会崩**,但如果真当 live 抓取路径用,neg-risk / 费率感知的 sizing 会静默降级。`enriched_fetcher.py` 需要补这三个字段的输出。
2. **不会被自动接管**:orchestrator 的 `resolvePulseScriptsDir` 硬编码在 vendored scripts 目录里找 `fetch_markets.py`(basename 固定),因此 `enriched_fetcher.py` **不会**被自动调用。要启用需把这个查找改成可配置。

在补齐以上两点之前,把它当作**离线可跑的标签/情报研究工具**;实盘抓取仍走现有 `fetch_markets.py`。

## 离线测试(无需网络/凭证)

```bash
pip install requests
pytest packages/market-intelligence/        # 标签分类 / Pace 分配 / JSON shape 兼容
```

注意:`python enriched_fetcher.py --no-intelligence` 跳过 World Monitor(不需要凭证),但市场抓取仍会访问 Gamma API(需要网络)。完全离线的冒烟验证请用上面的 `pytest`(走 `fixtures/sample_market.json`)。

## 架构

```
                    ┌─────────────────────────────┐
                    │   enriched_fetcher.py        │  ← orchestrator 调用入口
                    │   (兼容 fetch_markets.py)     │     输出 RawPulseOutput JSON
                    └──────────┬──────────────────┘
                               │
          ┌────────────────────┼─────────────────────┐
          ▼                    ▼                      ▼
  ┌───────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │ tag_library   │  │ worldmonitor     │  │ pace_strategy    │
  │               │  │ _client          │  │                  │
  │ 7 事件类型     │  │ 30+ 情报 API     │  │ fast/medium/     │
  │ 36 标签       │  │ CII / F&G /      │  │ slow/strategic   │
  │ 词边界匹配    │  │ 交易信号          │  │ 节奏策略          │
  └───────┬───────┘  └────────┬─────────┘  └────────┬─────────┘
          │                   │                      │
          ▼                   ▼                      ▼
  ┌───────────────┐  ┌──────────────────┐           │
  │ market_       │  │ intelligence_    │           │
  │ fetcher       │  │ enricher         │───────────┘
  │               │  │                  │
  │ Gamma API     │  │ 市场 ↔ 情报融合   │
  │ 分类 + 过滤   │  │ 推理上下文        │
  └───────────────┘  └──────────────────┘
```

## 两大核心能力

### 1. 市场标签 (Market Tagging)

按事件类型和标签自动分类每个市场，用于针对性获取：

| 事件类型 | 标签示例 | Pace |
|----------|----------|------|
| Sports | NBA, NFL, MLB, Soccer, UFC | fast |
| Politics | US Elections, US Policy, International | strategic |
| Crypto | Bitcoin, Ethereum, Altcoins, DeFi | medium |
| Economy | Stock Market, Commodities, Interest Rates | medium |
| Science & Tech | AI, Space, Climate, Health | slow |
| Entertainment | Awards, Movies & TV, Music | medium |
| Miscellaneous | Weather, Legal, Demographics | slow |

### 2. 情报收集 (Market Intelligence)

World Monitor 30+ API 实时注入：

- **CII 国家风险评分** — 31 国、4 维度 (军事/新闻/地缘收敛/CII)
- **AI 交易信号** — 多空方向 + 置信度 + 推理依据
- **跨源收敛警报** — 多域升级检测 (军事+动乱+GPS干扰 = 复合升级)
- **Fear & Greed** — 10 分维度综合情绪指数
- **冲突事件** — ACLED/UCDP 实时追踪
- **制裁/供应链** — 经济压力 + 航运瓶颈

## Pace 策略

不同市场类型使用不同分析节奏：

| Pace | 刷新频率 | 信心乘数 | 仓位乘数 | 典型场景 |
|------|---------|---------|---------|---------|
| `fast` | 1h | ×0.85 | ×0.7 | 体育赛事、即时事件 |
| `medium` | 6h | ×1.0 | ×1.0 | 选举、加密货币、财报 |
| `slow` | 24h | ×1.05 | ×1.1 | 气候、监管、人口 |
| `strategic` | 4h | ×1.1 | ×0.9 | 地缘冲突、高风险国家 |

Pace 自动分配规则：
1. 地缘风险 ≥ 50 → `strategic`
2. 距结束 ≤ 24h → `fast`
3. 标签级覆盖 (NBA → fast, US Elections → strategic)
4. 类型级默认

## 模块说明

| 文件 | 功能 |
|------|------|
| `enriched_fetcher.py` | **主入口** — 兼容 orchestrator 的 fetch_markets.py，输出 RawPulseOutput |
| `tag_library.py` | 标签库：7 事件类型、36 标签 |
| `market_fetcher.py` | 统一市场获取 + 过滤 |
| `pace_strategy.py` | Pace 节奏策略分配 |
| `worldmonitor_client.py` | World Monitor 客户端 |
| `intelligence_enricher.py` | 情报增强器 |
| `market_filter_demo.py` | 市场过滤 CLI 演示 |
| `intel_demo.py` | 情报增强 CLI 演示 |

## 使用方式

### 作为 orchestrator 的 drop-in 替换

```bash
# 标准调用（与 fetch_markets.py 参数兼容）
python enriched_fetcher.py \
    --pages 5 \
    --events-per-page 50 \
    --min-fetched-markets 5000 \
    --min-liquidity 5000 \
    --output /tmp/pulse.json

# 按类型针对性获取
python enriched_fetcher.py --event-type Politics --output /tmp/politics.json
python enriched_fetcher.py --event-type Crypto --output /tmp/crypto.json
python enriched_fetcher.py --tags NBA,NFL --output /tmp/sports.json

# 关闭情报（纯标签分类）
python enriched_fetcher.py --no-intelligence --output /tmp/fast.json
```

### 独立使用

```bash
pip install requests

# 浏览标签库
python market_filter_demo.py --browse-tags

# 按类型 / 标签 / 关键词筛选
python market_filter_demo.py --type Sports
python market_filter_demo.py --tag NBA
python market_filter_demo.py --keyword bitcoin

# 全球态势报告
python intel_demo.py --context

# 情报增强市场分析
python intel_demo.py --type Politics
python intel_demo.py --high-risk
```

## 输出格式

完全兼容 `RawPulseOutput` 接口，额外字段不影响现有解析：

```json
{
  "fetched_at": "2026-03-29T...",
  "total_fetched": 5200,
  "total_filtered": 42,
  "category_stats": { "fetched": [...], "filtered": [...] },
  "tag_stats": { "fetched": [...], "filtered": [...] },
  "intelligence_context": { "global_tension": "high", "..." },
  "markets": [
    {
      "question": "...",
      "category_slug": "politics",
      "category_label": "Politics",
      "tags": [{"slug": "us-elections", "label": "US Elections"}],
      "pace": "strategic",
      "intelligence": { "risk_level": "elevated", "..." },
      "..."
    }
  ]
}
```

## 依赖

- Python 3.9+
- `requests` (唯一外部依赖)

## 许可

增量补充模块，不修改项目原有代码。
