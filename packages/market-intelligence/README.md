# Market Intelligence Module

Polymarket 市场过滤 + World Monitor 地缘情报融合模块。

## 架构

```
Polymarket Gamma API ──→ market_fetcher.py ──→ 分类过滤后的市场
                              ↓
World Monitor 30+ APIs ──→ worldmonitor_client.py ──→ 情报数据
                              ↓
                    intelligence_enricher.py
                              ↓
                    带推理上下文的增强市场
```

## 模块说明

| 文件 | 功能 |
|------|------|
| `tag_library.py` | 标签库：7 事件类型、36 标签，词边界匹配 |
| `market_fetcher.py` | 统一市场获取：按类型/标签/交易量/日期/价格过滤 |
| `worldmonitor_client.py` | World Monitor 客户端：CII 风险评分、交易信号、收敛警报 |
| `intelligence_enricher.py` | 情报增强器：将地缘数据附着到每个市场 |
| `market_filter_demo.py` | 市场过滤 CLI 演示 |
| `intel_demo.py` | 情报增强 CLI 演示 |

## 快速使用

```bash
pip install requests

# 浏览标签库
python tag_library_demo.py --browse-tags

# 按类型筛选市场
python market_filter_demo.py --type Sports
python market_filter_demo.py --tag NBA
python market_filter_demo.py --keyword bitcoin

# 查看全球态势 + 情报增强市场
python intel_demo.py --context
python intel_demo.py --type Politics
python intel_demo.py --high-risk
```

## 数据源

### Polymarket (Gamma API)
- 市场列表、赔率、交易量、订单簿

### World Monitor (30+ 微服务)
- 国家不稳定指数 (CII) — 31 国、4 维度
- AI 交易信号 — 多空方向 + 置信度
- 跨源收敛警报 — 多域升级检测
- Fear & Greed 综合指数 — 10 个分维度
- ACLED/UCDP 冲突事件
- 制裁压力、供应链瓶颈
- 435+ RSS 新闻源 AI 摘要

## 依赖

- Python 3.9+
- `requests` (唯一外部依赖)

## 许可

增量补充模块，不修改项目原有代码。
