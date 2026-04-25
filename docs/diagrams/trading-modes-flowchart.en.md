# Trading Modes Flowchart

```mermaid
flowchart TD
  A[Start] --> B{AUTOPOLY_EXECUTION_MODE}

  B -->|paper| C[trial:recommend]
  C --> D[awaiting-approval]
  D --> E[trial:approve]
  E --> F[Paper execution + local state update]

  B -->|live| G{Entry command}
  G -->|pnpm pulse:live| H[Preflight]
  G -->|pnpm live:test| I[Preflight + DB/Redis/Queue Worker]

  H --> J[Generate or reuse Pulse]
  I --> J

  J --> K{AGENT_DECISION_STRATEGY}
  K -->|provider-runtime| L[LLM decision runtime]
  K -->|pulse-direct / House Direct| M[Pulse → decisions directly]

  L --> N[Risk guards + position constraints]
  M --> N

  N --> O{Executable plans?}
  O -->|No| P[Output summary only, 0 orders]
  O -->|Yes| Q{Order type}
  Q -->|FOK| R[Market order, immediate fill]
  Q -->|GTC enabled| S[Limit order → poll → fallback FOK]
  R --> T[execution-summary archive]
  S --> T
```

## Pulse Live Internal Stages (pulse-direct strategy)

```mermaid
flowchart LR
  F1[Fetch 8000 markets] --> F2[Filter → 900]
  F2 --> F3[Random sample 20]
  F3 --> F4[Deep research Top 4]
  F4 --> F5["LLM renders report ← only LLM step"]
  F5 --> F6[Entry Planner extracts plans]
  F6 --> F7[Position Review]
  F7 --> F8[Decision Compose merge]
  F8 --> F9[Risk guards + execute]

  style F5 fill:#1e3a5f,stroke:#38bdf8,color:#ffffff
```

## Glossary

- `Pulse Live`: `pnpm pulse:live` (default live trading)
- `Pre-Flight`: Pre-trade validation stage (not a standalone mode)
- `House Direct`: `AGENT_DECISION_STRATEGY=pulse-direct`
- `GTC`: Good Till Cancelled limit orders (disabled by default, `ENABLE_GTC_ORDERS=true`)
- `FOK`: Fill or Kill market orders (current default)

## Detailed flow

→ See [`pulse-live-flow.en.md`](pulse-live-flow.en.md)
