// /live-delta-pm — the shadow-trading decision chain rendered as a human
// hedge-fund desk flow: per news item, six desk stations (情报台 → 重要性检查 →
// 定价检查 → 研究 memo → PM 台 → 执行与风控), every number itemized, nothing
// abstracted. Server-rendered; the only interactivity is native <details>.
//
// Readability contract (operator review 2026-08-23): every case-level label
// states the READER-FACING OUTCOME (e.g. 「重要性不足」「已被市场定价」), never the
// internal mechanism (闸门1/入档); the raw enums stay visible in a small mono
// line for ledger reconciliation. A glossary <details> sits under the header.

import type {
  AuditPayload,
  CaseView,
  DecisionView,
  NewsView,
  PositionNowView,
  ReflectionView,
  SignalView,
  ThesisView,
  TimingsMsView
} from "../../lib/live-delta-pm/decode";
import {
  fmtBeta,
  fmtDurationMs,
  fmtFracPct,
  fmtHours,
  fmtInt,
  fmtMinutes,
  fmtPct,
  fmtPx,
  fmtQty,
  fmtSignedUsd,
  fmtUsd,
  fmtUtc,
  fmtX,
  minutesBetween,
  pricedInTone,
  zhAction,
  zhBenchmark,
  zhConfidence,
  zhContamination,
  zhCredibility,
  zhEventType,
  zhFactLevel,
  zhGuard,
  zhImpactBand,
  zhKind,
  zhNewsDirection,
  zhNewsSource,
  zhPostEvent,
  zhPrefix,
  zhPricedIn,
  zhProvider,
  zhSession,
  zhTradeDirection
} from "../../lib/live-delta-pm/labels";
import styles from "./report.module.css";

// ---------------------------------------------------------------------------
// Small building blocks

function Chip({ zh, raw, tone, strong }: { zh: string; raw?: string; tone?: string; strong?: boolean }) {
  const toneClass = tone ? styles[tone] ?? "" : "";
  return (
    <span className={`${styles.chip} ${toneClass} ${strong ? styles.chipStrong : ""}`}>
      {zh}
      {raw && raw !== zh ? <span className={styles.chipRaw}>{raw}</span> : null}
    </span>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.kv}>
      <span className={styles.kvLabel}>{label}</span>
      <span className={styles.kvValue}>{children}</span>
    </div>
  );
}

function Quote({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <blockquote className={styles.quote}>
      <span className={styles.quoteLabel}>{label}</span>
      {text}
    </blockquote>
  );
}

function Station({
  no,
  title,
  sub,
  tag,
  skipReason,
  children
}: {
  no: number;
  title: string;
  /** Plain-language subtitle stating what this station answers. */
  sub?: string;
  /** Internal mechanism name, kept mono for ledger reconciliation. */
  tag: string;
  /** When set, the station renders greyed as 未进行 with this reason. */
  skipReason?: string | null;
  children?: React.ReactNode;
}) {
  const skipped = typeof skipReason === "string";
  return (
    <li className={styles.station}>
      <span className={`${styles.stationNo} ${skipped ? styles.stationNoSkipped : ""}`}>{no}</span>
      <div className={styles.stationBody}>
        <div className={styles.stationHead}>
          <h4 className={styles.stationTitle}>{title}</h4>
          {sub ? <span className={styles.stationSub}>{sub}</span> : null}
          <span className={styles.stationTag}>{tag}</span>
        </div>
        {skipped ? <p className={styles.skipNote}>未进行 — {skipReason}</p> : children}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Chain outcome / progress helpers

interface Outcome {
  /** Plain reader-facing outcome — what happened to this news item. */
  label: string;
  tone: string;
  /** Raw enums behind the label, shown as a small mono line (审计对账用). */
  rawLine: string;
  /** One-line plain reason shown next to the chip (no_trade cases). */
  note?: string;
}

const ZH_VETO: Record<string, string> = {
  halted: "账本熔断中",
  cooldown: "止损冷却期",
  earnings: "财报窗口",
  earnings_window: "财报窗口"
};

const ARCHIVE_STATUSES = new Set(["full", "leaked", "reverse"]);

function oneLine(text: string, max = 110): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function caseOutcome(c: CaseView): Outcome {
  const d = c.decision;
  const mat = c.signal?.materiality ?? null;
  const pin = c.signal?.pricedIn ?? null;

  // A real PM action (or veto) is the strongest outcome — report it first.
  if (d?.audit?.vetoedBy) {
    return {
      label: `PM 否决 · ${ZH_VETO[d.audit.vetoedBy] ?? d.audit.vetoedBy}`,
      tone: "outRed",
      rawLine: `vetoedBy=${d.audit.vetoedBy}`
    };
  }
  if (d && (d.action === "open" || d.action === "add" || d.action === "flip")) {
    const dir = d.direction ? ` · ${zhTradeDirection(d.direction)}` : "";
    return {
      label: `已开仓${dir}`,
      tone: "outGreen",
      rawLine: `action=${d.action}${d.direction ? ` direction=${d.direction}` : ""}`
    };
  }
  if (d && (d.action === "close" || d.action === "trim")) {
    return { label: `已${zhAction(d.action)}`, tone: "outBlue", rawLine: `action=${d.action}` };
  }
  if (c.thesis && d && d.action === "no_trade") {
    return {
      label: "已分析 · 不开仓",
      tone: "outAmber",
      rawLine: "action=no_trade",
      note: d.reason ? oneLine(d.reason) : undefined
    };
  }

  // No decision — say where the pipeline stopped, in reader terms.
  if (!c.signal || !mat || mat.tickers.length === 0) {
    return {
      label: "不相关 · 非股票池",
      tone: "outGrey",
      rawLine: c.signal ? (mat ? "materiality.tickers=[]" : "materiality=null") : "signal=null"
    };
  }
  if (mat.factLevel === "opinion" || mat.tradeable === false) {
    const reason = mat.reason.toLowerCase();
    const isRepeat = reason.includes("stale") || reason.includes("duplicate");
    return {
      label: isRepeat ? "重复旧闻" : "重要性不足",
      tone: "outGrey",
      rawLine: `tradeable=${mat.tradeable === null ? "null" : String(mat.tradeable)} factLevel=${mat.factLevel || "—"} score=${mat.score ?? "—"}`
    };
  }
  if (pin?.status === "full") return { label: "已被市场定价", tone: "outSlate", rawLine: "pricedIn=full" };
  if (pin?.status === "reverse") return { label: "走势反向 · 仅记录", tone: "outPurple", rawLine: "pricedIn=reverse" };
  if (pin?.status === "awaiting_market") return { label: "待行情", tone: "outBlue", rawLine: "pricedIn=awaiting_market" };
  if (pin?.status === "leaked") {
    return { label: "疑似提前泄露 · 已分析", tone: "outOrange", rawLine: "pricedIn=leaked" };
  }
  if (c.thesis) return { label: "已分析 · 无决策记录", tone: "outGrey", rawLine: "thesis!=null decision=null" };
  if (!pin) return { label: "通过重要性检查 · 定价检查未运行", tone: "outGrey", rawLine: "pricedIn=null" };
  return {
    label: "通过两道检查 · 无研究记录",
    tone: "outGrey",
    rawLine: `pricedIn=${pin.status || "—"} thesis=null`
  };
}

function stationsReached(c: CaseView): number {
  let n = 1;
  if (c.signal?.materiality) n += 1;
  if (c.signal?.pricedIn) n += 1;
  if (c.thesis) n += 1;
  if (c.decision) n += 1;
  if (c.execution || c.positionNow || c.postEvents.length > 0) n += 1;
  return n;
}

// ---------------------------------------------------------------------------
// Per-stage timing strip (near the case header)

const PUBLISH_TO_SEEN_NOTE = "含 CDN 60 秒缓存节奏——feed 每 60 秒才刷新一次，此段耗时里有固定的缓存等待";

function TimingStrip({ t }: { t: TimingsMsView | null }) {
  if (!t) return null;
  const segs: Array<{ label: string; key: string; v: number | null; title?: string }> = [
    { label: "发布→抓取*", key: "publishToSeen", v: t.publishToSeen, title: PUBLISH_TO_SEEN_NOTE },
    { label: "检查", key: "seenToSignal", v: t.seenToSignal },
    { label: "研究", key: "signalToThesis", v: t.signalToThesis },
    { label: "决策", key: "thesisToDecision", v: t.thesisToDecision },
    { label: "端到端", key: "seenToDecision", v: t.seenToDecision }
  ];
  return (
    <div className={styles.timingStrip} aria-label="各阶段耗时">
      <span className={styles.timingCaption}>耗时</span>
      {segs.map((s) => (
        <span key={s.key} className={styles.timingSeg} title={s.title}>
          <span className={styles.timingLabel}>{s.label}</span>
          <span className={styles.timingValue}>{fmtDurationMs(s.v)}</span>
        </span>
      ))}
      <span className={styles.timingNote}>* 发布→抓取含 CDN 60 秒缓存节奏</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Station 1 — 情报台

/** Archived original text of the news item: full paste tier > feed teaser tier. */
function ArchivedOriginal({ news }: { news: NewsView }) {
  const body = news.fullText ?? news.teaser;
  const tier = news.fullText ? "粘贴全文" : news.teaser ? "feed 导语" : null;
  return (
    <div className={styles.archive}>
      <div className={styles.archiveHead}>
        <span className={styles.archiveTitle}>存档原文</span>
        {tier ? <Chip zh={tier} raw={news.fullText ? "fullText" : "teaser"} tone="outBlue" /> : null}
        {news.source ? <Chip zh={zhNewsSource(news.source)} raw={news.source} /> : null}
        {news.url ? (
          <a className={styles.srcLink} href={news.url} target="_blank" rel="noopener noreferrer">
            原文链接 ↗
          </a>
        ) : null}
      </div>
      {body ? (
        <div className={styles.archiveBody}>{body}</div>
      ) : (
        <p className={styles.archiveEmpty}>该条早于原文存档功能（2026-08-23 起存档），无原文留档。</p>
      )}
    </div>
  );
}

function NewsStation({ c }: { c: CaseView }) {
  const { news, signal } = c;
  const lagMin = minutesBetween(news.publishedUtc, news.seenAtUtc);
  return (
    <Station no={1} title="情报台" sub="新闻接收与溯源" tag="ingest">
      <div className={styles.chipRow}>
        <Chip zh={zhKind(news.kind)} raw={news.kind} />
        <Chip zh={zhPrefix(news.prefix)} raw={news.prefix} tone={news.prefix === "reportedly" ? "outAmber" : undefined} />
      </div>
      <ArchivedOriginal news={news} />
      <div className={styles.kvGrid}>
        <KV label="发布时间 publishedUtc">{fmtUtc(news.publishedUtc)}</KV>
        <KV label="系统见到 seenAtUtc">{fmtUtc(news.seenAtUtc)}</KV>
        <KV label="发布 → 见到 Δ">{fmtMinutes(lagMin)}</KV>
        <KV label="首次公开 firstSeenUtc">{signal ? fmtUtc(signal.firstSeenUtc) : "—"}</KV>
        <KV label="信号指纹 fingerprint">
          <span className={styles.mono}>{signal?.fingerprint || "—"}</span>
        </KV>
        <KV label="新闻 id">
          <span className={styles.mono}>{news.newsId || "—"}</span>
        </KV>
      </div>
      {signal?.firstSeenBasis ? <Quote label="firstSeenBasis 原文（t0 依据）" text={signal.firstSeenBasis} /> : null}
    </Station>
  );
}

// ---------------------------------------------------------------------------
// Station 2 — 重要性检查（原 M1 · 闸门1）

function MaterialityStation({ signal, skipReason }: { signal: SignalView | null; skipReason: string | null }) {
  const mat = signal?.materiality ?? null;
  if (!signal || !mat) {
    return (
      <Station no={2} title="重要性检查" sub="值得动用分析资源吗" tag="原 M1 · 闸门1" skipReason={skipReason ?? "上游未记录重要性检查结果"} />
    );
  }
  return (
    <Station no={2} title="重要性检查" sub="值得动用分析资源吗" tag="原 M1 · 闸门1">
      <div className={styles.chipRow}>
        {mat.tradeable === null ? (
          <Chip zh="检查结论未记录" raw="tradeable:null" tone="outGrey" />
        ) : (
          <Chip
            zh={mat.tradeable ? "通过 · 进入定价检查" : "不通过 · 归档"}
            raw={`tradeable:${mat.tradeable}`}
            tone={mat.tradeable ? "outGreen" : "outGrey"}
            strong
          />
        )}
        <Chip zh={`评分 ${mat.score === null ? "—" : mat.score}/100`} raw="score" strong />
        <Chip zh={zhEventType(mat.eventType)} raw={mat.eventType} />
        <Chip zh={zhFactLevel(mat.factLevel)} raw={mat.factLevel} />
        <Chip zh={zhNewsDirection(signal.expectedDirection)} raw={signal.expectedDirection} />
        <Chip zh={`预估幅度：${zhImpactBand(signal.coarseImpactBand)}`} raw={signal.coarseImpactBand} />
        {mat.tickers.length > 0 ? (
          mat.tickers.map((t) => <Chip key={t} zh={t} tone="outBlue" strong />)
        ) : (
          <Chip zh="无标的命中" tone="outGrey" />
        )}
      </div>
      <Quote label="surpriseNote 原文（超出共识基线的部分）" text={mat.surpriseNote} />
      <Quote label="reason 原文" text={mat.reason} />
    </Station>
  );
}

// ---------------------------------------------------------------------------
// Station 3 — 定价检查（原 M1 · 闸门2）

function PricedInStation({ signal, skipReason }: { signal: SignalView | null; skipReason: string | null }) {
  const pin = signal?.pricedIn ?? null;
  if (!pin) {
    return (
      <Station no={3} title="定价检查" sub="市场是否已消化" tag="原 M1 · 闸门2" skipReason={skipReason ?? "上游未记录定价检查结果"} />
    );
  }
  return (
    <Station no={3} title="定价检查" sub="市场是否已消化" tag="原 M1 · 闸门2">
      <div className={styles.chipRow}>
        <Chip zh={zhPricedIn(pin.status)} raw={pin.status} tone={pricedInTone(pin.status)} strong />
        <Chip zh={`判定信心：${zhConfidence(pin.confidence)}`} raw={pin.confidence} />
        <Chip zh={zhSession(pin.sessionBucket)} raw={pin.sessionBucket} />
        <Chip zh={`行情源：${pin.dataBasis || "—"}`} raw={pin.dataBasis} />
      </div>
      <div className={styles.kvGrid}>
        <KV label="已实现超额涨跌 realizedExcessPct">{fmtPct(pin.realizedExcessPct, { signed: true })}</KV>
        <KV label="β（基准）">
          {fmtBeta(pin.betaUsed)}（{zhBenchmark(pin.benchmarkUsed) || "—"}）
        </KV>
        <KV label="成交量 Z 分位 volumeZ">{pin.volumeZ === null ? "—" : pin.volumeZ.toFixed(2)}</KV>
        <KV label="评估时刻 tEvalUtc">{fmtUtc(pin.tEvalUtc)}</KV>
        <KV label="距 t0 时长 deltaTMinutes">{fmtMinutes(pin.deltaTMinutes)}</KV>
      </div>
      <Quote label="note 原文（内含反应完成度算式）" text={pin.note} />
    </Station>
  );
}

// ---------------------------------------------------------------------------
// Station 4 — 研究 memo (M2)

function ThesisStation({ thesis, skipReason }: { thesis: ThesisView | null; skipReason: string | null }) {
  if (!thesis) {
    return <Station no={4} title="研究 memo" sub="分析师" tag="M2 · analysis" skipReason={skipReason ?? "上游未记录研究 memo"} />;
  }
  const fair = thesis.fairImpactPct;
  const contaminationTone =
    thesis.contamination === "hard" ? "outRed" : thesis.contamination === "soft" ? "outAmber" : "outGreen";
  return (
    <Station no={4} title="研究 memo" sub="分析师" tag="M2 · analysis">
      <div className={styles.chipRow}>
        <Chip zh={thesis.ticker || "—"} tone="outBlue" strong />
        <Chip
          zh={zhTradeDirection(thesis.direction)}
          raw={thesis.direction}
          tone={thesis.direction === "long" ? "outGreen" : thesis.direction === "short" ? "outRed" : undefined}
          strong
        />
        <Chip zh={`信心：${zhConfidence(thesis.confidence)}`} raw={thesis.confidence} />
        <Chip zh={zhContamination(thesis.contamination)} raw={thesis.contamination} tone={contaminationTone} />
        <Chip zh={`分析引擎：${zhProvider(thesis.provider)}`} raw={thesis.provider} />
        <Chip zh={`持有窗口 ${fmtHours(thesis.horizonHours)}`} raw="horizonHours" />
      </div>
      {fair ? (
        <div className={styles.bigNums}>
          <div className={styles.bigNum}>
            <span className={styles.bigNumLabel}>公允冲击下限 min</span>
            <span className={styles.bigNumValue}>{fmtPct(fair.min, { signed: true })}</span>
          </div>
          <div className={`${styles.bigNum} ${styles.bigNumMain}`}>
            <span className={styles.bigNumLabel}>点估计 point</span>
            <span className={styles.bigNumValue}>{fmtPct(fair.point, { signed: true })}</span>
          </div>
          <div className={styles.bigNum}>
            <span className={styles.bigNumLabel}>公允冲击上限 max</span>
            <span className={styles.bigNumValue}>{fmtPct(fair.max, { signed: true })}</span>
          </div>
        </div>
      ) : (
        <p className={styles.skipNote}>fairImpactPct 未记录</p>
      )}
      {thesis.impactPath.length > 0 ? (
        <>
          <p className={styles.subHead}>影响传导路径 impactPath（全文，不截断）</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>step</th>
                  <th>value</th>
                </tr>
              </thead>
              <tbody>
                {thesis.impactPath.map((s, i) => (
                  <tr key={i}>
                    <td>{s.step}</td>
                    <td>{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {thesis.evidence.length > 0 ? (
        <>
          <p className={styles.subHead}>证据 evidence</p>
          <ul className={styles.plainList}>
            {thesis.evidence.map((e, i) => (
              <li key={i}>
                {e.point}
                <span className={styles.srcMeta}>
                  {e.source ? `来源：${e.source} · ` : ""}
                  {zhCredibility(e.credibility)}
                  <span className={styles.mono}> {e.credibility}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {thesis.catalysts.length > 0 ? (
        <>
          <p className={styles.subHead}>催化剂 catalysts</p>
          <ul className={styles.plainList}>
            {thesis.catalysts.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </>
      ) : null}
      {thesis.falsifiers.length > 0 ? (
        <>
          <p className={styles.subHead}>证伪条件 falsifiers</p>
          <ul className={styles.plainList}>
            {thesis.falsifiers.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </>
      ) : null}
      {thesis.limitations.length > 0 ? (
        <>
          <p className={styles.subHead}>局限 limitations</p>
          <ul className={styles.plainList}>
            {thesis.limitations.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </>
      ) : null}
    </Station>
  );
}

// ---------------------------------------------------------------------------
// Station 5 — PM 台 (M3 · decision)

function actionTone(action: string): string {
  if (action === "open" || action === "add" || action === "flip") return "outGreen";
  if (action === "close" || action === "trim") return "outBlue";
  return "outGrey";
}

function DecisionStation({ decision, skipReason }: { decision: DecisionView | null; skipReason: string | null }) {
  if (!decision) {
    return <Station no={5} title="PM 台" sub="仓位决策" tag="M3 · decision" skipReason={skipReason ?? "上游未记录 PM 决策"} />;
  }
  const audit = decision.audit;
  const vetoed = audit?.vetoedBy ?? null;
  const edge = audit?.edge ?? null;
  const thr = audit?.threshold ?? null;
  const stop = audit?.stopMenu ?? null;
  const sizing = audit?.sizing ?? null;
  const mkt = audit?.marketView ?? null;
  const volBinds =
    thr !== null && thr.thresholdPct !== null && thr.volFloorPct !== null && thr.thresholdPct === thr.volFloorPct;
  const costBinds =
    thr !== null && thr.thresholdPct !== null && thr.costFloorPct !== null && thr.thresholdPct === thr.costFloorPct;
  const passed =
    edge !== null && thr !== null && edge.residualPct !== null && thr.thresholdPct !== null
      ? edge.residualPct >= thr.thresholdPct
      : null;
  return (
    <Station no={5} title="PM 台" sub="仓位决策" tag="M3 · decision">
      <div className={styles.chipRow}>
        <Chip
          zh={vetoed ? `否决 · ${ZH_VETO[vetoed] ?? vetoed}` : zhAction(decision.action)}
          raw={vetoed ? `vetoedBy:${vetoed}` : decision.action}
          tone={vetoed ? "outRed" : actionTone(decision.action)}
          strong
        />
        {decision.direction ? <Chip zh={zhTradeDirection(decision.direction)} raw={decision.direction} /> : null}
        <Chip zh={decision.ticker || "—"} tone="outBlue" />
        <Chip zh={`决策参考价 ${fmtPx(decision.refPx)}`} raw="refPx" />
        <Chip zh={fmtUtc(decision.createdAtUtc)} raw="createdAtUtc" />
      </div>

      {audit ? (
        <>
          {edge ? (
            <>
              <p className={styles.subHead}>Edge 表（%，超额口径）</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>
                        保守口径 <span className={styles.mono}>conservativePct</span>
                      </th>
                      <th>
                        点估计 <span className={styles.mono}>pointPct</span>
                      </th>
                      <th>
                        已实现 <span className={styles.mono}>realizedPct</span>
                      </th>
                      <th>
                        残余 edge <span className={styles.mono}>residualPct</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={styles.num}>{fmtPct(edge.conservativePct, { signed: true })}</td>
                      <td className={styles.num}>{fmtPct(edge.pointPct, { signed: true })}</td>
                      <td className={styles.num}>{fmtPct(edge.realizedPct, { signed: true })}</td>
                      <td className={styles.num}>
                        <strong>{fmtPct(edge.residualPct, { signed: true })}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className={styles.skipNote}>Edge 算术未记录（决策在此之前终止）</p>
          )}

          {thr ? (
            <>
              <p className={styles.subHead}>门槛分解表</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>成本项</th>
                      <th>算式</th>
                      <th className={styles.num}>数值</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        taker 手续费 <span className={styles.mono}>takerFeePct</span>
                      </td>
                      <td className={styles.formulaCell}>单边</td>
                      <td className={styles.num}>{fmtPct(thr.takerFeePct)}</td>
                    </tr>
                    <tr>
                      <td>
                        滑点 <span className={styles.mono}>slippagePct</span>
                      </td>
                      <td className={styles.formulaCell}>单边估计</td>
                      <td className={styles.num}>{fmtPct(thr.slippagePct)}</td>
                    </tr>
                    <tr>
                      <td>
                        资金费 <span className={styles.mono}>fundingPct</span>
                      </td>
                      <td className={styles.formulaCell}>持有期合计（下限 0）</td>
                      <td className={styles.num}>{fmtPct(thr.fundingPct)}</td>
                    </tr>
                    <tr>
                      <td>
                        往返成本 <span className={styles.mono}>roundTripPct</span>
                      </td>
                      <td className={styles.formulaCell}>2×(手续费+滑点)+资金费</td>
                      <td className={styles.num}>{fmtPct(thr.roundTripPct)}</td>
                    </tr>
                    <tr className={costBinds ? styles.hlRow : undefined}>
                      <td>
                        成本地板 <span className={styles.mono}>costFloorPct</span>
                      </td>
                      <td className={styles.formulaCell}>= 3 × 往返成本</td>
                      <td className={styles.num}>{fmtPct(thr.costFloorPct)}</td>
                    </tr>
                    <tr className={volBinds ? styles.hlRow : undefined}>
                      <td>
                        波动地板 <span className={styles.mono}>volFloorPct</span>
                      </td>
                      <td className={styles.formulaCell}>= 0.5 × 日波动 × 持有折算</td>
                      <td className={styles.num}>{fmtPct(thr.volFloorPct)}</td>
                    </tr>
                    <tr className={styles.hlRow}>
                      <td>
                        门槛 <span className={styles.mono}>thresholdPct</span>
                      </td>
                      <td className={styles.formulaCell}>
                        = max(成本地板, 波动地板){volBinds ? " → 波动地板生效" : costBinds ? " → 成本地板生效" : ""}
                      </td>
                      <td className={styles.num}>{fmtPct(thr.thresholdPct)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {passed !== null && edge ? (
                <p className={styles.verdictLine}>
                  残余 edge {fmtPct(edge.residualPct, { signed: true })}{" "}
                  {passed ? "≥" : "<"} 门槛 {fmtPct(thr.thresholdPct)} →{" "}
                  <Chip zh={passed ? "通过门槛" : "不过门槛"} tone={passed ? "outGreen" : "outRed"} strong />
                </p>
              ) : null}
            </>
          ) : (
            <p className={styles.skipNote}>门槛分解未记录（决策在此之前终止）</p>
          )}

          {stop ? (
            <>
              <p className={styles.subHead}>止损菜单 stopMenu</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>候选</th>
                      <th className={styles.num}>价格 / 数值</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        ATR(20 日) <span className={styles.mono}>atr20d</span>
                      </td>
                      <td className={styles.num}>{fmtPx(stop.atr20d)}</td>
                    </tr>
                    <tr>
                      <td>
                        ATR 止损价 <span className={styles.mono}>atrStopPx</span>
                      </td>
                      <td className={styles.num}>{fmtPx(stop.atrStopPx)}</td>
                    </tr>
                    <tr>
                      <td>
                        摆动位 <span className={styles.mono}>swingPx</span>
                      </td>
                      <td className={styles.num}>{fmtPx(stop.swingPx)}</td>
                    </tr>
                    <tr>
                      <td>
                        硬性红线价 <span className={styles.mono}>hardFloorPx</span>（−20% 用户红线）
                      </td>
                      <td className={styles.num}>{fmtPx(stop.hardFloorPx)}</td>
                    </tr>
                    <tr className={styles.hlRow}>
                      <td>
                        选用止损价 <span className={styles.mono}>chosenPx</span>
                      </td>
                      <td className={styles.num}>{fmtPx(stop.chosenPx)}</td>
                    </tr>
                    <tr>
                      <td>
                        止损距离 <span className={styles.mono}>stopDistPct</span>
                      </td>
                      <td className={styles.num}>{fmtFracPct(stop.stopDistPct)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className={styles.skipNote}>止损菜单未记录（决策在此之前终止）</p>
          )}

          {sizing ? (
            <>
              <p className={styles.subHead}>Sizing 链</p>
              <div className={styles.eqLine}>
                <span className={styles.eqPart}>
                  <span className={styles.eqValue}>{fmtUsd(sizing.equityUsd)}</span>
                  <span className={styles.eqLabel}>权益 equityUsd</span>
                </span>
                <span className={styles.eqOp}>×</span>
                <span className={styles.eqPart}>
                  <span className={styles.eqValue}>{fmtFracPct(sizing.riskBudgetPct)}</span>
                  <span className={styles.eqLabel}>风险预算 riskBudgetPct</span>
                </span>
                <span className={styles.eqOp}>÷</span>
                <span className={styles.eqPart}>
                  <span className={styles.eqValue}>{fmtFracPct(stop?.stopDistPct ?? null)}</span>
                  <span className={styles.eqLabel}>止损距离 stopDistPct</span>
                </span>
                <span className={styles.eqOp}>=</span>
                <span className={`${styles.eqPart} ${styles.eqPartHl}`}>
                  <span className={styles.eqValue}>{fmtUsd(sizing.intendedNotionalUsd)}</span>
                  <span className={styles.eqLabel}>意向名义 intendedNotionalUsd</span>
                </span>
              </div>
              {sizing.guards.length > 0 ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>风控闸 guard</th>
                        <th className={styles.num}>上限 capUsd</th>
                        <th className={styles.num}>过闸后名义 notionalAfterUsd</th>
                        <th>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sizing.guards.map((g, i) => {
                        const binding = decision.bindingConstraint !== null && g.name === decision.bindingConstraint;
                        return (
                          <tr key={i} className={g.clipped ? styles.hlRow : undefined}>
                            <td>
                              {zhGuard(g.name)} <span className={styles.mono}>{g.name}</span>
                            </td>
                            <td className={styles.num}>{fmtUsd(g.capUsd)}</td>
                            <td className={styles.num}>{fmtUsd(g.notionalAfterUsd)}</td>
                            <td>
                              {g.clipped ? <span className={styles.tagClipped}>裁剪</span> : "通过"}
                              {binding ? <span className={styles.tagBinding}>binding</span> : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div className={styles.kvGrid}>
                <KV label="最终名义 finalNotionalUsd">
                  <strong>{fmtUsd(sizing.finalNotionalUsd)}</strong>
                </KV>
                {sizing.leverage ? (
                  <KV label="杠杆三帽 configCap / volCap / venueCap → chosen">
                    {fmtX(sizing.leverage.configCap)} / {fmtX(sizing.leverage.volCap)} /{" "}
                    {fmtX(sizing.leverage.venueCap)} → <strong>{fmtX(sizing.leverage.chosen)}</strong>
                    {sizing.leverage.chosen !== null && sizing.leverage.chosen <= 1 ? (
                      <span className={styles.kvNote}>当前策略：不上杠杆（chosen=1，用户 2026-08-23 拍板）</span>
                    ) : null}
                  </KV>
                ) : (
                  <KV label="杠杆三帽">—</KV>
                )}
              </div>
            </>
          ) : (
            <p className={styles.skipNote}>Sizing 链未记录（决策在此之前终止）</p>
          )}

          {mkt ? (
            <div className={styles.chipRow}>
              <Chip zh={`mark ${fmtPx(mkt.markPx)}`} raw="markPx" />
              <Chip zh={`日波动 ${fmtFracPct(mkt.dailyVolPct)}`} raw="dailyVolPct" />
              <Chip zh={`最大日内波动 ${fmtFracPct(mkt.maxDailyMovePct)}`} raw="maxDailyMovePct" />
              <Chip zh={`资金费率 ${fmtFracPct(mkt.fundingHourly)}/小时`} raw="fundingHourly" />
              <Chip zh={`β ${fmtBeta(mkt.beta)}`} raw="beta" />
            </div>
          ) : null}
        </>
      ) : (
        <p className={styles.skipNote}>此决策无逐项审计——审计字段自 2026-08-23 起记录，早于该时点的决策仅有 reason 原文。</p>
      )}

      {decision.action !== "no_trade" || decision.sizeUsd ? (
        <div className={styles.kvGrid}>
          <KV label="下单规模 sizeUsd">{fmtUsd(decision.sizeUsd)}</KV>
          <KV label="杠杆 leverage">{fmtX(decision.leverage)}</KV>
          <KV label="意向风险 intendedRiskPct">{fmtFracPct(decision.intendedRiskPct)}</KV>
          <KV label="实际风险 realizedRiskPct">{fmtFracPct(decision.realizedRiskPct)}</KV>
          <KV label="残余 edge residualEdgePct">{fmtPct(decision.residualEdgePct)}</KV>
          <KV label="被裁剪于 bindingConstraint">
            {decision.bindingConstraint ? (
              <>
                {zhGuard(decision.bindingConstraint)} <span className={styles.mono}>{decision.bindingConstraint}</span>
              </>
            ) : (
              "—"
            )}
          </KV>
          <KV label="持有期限 horizonUtc">{fmtUtc(decision.horizonUtc)}</KV>
          <KV label="目标超额区间 targetPctExcess">
            {decision.targetPctExcess
              ? `${fmtPct(decision.targetPctExcess.lo)} ~ ${fmtPct(decision.targetPctExcess.hi)}`
              : "—"}
          </KV>
          {decision.stop ? (
            <KV label="止损 initialPx / hardFloorPx">
              {fmtPx(decision.stop.initialPx)} / {fmtPx(decision.stop.hardFloorPx)}（−20% 用户红线）
            </KV>
          ) : null}
        </div>
      ) : null}
      {decision.stop?.rule ? <Quote label="止损规则 stop.rule 原文" text={decision.stop.rule} /> : null}
      <Quote label="decision.reason 原文" text={decision.reason} />
      <p className={styles.mono}>decision id: {decision.id || "—"}</p>
    </Station>
  );
}

// ---------------------------------------------------------------------------
// Station 6 — 执行与风控

function PostStation({ c, skipReason }: { c: CaseView; skipReason: string | null }) {
  const { execution, positionNow, postEvents, decision } = c;
  if (!execution && !positionNow && postEvents.length === 0) {
    return <Station no={6} title="执行与风控" tag="paper book" skipReason={skipReason ?? "无记录"} />;
  }
  const slippage =
    execution !== null && execution.fillPx !== null && decision !== null && decision.refPx !== null && decision.refPx !== 0
      ? (execution.fillPx - decision.refPx) / decision.refPx
      : null;
  return (
    <Station no={6} title="执行与风控" tag="paper book">
      {execution ? (
        <>
          <p className={styles.subHead}>模拟执行 execution</p>
          <div className={styles.kvGrid}>
            <KV label="类型 type">
              {zhPostEvent(execution.type)} <span className={styles.mono}>{execution.type}</span>
            </KV>
            <KV label="成交时间 ts">{fmtUtc(execution.ts)}</KV>
            <KV label="方向 / 数量">
              {execution.direction ? zhTradeDirection(execution.direction) : "—"} · {fmtQty(execution.qty)}
            </KV>
            <KV label="成交价 fillPx">{fmtPx(execution.fillPx)}</KV>
            <KV label="名义规模 sizeUsd">{fmtUsd(execution.sizeUsd)}</KV>
            <KV label="滑点（fillPx vs 决策 refPx）">
              {slippage === null ? (
                "—"
              ) : (
                <>
                  {fmtPx(execution.fillPx)} vs {fmtPx(decision?.refPx ?? null)} = {fmtFracPct(slippage, { signed: true })}
                </>
              )}
            </KV>
          </div>
        </>
      ) : null}
      {positionNow ? <PositionBlock p={positionNow} /> : execution ? (
        <p className={styles.skipNote}>当前账本无此仓位（可能已平仓，见下方事件；或账本已重置）。</p>
      ) : null}
      <p className={styles.subHead}>风控事件时间线 postEvents</p>
      {postEvents.length === 0 ? (
        <p className={styles.skipNote}>暂无 stop_loss / hard_floor_stop / paper_close 事件。</p>
      ) : (
        <ul className={styles.timeline}>
          {postEvents.map((e, i) => (
            <li key={i} className={styles.timelineItem}>
              <Chip
                zh={zhPostEvent(e.type)}
                raw={e.type}
                tone={e.type === "hard_floor_stop" ? "outRed" : e.type === "stop_loss" ? "outAmber" : "outBlue"}
                strong
              />
              <span>{fmtUtc(e.ts)}</span>
              {e.pnlUsd !== null ? (
                <span className={e.pnlUsd >= 0 ? styles.pos : styles.neg}>盈亏 {fmtSignedUsd(e.pnlUsd)}</span>
              ) : null}
              {e.extras.map((x) => (
                <span key={x.key} className={styles.mono}>
                  {x.key}={x.value}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Station>
  );
}

function PositionBlock({ p }: { p: PositionNowView }) {
  return (
    <>
      <p className={styles.subHead}>当前仓位 positionNow</p>
      <div className={styles.kvGrid}>
        <KV label="标的 / 方向">
          {p.ticker} · {zhTradeDirection(p.direction)}
        </KV>
        <KV label="开仓价 entryPx / 数量 qty">
          {fmtPx(p.entryPx)} · {fmtQty(p.qty)}
        </KV>
        <KV label="开仓名义 notionalUsdAtEntry">{fmtUsd(p.notionalUsdAtEntry)}</KV>
        <KV label="杠杆 leverage">{fmtX(p.leverage)}</KV>
        <KV label="当前 mark">{p.markPx === null ? "—（快照未含实时 mark）" : fmtPx(p.markPx)}</KV>
        <KV label="浮动盈亏 unrealizedPnlUsd">
          {p.unrealizedPnlUsd === null ? "—（快照未含实时 mark）" : fmtSignedUsd(p.unrealizedPnlUsd)}
        </KV>
        <KV label="止损价 stopPx">{fmtPx(p.stopPx)}</KV>
        <KV label="硬性红线价 hardFloorPx（−20%）">{fmtPx(p.hardFloorPx)}</KV>
        <KV label="持有期限 horizonUtc">{fmtUtc(p.horizonUtc)}</KV>
        <KV label="t0 基准价 baselinePx">{fmtPx(p.baselinePx)}</KV>
        <KV label="基准指数 t0 价 benchmarkBaselinePx">{fmtPx(p.benchmarkBaselinePx)}</KV>
        <KV label="β / 追踪止损">
          {fmtBeta(p.beta)} · {p.trailArmed === null ? "—" : p.trailArmed ? "追踪已启动" : "追踪未启动"}
        </KV>
        <KV label="目标超额区间 targetPctExcess">
          {p.targetPctExcess ? `${fmtPct(p.targetPctExcess.lo)} ~ ${fmtPct(p.targetPctExcess.hi)}` : "—"}
        </KV>
        <KV label="最高收盘 highestClosePx">{fmtPx(p.highestClosePx)}</KV>
        <KV label="开仓时间 entryUtc">{fmtUtc(p.entryUtc)}</KV>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Case card: summary line + six-station chain

function skipReasons(c: CaseView): { st2: string | null; st3: string | null; st4: string | null; st5: string | null; st6: string | null } {
  const mat = c.signal?.materiality ?? null;
  const pin = c.signal?.pricedIn ?? null;
  const notTradeable = mat !== null && mat.tradeable === false;
  const pinArchived = pin !== null && ARCHIVE_STATUSES.has(pin.status);
  const st2 = c.signal && mat ? null : c.signal ? "上游未记录重要性检查结果" : "该新闻未生成信号记录";
  const st3 = pin
    ? null
    : !c.signal
      ? "前站已归档（无信号，重要性检查未运行）"
      : notTradeable
        ? `前站已归档（重要性检查未通过，评分 ${mat?.score ?? "—"}/100）`
        : "上游未记录定价检查结果";
  const st4 = c.thesis
    ? null
    : notTradeable
      ? "前站已归档（重要性检查未通过）"
      : pinArchived && pin
        ? `前站已归档（定价检查判定「${zhPricedIn(pin.status)}」）`
        : c.signal
          ? "上游未记录研究 memo"
          : "前站已归档（无信号）";
  const st5 = c.decision ? null : c.thesis ? "上游未记录 PM 决策" : "前站已归档（无研究 memo）";
  const st6 =
    c.execution || c.positionNow || c.postEvents.length > 0
      ? null
      : c.decision
        ? c.decision.action === "open" || c.decision.action === "add" || c.decision.action === "flip"
          ? "上游未记录执行"
          : `PM 决策为「${zhAction(c.decision.action)}」，无需执行`
        : "前站已归档（无决策）";
  return { st2, st3, st4, st5, st6 };
}

function CaseCard({ c, defaultOpen }: { c: CaseView; defaultOpen: boolean }) {
  const outcome = caseOutcome(c);
  const reached = stationsReached(c);
  const tickers = c.thesis?.ticker
    ? [c.thesis.ticker]
    : c.signal?.materiality?.tickers?.length
      ? c.signal.materiality.tickers
      : [];
  const skip = skipReasons(c);
  return (
    <details className={styles.caseCard} open={defaultOpen}>
      <summary className={styles.caseSummary}>
        <div className={styles.sumTop}>
          <Chip zh={outcome.label} tone={outcome.tone} strong />
          <span className={styles.sumTitle}>{c.news.title}</span>
        </div>
        {outcome.note ? <p className={styles.sumNote}>原因：{outcome.note}</p> : null}
        <div className={styles.sumMeta}>
          <span>见到 {fmtUtc(c.news.seenAtUtc)}</span>
          {tickers.length > 0 ? <span>{tickers.join(" · ")}</span> : null}
          <span>流程 {reached}/6 站</span>
          <span className={styles.mono}>{outcome.rawLine}</span>
          <span className={styles.sumChevron}>展开决策链 ▾</span>
        </div>
      </summary>
      <div className={styles.caseBody}>
        <TimingStrip t={c.timingsMs} />
        <ol className={styles.chain}>
          <NewsStation c={c} />
          <MaterialityStation signal={c.signal} skipReason={skip.st2} />
          <PricedInStation signal={c.signal} skipReason={skip.st3} />
          <ThesisStation thesis={c.thesis} skipReason={skip.st4} />
          <DecisionStation decision={c.decision} skipReason={skip.st5} />
          <PostStation c={c} skipReason={skip.st6} />
        </ol>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Reflection footer

function ReflectionFooter({ r }: { r: ReflectionView }) {
  const f = r.funnel;
  const cont = r.contamination;
  const m1 = r.m1Calibration;
  return (
    <section className={styles.section} aria-labelledby="sec-reflection">
      <h2 id="sec-reflection" className={styles.sectionTitle}>
        当日反思关键数（{r.date || "—"}）
      </h2>
      {f ? (
        <div className={styles.funnelLine}>
          <span className={styles.funnelStep}>新闻 {fmtInt(f.newsSeen)}</span>
          <span className={styles.funnelArrow}>→</span>
          <span className={styles.funnelStep}>信号 {fmtInt(f.signals)}</span>
          <span className={styles.funnelArrow}>→</span>
          <span className={styles.funnelStep}>
            归档：非股票池 {fmtInt(f.archivedNoTicker)} · 重要性不足 {fmtInt(f.archivedNotMaterial)} · 重复旧闻{" "}
            {fmtInt(f.archivedStale)} · 已被市场定价 {fmtInt(f.archivedPricedIn)}
          </span>
          <span className={styles.funnelArrow}>→</span>
          <span className={styles.funnelStep}>研究 memo {fmtInt(f.theses)}</span>
          <span className={styles.funnelArrow}>→</span>
          <span className={styles.funnelStep}>
            开仓 {fmtInt(f.decisionsOpen)} · 不开仓 {fmtInt(f.decisionsNoTrade)}
          </span>
        </div>
      ) : (
        <p className={styles.sectionNote}>反思报告未含漏斗数据。</p>
      )}
      <div className={styles.chipRow}>
        {cont ? (
          <Chip
            zh={`污染率 ${cont.rate === null ? "—" : `${(cont.rate * 100).toFixed(0)}%`}（研究 ${fmtInt(cont.theses)} 份：重度 ${fmtInt(cont.hard)} · 轻度 ${fmtInt(cont.soft)}）`}
            raw="contamination"
            tone={cont.rate !== null && cont.rate > 0 ? "outAmber" : "outGreen"}
          />
        ) : null}
        {m1?.forwarded ? (
          <Chip
            zh={`放行样本方向命中 ${fmtInt(m1.forwarded.hits)}/${fmtInt(m1.forwarded.n)}${m1.forwarded.hitRate === null ? "（样本不足）" : ` = ${(m1.forwarded.hitRate * 100).toFixed(0)}%`}`}
            raw="m1Calibration.forwarded"
          />
        ) : null}
        {m1?.archivedFullReverse ? (
          <Chip
            zh={`错杀检查：归档「已被市场定价/走势反向」${fmtInt(m1.archivedFullReverse.n)} 条，其中随新闻方向走 ${fmtInt(m1.archivedFullReverse.movedWithNews)} 条`}
            raw="m1Calibration.archivedFullReverse"
          />
        ) : null}
        {r.deltaT ? (
          <Chip zh={`t0→评估延迟中位数 ${fmtMinutes(r.deltaT.medianMinutes)}（n=${fmtInt(r.deltaT.n)}）`} raw="deltaT" />
        ) : null}
        {r.engines.map((e) => (
          <Chip key={e.name} zh={`${zhProvider(e.name)} ${e.count} 次`} raw={e.name} />
        ))}
      </div>
      {r.pricedInDistribution.length > 0 ? (
        <p className={styles.sectionNote}>
          定价检查分布：
          {r.pricedInDistribution
            .map((d) => `${d.status === "not_evaluated" ? "未评估" : zhPricedIn(d.status)} ${d.count}`)
            .join(" · ")}
        </p>
      ) : null}
      {r.noTradeReasons.length > 0 ? (
        <p className={styles.sectionNote}>
          不开仓原因：{r.noTradeReasons.map((x) => `「${x.reason}」× ${x.count}`).join("；")}
        </p>
      ) : null}
      {r.book ? (
        <p className={styles.sectionNote}>
          反思时点账本：权益 {fmtUsd(r.book.equityUsd)} · 已实现 {fmtSignedUsd(r.book.realizedPnlUsd)} · 持仓{" "}
          {fmtInt(r.book.positions)} · {r.book.halted ? "已熔断" : "未熔断"}
        </p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Glossary (术语表) — plain definitions for every term of art on this page.

const GLOSSARY: Array<{ term: string; en: string; def: string }> = [
  {
    term: "重要性检查",
    en: "materiality gate",
    def: "判断新闻是否属于可交易事件类别、主角是否在 21 只股票池内、内容是否超出市场共识。不通过 = 归档，不再消耗任何分析资源。"
  },
  {
    term: "定价检查",
    en: "priced-in gate",
    def: "用新闻最早出现时间之后的真实价格走势（β 调整后的超额涨跌），判断市场是否已经消化这条新闻。已定价 / 走势反向 = 归档。"
  },
  {
    term: "残余空间",
    en: "residual",
    def: "分析师保守估计的合理涨跌幅，减去市场已经走掉的部分——决定开不开仓的核心数字。"
  },
  {
    term: "门槛",
    en: "threshold",
    def: "开仓要求的最小残余空间 = max(3×往返交易成本, 0.5×日波动)，防止为噪音下单。"
  },
  {
    term: "硬地板",
    en: "hard floor",
    def: "用户红线——持仓对入场价反向 20% 无条件平仓，优先级高于一切模型判断。"
  },
  {
    term: "风控闸",
    en: "guard",
    def: "六道敞口上限（单标的 / 总多空 / 同题材簇 / 隔离保证金等），只会把仓位向下裁剪，从不放大。"
  },
  {
    term: "β / 超额",
    en: "beta / excess",
    def: "个股涨跌扣掉大盘（XYZ100 指数）联动后的剩余部分——避免把大盘行情误认成新闻反应。"
  },
  {
    term: "影子模式",
    en: "shadow mode",
    def: "全流程真实运行但只记账，不向任何交易所发订单。"
  }
];

function Glossary() {
  return (
    <details className={styles.glossary}>
      <summary className={styles.glossarySummary}>术语表 — 本页所有行话的白话解释（点开）</summary>
      <dl className={styles.glossaryList}>
        {GLOSSARY.map((g) => (
          <div key={g.term} className={styles.glossaryItem}>
            <dt className={styles.glossaryTerm}>
              {g.term} <span className={styles.mono}>{g.en}</span>
            </dt>
            <dd className={styles.glossaryDef}>{g.def}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Page shell

export function DeltaPmReport({ payload, dataSource }: { payload: AuditPayload; dataSource: "live" | "baked" }) {
  const p = payload.portfolio;
  const book = payload.latestReflection?.book ?? null;
  const initial = p?.initialCapitalUsd ?? null;
  const realized = p?.realizedPnlUsd ?? null;
  const equity = book?.equityUsd ?? (initial !== null && realized !== null ? initial + realized : null);
  const firstThesisIdx = payload.cases.findIndex((c) => c.thesis !== null);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.kicker}>Tokyo VM · services/delta-pm · 内部审计页</span>
        <h1 className={styles.title}>Delta PM 决策链审计</h1>
        <p className={styles.meta}>
          每条新闻一份 IC memo：情报台 → 重要性检查 → 定价检查 → 研究 memo → PM 台 → 执行与风控。
          每个数字逐项摊开，不做抽象汇总；白话标签旁保留原始枚举值（小号等宽字），便于与账本核对。
        </p>
        <div className={styles.bannerRow}>
          <span className={`${styles.banner} ${styles.bannerShadow}`}>Phase 0 影子模式 · 只记账，不下真实订单</span>
          {dataSource === "live" ? (
            <span className={`${styles.banner} ${styles.bannerLive}`}>实时数据 · VM /delta-pm/audit</span>
          ) : (
            <span className={`${styles.banner} ${styles.bannerBaked}`}>
              烘焙快照回退 · 实时数据暂不可用，显示 {payload.generatedAtUtc.slice(0, 10) || "—"} 留档
            </span>
          )}
        </div>
        <p className={styles.meta}>
          账本起始 {fmtUtc(payload.bookStartedUtc)} · 数据生成 {fmtUtc(payload.generatedAtUtc)}
          {p ? <> · 组合更新 {fmtUtc(p.updatedAtUtc)}</> : null}
        </p>
        {p?.halted ? (
          <div className={styles.haltBar}>账本已熔断 HALTED{p.haltedReason ? ` — ${p.haltedReason}` : ""}</div>
        ) : null}
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>总权益（反思时点）</span>
            <strong className={styles.tileValue}>{fmtUsd(equity)}</strong>
            <span className={styles.tileSub}>
              {initial !== null && equity !== null
                ? `${fmtPct(((equity - initial) / initial) * 100, { signed: true })} vs 初始`
                : "—"}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>初始本金</span>
            <strong className={styles.tileValue}>{fmtUsd(initial)}</strong>
            <span className={styles.tileSub}>mode: {p?.mode || "—"}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>已实现盈亏</span>
            <strong className={`${styles.tileValue} ${realized !== null && realized < 0 ? styles.neg : styles.pos}`}>
              {fmtSignedUsd(realized)}
            </strong>
            <span className={styles.tileSub}>影子账本累计</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>当前持仓</span>
            <strong className={styles.tileValue}>{p ? p.positions.length : "—"}</strong>
            <span className={styles.tileSub}>
              {p && p.positions.length > 0
                ? p.positions.map((x) => `${x.ticker} ${zhTradeDirection(x.direction)}`).join(" · ")
                : "空仓"}
            </span>
          </div>
        </div>
      </header>

      <Glossary />

      <section className={styles.section} aria-labelledby="sec-cases">
        <h2 id="sec-cases" className={styles.sectionTitle}>
          决策链（{payload.cases.length} 条新闻，新 → 旧）
        </h2>
        <p className={styles.sectionNote}>
          每张卡片的大标签 = 这条新闻的最终结果（不相关 / 重要性不足 / 已被市场定价 / 已分析不开仓 / 已开仓……）；
          点开卡片看六站决策链，灰色站点表示流程在前站已归档、未进行。
        </p>
        {payload.cases.length === 0 ? (
          <p className={styles.sectionNote}>暂无案例数据。</p>
        ) : (
          payload.cases.map((c, i) => (
            <CaseCard key={`${c.news.newsId}-${i}`} c={c} defaultOpen={i === (firstThesisIdx === -1 ? 0 : firstThesisIdx)} />
          ))
        )}
      </section>

      {payload.latestReflection ? <ReflectionFooter r={payload.latestReflection} /> : null}

      <footer className={styles.footer}>
        数据来自 Tokyo VM <span className={styles.mono}>/delta-pm/audit</span>（每次页面请求服务端拉取，成功后缓存 60
        秒；连续失败退避 30 秒）。上游不可达时退回烘焙快照，页首会标注数据源。本页为 Phase 0
        影子模式审计——所有决策仅记账，不向任何交易所下真实订单。
      </footer>
    </main>
  );
}
