import type { CaseRound, PaperCase } from "../../lib/live-predict-raven/cases";
import type { Lang } from "../../lib/live-predict-raven/i18n";
import { fmtSignedUsd } from "./format";
import { CaseChart } from "./case-chart";
import styles from "./report.module.css";

// One case, end to end: the position's economics, the belief-vs-price chart,
// the research rounds that moved the number (with every source's link), the
// engine's own closing synthesis, and the harness's decision log.
//
// The rounds are the point of this section. Each card answers: what did it go
// looking for, what did it find, how much did that move the number, and why.

const SOURCE_TYPE_LABEL: Record<Lang, Record<string, string>> = {
  zh: {
    official: "官方",
    press: "媒体",
    insider: "行业/内部",
    analysis: "分析",
    social: "社交",
    aggregator: "聚合",
    unknown: "未标注"
  },
  en: {
    official: "official",
    press: "press",
    insider: "industry/insider",
    analysis: "analysis",
    social: "social",
    aggregator: "aggregator",
    unknown: "untagged"
  }
};

const CREDIBILITY_LABEL: Record<Lang, Record<string, string>> = {
  zh: { high: "高", medium: "中", low: "低" },
  en: { high: "high", medium: "medium", low: "low" }
};

const EXIT_REASON_LABEL: Record<Lang, Record<string, string>> = {
  zh: {
    stop_loss: "止损",
    negative_edge: "净边际转负",
    settled_won: "结算获胜",
    settled_lost: "结算判负",
    settled_voided: "市场作废"
  },
  en: {
    stop_loss: "stop-loss",
    negative_edge: "edge turned negative",
    settled_won: "settled won",
    settled_lost: "settled lost",
    settled_voided: "market voided"
  }
};

const STATUS_LABEL: Record<Lang, Record<string, string>> = {
  zh: {
    saturated: "饱和（概率打到 1%/99% 钳位）",
    converged: "收敛",
    max_rounds: "达到轮次上限",
    no_new_info: "无新信息",
    aborted: "中止",
    resolved: "已结算",
    open: "进行中"
  },
  en: {
    saturated: "saturated (clamped at 1%/99%)",
    converged: "converged",
    max_rounds: "round cap reached",
    no_new_info: "no new information",
    aborted: "aborted",
    resolved: "resolved",
    open: "open"
  }
};

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
};

const pp = (n: number): string => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}pp`;

function RoundCard({ round, side, lang }: { round: CaseRound; side: string; lang: Lang }): React.ReactElement {
  const zh = lang === "zh";
  // Dossier probabilities are P(YES); show them from the held side so they line
  // up with the chart and with the position itself.
  const flip = side === "NO";
  const prior = flip ? 1 - round.priorProb : round.priorProb;
  const post = flip ? 1 - round.postProb : round.postProb;
  const net = flip ? -round.netPp : round.netPp;
  return (
    <li className={styles.roundCard}>
      <div className={styles.roundHead}>
        <span className={styles.roundNo}>
          {zh
            ? `第 ${round.round} 轮${round.anchor === "first" ? "（首轮）" : round.anchor === "last" ? "（最后一轮）" : ""}`
            : `Round ${round.round}${round.anchor === "first" ? " (first)" : round.anchor === "last" ? " (last)" : ""}`}
        </span>
        <span className={styles.roundMove}>
          {(prior * 100).toFixed(1)}% → {(post * 100).toFixed(1)}%
          <strong className={net >= 0 ? styles.pos : styles.neg}> {pp(net)}</strong>
        </span>
        <span className={styles.roundMeta}>
          {zh
            ? `${round.ts.slice(5, 16).replace("T", " ")} UTC · 新增源 ${round.newSourceCount} · 置信度 ${round.confidence || "—"}`
            : `${round.ts.slice(5, 16).replace("T", " ")} UTC · new sources ${round.newSourceCount} · confidence ${round.confidence || "—"}`}
        </span>
      </div>

      {round.searchQueries.length > 0 ? (
        <p className={styles.roundQueries}>
          <span className={styles.roundLabel}>{zh ? "搜了什么" : "Searches"}</span>
          {round.searchQueries.slice(0, 6).map((q, i) => (
            <code key={`${q}-${i}`} className={styles.queryChip}>
              {q}
            </code>
          ))}
          {round.searchQueries.length > 6 ? (
            <span className={styles.rowNote}>
              {zh ? `…共 ${round.searchQueries.length} 条检索` : `…${round.searchQueries.length} queries total`}
            </span>
          ) : null}
        </p>
      ) : null}

      {round.sources.length > 0 ? (
        <ul className={styles.sourceList}>
          {round.sources.map((s, i) => {
            const delta = flip ? -s.deltaPp : s.deltaPp;
            // The same URL can appear twice in one round: once as new evidence
            // and once as a reflection correcting an earlier reading of it.
            return (
              <li key={`${s.url}-${s.kind}-${i}`} className={styles.sourceItem}>
                <span className={`${styles.sourceDelta} ${delta >= 0 ? styles.pos : styles.neg}`}>{pp(delta)}</span>
                <span className={styles.sourceBody}>
                  <a href={s.url} target="_blank" rel="noreferrer noopener" className={styles.sourceLink}>
                    {s.title || hostOf(s.url)}
                  </a>
                  <span className={styles.sourceTags}>
                    {zh ? (
                      <>
                        {hostOf(s.url)} · {SOURCE_TYPE_LABEL.zh[s.sourceType] ?? s.sourceType} · 可信度{" "}
                        {CREDIBILITY_LABEL.zh[s.credibility] ?? s.credibility}
                        {s.verified ? " · ✓ 检索链路可核" : " · ⚠ 未在检索结果中出现"}
                        {s.kind === "reflection" ? " · 对旧证据的修正" : ""}
                        {s.excluded ? " · ⛔ 市场价格来源，权重归零" : ""}
                      </>
                    ) : (
                      <>
                        {hostOf(s.url)} · {SOURCE_TYPE_LABEL.en[s.sourceType] ?? s.sourceType} · credibility{" "}
                        {CREDIBILITY_LABEL.en[s.credibility] ?? s.credibility}
                        {s.verified ? " · ✓ verifiable in the search trail" : " · ⚠ not found in search results"}
                        {s.kind === "reflection" ? " · corrects earlier evidence" : ""}
                        {s.excluded ? " · ⛔ market-price source, weight zeroed" : ""}
                      </>
                    )}
                  </span>
                  {s.explanation ? <span className={styles.sourceWhy}>{s.explanation}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {round.reasoning ? (
        <p className={styles.roundReasoning}>
          <span className={styles.roundLabel}>{zh ? "这一轮的判断" : "This round's read"}</span>
          {round.reasoning}
        </p>
      ) : null}
    </li>
  );
}

export function CaseWalkthrough({ paperCase, lang }: { paperCase: PaperCase; lang: Lang }): React.ReactElement {
  const zh = lang === "zh";
  const c = paperCase;
  const d = c.dossier;
  const won = (c.pnlUsd ?? 0) >= 0;
  const exitReasonText = EXIT_REASON_LABEL[lang][c.exitReason ?? ""] ?? c.exitReason ?? "—";
  return (
    <article className={styles.caseCard}>
      <header className={styles.caseHead}>
        <span className={`${styles.caseBadge} ${won ? styles.badgePos : styles.badgeNeg}`}>
          {zh
            ? c.bucket === "winner"
              ? `盈利第 ${c.rank}`
              : `亏损第 ${c.rank}`
            : c.bucket === "winner"
              ? `Winner #${c.rank}`
              : `Loser #${c.rank}`}
        </span>
        <h4 className={styles.caseTitle}>{c.question}</h4>
        <p className={styles.caseSub}>
          {zh ? (
            <>
              买 <strong>{c.side}</strong> @ ${c.entryPrice.toFixed(3)} · {c.shares.toFixed(0)} 股 ·{" "}
              {c.openedUtc.slice(0, 10)} 建仓
              {c.closedUtc ? ` · ${c.closedUtc.slice(0, 10)} 平仓（${exitReasonText}）` : " · 仍在持"}
              {c.entryEdgePp !== null ? ` · 建仓时声称 edge ${c.entryEdgePp.toFixed(1)}pp` : ""}
            </>
          ) : (
            <>
              Bought <strong>{c.side}</strong> @ ${c.entryPrice.toFixed(3)} · {c.shares.toFixed(0)} shares · opened{" "}
              {c.openedUtc.slice(0, 10)}
              {c.closedUtc ? ` · closed ${c.closedUtc.slice(0, 10)} (${exitReasonText})` : " · still open"}
              {c.entryEdgePp !== null ? ` · claimed edge at entry ${c.entryEdgePp.toFixed(1)}pp` : ""}
            </>
          )}
        </p>
      </header>

      <div className={styles.caseTiles}>
        <div className={styles.caseTile}>
          <span className={styles.tileLabel}>{zh ? "这笔的盈亏" : "Trade PnL"}</span>
          <strong className={`${styles.caseTileValue} ${won ? styles.pos : styles.neg}`}>
            {fmtSignedUsd(c.pnlUsd ?? 0)}
          </strong>
        </div>
        <div className={styles.caseTile}>
          <span className={styles.tileLabel}>{zh ? "建仓贡献" : "Entry contribution"}</span>
          <strong className={`${styles.caseTileValue} ${(c.entryAlphaUsd ?? 0) >= 0 ? styles.pos : styles.neg}`}>
            {fmtSignedUsd(c.entryAlphaUsd ?? 0)}
          </strong>
          <span className={styles.tileSub}>
            {zh
              ? `买了一直拿到${c.benchmarkSource === "settled" ? "结算" : "现在"}会是这个数`
              : `what holding to ${c.benchmarkSource === "settled" ? "settlement" : "now"} would have made`}
          </span>
        </div>
        <div className={styles.caseTile}>
          <span className={styles.tileLabel}>{zh ? "退出贡献" : "Exit contribution"}</span>
          <strong className={`${styles.caseTileValue} ${(c.exitAlphaUsd ?? 0) >= 0 ? styles.pos : styles.neg}`}>
            {c.status === "open" ? "—" : fmtSignedUsd(c.exitAlphaUsd ?? 0)}
          </strong>
          <span className={styles.tileSub}>
            {zh
              ? c.status === "open"
                ? "尚未退出"
                : `卖在 $${(c.exitPrice ?? 0).toFixed(3)}，基准价 $${(c.benchmarkPrice ?? 0).toFixed(3)}`
              : c.status === "open"
                ? "not exited yet"
                : `sold at $${(c.exitPrice ?? 0).toFixed(3)}, benchmark $${(c.benchmarkPrice ?? 0).toFixed(3)}`}
          </span>
        </div>
      </div>

      <CaseChart paperCase={c} lang={lang} />

      {d ? (
        <>
          <p className={styles.sectionNote}>
            {zh ? (
              <>
                引擎档案 <code>{d.forecastId}</code>：{d.rounds} 轮研究、{d.evidenceCount} 条证据、状态{" "}
                {STATUS_LABEL.zh[d.status] ?? d.status}
                {d.provider ? ` · 模型 ${d.provider}` : ""}
                {d.marketBlind?.enabled
                  ? ` · 市场盲测已开（屏蔽 ${d.marketBlind.blockedCount} 个价格来源${d.marketBlind.priorSuspect ? "，先验疑似受价格锚定" : ""}）`
                  : ""}
              </>
            ) : (
              <>
                Engine dossier <code>{d.forecastId}</code>: {d.rounds} research rounds, {d.evidenceCount} pieces of
                evidence, status {STATUS_LABEL.en[d.status] ?? d.status}
                {d.provider ? ` · model ${d.provider}` : ""}
                {d.marketBlind?.enabled
                  ? ` · market-blind on (${d.marketBlind.blockedCount} price sources blocked${d.marketBlind.priorSuspect ? "; prior likely price-anchored" : ""})`
                  : ""}
              </>
            )}
          </p>
          {d.normalizedQuestion ? (
            <p className={styles.sectionNote}>
              <span className={styles.roundLabel}>
                {zh ? "它实际在预测的问题" : "The question it actually forecast"}
              </span>
              {d.normalizedQuestion}
            </p>
          ) : null}

          <h5 className={styles.caseSubTitle}>
            {zh ? "关键研究轮次（按对概率的影响挑出）" : "Key research rounds (picked by probability impact)"}
          </h5>
          <ol className={styles.roundList}>
            {d.keyRounds.map((r) => (
              <RoundCard key={r.round} round={r} side={c.side} lang={lang} />
            ))}
          </ol>

          {d.verdict ? (
            <details className={styles.details}>
              <summary>{zh ? "引擎最终的整体判断（原文）" : "The engine's final synthesis (verbatim)"}</summary>
              <div className={styles.verdictBox}>
                {d.whySentence ? <p className={styles.verdictWhy}>{d.whySentence}</p> : null}
                <p>{d.verdict}</p>
                {d.keyFactorsYes.length > 0 ? (
                  <p>
                    <span className={styles.roundLabel}>{zh ? "支持 YES 的因素" : "Factors for YES"}</span>
                    {d.keyFactorsYes.join(zh ? "；" : "; ")}
                  </p>
                ) : null}
                {d.keyFactorsNo.length > 0 ? (
                  <p>
                    <span className={styles.roundLabel}>{zh ? "支持 NO 的因素" : "Factors for NO"}</span>
                    {d.keyFactorsNo.join(zh ? "；" : "; ")}
                  </p>
                ) : null}
                {d.mainUncertainties ? (
                  <p>
                    <span className={styles.roundLabel}>
                      {zh ? "它自己说不确定的地方" : "Its own stated uncertainties"}
                    </span>
                    {d.mainUncertainties}
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <p className={styles.sectionNote}>
          {zh
            ? "该市场的引擎档案在当前主机上不可读，仅显示交易与复审记录。"
            : "This market's engine dossier is unreadable on the current host; showing only the trade and review records."}
        </p>
      )}

      <details className={styles.details}>
        <summary>
          {zh
            ? `决策记录（${c.timeline.length} 条：扫描 → 建仓 → 每次复审 → 退出）`
            : `Decision log (${c.timeline.length} events: scan → entry → each review → exit)`}
        </summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{zh ? "时间 (UTC)" : "Time (UTC)"}</th>
                <th scope="col">{zh ? "动作" : "Action"}</th>
                <th scope="col" className={styles.num}>
                  {zh ? "引擎概率" : "Engine P"}
                </th>
                <th scope="col" className={styles.num}>
                  {zh ? "市场价" : "Market px"}
                </th>
                <th scope="col" className={styles.num}>
                  {zh ? "净 edge" : "Net edge"}
                </th>
                <th scope="col">{zh ? "说明" : "Detail"}</th>
              </tr>
            </thead>
            <tbody>
              {c.timeline.map((t, i) => (
                <tr key={`${t.ts}-${i}`}>
                  <td>{t.ts.slice(5, 16).replace("T", " ")}</td>
                  <td>{t.label}</td>
                  <td className={styles.num}>{t.agentProb === null ? "—" : `${(t.agentProb * 100).toFixed(1)}%`}</td>
                  <td className={styles.num}>{t.marketPrice === null ? "—" : `$${t.marketPrice.toFixed(3)}`}</td>
                  <td className={styles.num}>{t.netEdgePp === null ? "—" : `${t.netEdgePp.toFixed(1)}pp`}</td>
                  <td>{t.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
