# 预测流程图（迭代式二元事件预测引擎）

> 用于展示。主图一张讲清全流程；想深入再用文末的可选细节图。
> Mermaid 源码 —— 贴进 Notion / Typora / VS Code / GitHub，或在 https://mermaid.live 渲染导出 PNG/SVG。

## 主图 · 一张图看懂预测流程（横向）

```mermaid
flowchart LR
    P(["用户 prompt<br/>二元（是/否）事件"]) --> FRAME

    subgraph FRAME["① 框定问题"]
        direction TB
        F["归一化问题<br/>+ 审计判定标准"] --> PR["模型自估<br/>基率先验"]
    end

    FRAME --> CHK{"可预测？"}
    CHK -- 否 --> STOP(["要求澄清<br/>· 停止"])
    CHK -- 是 --> LOOP

    subgraph LOOP["② 多轮迭代"]
        direction TB
        SE["联网找新证据<br/>+ 反证搜索"] --> SC["每条信源<br/>方向 + 强度 + 同源分组"]
        SC --> EN["引擎合并<br/>去重 · 聚类折扣 · 核验 · 贝叶斯"]
        EN --> AT["逐源归因<br/>谁把概率推了多少"]
    end

    LOOP --> Q{"停止？<br/>收敛 / 无新信息 / 封顶"}
    Q -- "否：下一轮" --> LOOP
    Q -- 是 --> SUM["③ 收尾总览<br/>结论 + 正反因素<br/>+ 不确定性"]
    SUM --> OUT(["④ 输出<br/>概率 + 可追溯报告"])

    classDef start fill:#F8FAFC,stroke:#94A3B8,stroke-width:1.5px,color:#0F172A
    classDef stop fill:#FEE2E2,stroke:#EF4444,stroke-width:1.5px,color:#7F1D1D
    classDef dec fill:#FEF3C7,stroke:#F59E0B,stroke-width:1.5px,color:#78350F
    classDef fnode fill:#FFFFFF,stroke:#6366F1,stroke-width:1.5px,color:#1E1B4B
    classDef lnode fill:#FFFFFF,stroke:#10B981,stroke-width:1.5px,color:#064E3B
    classDef sum fill:#F5F3FF,stroke:#8B5CF6,stroke-width:1.5px,color:#4C1D95
    classDef out fill:#DCFCE7,stroke:#16A34A,stroke-width:1.5px,color:#14532D

    class P start
    class STOP stop
    class CHK,Q dec
    class F,PR fnode
    class SE,SC,EN,AT lnode
    class SUM sum
    class OUT out

    style FRAME fill:#EEF2FF,stroke:#6366F1,color:#3730A3
    style LOOP fill:#ECFDF5,stroke:#10B981,color:#065F46
```

### 讲解时一句话带过每个阶段

| 阶段 | 一句话 |
| --- | --- |
| ① 框定 | 把模糊的 prompt 变成"怎么算赢"说清楚的二元问题，并给一个起点先验 |
| ② 迭代 | 每轮联网找新证据，逐条打分，引擎用贝叶斯把它们合成概率——反复几轮 |
| ③ 收尾 | 通盘给一个结论：为什么是这个概率、正反在哪、不确定性是什么 |
| ④ 输出 | 一个概率 + 一份每步可追溯的报告 |

> 核心一句话：**引擎拥有那个数。** agent 只判断"每条证据多强、朝哪边"，概率由引擎确定性算出——所以可追溯、不会被凭空捏造。

---

## 纯文本版（无法渲染 Mermaid 时直接用）

```
                用户 prompt（二元事件）
                        │
            ┌───────────▼───────────┐
            │ ① 框定                 │
            │   归一化问题 + 审计标准  │
            │   模型自估基率先验       │
            └───────────┬───────────┘
                        ▼
                    可预测? ──否──► 要求澄清·停止
                        │是
            ┌───────────▼───────────┐
            │ ② 研究焦点中心           │
            │   拆问题·定唯一模型       │
            │   定检索方向·来源优先级   │
            └───────────┬───────────┘
                        ▼
            ┌───────────────────────┐
            │ ③ 多轮迭代（默认3轮）   │◄──────┐
            │   广搜·原始来源·反证     │       │
            │   每断言: 多来源交叉核验 │       │ 否:下一轮
            │   引擎: 甄选·去重·聚类   │       │
            │         ·贝叶斯更新      │       │
            │   一个断言只更新一次     │       │
            └───────────┬───────────┘       │
                        ▼                    │
                    停止? ────────────────---┘
                        │ 收敛/无新信息/封顶
                        ▼
            ④ 收尾总览(结论+情景+监控+缺口)
                        ▼
            ⑤ 输出: 概率 + 可读可追溯报告
```

---

## 附录 · 可选细节图（主图够用时可不展示）

### A. 单轮内部：引擎怎么把信源变成概率

```mermaid
flowchart LR
    IN["agent 输出<br/>原子断言 + 排序后的多来源 + 反思"] --> D["跨轮断言去重<br/>相同事实不因换 URL 重算"]
    D --> VER["来源甄选与交叉核验<br/>原始来源优先·搜索轨迹核验"]
    VER --> CLU["相关断言聚类折扣<br/>同一因果故事递减计权"]
    CLU --> TH["贝叶斯对数赔率串联<br/>每个断言只有一次更新"]
    TH --> ATTR["逐断言百分点归因<br/>额外来源只改变可信度"]
    ATTR --> PS[("持久化 state.json + report.md")]
```

### B. 状态机：一次预测的生命周期

```mermaid
stateDiagram-v2
    state "框定 + 审计" as framing
    state "不可预测" as nf
    state "进行中 (open)" as open
    state "收敛 converged" as conv
    state "无新信息 no_new_info" as nni
    state "封顶 max_rounds" as maxr
    state "中止 aborted" as ab
    state "收尾总览" as sum

    [*] --> framing
    framing --> nf: prompt 太模糊
    nf --> [*]: 要求澄清
    framing --> open: 先验已 seed（进入第 1 轮）
    open --> open: 移动 ≥1pp 且有新证据
    open --> conv: 移动 < 1pp
    open --> nni: 没有新证据 / 反思
    open --> maxr: 到达轮数上限
    open --> ab: agent 输出非法（重试后失败）
    conv --> sum
    nni --> sum
    maxr --> sum
    sum --> [*]: 输出 report.md + state.json
    ab --> [*]
```
