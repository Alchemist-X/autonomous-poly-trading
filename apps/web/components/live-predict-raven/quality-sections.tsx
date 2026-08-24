import type { Finding } from "../../lib/live-predict-raven/findings";
import type { Lang } from "../../lib/live-predict-raven/i18n";
import type { DecisionQuality, PaperSnapshot } from "../../lib/live-predict-raven/snapshot";
import { fmtSignedUsd, fmtUsd } from "./format";
import styles from "./report.module.css";

// The three analysis blocks the review page is built around:
//   DecisionQualitySection  the agent only makes two decisions — what to buy
//                           and when to sell — so its PnL is split into exactly
//                           those two contributions, against one shared "what
//                           if we had just held" benchmark
//   CalibrationSection      the Brier score plus the context needed to read it
//                           without over-claiming: horizon, clustering, and the
//                           unresolved markets it structurally cannot see
//   FindingsSection         conclusions recomputed from the current snapshot

const BENCHMARK_LABEL: Record<Lang, Record<string, string>> = {
  zh: {
    settled: "已结算",
    mark: "最新评估价",
    live: "实时价",
    exit: "无基准（按卖出价）"
  },
  en: {
    settled: "settled",
    mark: "last eval mark",
    live: "live price",
    exit: "no benchmark (exit price)"
  }
};

const REASON_LABEL: Record<Lang, Record<string, string>> = {
  zh: {
    stop_loss: "止损",
    negative_edge: "净边际转负",
    settled_won: "结算获胜",
    settled_lost: "结算判负",
    settled_voided: "作废"
  },
  en: {
    stop_loss: "stop-loss",
    negative_edge: "edge turned negative",
    settled_won: "settled won",
    settled_lost: "settled lost",
    settled_voided: "voided"
  }
};

/** Proportional bar: two contributions on a shared scale, so the split reads at a glance. */
function SplitBar({ entryUsd, exitUsd, lang }: { entryUsd: number; exitUsd: number; lang: Lang }): React.ReactElement {
  const scale = Math.max(Math.abs(entryUsd), Math.abs(exitUsd), 1);
  const row = (label: string, value: number): React.ReactElement => (
    <div className={styles.splitRow}>
      <span className={styles.splitLabel}>{label}</span>
      <span className={styles.splitTrack}>
        <span
          className={`${styles.splitFill} ${value >= 0 ? styles.splitPos : styles.splitNeg}`}
          style={{ width: `${(Math.abs(value) / scale) * 100}%` }}
        />
      </span>
      <span className={`${styles.splitValue} ${value >= 0 ? styles.pos : styles.neg}`}>{fmtSignedUsd(value)}</span>
    </div>
  );
  const zh = lang === "zh";
  return (
    <div className={styles.splitBars}>
      {row(zh ? "建仓决定" : "Entry calls", entryUsd)}
      {row(zh ? "退出决定" : "Exit calls", exitUsd)}
    </div>
  );
}

export function DecisionQualitySection({ dq, lang }: { dq: DecisionQuality; lang: Lang }): React.ReactElement {
  const zh = lang === "zh";
  const rows = [...dq.episodes].sort((a, b) => Math.abs(b.pnlUsd ?? 0) - Math.abs(a.pnlUsd ?? 0));
  const total = dq.entry.totalUsd + dq.exit.totalUsd;
  return (
    <section className={styles.section} aria-labelledby="sec-decisions">
      <h2 id="sec-decisions" className={styles.sectionTitle}>
        {zh ? "决策质量：建仓 vs 退出" : "Decision quality: entry vs. exit"}
      </h2>
      {zh ? (
        <p className={styles.sectionNote}>
          这个 agent 一共只做两个决定：<strong>买什么、什么价买</strong>（建仓），和<strong>什么时候卖</strong>
          （退出）。
          把每个仓位放在同一把尺子上量——“如果买了就一直拿到结算/现在”，得到的就是建仓贡献；实际卖出比这个基准多赚或少赚的部分，就是退出贡献。
          两者相加正好等于这笔的真实盈亏，所以不会有第三个说法。
        </p>
      ) : (
        <p className={styles.sectionNote}>
          The agent makes exactly two decisions: <strong>what to buy and at what price</strong> (entry), and{" "}
          <strong>when to sell</strong> (exit). Measure every position with one yardstick — &ldquo;bought and held to
          settlement/now&rdquo; — and that is the entry contribution; whatever the actual sale made above or below the
          benchmark is the exit contribution. The two add up to the trade&apos;s real PnL, so there is no third story.
        </p>
      )}
      <SplitBar entryUsd={dq.entry.totalUsd} exitUsd={dq.exit.totalUsd} lang={lang} />
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{zh ? "建仓贡献" : "Entry contribution"}</span>
          <strong className={`${styles.tileValue} ${dq.entry.totalUsd >= 0 ? styles.pos : styles.neg}`}>
            {fmtSignedUsd(dq.entry.totalUsd)}
          </strong>
          <span className={styles.tileSub}>
            {zh
              ? `在持 ${fmtSignedUsd(dq.entry.openUsd)} · 已平 ${fmtSignedUsd(dq.entry.closedUsd)}`
              : `open ${fmtSignedUsd(dq.entry.openUsd)} · closed ${fmtSignedUsd(dq.entry.closedUsd)}`}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{zh ? "退出贡献" : "Exit contribution"}</span>
          <strong className={`${styles.tileValue} ${dq.exit.totalUsd >= 0 ? styles.pos : styles.neg}`}>
            {fmtSignedUsd(dq.exit.totalUsd)}
          </strong>
          <span className={styles.tileSub}>
            {zh
              ? `${dq.exit.scored} 次可评分${dq.exit.unscored > 0 ? ` · ${dq.exit.unscored} 次缺基准价` : ""}`
              : `${dq.exit.scored} scored${dq.exit.unscored > 0 ? ` · ${dq.exit.unscored} missing benchmark` : ""}`}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{zh ? "两者相加" : "Sum of both"}</span>
          <strong className={`${styles.tileValue} ${total >= 0 ? styles.pos : styles.neg}`}>
            {fmtSignedUsd(total)}
          </strong>
          <span className={styles.tileSub}>
            {zh ? `覆盖 ${dq.episodes.length} 个仓位周期` : `across ${dq.episodes.length} position episodes`}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{zh ? "账目校验" : "Reconciliation"}</span>
          <strong className={styles.tileValue}>
            {Math.abs(dq.reconciliation.deltaUsd) < 1
              ? zh
                ? "一致"
                : "matches"
              : fmtSignedUsd(dq.reconciliation.deltaUsd)}
          </strong>
          <span className={styles.tileSub}>
            {zh
              ? `已平仓合计 ${fmtUsd(dq.reconciliation.closedPnlUsd)} vs 账本已实现 ${fmtUsd(dq.reconciliation.realizedPnlUsd)}`
              : `closed total ${fmtUsd(dq.reconciliation.closedPnlUsd)} vs ledger realized ${fmtUsd(dq.reconciliation.realizedPnlUsd)}`}
          </span>
        </div>
      </div>

      <details className={styles.details} open>
        <summary>{zh ? "逐仓位拆分（按盈亏绝对值排序）" : "Per-position split (sorted by |PnL|)"}</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{zh ? "市场" : "Market"}</th>
                <th scope="col">{zh ? "方向 / 状态" : "Side / status"}</th>
                <th scope="col" className={styles.num}>
                  {zh ? "建仓价" : "Entry px"}
                </th>
                <th scope="col" className={styles.num}>
                  {zh ? "基准价" : "Benchmark"}
                </th>
                <th scope="col" className={styles.num}>
                  {zh ? "建仓贡献" : "Entry α"}
                </th>
                <th scope="col" className={styles.num}>
                  {zh ? "退出贡献" : "Exit α"}
                </th>
                <th scope="col" className={styles.num}>
                  {zh ? "盈亏" : "PnL"}
                </th>
                <th scope="col" className={styles.num}>
                  {zh ? "建仓时 edge / 研究轮次" : "Entry edge / rounds"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={`${e.positionId}-${e.openedUtc}`}>
                  <td>
                    {e.question}
                    <span className={styles.rowNote}>
                      {e.openedUtc.slice(0, 10)}
                      {e.closedUtc ? ` → ${e.closedUtc.slice(0, 10)}` : zh ? " → 在持" : " → open"}
                      {e.holdDays !== null ? (zh ? `（${e.holdDays} 天）` : ` (${e.holdDays}d)`) : ""}
                    </span>
                  </td>
                  <td>
                    {e.side}
                    <span className={styles.rowNote}>
                      {e.status === "open"
                        ? zh
                          ? "在持"
                          : "open"
                        : (REASON_LABEL[lang][e.exitReason ?? ""] ?? e.exitReason ?? (zh ? "已平" : "closed"))}
                    </span>
                  </td>
                  <td className={styles.num}>${e.entryPrice.toFixed(3)}</td>
                  <td className={styles.num}>
                    {e.benchmarkPrice === null ? "—" : `$${e.benchmarkPrice.toFixed(3)}`}
                    <span className={styles.rowNote}>
                      {BENCHMARK_LABEL[lang][e.benchmarkSource] ?? e.benchmarkSource}
                    </span>
                  </td>
                  <td className={`${styles.num} ${(e.entryAlphaUsd ?? 0) >= 0 ? styles.pos : styles.neg}`}>
                    {e.entryAlphaUsd === null ? "—" : fmtSignedUsd(e.entryAlphaUsd)}
                  </td>
                  <td className={`${styles.num} ${(e.exitAlphaUsd ?? 0) >= 0 ? styles.pos : styles.neg}`}>
                    {e.status === "open" ? "—" : e.exitAlphaUsd === null ? "—" : fmtSignedUsd(e.exitAlphaUsd)}
                  </td>
                  <td className={`${styles.num} ${(e.pnlUsd ?? 0) >= 0 ? styles.pos : styles.neg}`}>
                    {e.pnlUsd === null ? "—" : fmtSignedUsd(e.pnlUsd)}
                  </td>
                  <td className={styles.num}>
                    {e.entryEdgePp === null ? "—" : `${e.entryEdgePp.toFixed(1)}pp`}
                    <span className={styles.rowNote}>
                      {e.roundsAtEntry === null
                        ? zh
                          ? "轮次未记录"
                          : "rounds unrecorded"
                        : zh
                          ? `${e.roundsAtEntry} 轮 / ${e.evidenceAtEntry ?? "—"} 源`
                          : `${e.roundsAtEntry} rounds / ${e.evidenceAtEntry ?? "—"} sources`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className={styles.sectionNote}>
        {zh
          ? `基准价含义：已结算市场用结算值（$1 / $0 / $0.50），未结算的用最近一次观察到的价格。${dq.benchmarkAsOfUtc ? `已平仓位的基准价取自 ${dq.benchmarkAsOfUtc.slice(0, 10)} 的反思报告。` : ""}`
          : `Benchmark: settled markets use the settlement value ($1 / $0 / $0.50); unsettled ones use the last observed price.${dq.benchmarkAsOfUtc ? ` Closed positions' benchmarks come from the ${dq.benchmarkAsOfUtc.slice(0, 10)} reflection report.` : ""}`}
      </p>
    </section>
  );
}

function skillText(skill: number | null): string {
  return skill === null ? "—" : skill.toFixed(2);
}

export function CalibrationSection({ snapshot, lang }: { snapshot: PaperSnapshot; lang: Lang }): React.ReactElement {
  const zh = lang === "zh";
  const b = snapshot.brier;
  const horizon = b.horizon;
  const clusters = b.clusters;
  const pending = b.pending;
  const pendingUnrealized = pending.reduce((s, r) => s + (r.unrealizedUsd ?? 0), 0);
  return (
    <>
      <h3 className={styles.subTitle}>
        {zh
          ? `校准（Brier）：技巧分 ${b.skillScore.toFixed(2)}，n=${b.n}${clusters ? `（来自 ${clusters.effectiveN} 个独立事件）` : ""}`
          : `Calibration (Brier): skill ${b.skillScore.toFixed(2)}, n=${b.n}${clusters ? ` (from ${clusters.effectiveN} independent events)` : ""}`}
      </h3>
      {zh ? (
        <p className={styles.sectionNote}>
          技巧分 = 1 − Brier<sub>agent</sub> / Brier<sub>市场</sub>，&gt;0 才算跑赢市场。当前 agent{" "}
          {b.agentScore.toFixed(3)} vs 市场 {b.marketScore.toFixed(3)}。
          <strong>这个数字有三个结构性的不公平，下面逐个拆开看。</strong>
        </p>
      ) : (
        <p className={styles.sectionNote}>
          Skill = 1 − Brier<sub>agent</sub> / Brier<sub>market</sub>; only &gt;0 beats the market. Currently agent{" "}
          {b.agentScore.toFixed(3)} vs market {b.marketScore.toFixed(3)}.{" "}
          <strong>The number carries three structural biases, unpacked below.</strong>
        </p>
      )}

      <div className={styles.fairGrid}>
        <div className={styles.fairCard}>
          <h4 className={styles.fairTitle}>
            {zh ? "① 只算已结算的，赚钱的还没结算" : "① Only settled calls count — the winners haven't settled"}
          </h4>
          {zh ? (
            <p>
              Brier 只能给已经出结果的市场打分。目前还有 <strong>{pending.length}</strong>{" "}
              个已评估但未结算的市场不在样本里， 其中在持仓的浮动盈亏合计{" "}
              <strong className={pendingUnrealized >= 0 ? styles.pos : styles.neg}>
                {fmtSignedUsd(pendingUnrealized)}
              </strong>
              。长周期、赢面大的判断天然结算得晚，所以短期内 Brier 会系统性偏向“只看到了亏的那批”。
              这部分表现体现在上面的<strong>建仓贡献</strong>里，不在这个分数里。
            </p>
          ) : (
            <p>
              Brier can only score markets that have resolved. <strong>{pending.length}</strong> evaluated-but-unsettled
              markets sit outside the sample, with{" "}
              <strong className={pendingUnrealized >= 0 ? styles.pos : styles.neg}>
                {fmtSignedUsd(pendingUnrealized)}
              </strong>{" "}
              of open unrealized PnL among them. Long-horizon, high-conviction calls settle late by nature, so near-term
              Brier systematically sees only the losing batch. That performance lives in the{" "}
              <strong>entry contribution</strong> above, not in this score.
            </p>
          )}
        </div>
        {horizon?.atEntry && horizon.atLast ? (
          <div className={styles.fairCard}>
            <h4 className={styles.fairTitle}>{zh ? "② 打分打在最容易的那一刻" : "② Scored at the easiest moment"}</h4>
            {zh ? (
              <p>
                头部那个数字用的是<strong>结算前最后一次</strong>判断——离揭晓最近、也最容易。换成
                <strong>第一次</strong>判断（真正提前量，中位 {(horizon.atEntry.medianHorizonDays ?? 0).toFixed(1)}{" "}
                天）： 技巧分 <strong>{skillText(horizon.atEntry.skill)}</strong>；最后一次（中位{" "}
                {(horizon.atLast.medianHorizonDays ?? 0).toFixed(1)} 天）：{skillText(horizon.atLast.skill)}。
                临近结算时市场报价会非常锐利，而引擎概率被 1%/99% 钳住，差距被放大。
              </p>
            ) : (
              <p>
                The headline number uses the <strong>last call before settlement</strong> — the closest and easiest one.
                Use the <strong>first</strong> call instead (the real lead time, median{" "}
                {(horizon.atEntry.medianHorizonDays ?? 0).toFixed(1)} days): skill{" "}
                <strong>{skillText(horizon.atEntry.skill)}</strong>; the last call (median{" "}
                {(horizon.atLast.medianHorizonDays ?? 0).toFixed(1)} days): {skillText(horizon.atLast.skill)}. Near
                settlement the market quotes razor-sharp prices while the engine is clamped at 1%/99%, which inflates
                the gap.
              </p>
            )}
          </div>
        ) : null}
        {clusters ? (
          <div className={styles.fairCard}>
            <h4 className={styles.fairTitle}>
              {zh ? (
                <>
                  ③ n={b.n} 不是 {b.n} 个独立样本
                </>
              ) : (
                <>
                  ③ n={b.n} is not {b.n} independent samples
                </>
              )}
            </h4>
            {zh ? (
              <p>
                同一个故事的不同到期日（停火 7/31、8/15…）会被算成多条，但它们赌的是同一件事。按 Polymarket 事件归并后，
                真正独立的样本只有 <strong>{clusters.effectiveN}</strong> 个。样本这么少时，技巧分的波动本来就很大，
                单个极端样本能主导整个数字。
              </p>
            ) : (
              <p>
                Different expiries of the same story (ceasefire 7/31, 8/15…) count as separate rows, but they bet on one
                thing. Merged by Polymarket event, only <strong>{clusters.effectiveN}</strong> samples are truly
                independent. At that size the skill score is inherently noisy — a single extreme sample can dominate the
                whole number.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {horizon && horizon.buckets.length > 0 ? (
        <>
          <h4 className={styles.subTitle}>{zh ? "按提前量分开看" : "Split by lead time"}</h4>
          <p className={styles.sectionNote}>
            {zh
              ? `每个市场在每个跨度里只取一次判断，避免被复审次数多的市场刷屏。${
                  horizon.weighted?.skill !== null && horizon.weighted !== null
                    ? ` 若按「难度随天数^${horizon.weighted.exponent} 增长」给长跨度更高权重，整体技巧分为 ${skillText(
                        horizon.weighted.skill
                      )}（对比不加权的 ${skillText(horizon.atEntry?.skill ?? null)}）。`
                    : ""
                }`
              : `One call per market per bucket, so heavily re-reviewed markets can't flood the sample.${
                  horizon.weighted?.skill !== null && horizon.weighted !== null
                    ? ` Weighting longer horizons by difficulty ∝ days^${horizon.weighted.exponent} puts overall skill at ${skillText(
                        horizon.weighted.skill
                      )} (vs ${skillText(horizon.atEntry?.skill ?? null)} unweighted).`
                    : ""
                }`}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{zh ? "提前量" : "Lead time"}</th>
                  <th scope="col" className={styles.num}>
                    {zh ? "样本" : "n"}
                  </th>
                  <th scope="col" className={styles.num}>
                    agent Brier
                  </th>
                  <th scope="col" className={styles.num}>
                    {zh ? "市场 Brier" : "market Brier"}
                  </th>
                  <th scope="col" className={styles.num}>
                    {zh ? "技巧分" : "Skill"}
                  </th>
                  <th scope="col">{zh ? "读法" : "Read"}</th>
                </tr>
              </thead>
              <tbody>
                {horizon.buckets.map((bucket) => (
                  <tr key={bucket.label}>
                    <td>{bucket.label}</td>
                    <td className={styles.num}>{bucket.n}</td>
                    <td className={styles.num}>{bucket.brierAgent?.toFixed(3) ?? "—"}</td>
                    <td className={styles.num}>{bucket.brierMarket?.toFixed(3) ?? "—"}</td>
                    <td className={`${styles.num} ${(bucket.skill ?? 0) >= 0 ? styles.pos : styles.neg}`}>
                      {skillText(bucket.skill)}
                    </td>
                    <td>
                      {(bucket.skill ?? -1) > 0
                        ? zh
                          ? "这个跨度上跑赢了市场"
                          : "beats the market at this horizon"
                        : (bucket.brierMarket ?? 1) < 0.06
                          ? zh
                            ? "市场几乎已经确定，agent 的钳位概率无法跟上"
                            : "market near-certain; the clamped probability can't follow"
                          : zh
                            ? "落后于市场"
                            : "trails the market"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {pending.length > 0 ? (
        <details className={styles.details}>
          <summary>
            {zh
              ? `还没结算的 ${pending.length} 个判断（不进 Brier，仅供核对）`
              : `${pending.length} unsettled calls (outside Brier; for reference)`}
          </summary>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{zh ? "市场" : "Market"}</th>
                  <th scope="col">{zh ? "方向" : "Side"}</th>
                  <th scope="col" className={styles.num}>
                    {zh ? "引擎概率" : "Engine P"}
                  </th>
                  <th scope="col" className={styles.num}>
                    {zh ? "市场价" : "Market px"}
                  </th>
                  <th scope="col" className={styles.num}>
                    {zh ? "距结算" : "To settle"}
                  </th>
                  <th scope="col" className={styles.num}>
                    {zh ? "浮动盈亏" : "Unrealized"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r, i) => (
                  <tr key={`${r.slug}-${r.side ?? ""}-${i}`}>
                    <td>{r.question}</td>
                    <td>{r.side ?? (zh ? "未持仓" : "no position")}</td>
                    <td className={styles.num}>{(r.agentProb * 100).toFixed(1)}%</td>
                    <td className={styles.num}>${r.marketProb.toFixed(3)}</td>
                    <td className={styles.num}>
                      {r.horizonDays === null
                        ? "—"
                        : zh
                          ? `${r.horizonDays.toFixed(0)} 天`
                          : `${r.horizonDays.toFixed(0)}d`}
                    </td>
                    <td className={`${styles.num} ${(r.unrealizedUsd ?? 0) >= 0 ? styles.pos : styles.neg}`}>
                      {r.unrealizedUsd === null ? "—" : fmtSignedUsd(r.unrealizedUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {clusters && clusters.rows.length > 0 ? (
        <details className={styles.details}>
          <summary>
            {zh
              ? `按事件归并后的 ${clusters.effectiveN} 个独立样本`
              : `${clusters.effectiveN} independent samples after event merge`}
          </summary>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{zh ? "事件" : "Event"}</th>
                  <th scope="col" className={styles.num}>
                    {zh ? "含市场数" : "Markets"}
                  </th>
                  <th scope="col" className={styles.num}>
                    {zh ? "技巧分" : "Skill"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {clusters.rows.map((c) => (
                  <tr key={c.eventSlug}>
                    <td>{c.label}</td>
                    <td className={styles.num}>{c.n}</td>
                    <td className={`${styles.num} ${(c.skill ?? 0) >= 0 ? styles.pos : styles.neg}`}>
                      {skillText(c.skill)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </>
  );
}

const KIND_LABEL: Record<Lang, Record<Finding["kind"], string>> = {
  zh: {
    headline: "总览",
    strength: "做对的",
    risk: "风险",
    proposal: "待你拍板"
  },
  en: {
    headline: "Overview",
    strength: "What's working",
    risk: "Risk",
    proposal: "Needs your sign-off"
  }
};

export function FindingsSection({
  findings,
  asOfUtc,
  lang
}: {
  findings: readonly Finding[];
  asOfUtc: string;
  lang: Lang;
}): React.ReactElement {
  const zh = lang === "zh";
  return (
    <section className={styles.section} aria-labelledby="sec-verdict">
      <h2 id="sec-verdict" className={styles.sectionTitle}>
        {zh
          ? `结论与建议（数据截至 ${asOfUtc.slice(0, 10)}，随每次评估周期自动重算）`
          : `Findings and proposals (data through ${asOfUtc.slice(0, 10)}; recomputed every eval cycle)`}
      </h2>
      <p className={styles.sectionNote}>
        {zh
          ? "下面每一条都是从当前这份账本算出来的，不是某次人工复盘留下的旧结论。标注「待你拍板」的是风控参数改动—— agent 不会自己改，需要你确认后写入配置。"
          : "Every item below is computed from the current ledger — not a stale conclusion from a past manual review. Items tagged 'needs your sign-off' are risk-parameter changes: the agent never applies them itself; they reach the config only after you confirm."}
      </p>
      <ul className={styles.findingList}>
        {findings.map((f) => (
          <li key={f.id} className={`${styles.findingCard} ${styles[`finding_${f.kind}`] ?? ""}`}>
            <span className={styles.findingKind}>{KIND_LABEL[lang][f.kind]}</span>
            <h3 className={styles.findingTitle}>{f.title}</h3>
            <p className={styles.findingBody}>{f.body}</p>
            {f.metrics.length > 0 ? (
              <ul className={styles.metricChips}>
                {f.metrics.map((m) => (
                  <li key={`${f.id}-${m.label}`} className={styles.metricChip}>
                    <span className={styles.metricLabel}>{m.label}</span>
                    <span className={styles.metricValue}>{m.value}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
