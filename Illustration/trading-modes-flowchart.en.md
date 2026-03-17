# Trading Modes Flowchart

```mermaid
flowchart TD
  A[Start] --> B{AUTOPOLY_EXECUTION_MODE}

  B -->|paper| C[trial:recommend]
  C --> D[awaiting-approval]
  D --> E[trial:approve]
  E --> F[Paper execution + local state update]

  B -->|live| G{Entry Command}
  G -->|pnpm live:test:stateless| H[Preflight]
  G -->|pnpm live:test| I[Preflight + DB/Redis/Queue Worker]

  H --> J[Generate or reuse Pulse]
  I --> J

  J --> K{AGENT_DECISION_STRATEGY}
  K -->|provider-runtime| L[LLM decision runtime]
  K -->|pulse-direct / House Direct| M[Convert Pulse directly into decisions]

  L --> N[Risk guards and position caps]
  M --> N

  N --> O{Executable plans available?}
  O -->|No| P[Summary only, 0 orders]
  O -->|Yes + stateless| Q[Direct order execution]
  O -->|Yes + stateful| R[Queue execution + sync]

  Q --> S[Archive execution-summary]
  R --> S
```

## Term Mapping

- `Stateless`: `pnpm live:test:stateless`
- `Pre-Flight`: a gate stage inside live flow (not a standalone order mode)
- `House Direct`: `AGENT_DECISION_STRATEGY=pulse-direct`
