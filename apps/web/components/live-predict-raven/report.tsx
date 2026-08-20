import type { PaperCases } from "../../lib/live-predict-raven/cases";
import { deriveFindings } from "../../lib/live-predict-raven/findings";
import type { PaperSnapshot } from "../../lib/live-predict-raven/snapshot";
import { deriveReportStats } from "../../lib/live-predict-raven/stats";
import { CaseWalkthrough } from "./case-walkthrough";
import { EquityChart } from "./equity-chart";
import { CalibrationSection, DecisionQualitySection, FindingsSection } from "./quality-sections";
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
  dataSource,
  cases
}: {
  snapshot: PaperSnapshot;
  dataSource: "live" | "baked";
  /** Case walk-throughs from the VM; omitted when that endpoint is unavailable. */
  cases?: PaperCases | null;
}) {
  const s = snapshot;
  const findings = deriveFindings(s);
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
          峰值 {fmtUsd(equity.peakUsd)}（{equity.peakDate}），自峰值最大回撤 {fmtSignedPct(equity.maxDrawdownPct)}，
          当前 {fmtUsd(equity.currentUsd)}（{fmtSignedPct(equity.returnPct)}）。每个点是当日反思报告的收盘权益，最后一点是最近一次评估。
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
          {trade.wins} 笔盈利平均 {fmtUsd(trade.avgWinUsd)}，{trade.losses} 笔亏损平均 {fmtUsd(trade.avgLossUsd)}，
          已实现合计 {fmtSignedUsd(trade.realizedPnlUsd)}。每一笔"卖得对不对"的评价见下面的
          <strong>决策质量</strong>一节——那里把同一笔拆成建仓和退出两部分。
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
          仓位占用 {s.openPositions.length} / {s.config.maxPositions}，现金占总权益 {openBook.cashSharePct.toFixed(1)}%。
          这些仓位都还没结算，因此不进入下面的 Brier 校准——它们的表现只体现在<strong>建仓贡献</strong>里。
          题材集中度与方向一致性见页尾「结论与建议」。
        </p>
      </section>

      {s.decisionQuality ? <DecisionQualitySection dq={s.decisionQuality} /> : null}

      {cases && (cases.winners.length > 0 || cases.losers.length > 0) ? (
        <section className={styles.section} aria-labelledby="sec-cases">
          <h2 id="sec-cases" className={styles.sectionTitle}>
            四个案例：它当时到底看到了什么
          </h2>
          <p className={styles.sectionNote}>
            盈利最大和亏损最大的各两笔。每一笔都摊开：引擎每一轮搜了什么、找到哪条源、那条源把概率推了多少、
            它当时怎么想的，以及 harness 在同一时间轴上做了什么。所有链接都是引擎当时真正引用的原文。
          </p>
          {[...cases.winners, ...cases.losers].map((c) => (
            <CaseWalkthrough key={`${c.positionId}-${c.openedUtc}`} paperCase={c} />
          ))}
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="sec-quality">
        <h2 id="sec-quality" className={styles.sectionTitle}>
          预测与执行质量
        </h2>

        <h3 className={styles.subTitle}>退出明细：逐次退出 vs 不卖的对照</h3>
        <p className={styles.sectionNote}>
          α = 卖出所得 −（若持有到现在/结算的价值），正数 = 卖对了。合计与上面「决策质量」一节的退出贡献同源，
          这里按每次退出的方式（市价 / 限价 / 混合）展开。
        </p>
        <ExitAlphaTable rows={s.exitAlpha.rows} />

        <CalibrationSection snapshot={s} />
        <details className={styles.details}>
          <summary>逐条已结算判断（{s.brier.rows.length} 条）</summary>
          <BrierTable rows={s.brier.rows} />
        </details>

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

      <FindingsSection findings={findings} asOfUtc={s.lastEvalCycleUtc} />

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
