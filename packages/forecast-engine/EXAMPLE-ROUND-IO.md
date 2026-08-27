# 每轮 输入 / 输出 示例（真实运行）

> **历史归档，不是当前接口契约。** 本例保留 2026-06 的真实运行记录，便于复盘旧引擎为何会把同一事实的多张网页分别计权。自 2026-08-27 的第一阶段改造起，当前输出使用 `new_claims`：一个原子事实断言包含按质量排序的 `sources` 数组，并且只产生一次概率更新；研究代理不再输出第二个整体概率。当前契约以 [`src/engine.ts`](src/engine.ts) 和 [`src/types.ts`](src/types.ts) 为准。

> 取自真实预测："OpenAI 2026 年底前会不会发布 GPT-6 家族模型？"
> 展示 agent 每轮**收到什么(输入)**、**返回什么(输出)**，以及**引擎据此算出概率**。
> 每轮 = 一次 `claude --print`，内部自由联网搜索/推理，最后吐一个结构化 JSON。

---

## Round 0 · 框定（先把问题和先验定下来）

**输出（框定结果）：**
- **问题**：OpenAI 是否在 **2026-12-31** 前，把官方命名属于 **"GPT-6" 家族**的模型公开放出？
- **结算标准**：预览/beta/API 可用即算 YES；`GPT-6 mini/Turbo/6.x` 算；`GPT-5.x`、`o6` 不算；仅"宣布/候补名单"不算。
- **自估基率先验**：**40%**（理由：GPT-6 已确认 2026 发布，但 OpenAI 多次把大版本号压住——"Spud"按能力不够改叫了 GPT-5.5，且偏好点版本号）

---

## Round 1

### ⬇️ 输入（给 agent 的 prompt，节选关键动态部分）

```
EVENT: OpenAI 是否在 2026-12-31 前发布 "GPT-6" 家族模型？
RESOLUTION: 预览/beta/API 可用即 YES；GPT-6.x/mini 算，GPT-5.x/o6 不算……
CURRENT ESTIMATE（本轮先验）: P(YES) = 40.0%
ROUND: 1 of 3
SOURCES ALREADY COUNTED: （无 —— 这是第一轮）

任务：① 联网找新证据  ② 必须做一次"反证"搜索  ③ 每条信源给 立场+强度
     ④ 给带符号 LLR（+偏YES/−偏NO）  ⑤ 同源的标同一个 cluster_id
     ⑥ 从当前先验出发移动  ⑦ 只引用真搜到的 URL  ⑧ 反思（可选）
输出：单个 JSON 对象
```

### ⬆️ 输出（agent 返回的 JSON，真实内容）

```json
{
  "round_summary": "证据多指向 OpenAI 会把大版本号压住继续走 5.x；但一个预测市场把年底前 GPT-6 定在 ~82%，明显高于 40% 先验。",
  "new_evidence": [
    {
      "claim": "本被预期是 GPT-6 的模型(代号 Spud)2026-04-23 以 GPT-5.5 名义发布，而非 GPT-6。",
      "source_url": "https://felloai.com/all-we-know-about-chatgpt-6/",
      "source_title": "ChatGPT 6 Release Date: Spud Shipped as GPT-5.5",
      "stance": "supports_no", "strength": "moderate", "llr": -0.5,
      "cluster_id": "five-x-cadence",
      "rationale": "OpenAI 连强模型都保留 GPT-6 名号，说明只会用于重大跨越。"
    },
    {
      "claim": "Polymarket 群体把年底前公开 GPT-6 定在 ~82%。",
      "source_url": "https://findskill.ai/blog/gpt-6-release-date/",
      "source_title": "GPT-6 Release Date: Spud=GPT-5.5, Real GPT-6 in Q4",
      "stance": "supports_yes", "strength": "strong", "llr": 0.9,
      "cluster_id": "prediction-markets",
      "rationale": "一个流动的预测市场直接押这个问题，远高于 40% 先验。"
    },
    {
      "claim": "下一款被预期是 GPT-5.6(代号 kindle-alpha)，延续 5.x 点版本。",
      "source_url": "https://www.techtimes.com/articles/318492/...",
      "source_title": "GPT-5.6: OpenAI Chief Scientist Calls It a Meaningful Leap",
      "stance": "supports_no", "strength": "weak", "llr": -0.2,
      "cluster_id": "five-x-cadence",
      "rationale": "连'有意义的跨越'都被标成 5.6，强化 5.x 节奏。"
    },
    {
      "claim": "约四分之一概率被押在 2027 或更晚。",
      "source_url": "https://polymarket.com/event/gpt-6-released-by",
      "source_title": "GPT-6 released by…? | Polymarket",
      "stance": "supports_no", "strength": "weak", "llr": -0.2,
      "cluster_id": "prediction-markets",
      "rationale": "一部分预测者认为会滑到 2026 后，抵消年底市场数字的上拉。"
    }
  ],
  "reflection": [],
  "agent_holistic_probability": 0.50,
  "confidence": "medium",
  "found_new_information": true,
  "notes": "下一轮核对：findskill 市场的'GPT-6'结算口径是否就是本题。"
}
```

### ⚙️ 引擎据此算（输出 → 概率）

- 去重：无 ｜ 聚类：`prediction-markets` 有 2 条 → 较弱那条 **×0.5 折扣**（防同源重复计数）
- 核验：4 条 URL 都在真实搜索轨迹里 ✓
- 贝叶斯串联：**40.0% → 49.2%**，逐源归因 `+16.9pp / −4.7pp / −1.7pp / −1.2pp`

---

## Round 2（注意输入变了：先验更新 + 列出已计信源）

### ⬇️ 输入（关键动态部分 —— 这就是"迭代"）

```
CURRENT ESTIMATE（本轮先验）: P(YES) = 49.2%   ← 上一轮的结果
ROUND: 2 of 3
SOURCES ALREADY COUNTED（不要重复计数；可对它们做反思）:
  - [supports_no, -4.7pp]  felloai.com/...        — Spud 以 GPT-5.5 发布
  - [supports_yes, +16.9pp] findskill.ai/...       — Polymarket ~82%
  - [supports_no, -1.7pp]  techtimes.com/...       — 下一款是 GPT-5.6
  - [supports_no, -1.2pp]  polymarket.com/...      — 约 1/4 押 2027+
```

### ⬆️ 输出（这一轮触发了反思 ↻）

```json
{
  "round_summary": "核对发现上一轮那个 82% 市场的结算口径比本题宽，做了回调；并补充两条延续 5.x 命名的证据。",
  "new_evidence": [
    {
      "claim": "本题按字面 'GPT-6' 名结算；OpenAI 结构性地不愿用大数字号。",
      "source_url": "https://overchat.ai/ai-hub/gpt-6-released-date",
      "source_title": "When Will GPT-6 Be Released: Everything You Need to Know",
      "stance": "supports_no", "strength": "moderate", "llr": -0.6,
      "cluster_id": "5x-cadence-naming", "rationale": "命名门槛压低 YES。"
    },
    {
      "claim": "近期下一款确认是另一个 5.x 点版本(GPT-5.6)。",
      "source_url": "https://www.geeky-gadgets.com/gpt-5-6-june-2026-release/",
      "source_title": "What to Expect from OpenAI's GPT-5.6 Release in June 2026",
      "stance": "supports_no", "strength": "weak", "llr": -0.2,
      "cluster_id": "5x-cadence-naming", "rationale": "占用近期发布档期。"
    }
  ],
  "reflection": [
    {
      "target_url": "https://findskill.ai/blog/gpt-6-release-date/",
      "llr_adjustment": -0.6,
      "reason": "那个 ~82% 来自结算口径更宽的市场(把任何'GPT-5 的公认后继'都算)，不是本题字面 GPT-6 —— 上一轮高估了它。",
      "new_source_url": "https://polymarket.com/event/gpt-6-released-by/will-gpt-6-be-released-by-june-30-2026"
    }
  ],
  "agent_holistic_probability": 0.35,
  "confidence": "medium",
  "found_new_information": true,
  "notes": "命名口径是关键变量。"
}
```

### ⚙️ 引擎据此算

- **反思**先执行：把上一轮 findskill 那条**回调 −5.0pp**（带护栏：必须有新引用、幅度夹紧、单独标 ↻）
- 再叠加 2 条新证据 → **49.2% → 35.3%**

---

## Round 3（概率趋稳 → 触发停止）

3 条新证据(其中 1 条来自**反证搜索**，结果反而小幅支持 YES：+3.9pp)，净移动只有 **35.3% → 33.7%**，<1pp 视为**收敛**，停止。

→ 进入 **收尾总览**：给出最终 **P(YES)=33.7%** + 正反因素 + 不确定性。

---

### 一句话看懂分工
> **agent 给判断**（每条证据：朝哪边 `stance`、多强 `strength/llr`、是否同源 `cluster_id`、为什么 `rationale`）；
> **引擎给数字**（去重 → 聚类折扣 → 核验 → 贝叶斯串联 → 逐源 pp 归因）。
> 概率永远由引擎算，所以每一步都可追溯、不会被 agent 凭空捏造。
