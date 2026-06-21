# 预测流程图（迭代式二元事件预测引擎）

> 用于展示。Mermaid 源码，可贴进支持 Mermaid 的工具，或在 https://mermaid.live 渲染成 PNG/SVG。
> English labels available on request.

## 1. 高层流程（一次预测的全貌）

```mermaid
flowchart TD
    P(["用户 prompt：一个二元（是/否）事件"]) --> F0["① 框定：归一化 → 问题 + 结算标准 + 结算日 + 结算来源"]
    F0 --> A0["② 怀疑式审计：独立重导，纠正歧义/写错的判定标准"]
    A0 --> PR["③ 模型凭自身知识自估一个基率先验"]
    PR --> FC{"可预测？"}
    FC -- 否 --> CL(["要求澄清 · 停止"])
    FC -- 是 --> SEED["用先验 seed P(是)，而非盲目 0.5"]
    SEED --> RND["▶ 第 k 轮"]
    RND --> S["agent 联网搜索：找新证据 + 一次反证搜索"]
    S --> SC["每条信源：立场 + 带符号 LLR + cluster_id"]
    SC --> RF["反思：可选地回调某条旧信源（带护栏）"]
    RF --> EN["引擎更新（见图 2）"]
    EN --> ST{"停止？"}
    ST -- "否 → 下一轮" --> RND
    ST -- "收敛 / 无新信息 / 封顶(默认3轮)" --> SM["④ 收尾总览：结论 + 正反因素 + 不确定性"]
    SM --> OUT(["输出：report.md + state.json"])
```

## 2. 单轮内部（引擎怎么把信源变成概率）

```mermaid
flowchart LR
    IN["agent 输出<br/>带 LLR + cluster_id 的信源 + 反思"] --> D["跨轮去重<br/>按规范化 URL 丢掉已计过的"]
    D --> CLU["同源聚类折扣<br/>同簇第 n 条 ×0.5^名次"]
    CLU --> VER["核验夹紧<br/>URL 不在真实搜索轨迹 → |LLR|≤0.2"]
    VER --> TH["贝叶斯 log-odds 串联<br/>后验 = invLogit( logit(先验) + ΣLLR )"]
    TH --> ATTR["逐源 pp 归因<br/>每条把概率从 A 推到 B"]
    ATTR --> WHY["why-changed 分解 + 确认比"]
    WHY --> PS[("持久化 state.json + report.md")]
```

> 红线：**引擎拥有那个数**。agent 只给"每条信源多强、朝哪边"（LLR），概率由引擎确定性算出——所以每一次移动都可追溯、不会被凭空捏造。

## 3. 状态机（一次预测的生命周期）

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
    open --> open: 本轮移动 ≥1pp 且有新证据
    open --> conv: 本轮移动 < 1pp
    open --> nni: 没有新证据 / 反思
    open --> maxr: 到达轮数上限
    open --> ab: agent 输出非法（重试后仍失败）
    conv --> sum
    nni --> sum
    maxr --> sum
    sum --> [*]: 输出 report.md + state.json
    ab --> [*]
```

## 关键机制对照（讲解用）

| 环节 | 防的是什么问题 |
| --- | --- |
| ② 怀疑式审计 | 给"错的问题"算出漂亮答案（判定标准写偏） |
| ③ 自估先验 | 起点盲目 0.5，对真实基率 10%/85% 的事只能靠运气 |
| 反证搜索 | 只搜支持现有倾向的证据 → 自我说服棘轮 |
| 聚类折扣 | 一条新闻被 5 家转载，被当 5 条独立证据 |
| 核验夹紧 | agent 编造一个没真访问过的 URL，照样推动概率 |
| 反思（带护栏） | 旧信源已过时/被推翻，却一直焊在概率里 |
| 引擎拥有数字 | agent 直接给概率 → 不可追溯、可能脑补（demo 问题） |

---

### 纯文本版（无法渲染 Mermaid 时直接用）

```
用户 prompt（二元事件）
   │
   ▼
① 框定 ─► ② 审计 ─► ③ 自估先验 ──► 可预测？──否──► 要求澄清·停止
                                      │是
                                      ▼
                          用先验 seed P(是)（非 0.5）
                                      │
          ┌───────────────── 第 k 轮 ◄─────────────────┐
          ▼                                            │
   联网搜索(新证据 + 反证)                               │
          ▼                                            │
   每源: 立场 + LLR + cluster_id                        │ 否→下一轮
          ▼                                            │
   反思(回调旧源, 带护栏)                                 │
          ▼                                            │
   引擎更新: 去重 ► 聚类折扣 ► 核验夹紧                    │
            ► log-odds 串联 ► 逐源 pp 归因 ► why-changed │
          ▼                                            │
        停止? ───────────────────────────────────────-─┘
          │ 收敛 / 无新信息 / 封顶(默认3轮)
          ▼
④ 收尾总览(结论 + 正反因素 + 不确定性)
          ▼
   输出: report.md + state.json
```
