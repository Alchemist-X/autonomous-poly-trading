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
            sub={`占总权益 ${openBook.cashSharePct.toFixed(1)}% · 费用 $0（本批市场费率 0 bps）`}
          />
        </div>
        <p className={styles.callout}>
          一句话：{equity.returnPct >= 0 ? "赚了" : "亏了"} {Math.abs(equity.returnPct).toFixed(1)}%
          ，结构上是"高胜率小盈利 + 低频大亏损"——平均单笔亏损（{fmtUsd(trade.avgLossUsd)}
          ）约为平均单笔盈利（{fmtUsd(trade.avgWinUsd)}）的{" "}
          {trade.avgWinUsd > 0 ? (trade.avgLossUsd / trade.avgWinUsd).toFixed(1) : "—"} 倍，目前靠{" "}
          {trade.winRatePct.toFixed(1)}% 的胜率和浮盈扛住。
          {s.realizedPnlUsd < 0 ? "已实现部分整体仍是负数。" : ""}
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
          复盘注（2026-07-24）：7/14 冲到峰值 +8.0% 后，7/15–16 被同一市场的两次止损（合计
          -$460）拖低，低点出现在 7/21，随后回稳。
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
          复盘注（2026-07-24）：两笔亏损是同一个论点买了两次："伊朗 7/17 前退出 MOU 谈判"。第一次 agent 估 19.5%（市场只给
          6.4%）买 YES，4 小时后止损；当晚在更低价位原方向重进，次日再止损。这是整个模拟盘唯一一次显著偏离市场定价的独立判断，也是全部已实现亏损的来源。反事实检验显示两次止损本身都是对的（死扛到归零会多亏
          $540）——错在入场与止损后无冷却期的重进。
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
          复盘注（2026-07-24）风险集中：六仓全是地缘政治 NO，其中四仓共享"伊朗局势"单一驱动（霍尔木兹 ×2 + 核协议 +
          入侵伊朗）。一次中东局势突变会同时打穿多仓。亮点是霍尔木兹 12/31：市场定价 72% 会恢复通航时逆势买
          NO @ 0.28，现在市场已向 agent 靠拢（+75%），是目前唯一在赢的真正逆市场立场（未结算）。
        </p>
      </section>

      <section className={styles.section} aria-labelledby="sec-quality">
        <h2 id="sec-quality" className={styles.sectionTitle}>
          预测与执行质量
        </h2>

        <h3 className={styles.subTitle}>退出质量：α 合计 {fmtSignedUsd(s.exitAlpha.totalUsd)}</h3>
        <p className={styles.sectionNote}>
          α = 卖出所得 −（若持有到现在/结算的价值），正数 = 卖对了。结论：退出决策整体明显加分。
        </p>
        <ExitAlphaTable rows={s.exitAlpha.rows} />

        <h3 className={styles.subTitle}>
          校准（Brier）：skill score {s.brier.skillScore.toFixed(2)}，n={s.brier.n}
        </h3>
        <p className={styles.sectionNote}>
          skill score = 1 − Brier_agent / Brier_market，&gt;0 才算跑赢市场。当前为负（agent {s.brier.agentScore.toFixed(3)} vs 市场{" "}
          {s.brier.marketScore.toFixed(3)}），样本仅 {s.brier.n} 个已结算市场——尚不能下结论。7/31
          有一批持仓集中到期，样本很快会上来。
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
          <li>费用 $0：本批地缘市场 taker/maker 均为 0 bps，费用拖累尚未被真正测试。</li>
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
          结论与建议（2026-07-24 复盘）
        </h2>
        <ul className={styles.list}>
          <li>
            <strong>盈利构成：</strong>收"大概率不发生"的权利金（4 笔已验证有效）+ 一个在赢的逆市场仓（霍尔木兹
            12/31，未结算）− 一次输掉的独立判断（MOU，-$460）。
          </li>
          <li>
            <strong>与基准一致：</strong>贴着市场先验做小幅修正能稳定小赚；真正偏离市场的判断才是分水岭——目前
            1 胜（浮盈）1 负（已实现）。
          </li>
          <li>
            <strong>建议 ①（最高优先级）：</strong>止损后对同市场/同事件加冷却期。MOU 的第二次进场距第一次止损仅
            4 小时，多亏 $227。
          </li>
          <li>
            <strong>建议 ②：</strong>加题材级相关性敞口上限（或先在反思报告里显式呈现相关暴露）。事件级上限没挡住
            4 仓共享伊朗驱动。
          </li>
          <li>
            <strong>建议 ③（已部分落地）：</strong>饱和钳位导致的错误卖出已由 saturated-hold 修复（PR
            #91）拦截，赢家可持有到结算；饱和 edge 的名义值展示仍待改进。等 7/31 结算潮把 Brier
            样本攒起来再评价预测能力。
          </li>
        </ul>
      </section>

      <footer className={styles.footer}>
        <p>
          模拟盘——无真实订单、无真实资金。费用按 CLOB 逐市场实时元数据计（本批均为 0）。金额合计与总权益之间存在
          &lt;$1 的取整差（报告 mark 保留两位）。
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
