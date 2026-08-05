import type { PaperSnapshot } from "../../lib/live-predict-raven/snapshot";
import { deriveReportStats } from "../../lib/live-predict-raven/stats";
import { EquityChart } from "./equity-chart";
import { fmtSignedPct, fmtSignedUsd, fmtUsd } from "./format";
import {
  BrierTable,
  ClosedTradesTable,
  EquityTable,
  ExitAlphaTable,
  OpenPositionsTable,
  ParamsTable
} from "./report-tables";
import styles from "./report.module.css";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <strong className={`${styles.tileValue} ${tone ? styles[tone] : ""}`}>{value}</strong>
      {sub ? <span className={styles.tileSub}>{sub}</span> : null}
    </div>
  );
}

const fmtUtcMinute = (iso: string): string => (iso.length >= 16 ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : iso);

export function PaperReport({
  snapshot,
  dataSource
}: {
  snapshot: PaperSnapshot;
  dataSource: "live" | "baked";
}) {
  const s = snapshot;
  const { trade, equity, openBook } = deriveReportStats(s);
  const rawDays = Math.round((Date.parse(s.lastEvalCycleUtc) - Date.parse(s.startedUtc)) / 86_400_000);
  const runDaysLabel = Number.isFinite(rawDays) ? `${Math.max(1, rawDays)} 天` : "—";
  const payoffRatio =
    trade.avgWinUsd > 0 && trade.avgLossUsd > 0 ? (trade.avgWinUsd / trade.avgLossUsd).toFixed(2) : "—";
  const effectiveOpens = Math.max(0, s.fills.buys - s.droppedBuyFills);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.kicker}>Tokyo VM · services/paper-agent · 私有复盘页</span>
        <h1 className={styles.title}>Polymarket 模拟盘复盘</h1>
        <p className={styles.meta}>
          $10,000 本金 · Claude evaluator（联网搜索）· 每日 UTC 02/10/18 三轮评估 · 单仓 $500 ·
          仅 finance / geopolitics / tech 三类市场
        </p>
        <p className={styles.meta}>
          数据截至 <strong>{fmtUtcMinute(s.lastEvalCycleUtc)}</strong>（第 {s.evalCycles} 个评估周期）· 反思报告{" "}
          {fmtUtcMinute(s.reflectionReportUtc)} ·{" "}
          {dataSource === "live" ? (
            <strong>实时数据（每个评估周期后自动更新）</strong>
          ) : (
            <strong>快照回退——实时数据暂不可用，显示 {s.generatedAtUtc.slice(0, 10)} 留档</strong>
          )}
        </p>
      </header>

      <section className={styles.section} aria-labelledby="sec-headline">
        <h2 id="sec-headline" className={styles.sectionTitle}>
          总览
        </h2>
        <div className={styles.tiles}>
          <Tile
            label="总权益"
            value={fmtUsd(equity.currentUsd)}
            sub={`${fmtSignedPct(equity.returnPct)} vs 本金 · ${runDaysLabel}`}
            tone={equity.returnPct >= 0 ? "pos" : "neg"}
          />
          <Tile
            label="已平仓胜率"
            value={`${trade.wins}/${trade.closedCount} = ${trade.winRatePct.toFixed(1)}%`}
            sub={`${trade.wins} 胜 ${trade.losses} 负（按回合）`}
          />
          <Tile
            label="已实现盈亏"
            value={fmtSignedUsd(s.realizedPnlUsd)}
            sub="已平仓回合与结算的累计净额"
            tone={s.realizedPnlUsd >= 0 ? "pos" : "neg"}
          />
          <Tile
            label="浮动盈亏"
            value={fmtSignedUsd(openBook.unrealizedUsd)}
            sub={`${openBook.positionCount} 仓：${openBook.green} 绿 ${openBook.flat} 平 ${openBook.red} 红`}
            tone={openBook.unrealizedUsd >= 0 ? "pos" : "neg"}
          />
        </div>
        <div className={styles.tiles}>
          <Tile
            label="总成交"
            value={`${s.fills.total} 笔`}
            sub={`${s.fills.buys} 买 + ${s.fills.sells} 卖（含分批成交）· 有效开仓 ${effectiveOpens} 次`}
          />
          <Tile
            label="平均盈 / 亏"
            value={`${fmtSignedUsd(trade.avgWinUsd)} / ${fmtSignedUsd(-trade.avgLossUsd)}`}
            sub={`盈亏比 ${payoffRatio} · profit factor ${Number.isFinite(trade.profitFactor) ? trade.profitFactor.toFixed(2) : "∞"}`}
          />
          <Tile
            label="最大回撤"
            value={fmtSignedPct(equity.maxDrawdownPct)}
            sub={`峰值 ${fmtUsd(equity.peakUsd)}（${equity.peakDate}）之后的最深回落`}
            tone="neg"
          />
          <Tile
            label="现金"
            value={fmtUsd(s.cashUsd)}
            sub={`占总权益 ${openBook.cashSharePct.toFixed(1)}% · 累计费用 ${fmtUsd(s.feesUsd)}（按 CLOB 逐市场费率）`}
          />
        </div>
        <p className={styles.callout}>
          一句话：{equity.returnPct >= 0 ? "赚了" : "亏了"} {Math.abs(equity.returnPct).toFixed(1)}%
          ——已平仓 {trade.closedCount} 回合 {trade.wins} 胜 {trade.losses} 负（胜率{" "}
          {trade.winRatePct.toFixed(1)}%），平均单笔亏损（{fmtUsd(trade.avgLossUsd)}
          ）约为平均单笔盈利（{fmtUsd(trade.avgWinUsd)}）的{" "}
          {trade.avgWinUsd > 0 ? (trade.avgLossUsd / trade.avgWinUsd).toFixed(1) : "—"} 倍。
          {s.realizedPnlUsd < 0 ? "已实现部分整体为负数。" : ""}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="sec-equity">
        <h2 id="sec-equity" className={styles.sectionTitle}>
          权益曲线（每日反思快照 + 最新评估点）
        </h2>
        <div className={styles.chartWrap}>
          <EquityChart curve={s.equityCurve} bankrollUsd={s.bankrollUsd} />
        </div>
        <p className={styles.sectionNote}>
          复盘注（2026-08-05）：两段行情。7/14 冲到峰值 +8.0%（$10,799）后靠浮盈横盘到
          7/24；7/25 起连续下台阶——11 天里 10 次止损，几乎全是以伊停火题材，8/4 跌到
          $8,112，自峰值最大回撤 −26%。
        </p>
        <details className={styles.details}>
          <summary>查看逐日数值表</summary>
          <EquityTable curve={s.equityCurve} />
        </details>
      </section>

      <section className={styles.section} aria-labelledby="sec-closed">
        <h2 id="sec-closed" className={styles.sectionTitle}>
          已平仓 {trade.closedCount} 回合：{trade.wins} 胜 {trade.losses} 负
        </h2>
        <ClosedTradesTable trades={s.closedTrades} />
        <p className={styles.callout}>
          复盘注（2026-08-05）：7/24 时"4 胜 2 负"的结构已被 7/26–8/4 的止损串彻底改写——新增 11
          回合里 10 次止损。7/24 复盘提出的"止损后同市场冷却期"未落地，同样的错误以更大规模重演："以伊停火延续至
          7/31"同一市场三进三止损（合计 −$601），"美伊 7/31 有效停火"二进二止损（−$400）。最贵的一笔是英伟达：0.22 买
          YES 一天后止损，市场最终以 YES 结算（反事实 α −$1,838）。唯一亮点：霍尔木兹 7/31 被 saturated-hold
          护着持有到临近结算，+$170 落袋。
        </p>
      </section>

      <section className={styles.section} aria-labelledby="sec-open">
        <h2 id="sec-open" className={styles.sectionTitle}>
          在持 {openBook.positionCount} 仓：浮盈 {fmtSignedUsd(openBook.unrealizedUsd)}
        </h2>
        <OpenPositionsTable positions={s.openPositions} />
        <p className={styles.sectionNote}>
          ⚠ 饱和 = 引擎概率打到 99% 上限，edge 为下限值而非精确判断；⛔ 污染 =
          该预测被检测到引用了市场价格，不作为开仓/退出依据。现价 = 各仓最近一次评估时的 bid
          mark，随每次评估周期更新。
        </p>
        <p className={styles.callout}>
          复盘注（2026-08-05）风险集中：满仓 10/10，全是地缘政治 NO，其中五仓共享"伊朗局势"单一驱动（霍尔木兹
          ×2 + 核协议 + 入侵伊朗 + 解除封锁）——正是这个题材在 7 月末打穿了已平仓账。亮点仍是霍尔木兹
          12/31：市场定价 72% 会恢复通航时逆势买 NO @ 0.28，现价 0.38（+$179），是唯一在赢的真正逆市场立场（未结算）。8/4
          新开的"解除封锁"仓一天浮亏 −$116，是当前最大的红仓。
        </p>
      </section>

      <section className={styles.section} aria-labelledby="sec-quality">
        <h2 id="sec-quality" className={styles.sectionTitle}>
          预测与执行质量
        </h2>

        <h3 className={styles.subTitle}>退出质量：α 合计 {fmtSignedUsd(s.exitAlpha.totalUsd)}</h3>
        <p className={styles.sectionNote}>
          α = 卖出所得 −（若持有到现在/结算的价值），正数 = 卖对了。
          {s.exitAlpha.totalUsd >= 0
            ? "合计为正：退出决策整体加分。"
            : "合计为负：退出决策整体在减分。"}{" "}
          复盘注（2026-08-05）：合计从 7/24 的 +$1,077 转负——英伟达（止损后市场以 YES 结算，−$1,838）与哈马斯（止损后
          NO 价反弹近 4 倍，−$869）两笔反事实巨亏，压过了停火系列止损救回的约 +$1,400。
        </p>
        <ExitAlphaTable rows={s.exitAlpha.rows} />

        <h3 className={styles.subTitle}>
          校准（Brier）：skill score {s.brier.skillScore.toFixed(2)}，n={s.brier.n}
        </h3>
        <p className={styles.sectionNote}>
          skill score = 1 − Brier_agent / Brier_market，&gt;0 才算跑赢市场。当前为负（agent {s.brier.agentScore.toFixed(3)} vs 市场{" "}
          {s.brier.marketScore.toFixed(3)}，n={s.brier.n}）。复盘注（2026-08-05）：7/31
          结算潮后样本首次够量，初步结论是 agent 落后于市场——大额失分集中在以伊停火系列（对"停火延续"的方向判断与结果相反）与"停止对伊军事行动"（agent
          15% vs 市场 94%，事件发生）。
        </p>
        <BrierTable rows={s.brier.rows} />

        <h3 className={styles.subTitle}>引擎与执行</h3>
        <ul className={styles.list}>
          <li>
            {s.engineQuality.evaluations} 次评估中 {s.engineQuality.saturated} 次饱和（
            {Math.round((s.engineQuality.saturated / s.engineQuality.evaluations) * 100)}%）、
            {s.engineQuality.contaminated} 次检测到市场价格污染、{s.engineQuality.evalErrors} 次评估错误（均
            fail-safe 为 hold）。
          </li>
          {s.engineQuality.limitVsMarketPp !== null ? (
            <li>
              混合退出：限价腿较市价腿平均改善 +{s.engineQuality.limitVsMarketPp.toFixed(2)}pp（限价单挂出{" "}
              {s.engineQuality.limitOrdersPlaced} 次、分批成交 {s.engineQuality.limitFills} 笔）。方向正确，幅度小。
            </li>
          ) : null}
          <li>
            饱和持有拦截 <strong>{s.saturatedHolds}</strong> 次——saturated-hold 修复（PR #91）阻止 99%
            钳位把接近满值的赢家提前卖掉，改为持有到结算。
          </li>
          <li>
            累计费用 {fmtUsd(s.feesUsd)}：早期地缘市场费率均为 0 bps，7 月下旬起部分新市场（英伟达、马杜罗）带真实费率——英伟达回合
            $45 入场费 + $23 卖出费已计入该回合成本与盈亏。
          </li>
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="sec-params">
        <h2 id="sec-params" className={styles.sectionTitle}>
          运行参数
        </h2>
        <p className={styles.sectionNote}>
          {dataSource === "live"
            ? "实时读取自 VM 环境配置（env 可调默认值，调整须经用户确认）。"
            : "留档快照值（VM 暂不可达）；参数以 VM 环境配置为准。"}
        </p>
        <ParamsTable config={s.config} />
      </section>

      <section className={styles.section} aria-labelledby="sec-verdict">
        <h2 id="sec-verdict" className={styles.sectionTitle}>
          结论与建议（2026-08-05 复盘）
        </h2>
        <ul className={styles.list}>
          <li>
            <strong>亏损构成：</strong>−20% ≈ 已实现 −$2,114（12 个负回合、其中 10
            次止损）+ 浮盈 +$134 的微弱缓冲。7 月上旬收权利金攒下的 +8%
            浮盈，在 7/25 后的止损串里全部回吐并转亏。
          </li>
          <li>
            <strong>与基准：</strong>Brier skill −0.53（n=12）——首批足量样本显示独立判断整体落后市场。7/24
            时"贴市场小修正稳定小赚"的通道，在短到期、高波动的停火系列上失效：agent 反复给出与市场大幅背离的方向判断，结果站在错的一边。
          </li>
          <li>
            <strong>建议 ①（7/24 已提、仍未落地，代价已现）：</strong>止损后对同市场/同事件加冷却期。以伊停火 7/31
            三进三止损（−$601）、美伊停火二进二止损（−$400）、哈马斯止损后 24 小时内重进（现持仓中）——全部是这一个缺口。
          </li>
          <li>
            <strong>建议 ②：</strong>题材级相关性敞口上限。事件级 maxPerEvent=1 没挡住停火/封锁/军事行动这组强相关市场同向暴露，7
            月末一个题材打穿整本账；当前在持 10 仓里仍有 5 仓共享伊朗驱动。
          </li>
          <li>
            <strong>建议 ③：</strong>止损规则与低价单适配。−35% 价格止损对 0.1–0.3
            区间的单子过于敏感（波动天然大），英伟达止损后市场以 YES 结算（α
            −$1,838）；考虑按剩余净 edge 退出而非纯价格回撤，或对低价单缩小仓位而不是收紧止损。
          </li>
        </ul>
      </section>

      <footer className={styles.footer}>
        <p>
          模拟盘——无真实订单、无真实资金。费用按 CLOB 逐市场实时元数据计（多数地缘市场为
          0，个别市场带真实费率，已计入回合成本）。金额合计与总权益之间存在 &lt;$1 的取整差（报告 mark 保留两位）。
        </p>
        <p>
          数据来源：raven-paper-agent-1 容器 portfolio.json / ledger.jsonl（{s.fills.total} 笔成交，其中 1
          笔买入被 7/3 账本锁竞争丢弃、现金已还原）与每日反思报告，经 VM forecast-api 只读端点在每次页面访问时拉取——
          agent 每次评估周期（review）落盘后，本页即反映最新状态；VM 不可达时回退到最近一次留档快照并在页顶标注。
        </p>
      </footer>
    </main>
  );
}
