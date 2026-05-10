# Agent Swarm Trading — 单文件开发 Prompt（交给新 Agent）

> 用途：把下面 **`---START PROMPT---` 到 `---END PROMPT---`** 之间的全文复制给新的 coding agent，即可在无人值守前提下开始设计/实现。可根据黑客松时限删减「交付阶段」。

> **Pulse 仓库地址**：<https://github.com/Alchemist-X/autonomous-poly-trading>（`git clone https://github.com/Alchemist-X/autonomous-poly-trading.git`）

---

---START PROMPT---

## 0. 你的角色

你是资深全栈 + 链上集成工程师。需要在 **OKX Agentic Wallet**、**OKX OnchainOS（网关能力）** 与可选参考仓库 **Pulse 仓库** 的背景下，实现黑客松项目 **Agent Swarm Trading**：

- **Pulse 仓库（唯一指定，勿与其它项目混淆）**  
  - 网页：<https://github.com/Alchemist-X/autonomous-poly-trading>  
  - Git 克隆：`git clone https://github.com/Alchemist-X/autonomous-poly-trading.git`  
  - 仓库名：`Alchemist-X/autonomous-poly-trading`（本地目录常名为 `autonomous-poly-trading`）

在此基础上：用 **多账户（目标约 50 个）** 并行验证交易 idea，仅根据 **可观测结果**（PnL、回撤、成交质量、信号稳定性）做 **资金分配与淘汰**，使系统在行为上表现得像 **蜂群试错但整体收敛**。

## 1. 产品一句话

**Agent Swarm Trading**：元策略（单一调度器）不预测市场；它只读各子账户的客观绩效与执行质量，动态把有限资金拨给「更健康」的 idea 线路，并对劣质线路降权或暂停——演示 **规模化试错 + 选择压下的收敛**。

## 2. 你必须遵守的硬约束

1. **不可观测不可分配**：allocator 的输入只能来自链上/交易所 API 拉取的数据（成交、持仓、PnL、滑点估计、失败率、时序稳定性等）。禁止把「LLM 主观判断涨跌」作为资金权重依据（LLM 若存在，只能生成 **风格卡片参数** 或解释性报告，**不能直连资金开关**）。
2. **资金与风控**：总敞口上限、单账户上限、全局 `kill switch`、单笔上限必须可配置且在代码路径上不可绕过。
3. **合规与诚实表述**：多账户用于**策略科学实验平台**，不宣传「绕监管」或「女巫攻击」；文档与 demo 中写明测试环境（测试网 / 小额主网）假设。
4. **代码质量**：新代码注释英文；对人类说明文档中文为主（若仓库要求双语再补英文副本）。

## 3. 背景资料（只读理解，无需复刻 Pulse 仓库全量功能）

### 3.1 Pulse 仓库可借鉴的模式

- **官方地址（与 §0 一致）**：<https://github.com/Alchemist-X/autonomous-poly-trading> · `git@github.com:Alchemist-X/autonomous-poly-trading.git`（SSH）或 HTTPS 见 §0。
- **分层**：研究侧产出（Pulse 报告）→ 决策运行时 → 风控裁剪 → 执行 → 归档。你的 swarm 不必实现 Pulse 全文，但应复用其思想：**决策与资金分离**、**artifact 可追溯**、**终端可观测进度**。
- **可参考路径（若 monorepo 存在）**：
  - 编排与任务：`services/orchestrator`
  - 执行与下单 Worker：`services/executor`
  - 契约与决策 schema：`packages/contracts`
- **若黑客松代码独立新仓**：仅抽象复用概念（配置驱动、runId、归档目录、风控钩子），不要求强行 fork 全仓库。

### 3.2 OKX Agentic Wallet（能力假设，以实现时官方文档为准）

- 支持钱包生命周期：登录、OTP、多账户/地址体系、查询余额与资产、签名与发交易（含 EVM / Solana 等以你们绑定的为准）。
- **Swarm 核心诉求**：能编程方式在 **N 个账户** 间切换或并行会话，并对每笔操作 **可追溯审计**（至少：账户 id、链、币种、意图、tx hash）。

### 3.3 OKX OnchainOS / Gateway（能力假设）

- 交易广播前_gas/模拟_、广播、**交易确认追踪**；多账户批量操作时统一错误模型与重试策略。
- DEX / 市场数据若赛程允许：用于构造「成交质量」指标（滑点、深度、部分成交）。

## 4. 目标架构（最小可运行 → 可演示）

实现下列逻辑模块（名称可改，职能不能丢）：

| 模块 | 职责 |
|------|------|
| **TraderPool** | 维护 `N` 条「账户 + **风格卡片（Style Profile）**」：见 §4.1–§4.3。每条对人可读、底层为 **可计算过滤规则**（非散文策略）。 |
| **ExecutionAdapter** | 对接 Agentic Wallet：按账户执行下单/撤单/查仓（接口抽象，便于 mock）。 |
| **MetricsCollector** | 周期性拉取可观测指标，写入时序或滚动聚合（内存可，展示优先）。 |
| **Allocator** | 输入仅 `MetricsSnapshot`，输出每个账户下一周期的 **资金权重 / 是否暂停**。具体算法见 **§5**。 |
| **Orchestrator Loop** | `tick`：`collect → allocate → apply budget caps → execute (per account) → archive`。 |
| **Archive / Dashboard** | 每轮 `runId`：`metrics.json`、`allocation.json`、`stderr` 摘要；简单 Web 或 CLI 表格展示「蜂群仪表盘」。 |

### 4.1 人类可读风格（Style Profile）与因子库

每条账户绑定一种 **人话可讲清楚** 的假设，但实现上必须是 **因子 → 阈值/枚举**，禁止只靠自然语言。

| 因子 | 人话示例 | 客观定义（实现时数值可调） |
|------|----------|----------------------------|
| **流动性偏好** | 「只押低流动性」 | `liquidity_usd < L_max` 和/或 `depth_at_2pct_slippage < D_max` |
| **主题 / 垂直** | 「只做科技」 | `sector/tag ∈ {tech}`（来自市场元数据、分类 ID、关键词） |
| **方向 / 偏置** | 「多下注 NO、信 long-shot bias」 | 仅允许 `action ∈ {Buy No}`；或仅当 `p_yes < 0.2` 时进入候选（long-shot 宇宙） |
| **彩票 / 低价** | 「只买 <2c 的彩票」 | `best_ask < 0.02` 且满足最小可成交量；必须配 `min_liquidity` 防纯无法成交噪声 |
| **客观理性（硬规则）** | 「仍保持客观」 | **无订单簿快照 / 无规则摘要则禁止开仓**；数据不齐记 `no_trade`，勿与亏损成交混淆归因 |

**特殊风险提示（须在 metrics / 文档中体现）：**

- **低流动性**：冲击成本大、难平仓 → `成交质量` 权重提高，单账户 **notional 上限** 从严。
- **NO / long-shot 簇**：多账户可能 **同向相关** → 可选 **板块/相关簇敞口上限**。
- **<2c 彩票**：拒单、部分成交多 → 必须记录 **fill_rate**；避免「零成交却低回撤」的假安全。

### 4.2 批量生成：菜单组合 + 去相关

- 用少量 **轴** 组合成人话标签，例如：  
  **流动性** `{低, 中, 高}` × **主题** `{科技, 政治, 加密, 全市场}` × **方向** `{中性, NO 偏置, Yes 偏置}` × **价位带** `{彩票<2c, 低价<5c, 中价}`。  
- 一条风格 = 轴上取值组合，例如：`低流动性 × 科技 × NO 偏置 × 彩票<2c`。  
- **批量生成**：在笛卡尔积上 **枚举或随机抽样** 得到 `N` 条；对汉明距离过小的组合做 **扰动或去重**，避免 50 个账户测同一假设。  
- 可选：**10% 名额** 完全随机探索（探索未知组合），其余 **分层覆盖**（exploit 结构）。  
- **备选（与风格正交）**：同一母策略族内用 **参数向量** \(\theta\)（持有期、再平衡周期、阈值等）+ **LHS/Sobol** 在 \([0,1]^d\) 均匀采样后映射到档位，再经硬过滤、去相关；与「风格菜单」二选一或混用（混用时每条账户仍要一张可读 `human` 摘要）。

### 4.3 风格卡片 Schema（YAML 示例）

每条账户对应一张卡（**人类可读 + 机器可读**），例如：

```yaml
style_id: tech_no_lottery_v1
human: "科技市场，偏好 NO，仅考虑 Yes 侧隐含概率偏低段，单价上限 2c，偏低流动性池"
filters:
  sector: [tech]
  max_yes_price: 0.20      # long-shot 宇宙（与 analysis-framework 叙事一致时可调）
  max_ask_price: 0.02      # 彩票门槛
  max_liquidity_usd: 50000
  allowed_sides: [NO]
risk:
  max_notional_usd: 50
  max_dd: 0.35
gates:
  require_orderbook: true
  require_rules_summary: true
```

实现时：**filters/gates** 决定 *universe 与是否允许下单*；**Allocator（§5）** 只根据 metrics 决定 *给多少钱*。

### 4.4 风格与 Allocator 的职责边界

- **风格 / 因子 / 卡片**：定义 **交易宇宙与动作可行性**（假设检验的「实验条件」）。  
- **Allocator**：只根据 **可观测业绩与执行质量** 做 **资金融合与淘汰**；不得读取 `human` 字符串作为权重。  
- 可选公平性：指标上记录 **turnover、fill_rate**；高阶可做相对基准超额（MVP 可省略）。

## 5. Allocator 与融合算法（必须可实现、可测试）

### 5.1 可观测输入（每个账户 `i`、窗口 `W`）

- **PnL** \(r_i\)；可选风险调整分母 \(\sigma_i\)（净值或 PnL 序列波动）。
- **回撤** \(DD_i\)；若 \(DD_i > DD_{\max}\) → **强制淘汰**（权重 0，直至冷却结束）。
- **成交质量** \(q_i \in [0,1]\)：如由平均滑点、拒单率合成。
- **信号稳定性**：翻转率、或方向与下窗收益的相关（实现可简化）。

### 5.2 资金融合（默认主算法）：风险调整 + Softmax + 总资金约束

1. 风险调整得分（示例）：  
   \(\tilde{r}_i = \dfrac{r_i}{\max(\epsilon,\sigma_i)} \cdot q_i \cdot \mathbb{1}[DD_i \le DD_{\max}]\)  
2. 温度 Softmax：  
   \(u_i = \dfrac{\exp(\beta \tilde{r}_i)}{\sum_j \exp(\beta \tilde{r}_j)}\)（\(\beta\) 控制「赢家通吃」程度；demo 可调）。  
3. 单账户资金：  
   \(\text{cap}_i = \min(\text{cap}_{\text{per-account}},\, u_i \cdot C_{\text{total}})\)，再应用全局 kill switch。  
4. 可选：**淘汰账户探索池**——刚恢复交易的账户给最小权重 \(w_{\min}\)（如总资金 1% 档），避免永久冻死。

### 5.3 多臂老虎机（与 5.2 二选一或叠加）

- **Thompson Sampling** 或 **UCB**：每臂 = 一条账户线路；对 \(\tilde{r}_i\) 维护后验，采样后做 softmax 或直接分配；**固定随机种子**以便 demo 复现。  
- 可与 **5.2** 组合：**5.2 做安全裁剪，Bandit 做探索分配**（feature flag）。

### 5.4 同标的信号融合（可选模块）

当多账户对同一标的给出方向 \(d_i \in \{+1,-1,0\}\)：  
\(D = \operatorname{sign}\left(\sum_i w_i \, d_i\right)\)，其中 \(w_i \propto \max(0,\tilde{r}_i)^{\gamma}\)；\(|D|\) 低于阈值则不下单。业绩只进入 \(w_i\)，不进入各账户内部规则。

### 5.5 LLM 与参数化的边界

- **允许**：LLM 仅输出 **符合 schema 的风格卡片或 \(\theta\)**，经校验器通过后写入 TraderPool。  
- **禁止**：LLM 输出直接作为 Allocator 权重或是否下单的 **唯一** 依据。

## 6. 交付物清单（按黑客松时间删减）

**MVP（必须有）**

- 可配置 `N`（默认小到 3–5 用于本地跑通，演示切换到 50 为 **dry-run / paper** 或受控环境）。
- **风格卡片**（YAML/JSON）驱动过滤 + 一轮完整 loop 的日志 + JSON 归档。
- Allocator：**§5.2** 实现 + **§5.3** 之一（feature flag）。
- README：如何配置密钥占位、如何运行、**安全警告**。

**加分**

- 简单 UI：表格 + Sankey（资金从低分流向高分示意即可）。
- 「执行质量门控」：低质量账户禁止加资金，即使短期 PnL 高。
- **§5.4** 同标的加权投票。
- 与 Pulse 仓库的 **artifact** 兼容（若同 repo：`runtime-artifacts/swarm/<runId>/`）。

## 7. 技术执行建议

- 语言优先级：**TypeScript（Node 20+）** 与 Pulse 仓库生态一致；若独立脚本可用 Python，但需统一 JSON schema。
- **账户并行**：注意 rate limit；使用队列 + 抖动 + 指数退避；并行度可配置。
- **测试**：单元测 allocator（给定伪造 metrics，期望权重单调性/淘汰）；集成测用 mock Wallet；**风格过滤**单测给定市场列表期望子集。

## 8. 验收标准（新 Agent 自检）

- [ ] Allocator **从不**读取 LLM 文本或 `human` 字段作为资金权重输入。
- [ ] 任意账户超过 `DD_max` 后，下一 tick 权重为 0（除非显式「冷却解除」配置）。
- [ ] `TotalCap` 从未被超过；单次执行可证明截断。
- [ ] 同一输入 metrics，allocator 输出 **确定性**（bandit 除外需固定随机种子便于 demo 复现）。
- [ ] 归档路径与 `runId` 可追溯；风格卡片与账户映射可审计。

## 9. 明确非目标（不要做）

- 不做「保证盈利」或链上套利圣杯宣称。
- 不在无许可情况下实现恶意 MEV/女巫 farm 专门化逻辑。
- 不把 50 个账户硬编码私钥进仓库。

## 10. 启动时请先做（顺序）

1. 阅读本 prompt 全文；列出 **文件/目录计划** 与 **API 假设清单**（哪些必须查 OKX 文档确认）。
2. 搭 **mock** 整条 pipeline，再接真实 Wallet。
3. 实现 **风格过滤 →** Metrics → Allocator → 伪执行；最后替换 ExecutionAdapter。
4. 补齐 README 与安全说明；录制 2 分钟 demo 脚本大纲（**每条风格一句人话**）。

若上下文中有本仓库（<https://github.com/Alchemist-X/autonomous-poly-trading>），优先 **对齐其环境变量命名与终端日志风格**（`INFO/WARN/ERR`），但不强制依赖 Pulse 生成逻辑。

---END PROMPT---

---

## 附：给维护者

- **Pulse 参考仓库**：<https://github.com/Alchemist-X/autonomous-poly-trading>（`Alchemist-X/autonomous-poly-trading`）。
- 若并入本仓库：可将实现放在 `services/swarm-orchestrator/` 或独立 `apps/swarm-dashboard/`，并在根 `README` 加一节链接（按需）。
- 英文副本：若产品要求双语，复制本文件为 `Plan/agent-swarm-trading-agent-prompt.en.md` 并同步内容。

最后更新：2026-04-21
