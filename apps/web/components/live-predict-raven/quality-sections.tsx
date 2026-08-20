import type { Finding } from "../../lib/live-predict-raven/findings";
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

const BENCHMARK_ZH: Record<string, string> = {
  settled: "已结算",
  mark: "最新评估价",
  live: "实时价",
  exit: "无基准（按卖出价）"
};

const REASON_ZH: Record<string, string> = {
  stop_loss: "止损",
  negative_edge: "净边际转负",
  settled_won: "结算获胜",
  settled_lost: "结算判负",
  settled_voided: "作废"
};

/** Proportional bar: two contributions on a shared scale, so the split reads at a glance. */
function SplitBar({ entryUsd, exitUsd }: { entryUsd: number; exitUsd: number }): React.ReactElement {
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
  return (
    <div className={styles.splitBars}>
      {row("建仓决定", entryUsd)}
      {row("退出决定", exitUsd)}
    </div>
  );
}

export function DecisionQualitySection({ dq }: { dq: DecisionQuality }): React.ReactElement {
  const rows = [...dq.episodes].sort((a, b) => Math.abs(b.pnlUsd ?? 0) - Math.abs(a.pnlUsd ?? 0));
  const total = dq.entry.totalUsd + dq.exit.totalUsd;
  return (
    <section className={styles.section} aria-labelledby="sec-decisions">
      <h2 id="sec-decisions" className={styles.sectionTitle}>
        决策质量：建仓 vs 退出
      </h2>
      <p className={styles.sectionNote}>
        这个 agent 一共只做两个决定：<strong>买什么、什么价买</strong>（建仓），和<strong>什么时候卖</strong>（退出）。
        把每个仓位放在同一把尺子上量——“如果买了就一直拿到结算/现在”，得到的就是建仓贡献；实际卖出比这个基准多赚或少赚的部分，就是退出贡献。
        两者相加正好等于这笔的真实盈亏，所以不会有第三个说法。
      </p>
      <SplitBar entryUsd={dq.entry.totalUsd} exitUsd={dq.exit.totalUsd} />
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>建仓贡献</span>
          <strong className={`${styles.tileValue} ${dq.entry.totalUsd >= 0 ? styles.pos : styles.neg}`}>
            {fmtSignedUsd(dq.entry.totalUsd)}
          </strong>
          <span className={styles.tileSub}>
            在持 {fmtSignedUsd(dq.entry.openUsd)} · 已平 {fmtSignedUsd(dq.entry.closedUsd)}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>退出贡献</span>
          <strong className={`${styles.tileValue} ${dq.exit.totalUsd >= 0 ? styles.pos : styles.neg}`}>
            {fmtSignedUsd(dq.exit.totalUsd)}
          </strong>
          <span className={styles.tileSub}>
            {dq.exit.scored} 次可评分
            {dq.exit.unscored > 0 ? ` · ${dq.exit.unscored} 次缺基准价` : ""}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>两者相加</span>
          <strong className={`${styles.tileValue} ${total >= 0 ? styles.pos : styles.neg}`}>
            {fmtSignedUsd(total)}
          </strong>
          <span className={styles.tileSub}>覆盖 {dq.episodes.length} 个仓位周期</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>账目校验</span>
          <strong className={styles.tileValue}>
            {Math.abs(dq.reconciliation.deltaUsd) < 1 ? "一致" : fmtSignedUsd(dq.reconciliation.deltaUsd)}
          </strong>
          <span className={styles.tileSub}>
            已平仓合计 {fmtUsd(dq.reconciliation.closedPnlUsd)} vs 账本已实现{" "}
            {fmtUsd(dq.reconciliation.realizedPnlUsd)}
          </span>
        </div>
      </div>

      <details className={styles.details} open>
        <summary>逐仓位拆分（按盈亏绝对值排序）</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">市场</th>
                <th scope="col">方向 / 状态</th>
                <th scope="col" className={styles.num}>
                  建仓价
                </th>
                <th scope="col" className={styles.num}>
                  基准价
                </th>
                <th scope="col" className={styles.num}>
                  建仓贡献
                </th>
                <th scope="col" className={styles.num}>
                  退出贡献
                </th>
                <th scope="col" className={styles.num}>
                  盈亏
                </th>
                <th scope="col" className={styles.num}>
                  建仓时 edge / 研究轮次
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
                      {e.closedUtc ? ` → ${e.closedUtc.slice(0, 10)}` : " → 在持"}
                      {e.holdDays !== null ? `（${e.holdDays} 天）` : ""}
                    </span>
                  </td>
                  <td>
                    {e.side}
                    <span className={styles.rowNote}>
                      {e.status === "open" ? "在持" : (REASON_ZH[e.exitReason ?? ""] ?? e.exitReason ?? "已平")}
                    </span>
                  </td>
                  <td className={styles.num}>${e.entryPrice.toFixed(3)}</td>
                  <td className={styles.num}>
                    {e.benchmarkPrice === null ? "—" : `$${e.benchmarkPrice.toFixed(3)}`}
                    <span className={styles.rowNote}>{BENCHMARK_ZH[e.benchmarkSource] ?? e.benchmarkSource}</span>
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
                      {e.roundsAtEntry === null ? "轮次未记录" : `${e.roundsAtEntry} 轮 / ${e.evidenceAtEntry ?? "—"} 源`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className={styles.sectionNote}>
        基准价含义：已结算市场用结算值（$1 / $0 / $0.50），未结算的用最近一次观察到的价格。
        {dq.benchmarkAsOfUtc ? `已平仓位的基准价取自 ${dq.benchmarkAsOfUtc.slice(0, 10)} 的反思报告。` : ""}
      </p>
    </section>
  );
}

function skillText(skill: number | null): string {
  return skill === null ? "—" : skill.toFixed(2);
}

export function CalibrationSection({ snapshot }: { snapshot: PaperSnapshot }): React.ReactElement {
  const b = snapshot.brier;
  const horizon = b.horizon;
  const clusters = b.clusters;
  const pending = b.pending;
  const pendingUnrealized = pending.reduce((s, r) => s + (r.unrealizedUsd ?? 0), 0);
  return (
    <>
      <h3 className={styles.subTitle}>
        校准（Brier）：技巧分 {b.skillScore.toFixed(2)}，n={b.n}
        {clusters ? `（来自 ${clusters.effectiveN} 个独立事件）` : ""}
      </h3>
      <p className={styles.sectionNote}>
        技巧分 = 1 − Brier<sub>agent</sub> / Brier<sub>市场</sub>，&gt;0 才算跑赢市场。当前 agent{" "}
        {b.agentScore.toFixed(3)} vs 市场 {b.marketScore.toFixed(3)}。
        <strong>这个数字有三个结构性的不公平，下面逐个拆开看。</strong>
      </p>

      <div className={styles.fairGrid}>
        <div className={styles.fairCard}>
          <h4 className={styles.fairTitle}>① 只算已结算的，赚钱的还没结算</h4>
          <p>
            Brier 只能给已经出结果的市场打分。目前还有 <strong>{pending.length}</strong> 个已评估但未结算的市场不在样本里，
            其中在持仓的浮动盈亏合计 <strong className={pendingUnrealized >= 0 ? styles.pos : styles.neg}>
              {fmtSignedUsd(pendingUnrealized)}
            </strong>
            。长周期、赢面大的判断天然结算得晚，所以短期内 Brier 会系统性偏向“只看到了亏的那批”。
            这部分表现体现在上面的<strong>建仓贡献</strong>里，不在这个分数里。
          </p>
        </div>
        {horizon?.atEntry && horizon.atLast ? (
          <div className={styles.fairCard}>
            <h4 className={styles.fairTitle}>② 打分打在最容易的那一刻</h4>
            <p>
              头部那个数字用的是<strong>结算前最后一次</strong>判断——离揭晓最近、也最容易。换成
              <strong>第一次</strong>判断（真正提前量，中位 {(horizon.atEntry.medianHorizonDays ?? 0).toFixed(1)} 天）：
              技巧分 <strong>{skillText(horizon.atEntry.skill)}</strong>；最后一次（中位{" "}
              {(horizon.atLast.medianHorizonDays ?? 0).toFixed(1)} 天）：{skillText(horizon.atLast.skill)}。
              临近结算时市场报价会非常锐利，而引擎概率被 1%/99% 钳住，差距被放大。
            </p>
          </div>
        ) : null}
        {clusters ? (
          <div className={styles.fairCard}>
            <h4 className={styles.fairTitle}>③ n={b.n} 不是 {b.n} 个独立样本</h4>
            <p>
              同一个故事的不同到期日（停火 7/31、8/15…）会被算成多条，但它们赌的是同一件事。按 Polymarket 事件归并后，
              真正独立的样本只有 <strong>{clusters.effectiveN}</strong> 个。样本这么少时，技巧分的波动本来就很大，
              单个极端样本能主导整个数字。
            </p>
          </div>
        ) : null}
      </div>

      {horizon && horizon.buckets.length > 0 ? (
        <>
          <h4 className={styles.subTitle}>按提前量分开看</h4>
          <p className={styles.sectionNote}>
            每个市场在每个跨度里只取一次判断，避免被复审次数多的市场刷屏。
            {horizon.weighted?.skill !== null && horizon.weighted !== null
              ? ` 若按「难度随天数^${horizon.weighted.exponent} 增长」给长跨度更高权重，整体技巧分为 ${skillText(
                  horizon.weighted.skill
                )}（对比不加权的 ${skillText(horizon.atEntry?.skill ?? null)}）。`
              : ""}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">提前量</th>
                  <th scope="col" className={styles.num}>
                    样本
                  </th>
                  <th scope="col" className={styles.num}>
                    agent Brier
                  </th>
                  <th scope="col" className={styles.num}>
                    市场 Brier
                  </th>
                  <th scope="col" className={styles.num}>
                    技巧分
                  </th>
                  <th scope="col">读法</th>
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
                        ? "这个跨度上跑赢了市场"
                        : (bucket.brierMarket ?? 1) < 0.06
                          ? "市场几乎已经确定，agent 的钳位概率无法跟上"
                          : "落后于市场"}
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
          <summary>还没结算的 {pending.length} 个判断（不进 Brier，仅供核对）</summary>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">市场</th>
                  <th scope="col">方向</th>
                  <th scope="col" className={styles.num}>
                    引擎概率
                  </th>
                  <th scope="col" className={styles.num}>
                    市场价
                  </th>
                  <th scope="col" className={styles.num}>
                    距结算
                  </th>
                  <th scope="col" className={styles.num}>
                    浮动盈亏
                  </th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r, i) => (
                  <tr key={`${r.slug}-${r.side ?? ""}-${i}`}>
                    <td>{r.question}</td>
                    <td>{r.side ?? "未持仓"}</td>
                    <td className={styles.num}>{(r.agentProb * 100).toFixed(1)}%</td>
                    <td className={styles.num}>${r.marketProb.toFixed(3)}</td>
                    <td className={styles.num}>{r.horizonDays === null ? "—" : `${r.horizonDays.toFixed(0)} 天`}</td>
                    <td
                      className={`${styles.num} ${(r.unrealizedUsd ?? 0) >= 0 ? styles.pos : styles.neg}`}
                    >
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
          <summary>按事件归并后的 {clusters.effectiveN} 个独立样本</summary>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">事件</th>
                  <th scope="col" className={styles.num}>
                    含市场数
                  </th>
                  <th scope="col" className={styles.num}>
                    技巧分
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

const KIND_LABEL: Record<Finding["kind"], string> = {
  headline: "总览",
  strength: "做对的",
  risk: "风险",
  proposal: "待你拍板"
};

export function FindingsSection({
  findings,
  asOfUtc
}: {
  findings: readonly Finding[];
  asOfUtc: string;
}): React.ReactElement {
  return (
    <section className={styles.section} aria-labelledby="sec-verdict">
      <h2 id="sec-verdict" className={styles.sectionTitle}>
        结论与建议（数据截至 {asOfUtc.slice(0, 10)}，随每次评估周期自动重算）
      </h2>
      <p className={styles.sectionNote}>
        下面每一条都是从当前这份账本算出来的，不是某次人工复盘留下的旧结论。标注「待你拍板」的是风控参数改动——
        agent 不会自己改，需要你确认后写入配置。
      </p>
      <ul className={styles.findingList}>
        {findings.map((f) => (
          <li key={f.id} className={`${styles.findingCard} ${styles[`finding_${f.kind}`] ?? ""}`}>
            <span className={styles.findingKind}>{KIND_LABEL[f.kind]}</span>
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
