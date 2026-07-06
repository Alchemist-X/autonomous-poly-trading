# Forecast Engine 推荐流程 Prompt 评审（一次跑 3 个市场推荐）

> **落地状态（2026-07-02）**：第 6 节建议 1-5、7 已实现（用户指示「prompt 引导思考、harness 保证正确性」）——B/C/D/A 四处 prompt 重写、确定性解析闸门（`assessPulseReportParseability`）、Top 3 改上限、SKILL.md 配方降级为默认值。建议 1 的完整「结构化对象接口」未做（保留正则接口 + 渲染时闸门作为第一步）；E/F vendored 模板审计缺口仍在。DeepSeek A/B 实证见 [`forecast-house-style.md`](../forecast-house-style.md) 第 6 节。

> 评审目标：检查 `forecast:recommend`（一次性产出 Top 3 市场推荐）这条链路上**所有 prompt**，判断它们是否**过度限制了模型行为**。
> 前提立场（用户给定）：模型能力很强，除了**大方向**和**风控 guardrail** 该明确引导，其余推理细节都不应该写死。
>
> 评审日期：2026-06-17 · 评审对象 commit：当前 `main`（84d60ae 之后）
> 语言状态：中文为主文件，**英文副本待同步翻译**。

---

## 0. 先看这里（人类 review 入口）

如果只想核对结论，按这个顺序打开 5 个文件，对照本评审第 5 节：

1. [`vendor/repos/polymarket-market-pulse/polymarket-market-pulse-zh/SKILL.md`](../../../vendor/repos/polymarket-market-pulse/polymarket-market-pulse-zh/SKILL.md) — **头号问题源**。7 步方法论，把贝叶斯更新幅度、edge 分档、排序公式、Kelly 比例全部写死。
2. [`services/orchestrator/src/pulse/full-pulse.ts:900`](../../../services/orchestrator/src/pulse/full-pulse.ts#L900) — 报告渲染 prompt（market-scan 变体），强制章节清单 + 「默认只用已给上下文，不要额外查证」。
3. [`services/orchestrator/src/runtime/pulse-entry-planner.ts:229`](../../../services/orchestrator/src/runtime/pulse-entry-planner.ts#L229) — **结构性瓶颈**：用正则从报告里抠 `| Yes | 市场价 | AI% |` 两个数字，模型的全部推理最终只剩这一个概率单元格能影响交易。
4. [`skills/probability-analysis/SKILL.md`](../../../skills/probability-analysis/SKILL.md) — **正面范例**：给方向 + 禁止事项，不写死数字。可作为重写 #1 的模板。
5. [`docs/risk-controls.md`](../../../docs/risk-controls.md) — guardrail 层，**该硬就硬**，不要动。

一句话结论：**风控 guardrail 层校准得很好（该硬的地方硬），但「方法论 / 报告」层把模型当成填表器在用——既写死了本应由强模型自己判断的量化推理（更新幅度、排序公式、Kelly），又通过下游正则把模型的决策权压缩成「填一个概率百分比」。** 这正是「限制过死」。

---

## 1. 评分标准：自由度校准分（1–10）

分数越高 = 越符合「给大方向 + guardrail，把推理留给模型」的理想；越低 = 越在微观层面替强模型做决定。

| 分段 | 含义 |
| --- | --- |
| **9–10** | 只定方向与硬边界（风控、禁止造假、输出契约），推理过程完全交给模型。 |
| **7–8** | 基本健康；有少量不必要的规定，但不伤害核心推理自由。 |
| **5–6** | 明显有冗余约束；规定了一些本该模型自己决定的结构/取舍。 |
| **3–4** | 过度限制；把量化判断、方法论步骤写成固定配方，强模型被降级为执行器。 |
| **1–2** | 严重过度限制；模型实际只剩「按模板填空」的空间。 |

> 注意：**guardrail 类 prompt 分数高 ≠ 它「自由」**，而是「它该硬，且硬得恰当」。风控文档拿 9 分，是因为它正确地只管硬边界、且明说自己是硬规则。

---

## 2. 流程地图：这条链路上到底有哪些 prompt

`forecast:recommend` = `scripts/pulse-live.ts --recommend-only`。默认决策策略是 **`pulse-direct`**（`config.ts:181`），**它是确定性代码，不是 LLM**。链路上真正喂给模型的 prompt：

```
fetch_markets.py (确定性抓取)
   ↓
[LLM] 预筛 prescreen        ← prompt A（可选）
   ↓
web-search (确定性模板 query，非 LLM)
   ↓
[LLM] full-pulse 报告渲染   ← prompt B（wrapper）
        └─ 强制先读：prompt D（pulse SKILL 7 步）
                       prompt E（output-template，vendored）
                       prompt F（analysis-framework，vendored）
   ↓
entry-planner 正则解析 (确定性) ← 结构性瓶颈 K
   ↓
decision-composer (确定性)
   ↓
recommend-only：到此为止，写 recommendation.json
```

- **默认路径（pulse-direct）上唯一的 LLM 推理点是「预筛 + 报告渲染」。** 报告写完之后，方向、edge、Kelly 仓位全部由代码从报告里**正则抠数字**重算。
- **`provider-runtime` 的 LLM 决策 prompt（prompt H）是 legacy 路径**（`AGENT_DECISION_STRATEGY=provider-runtime` 才走），默认不跑，但仍属本流程的一部分，一并评。
- `position-research.ts` / `position-review.ts` 经核实是**确定性代码**，没有内联 LLM prompt，不计入。
- prompt G（probability-analysis）/ prompt I（daily-pulse）/ prompt J（risk-controls）作为 agent skill / guardrail 文档进入上下文，一并评。

---

## 3. 打分总表

| # | Prompt | 位置 | 角色 | 默认路径? | 分数 | 主要问题 |
| --- | --- | --- | --- | --- | --- | --- |
| A | 预筛分类 | `pulse-prescreen.ts:68` | 候选粗筛 | 是 | **7** | 轻量；SKIP 判据内置了「已被有效定价」先验 |
| B | full-pulse 报告 wrapper（扫描） | `full-pulse.ts:900` | 报告渲染指令 | 是 | **6** | 强制长章节清单 + 「别额外查证」 |
| C | full-pulse 报告 wrapper（持仓） | `full-pulse.ts:839` | 持仓复审报告 | 否(positions) | **6** | 同上家族；逐仓表格格式锁死 |
| D | **pulse SKILL 7 步方法论** | `…/polymarket-market-pulse-zh/SKILL.md` | 核心方法论 | 是 | **4** | 写死更新幅度/edge 分档/排序公式/Kelly/No 配额 |
| E | output-template（vendored） | `…/references/output-template.md` | 输出结构模板 | 是 | **5\*** | 结构锁死；**内容不在仓库**，无法逐字审 |
| F | analysis-framework（vendored） | `…/references/analysis-framework.md` | 详细方法论 | 是 | **4\*** | 推测放大 D 的数字配方；**内容不在仓库** |
| G | probability-analysis SKILL | `skills/probability-analysis/SKILL.md` | 概率方法论 | skill | **8** | 范例级：给方向+禁止事项，不写死数字 |
| H | provider-runtime 决策 prompt | `provider-runtime.ts:324` | LLM 下单决策(legacy) | 否(legacy) | **7** | 多为 guardrail；输出形状有少量硬规定 |
| I | daily-pulse SKILL | `skills/daily-pulse/SKILL.md` | 操作/命令指引 | skill | **8** | 操作类指令，规定得当 |
| J | risk-controls 文档 | `docs/risk-controls.md` | 风控硬规则 | guardrail | **9** | 该硬就硬，校准恰当，**勿动** |
| K | （结构性）entry-planner 正则接口 | `pulse-entry-planner.ts:229` | 模型→决策接口 | 是 | **2** | 模型决策权被压成「填概率单元格」 |

\* E/F 内容被 `pnpm vendor:sync` 同步、`vendor/repos` 已 gitignore，本地 worktree 只有 `SKILL.md`，模板正文缺失 → 这是**审计缺口**（见第 7 节）。分数为基于其「角色 + 被引用方式」的暂定值。

平均（A–J 计入打分的 prompt）≈ **6.4**。但平均分会掩盖问题：**guardrail 层（J=9, I=8, G=8, H=7）拉高了均值，而真正决定推荐质量的「方法论 + 报告 + 接口」层（D=4, F=4, K=2, E=5, B=6）系统性偏低。**

---

## 4. 头号发现：最硬的约束不在任何 prompt 文字里，而在「正则接口」(K)

这是整份评审最重要的一点，请优先看。

模型写完报告后，[`pulse-entry-planner.ts:229`](../../../services/orchestrator/src/runtime/pulse-entry-planner.ts#L229) 用这条正则把概率抠出来：

```js
const regex = /^\|\s*(Yes|No)[^|]*\|\s*([0-9.]+)%\s*\|\s*([0-9.]+)%\s*(?:\|.*)?$/gim;
```

之后**方向、edge、1/4 Kelly、仓位**全部由代码用抠出来的 `ai_prob / market_prob` 重算（`risk-controls.md` 第三节也明说「Markdown 里的建议仓位只作人工审计，不可信」）。

**含义：无论模型多强、推理多精彩，它对最终交易的实际影响 = 在那张表格里填的一个 AI 概率百分比。** 证据链、条件概率分解 `P(A)×P(B|A)`、置信区间、四维分析、它对仓位的判断——全部不进入决策，只是给人看的散文。

- 这比任何 prompt 措辞都更彻底地「限制过死」，而且是**结构性**的，光改 prompt 文字改不掉。
- 它也解释了为什么 D 把 Kelly/edge 公式写死：因为下游本来就要在代码里重算，prompt 只是在复述代码的口径。

**这是最高杠杆的改动点（见第 6 节建议 1）。**

---

## 5. 逐 Prompt 详评

### A · 预筛分类 prompt — 7/10
`pulse-prescreen.ts:68`｜默认路径｜可选粗筛

- **做什么**：让模型把每个候选一行判成 `TRADE|slug|理由` 或 `SKIP|slug|理由`。
- **合理引导**：任务清晰、格式可解析；漏判默认 `TRADE`（保守，不误杀）。轻量、低成本，定位恰当。
- **过度限制**：SKIP 判据内置了 "already efficiently priced" 这个**先验结论**——强模型恰恰可能在「看起来已被有效定价」的市场里找到 edge。作为会默认放行的粗筛，危害有限。
- **建议**：保留。把 SKIP 判据从「断言已被有效定价」改为「你判断没有可研究的信息差」，把判断权还给模型。

### B · full-pulse 报告 wrapper（市场扫描）— 6/10
`full-pulse.ts:900`（zh）/ `:930`（en）｜默认路径｜核心 LLM 触点

- **做什么**：包裹层，要求模型先读 3 个 skill 文件，再按规定产出报告。
- **合理引导**：「缺数据要标注未获取、不得编造」（item 7）、「必须用 web_search 字段」（item 8）——这些是 guardrail，保留。
- **过度限制**：
  - item 5/6 的**强制章节清单**很长（候选池、推荐摘要、Top 3、概率评估、证据链、四维分析、结算规则、推理逻辑、仓位建议、评论区校验、信息源、元数据）。其中只有「概率表」是下游正则真正需要的，其余是产品一致性诉求，但对强模型是结构枷锁。
  - **item 10（zh）/ 9（en）最伤**：「默认只使用已提供的研究上下文；只有…才允许做**极少量**定向补充核验。」——直接压制强模型自主补研究的能力，与「用强模型」自相矛盾。
- **建议**：把强制章节缩到「可解析核心（概率表 + 方向 + 结算口径）」+「自由推理区」；删掉/反转 item 10，改为「鼓励在证据不足时自主补充检索」。

### C · full-pulse 报告 wrapper（持仓复审）— 6/10
`full-pulse.ts:839`（zh）/ `:871`（en）｜持仓路径

- 与 B 同源。逐仓 `##` 章节 + `| Yes | 市场定价 | AI 估算 |` 表格格式锁死（item 7/8），同样是为下游正则服务。item 12「只允许极少量定向补充核验」同 B 的问题。
- **建议**：随 B 一起处理；持仓复审的「反向 edge 必须给」（item 8）是好规则，保留。

### D · pulse SKILL「7 步方法论」— 4/10 ⚠️ 头号 prompt 问题源
`vendor/repos/polymarket-market-pulse/polymarket-market-pulse-zh/SKILL.md`｜默认路径｜被 B 强制读取

这是塑造模型行为最强的一份 prompt，也是「限制过死」最集中的地方。

- **写死的量化配方（核心问题）**：
  - 「按顺序执行以下 7 个步骤，**不可跳过**」（L12）——把流程顺序锁死。
  - 贝叶斯更新幅度写死：「强证据：10-20% 偏移；中等：5-10%；弱：1-5%」（L137）——**这是强模型最该自己校准的判断，却被钉成固定数字**。
  - edge 分档写死（>20% 强 / 10-20% 中 / 5-10% 弱 / <5% 跳过，L156-159）。
  - 排序公式写死：`综合得分 = |Edge| × log10(Liquidity+1)`（L164）。
  - Kelly 比例写死：1/4 Kelly + `liquidity_cap = 0.10 × max_cost`（L257-264）。
  - **硬配额**：「必须专门选取 3-5 个 Yes<20% 且流动性>$50k 作为 No 扫描」（L48）、「Top 3 中应至少包含 1 个买 No」（L186）——bias 意识是对的，但「必须凑够」会逼出没有 edge 的仓。
- **本该保留的好引导（混在其中）**：A0 必须查 resolution source 当前状态（L104）、A1.5「禁止用无法溯源的事实主张作为主要证据」（L132）、longshot bias 提醒（L139）。这些是方向/guardrail，价值高。
- **问题本质**：把「真 guardrail」和「量化配方」揉在同一份文件里，导致强模型既被正确引导、又被错误地剥夺了量化判断权。
- **建议**：拆成两层——
  1. **保留**：资料溯源、resolution source 实时查验、禁止造假、longshot bias **提醒**（不是配额）。
  2. **降级为「默认值/参考」而非「必须」**：更新幅度、edge 分档、排序公式、Kelly 比例、No 配额——允许模型在写明理由时偏离。
  3. 「7 步不可跳过」改为「推荐的推理脚手架，可按事件特性调整顺序与深度」。

### E · output-template.md — 5/10（暂定，内容缺失）
`…/polymarket-market-pulse-zh/references/output-template.md`｜默认路径｜被 B 强制读取

- 锁定报告章节顺序与字段结构。**内容被 `pnpm vendor:sync` 同步、本仓库 gitignore 了 `vendor/repos`，worktree 里缺失**，无法逐字审。
- 结构（form）约束比推理（reasoning）约束危害小，但因与下游正则耦合，它实际把输出格式钉死。
- **建议**：(a) 把它纳入版本控制或在本仓库留一份快照，否则无法 review、也无法保证线上与本地一致（违反 CLAUDE.md §8）；(b) 模板只规定「机器要解析的部分」，其余留白。

### F · analysis-framework.md — 4/10（暂定，内容缺失）
`…/references/analysis-framework.md`｜默认路径｜被 B 强制读取

- A1/A2/B1/B2 详细方法论。同样**内容不在仓库**。从 D 已暴露的口径推断，它大概率进一步细化并放大 D 的数字配方。
- **建议**：同 E 先入库再审；审时重点看它是否把更多量化判断写死。

### G · probability-analysis SKILL — 8/10 ✅ 正面范例
`skills/probability-analysis/SKILL.md`｜agent skill

- **为什么高分**：它给的是**推理脚手架 + 禁止事项**，而**不写死数字**。
  - 工作流：理清定义 → 拆 2-5 个必要条件 → 列证据（带来源/日期/URL）→ 给证据定方向和权重 → 用条件概率 `P(A)×P(B|A)` 建模 → 贝叶斯更新 → 输出单一概率 + 80% 置信区间。
  - 禁止事项（L53-58）全是真 guardrail：不得用市场价倒推概率、不得把单方表态当正式协议、不得编造来源、不得只说「可能/不可能」而不给具体数。
- **唯一的轻度过约束**：强制每个事件都做 `P(A)×P(B|A)` 条件分解——有些事件并不天然可分解。可改为「适用时分解」。
- **结论**：这份就是 D 应该长成的样子。**建议用它作为重写 D/F 的模板。**

### H · provider-runtime 决策 prompt — 7/10
`provider-runtime.ts:324`（zh）/ `:379`（en）｜legacy 路径（默认不跑）

- **做什么**：让模型输出 `TradeDecisionSet` JSON（open/hold/skip/close/reduce）。
- **合理引导（大多是 guardrail）**：风险标记→禁止 open（rule 3）、open 的 token_id 必须来自 pulse 候选（rule 4）、notional≤bankroll（rule 6）、沙盒「不要扫描无关文件/跑测试/改代码」——对一个有 shell 的执行 agent 是恰当的安全边界。
- **轻度过约束**：rule 8/9/10 规定输出形状（必须为每个被拒候选输出带 thesis 的 skip、必须为每个持仓输出 hold/close/reduce）——为可审计性可接受，但偏啰嗦。
- **结论**：作为**决策 guardrail 层**校准得不错；它的职责是守边界而非推理。保留，措辞可精简。

### I · daily-pulse SKILL — 8/10
`skills/daily-pulse/SKILL.md`｜操作指引

- 规定跑哪个命令、默认 env、默认模式、跑完要汇报什么。这是**操作编排**，不是推理 prompt，规定得当且必要。与「过度限制推理」无关。保留。

### J · risk-controls.md — 9/10 ✅ guardrail 标杆
`docs/risk-controls.md`｜风控硬规则

- 停机回撤 20%、单仓止损 30%、敞口/笔数/单笔上限、provider 输出契约、FOK only、低于最小额必须丢弃不得反向加仓……
- 开篇即声明「**这份文档定义的是服务层硬规则，不是提示词建议**」——定位极清晰。
- **这正是用户要的「风控 guardrail 该硬就硬」**。**不要动。** 扣 1 分仅因部分阈值（如敞口 50%）硬编码在文档，与 `.env` 可调默认值（CLAUDE.md 写单笔≤15%/总敞口≤80%）存在口径漂移，值得对齐，但不属于「过度限制模型」的范畴。

### K · entry-planner 正则接口（结构性）— 2/10
`pulse-entry-planner.ts:229`｜默认路径｜模型→决策接口

见第 4 节。这是模型决策权被压缩成「填一个概率单元格」的根因，是系统级的过度限制。

---

## 6. 建议改动清单（按杠杆排序）

1. **【最高杠杆 · 针对 K】拓宽「模型→决策」接口。**
   让报告渲染那一步直接产出**结构化对象**（概率、置信区间、条件模型节点、证据权重、建议方向与仓位理由），由确定性层消费；代码仍然拥有「按风控裁剪后的最终下注额」的最终权。这样模型的推理才真正进入决策，而不是被正则抠掉。**改这一处，等于一次性松开 B/C/D/E 里大量「为喂正则而存在」的格式约束。**

2. **【针对 D/F】把「量化配方」从「必须」降级为「默认值 + 可说明偏离」。**
   更新幅度、edge 分档、排序公式、Kelly 比例、No 配额——全部改为「默认这样，模型可在写明理由时调整」。保留 resolution source 查验、禁止造假、longshot **提醒**。

3. **【针对 B/C】删除/反转「默认只用已给上下文、不要额外查证」。**
   改为鼓励强模型在证据不足时自主补充检索（在成本预算内）。

4. **【针对 D】把「7 步不可跳过」改为「推荐脚手架，可按事件调整」。**

5. **【针对「Top 3」固定数】把推荐数从写死的 3 改为「edge 达标者，至多 N 个」。**
   现在「3」既写死在 prompt（B item 12、D L173）又写进 skill description。固定 3 个会两头受损：凑数纳入弱 #3、或砍掉强 #4。

6. **【针对 E/F · 审计缺口】把 vendored 模板纳入版本控制或在仓库留快照**，否则无法 review、也无法保证线上=本地（CLAUDE.md §8）。

7. **【针对 D 重写】以 G（probability-analysis）为模板**重写 pulse 方法论：方向 + 禁止事项 + 推理脚手架，不写死数字。

8. **【勿动】J（风控）、H 的 risk 类 hard rules、G 的禁止事项**——这些是用户明确要保留的 guardrail。

---

## 7. 待办 / 审计缺口

- [ ] E/F（output-template.md、analysis-framework.md）正文不在仓库（`vendor/repos` 被 gitignore，靠 `pnpm vendor:sync`）。**本评审对 E/F 仅基于其角色与被引用方式给暂定分**；需 `pnpm vendor:sync` 后补审正文，确认是否进一步写死量化判断。
- [ ] J 中的敞口阈值（50%/5%）与 CLAUDE.md 记录的 env 默认（80%/15%）口径漂移，建议对齐到单一来源。
- [ ] 本文件为中文主文件，**英文副本 `2026-06-17-forecast-prompt-review.en.md` 待同步翻译**。

---

## 8. 一句话总评

**风控 guardrail 层（J/I/G/H）校准得当，体现了「该硬就硬」；真正拖累推荐质量的是「方法论(D/F) + 报告(B/C) + 正则接口(K)」这条链——它把一个强模型的量化判断写成固定配方，又用正则把它的决策权压成一个概率单元格。** 想发挥强模型的能力，按第 6 节先改 K（拓宽接口），再以 G 为模板重写 D。
