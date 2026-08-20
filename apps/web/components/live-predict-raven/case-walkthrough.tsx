import type { CaseRound, PaperCase } from "../../lib/live-predict-raven/cases";
import { fmtSignedUsd } from "./format";
import { CaseChart } from "./case-chart";
import styles from "./report.module.css";

// One case, end to end: the position's economics, the belief-vs-price chart,
// the research rounds that moved the number (with every source's link), the
// engine's own closing synthesis, and the harness's decision log.
//
// The rounds are the point of this section. Each card answers: what did it go
// looking for, what did it find, how much did that move the number, and why.

const SOURCE_TYPE_ZH: Record<string, string> = {
  official: "官方",
  press: "媒体",
  insider: "行业/内部",
  analysis: "分析",
  social: "社交",
  aggregator: "聚合",
  unknown: "未标注"
};

const CREDIBILITY_ZH: Record<string, string> = { high: "高", medium: "中", low: "低" };

const EXIT_REASON_ZH: Record<string, string> = {
  stop_loss: "止损",
  negative_edge: "净边际转负",
  settled_won: "结算获胜",
  settled_lost: "结算判负",
  settled_voided: "市场作废"
};

const STATUS_ZH: Record<string, string> = {
  saturated: "饱和（概率打到 1%/99% 钳位）",
  converged: "收敛",
  max_rounds: "达到轮次上限",
  no_new_info: "无新信息",
  aborted: "中止",
  resolved: "已结算",
  open: "进行中"
};

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
};

const pp = (n: number): string => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}pp`;

function RoundCard({ round, side }: { round: CaseRound; side: string }): React.ReactElement {
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
          第 {round.round} 轮
          {round.anchor === "first" ? "（首轮）" : round.anchor === "last" ? "（最后一轮）" : ""}
        </span>
        <span className={styles.roundMove}>
          {(prior * 100).toFixed(1)}% → {(post * 100).toFixed(1)}%
          <strong className={net >= 0 ? styles.pos : styles.neg}> {pp(net)}</strong>
        </span>
        <span className={styles.roundMeta}>
          {round.ts.slice(5, 16).replace("T", " ")} UTC · 新增源 {round.newSourceCount} · 置信度 {round.confidence || "—"}
        </span>
      </div>

      {round.searchQueries.length > 0 ? (
        <p className={styles.roundQueries}>
          <span className={styles.roundLabel}>搜了什么</span>
          {round.searchQueries.slice(0, 6).map((q, i) => (
            <code key={`${q}-${i}`} className={styles.queryChip}>
              {q}
            </code>
          ))}
          {round.searchQueries.length > 6 ? (
            <span className={styles.rowNote}>…共 {round.searchQueries.length} 条检索</span>
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
                    {hostOf(s.url)} · {SOURCE_TYPE_ZH[s.sourceType] ?? s.sourceType} · 可信度{" "}
                    {CREDIBILITY_ZH[s.credibility] ?? s.credibility}
                    {s.verified ? " · ✓ 检索链路可核" : " · ⚠ 未在检索结果中出现"}
                    {s.kind === "reflection" ? " · 对旧证据的修正" : ""}
                    {s.excluded ? " · ⛔ 市场价格来源，权重归零" : ""}
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
          <span className={styles.roundLabel}>这一轮的判断</span>
          {round.reasoning}
        </p>
      ) : null}
    </li>
  );
}

export function CaseWalkthrough({ paperCase }: { paperCase: PaperCase }): React.ReactElement {
  const c = paperCase;
  const d = c.dossier;
  const won = (c.pnlUsd ?? 0) >= 0;
  return (
    <article className={styles.caseCard}>
      <header className={styles.caseHead}>
        <span className={`${styles.caseBadge} ${won ? styles.badgePos : styles.badgeNeg}`}>
          {c.bucket === "winner" ? `盈利第 ${c.rank}` : `亏损第 ${c.rank}`}
        </span>
        <h4 className={styles.caseTitle}>{c.question}</h4>
        <p className={styles.caseSub}>
          买 <strong>{c.side}</strong> @ ${c.entryPrice.toFixed(3)} · {c.shares.toFixed(0)} 股 ·{" "}
          {c.openedUtc.slice(0, 10)} 建仓
          {c.closedUtc ? ` · ${c.closedUtc.slice(0, 10)} 平仓（${EXIT_REASON_ZH[c.exitReason ?? ""] ?? c.exitReason ?? "—"}）` : " · 仍在持"}
          {c.entryEdgePp !== null ? ` · 建仓时声称 edge ${c.entryEdgePp.toFixed(1)}pp` : ""}
        </p>
      </header>

      <div className={styles.caseTiles}>
        <div className={styles.caseTile}>
          <span className={styles.tileLabel}>这笔的盈亏</span>
          <strong className={`${styles.caseTileValue} ${won ? styles.pos : styles.neg}`}>
            {fmtSignedUsd(c.pnlUsd ?? 0)}
          </strong>
        </div>
        <div className={styles.caseTile}>
          <span className={styles.tileLabel}>建仓贡献</span>
          <strong className={`${styles.caseTileValue} ${(c.entryAlphaUsd ?? 0) >= 0 ? styles.pos : styles.neg}`}>
            {fmtSignedUsd(c.entryAlphaUsd ?? 0)}
          </strong>
          <span className={styles.tileSub}>买了一直拿到{c.benchmarkSource === "settled" ? "结算" : "现在"}会是这个数</span>
        </div>
        <div className={styles.caseTile}>
          <span className={styles.tileLabel}>退出贡献</span>
          <strong className={`${styles.caseTileValue} ${(c.exitAlphaUsd ?? 0) >= 0 ? styles.pos : styles.neg}`}>
            {c.status === "open" ? "—" : fmtSignedUsd(c.exitAlphaUsd ?? 0)}
          </strong>
          <span className={styles.tileSub}>
            {c.status === "open" ? "尚未退出" : `卖在 $${(c.exitPrice ?? 0).toFixed(3)}，基准价 $${(c.benchmarkPrice ?? 0).toFixed(3)}`}
          </span>
        </div>
      </div>

      <CaseChart paperCase={c} />

      {d ? (
        <>
          <p className={styles.sectionNote}>
            引擎档案 <code>{d.forecastId}</code>：{d.rounds} 轮研究、{d.evidenceCount} 条证据、状态{" "}
            {STATUS_ZH[d.status] ?? d.status}
            {d.provider ? ` · 模型 ${d.provider}` : ""}
            {d.marketBlind?.enabled
              ? ` · 市场盲测已开（屏蔽 ${d.marketBlind.blockedCount} 个价格来源${d.marketBlind.priorSuspect ? "，先验疑似受价格锚定" : ""}）`
              : ""}
          </p>
          {d.normalizedQuestion ? (
            <p className={styles.sectionNote}>
              <span className={styles.roundLabel}>它实际在预测的问题</span>
              {d.normalizedQuestion}
            </p>
          ) : null}

          <h5 className={styles.caseSubTitle}>关键研究轮次（按对概率的影响挑出）</h5>
          <ol className={styles.roundList}>
            {d.keyRounds.map((r) => (
              <RoundCard key={r.round} round={r} side={c.side} />
            ))}
          </ol>

          {d.verdict ? (
            <details className={styles.details}>
              <summary>引擎最终的整体判断（原文）</summary>
              <div className={styles.verdictBox}>
                {d.whySentence ? <p className={styles.verdictWhy}>{d.whySentence}</p> : null}
                <p>{d.verdict}</p>
                {d.keyFactorsYes.length > 0 ? (
                  <p>
                    <span className={styles.roundLabel}>支持 YES 的因素</span>
                    {d.keyFactorsYes.join("；")}
                  </p>
                ) : null}
                {d.keyFactorsNo.length > 0 ? (
                  <p>
                    <span className={styles.roundLabel}>支持 NO 的因素</span>
                    {d.keyFactorsNo.join("；")}
                  </p>
                ) : null}
                {d.mainUncertainties ? (
                  <p>
                    <span className={styles.roundLabel}>它自己说不确定的地方</span>
                    {d.mainUncertainties}
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <p className={styles.sectionNote}>该市场的引擎档案在当前主机上不可读，仅显示交易与复审记录。</p>
      )}

      <details className={styles.details}>
        <summary>决策记录（{c.timeline.length} 条：扫描 → 建仓 → 每次复审 → 退出）</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">时间 (UTC)</th>
                <th scope="col">动作</th>
                <th scope="col" className={styles.num}>
                  引擎概率
                </th>
                <th scope="col" className={styles.num}>
                  市场价
                </th>
                <th scope="col" className={styles.num}>
                  净 edge
                </th>
                <th scope="col">说明</th>
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
