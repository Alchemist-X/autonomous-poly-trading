import type { PaperCases } from "../../lib/live-predict-raven/cases";
import { deriveFindings } from "../../lib/live-predict-raven/findings";
import type { Lang } from "../../lib/live-predict-raven/i18n";
import { otherLang, t } from "../../lib/live-predict-raven/i18n";
import { localizeCases, localizeSnapshot } from "../../lib/live-predict-raven/localize";
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
  cases,
  lang
}: {
  snapshot: PaperSnapshot;
  dataSource: "live" | "baked";
  /** Case walk-throughs from the VM; omitted when that endpoint is unavailable. */
  cases?: PaperCases | null;
  lang: Lang;
}) {
  const zh = lang === "zh";
  const tt = t(lang);
  // zh mode renders the decorated objects untouched; en mode maps the labels
  // back to the raw English titles before anything downstream reads them.
  const s = localizeSnapshot(snapshot, lang);
  const localCases = localizeCases(cases, lang);
  const findings = deriveFindings(s, lang);
  const { trade, equity, openBook } = deriveReportStats(s);
  const rawDays = Math.round((Date.parse(s.lastEvalCycleUtc) - Date.parse(s.startedUtc)) / 86_400_000);
  const runDaysLabel = Number.isFinite(rawDays)
    ? zh
      ? `${Math.max(1, rawDays)} 天`
      : `${Math.max(1, rawDays)} days`
    : "—";
  const payoffRatio =
    trade.avgWinUsd > 0 && trade.avgLossUsd > 0 ? (trade.avgWinUsd / trade.avgLossUsd).toFixed(2) : "—";
  const effectiveOpens = Math.max(0, s.fills.buys - s.droppedBuyFills);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.kicker}>{tt("kicker")}</span>
          <a className={styles.langToggle} href={`/live-predict-raven/lang?to=${otherLang(lang)}`}>
            {tt("langToggle")}
          </a>
        </div>
        <h1 className={styles.title}>{tt("pageTitle")}</h1>
        <p className={styles.meta}>{tt("metaLine1")}</p>
        <p className={styles.meta}>
          {zh ? (
            <>
              数据截至 <strong>{fmtUtcMinute(s.lastEvalCycleUtc)}</strong>（第 {s.evalCycles} 个评估周期）· 反思报告{" "}
              {fmtUtcMinute(s.reflectionReportUtc)} ·{" "}
              {dataSource === "live" ? (
                <strong>{tt("liveNote")}</strong>
              ) : (
                <strong>快照回退——实时数据暂不可用，显示 {s.generatedAtUtc.slice(0, 10)} 留档</strong>
              )}
            </>
          ) : (
            <>
              Data through <strong>{fmtUtcMinute(s.lastEvalCycleUtc)}</strong> (eval cycle {s.evalCycles}) · reflection
              report {fmtUtcMinute(s.reflectionReportUtc)} ·{" "}
              {dataSource === "live" ? (
                <strong>{tt("liveNote")}</strong>
              ) : (
                <strong>
                  snapshot fallback — live feed unavailable; showing the {s.generatedAtUtc.slice(0, 10)} archive
                </strong>
              )}
            </>
          )}
        </p>
      </header>

      <section className={styles.section} aria-labelledby="sec-headline">
        <h2 id="sec-headline" className={styles.sectionTitle}>
          {tt("sectionOverview")}
        </h2>
        <div className={styles.tiles}>
          <Tile
            label={tt("tileEquity")}
            value={fmtUsd(equity.currentUsd)}
            sub={
              zh
                ? `${fmtSignedPct(equity.returnPct)} vs 本金 · ${runDaysLabel}`
                : `${fmtSignedPct(equity.returnPct)} vs bankroll · ${runDaysLabel}`
            }
            tone={equity.returnPct >= 0 ? "pos" : "neg"}
          />
          <Tile
            label={tt("tileWinRate")}
            value={`${trade.wins}/${trade.closedCount} = ${trade.winRatePct.toFixed(1)}%`}
            sub={
              zh
                ? `${trade.wins} 胜 ${trade.losses} 负（按回合）`
                : `${trade.wins} wins, ${trade.losses} losses (per round trip)`
            }
          />
          <Tile
            label={tt("tileRealized")}
            value={fmtSignedUsd(s.realizedPnlUsd)}
            sub={tt("tileRealizedSub")}
            tone={s.realizedPnlUsd >= 0 ? "pos" : "neg"}
          />
          <Tile
            label={tt("tileUnrealized")}
            value={fmtSignedUsd(openBook.unrealizedUsd)}
            sub={
              zh
                ? `${openBook.positionCount} 仓：${openBook.green} 绿 ${openBook.flat} 平 ${openBook.red} 红`
                : `${openBook.positionCount} positions: ${openBook.green} green, ${openBook.flat} flat, ${openBook.red} red`
            }
            tone={openBook.unrealizedUsd >= 0 ? "pos" : "neg"}
          />
        </div>
        <div className={styles.tiles}>
          <Tile
            label={tt("tileFills")}
            value={zh ? `${s.fills.total} 笔` : `${s.fills.total}`}
            sub={
              zh
                ? `${s.fills.buys} 买 + ${s.fills.sells} 卖（含分批成交）· 有效开仓 ${effectiveOpens} 次`
                : `${s.fills.buys} buys + ${s.fills.sells} sells (incl. partial fills) · ${effectiveOpens} effective opens`
            }
          />
          <Tile
            label={tt("tileAvgWinLoss")}
            value={`${fmtSignedUsd(trade.avgWinUsd)} / ${fmtSignedUsd(-trade.avgLossUsd)}`}
            sub={
              zh
                ? `盈亏比 ${payoffRatio} · profit factor ${Number.isFinite(trade.profitFactor) ? trade.profitFactor.toFixed(2) : "∞"}`
                : `payoff ratio ${payoffRatio} · profit factor ${Number.isFinite(trade.profitFactor) ? trade.profitFactor.toFixed(2) : "∞"}`
            }
          />
          <Tile
            label={tt("tileMaxDrawdown")}
            value={fmtSignedPct(equity.maxDrawdownPct)}
            sub={
              zh
                ? `峰值 ${fmtUsd(equity.peakUsd)}（${equity.peakDate}）之后的最深回落`
                : `deepest drop from the ${fmtUsd(equity.peakUsd)} peak (${equity.peakDate})`
            }
            tone="neg"
          />
          <Tile
            label={tt("tileCash")}
            value={fmtUsd(s.cashUsd)}
            sub={
              zh
                ? `占总权益 ${openBook.cashSharePct.toFixed(1)}% · 累计费用 ${fmtUsd(s.feesUsd)}（按 CLOB 逐市场费率）`
                : `${openBook.cashSharePct.toFixed(1)}% of equity · ${fmtUsd(s.feesUsd)} total fees (per-market CLOB rates)`
            }
          />
        </div>
        {zh ? (
          <p className={styles.callout}>
            一句话：{equity.returnPct >= 0 ? "赚了" : "亏了"} {Math.abs(equity.returnPct).toFixed(1)}% ——已平仓{" "}
            {trade.closedCount} 回合 {trade.wins} 胜 {trade.losses} 负（胜率 {trade.winRatePct.toFixed(1)}
            %），平均单笔亏损（{fmtUsd(trade.avgLossUsd)}
            ）约为平均单笔盈利（{fmtUsd(trade.avgWinUsd)}）的{" "}
            {trade.avgWinUsd > 0 ? (trade.avgLossUsd / trade.avgWinUsd).toFixed(1) : "—"} 倍。
            {s.realizedPnlUsd < 0 ? "已实现部分整体为负数。" : ""}
          </p>
        ) : (
          <p className={styles.callout}>
            Bottom line: {equity.returnPct >= 0 ? "up" : "down"} {Math.abs(equity.returnPct).toFixed(1)}% —{" "}
            {trade.closedCount} closed round trips, {trade.wins} wins {trade.losses} losses (
            {trade.winRatePct.toFixed(1)}% win rate); the average loss ({fmtUsd(trade.avgLossUsd)}) runs{" "}
            {trade.avgWinUsd > 0 ? (trade.avgLossUsd / trade.avgWinUsd).toFixed(1) : "—"}× the average win (
            {fmtUsd(trade.avgWinUsd)}).{s.realizedPnlUsd < 0 ? " Realized PnL is net negative." : ""}
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="sec-equity">
        <h2 id="sec-equity" className={styles.sectionTitle}>
          {tt("sectionEquity")}
        </h2>
        <div className={styles.chartWrap}>
          <EquityChart curve={s.equityCurve} bankrollUsd={s.bankrollUsd} lang={lang} />
        </div>
        {zh ? (
          <p className={styles.sectionNote}>
            峰值 {fmtUsd(equity.peakUsd)}（{equity.peakDate}），自峰值最大回撤 {fmtSignedPct(equity.maxDrawdownPct)}，
            当前 {fmtUsd(equity.currentUsd)}（{fmtSignedPct(equity.returnPct)}
            ）。每个点是当日反思报告的收盘权益，最后一点是最近一次评估。
          </p>
        ) : (
          <p className={styles.sectionNote}>
            Peak {fmtUsd(equity.peakUsd)} ({equity.peakDate}), max drawdown from peak{" "}
            {fmtSignedPct(equity.maxDrawdownPct)}, now {fmtUsd(equity.currentUsd)} ({fmtSignedPct(equity.returnPct)}).
            Each point is that day&apos;s reflection-report closing equity; the last point is the latest eval.
          </p>
        )}
        <details className={styles.details}>
          <summary>{tt("equityTableSummary")}</summary>
          <EquityTable curve={s.equityCurve} lang={lang} />
        </details>
      </section>

      <section className={styles.section} aria-labelledby="sec-closed">
        <h2 id="sec-closed" className={styles.sectionTitle}>
          {zh
            ? `已平仓 ${trade.closedCount} 回合：${trade.wins} 胜 ${trade.losses} 负`
            : `${trade.closedCount} closed round trips: ${trade.wins} wins, ${trade.losses} losses`}
        </h2>
        <ClosedTradesTable trades={s.closedTrades} lang={lang} />
        {zh ? (
          <p className={styles.callout}>
            {trade.wins} 笔盈利平均 {fmtUsd(trade.avgWinUsd)}，{trade.losses} 笔亏损平均 {fmtUsd(trade.avgLossUsd)}，
            已实现合计 {fmtSignedUsd(trade.realizedPnlUsd)}。每一笔"卖得对不对"的评价见下面的
            <strong>决策质量</strong>一节——那里把同一笔拆成建仓和退出两部分。
          </p>
        ) : (
          <p className={styles.callout}>
            {trade.wins} winners averaged {fmtUsd(trade.avgWinUsd)}; {trade.losses} losers averaged{" "}
            {fmtUsd(trade.avgLossUsd)}; realized total {fmtSignedUsd(trade.realizedPnlUsd)}. Whether each sale was right
            is scored in <strong>Decision quality</strong> below — the same trade split into its entry and exit.
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="sec-open">
        <h2 id="sec-open" className={styles.sectionTitle}>
          {zh
            ? `在持 ${openBook.positionCount} 仓：浮盈 ${fmtSignedUsd(openBook.unrealizedUsd)}`
            : `${openBook.positionCount} open positions: ${fmtSignedUsd(openBook.unrealizedUsd)} unrealized`}
        </h2>
        <OpenPositionsTable positions={s.openPositions} lang={lang} />
        <p className={styles.sectionNote}>{tt("openPosNote")}</p>
        {zh ? (
          <p className={styles.callout}>
            仓位占用 {s.openPositions.length} / {s.config.maxPositions}，现金占总权益 {openBook.cashSharePct.toFixed(1)}
            %。 这些仓位都还没结算，因此不进入下面的 Brier 校准——它们的表现只体现在<strong>建仓贡献</strong>里。
            题材集中度与方向一致性见页尾「结论与建议」。
          </p>
        ) : (
          <p className={styles.callout}>
            Slots used {s.openPositions.length} / {s.config.maxPositions}; cash is {openBook.cashSharePct.toFixed(1)}%
            of equity. None of these have settled, so they stay outside the Brier calibration below — their performance
            shows up only in the <strong>entry contribution</strong>. Theme concentration and one-sidedness: see
            Findings at the bottom.
          </p>
        )}
      </section>

      {s.decisionQuality ? <DecisionQualitySection dq={s.decisionQuality} lang={lang} /> : null}

      {localCases && (localCases.winners.length > 0 || localCases.losers.length > 0) ? (
        <section className={styles.section} aria-labelledby="sec-cases">
          <h2 id="sec-cases" className={styles.sectionTitle}>
            {tt("sectionCases")}
          </h2>
          <p className={styles.sectionNote}>{tt("casesNote")}</p>
          {[...localCases.winners, ...localCases.losers].map((c) => (
            <CaseWalkthrough key={`${c.positionId}-${c.openedUtc}`} paperCase={c} lang={lang} />
          ))}
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="sec-quality">
        <h2 id="sec-quality" className={styles.sectionTitle}>
          {tt("sectionQuality")}
        </h2>

        <h3 className={styles.subTitle}>{tt("exitDetailTitle")}</h3>
        <p className={styles.sectionNote}>{tt("exitDetailNote")}</p>
        <ExitAlphaTable rows={s.exitAlpha.rows} lang={lang} />

        <CalibrationSection snapshot={s} lang={lang} />
        <details className={styles.details}>
          <summary>
            {zh ? `逐条已结算判断（${s.brier.rows.length} 条）` : `All settled calls (${s.brier.rows.length})`}
          </summary>
          <BrierTable rows={s.brier.rows} lang={lang} />
        </details>

        <h3 className={styles.subTitle}>{tt("engineExecTitle")}</h3>
        <ul className={styles.list}>
          <li>
            {zh ? (
              <>
                {s.engineQuality.evaluations} 次评估中 {s.engineQuality.saturated} 次饱和（
                {Math.round((s.engineQuality.saturated / s.engineQuality.evaluations) * 100)}%）、
                {s.engineQuality.contaminated} 次检测到市场价格污染、{s.engineQuality.evalErrors} 次评估错误（均
                fail-safe 为 hold）。
              </>
            ) : (
              <>
                {s.engineQuality.saturated} of {s.engineQuality.evaluations} evaluations saturated (
                {Math.round((s.engineQuality.saturated / s.engineQuality.evaluations) * 100)}%);{" "}
                {s.engineQuality.contaminated} flagged for market-price contamination; {s.engineQuality.evalErrors} eval
                errors (all fail-safed to hold).
              </>
            )}
          </li>
          {s.engineQuality.limitVsMarketPp !== null ? (
            <li>
              {zh ? (
                <>
                  混合退出：限价腿较市价腿平均改善 +{s.engineQuality.limitVsMarketPp.toFixed(2)}pp（限价单挂出{" "}
                  {s.engineQuality.limitOrdersPlaced} 次、分批成交 {s.engineQuality.limitFills} 笔）。方向正确，幅度小。
                </>
              ) : (
                <>
                  Hybrid exits: the limit leg beat the market leg by +{s.engineQuality.limitVsMarketPp.toFixed(2)}pp on
                  average ({s.engineQuality.limitOrdersPlaced} limit orders placed, {s.engineQuality.limitFills} partial
                  fills). Right direction, small size.
                </>
              )}
            </li>
          ) : null}
          <li>
            {zh ? (
              <>
                饱和持有拦截 <strong>{s.saturatedHolds}</strong> 次——saturated-hold 修复（PR #91）阻止 99%
                钳位把接近满值的赢家提前卖掉，改为持有到结算。
              </>
            ) : (
              <>
                Saturated-hold vetoed <strong>{s.saturatedHolds}</strong> exits — the PR #91 fix stops the 99% clamp
                from dumping near-full-value winners early; they are held to settlement instead.
              </>
            )}
          </li>
          <li>
            {zh ? (
              <>
                累计费用 {fmtUsd(s.feesUsd)}：早期地缘市场费率均为 0 bps，7
                月下旬起部分新市场（英伟达、马杜罗）带真实费率——英伟达回合 $45 入场费 + $23
                卖出费已计入该回合成本与盈亏。
              </>
            ) : (
              <>
                Total fees {fmtUsd(s.feesUsd)}: early geopolitics markets all charged 0 bps; since late July some new
                markets (NVIDIA, Maduro) carry real fees — the NVIDIA round trip&apos;s $45 entry + $23 exit fees are in
                its cost and PnL.
              </>
            )}
          </li>
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="sec-params">
        <h2 id="sec-params" className={styles.sectionTitle}>
          {tt("sectionParams")}
        </h2>
        <p className={styles.sectionNote}>{dataSource === "live" ? tt("paramsNoteLive") : tt("paramsNoteBaked")}</p>
        <ParamsTable config={s.config} lang={lang} />
      </section>

      <FindingsSection findings={findings} asOfUtc={s.lastEvalCycleUtc} lang={lang} />

      <footer className={styles.footer}>
        <p>{tt("footerDisclaimer")}</p>
        {zh ? (
          <p>
            数据来源：raven-paper-agent-1 容器 portfolio.json / ledger.jsonl（{s.fills.total} 笔成交，其中 1 笔买入被
            7/3 账本锁竞争丢弃、现金已还原）与每日反思报告，经 VM forecast-api 只读端点在每次页面访问时拉取—— agent
            每次评估周期（review）落盘后，本页即反映最新状态；VM 不可达时回退到最近一次留档快照并在页顶标注。
          </p>
        ) : (
          <p>
            Source: the raven-paper-agent-1 container&apos;s portfolio.json / ledger.jsonl ({s.fills.total} fills; one
            buy was dropped by the 7/3 book-lock race, cash restored) plus the daily reflection reports, pulled through
            the VM forecast-api&apos;s read-only endpoints on every page view — the page reflects each eval cycle as
            soon as the agent writes it; when the VM is unreachable it falls back to the latest archived snapshot,
            flagged at the top.
          </p>
        )}
      </footer>
    </main>
  );
}
