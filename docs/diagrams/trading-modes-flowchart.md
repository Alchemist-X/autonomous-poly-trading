# 下单模式流程图

```mermaid
flowchart TD
  A[开始] --> B{AUTOPOLY_EXECUTION_MODE}

  B -->|paper| C[trial:recommend]
  C --> D[awaiting-approval]
  D --> E[trial:approve]
  E --> F[Paper execution + 本地状态更新]

  B -->|live| G{入口命令}
  G -->|pnpm pulse:live| H[Preflight]
  G -->|pnpm live:test| I[Preflight + DB/Redis/Queue Worker]

  H --> J[生成或复用 Pulse]
  I --> J

  J --> K{AGENT_DECISION_STRATEGY}
  K -->|provider-runtime| L[LLM 决策运行时]
  K -->|pulse-direct / House Direct| M[直接由 Pulse 转决策]

  L --> N[风控与仓位约束]
  M --> N

  N --> O{是否有可执行计划}
  O -->|否| P[仅输出总结，0 笔下单]
  O -->|是| Q{订单类型}
  Q -->|FOK| R[市价单立即成交]
  Q -->|GTC 且已启用| S[限价单 → 轮询 → fallback FOK]
  R --> T[execution-summary 归档]
  S --> T
```

## Pulse Live 内部阶段（pulse-direct 策略）

```mermaid
flowchart LR
  F1[Fetch 8000 市场] --> F2[过滤 → 900]
  F2 --> F3[随机选 20]
  F3 --> F4[深度研究 Top 4]
  F4 --> F5["LLM 渲染报告 ← 唯一 LLM 步骤"]
  F5 --> F6[Entry Planner 提取计划]
  F6 --> F7[Position Review 复审持仓]
  F7 --> F8[Decision Compose 合并]
  F8 --> F9[风控裁剪 + 下单]

  style F5 fill:#1e3a5f,stroke:#38bdf8,color:#ffffff
```

## 名词对齐

- `Pulse Live`：`pnpm pulse:live`（默认实盘）
- `Pre-Flight`：live 流程中的前置检查阶段（不是独立下单模式）
- `House Direct`：`AGENT_DECISION_STRATEGY=pulse-direct`
- `GTC`：Good Till Cancelled 限价单（默认关闭，`ENABLE_GTC_ORDERS=true` 启用）
- `FOK`：Fill or Kill 市价单（当前默认）

## 详细流程文档

→ 见 [`pulse-live-flow.md`](pulse-live-flow.md)
