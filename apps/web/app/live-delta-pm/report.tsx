// /live-delta-pm — the shadow-trading decision chain rendered as a human
// hedge-fund desk flow: per news item, six desk stations (情报台 → 重要性检查 →
// 定价检查 → 研究 memo → PM 台 → 执行与风控), every number itemized, nothing
// abstracted. Server-rendered; the only interactivity is native <details>.
//
// Readability contract (operator review 2026-08-23): every case-level label
// states the READER-FACING OUTCOME (e.g. 「重要性不足」「已被市场定价」), never the
// internal mechanism (闸门1/入档); the raw enums stay visible in a small mono
// line for ledger reconciliation. A glossary <details> sits under the header.
//
// i18n (2026-08-24): the page renders zh (default, byte-identical to the
// original) or en, chosen by the ldp_lang cookie via the header toggle. Static
// copy lives in lib/live-delta-pm/i18n.ts; enum labels in labels.ts; payload
// content (headlines, tickers, ledger reasons) is data and never translated.

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
import { LANG_TOGGLE_LABEL, otherLang, t, type Lang } from "../../lib/live-delta-pm/i18n";
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
  labelAction,
  labelBenchmark,
  labelConfidence,
  labelContamination,
  labelCredibility,
  labelEventType,
  labelFactLevel,
  labelGuard,
  labelImpactBand,
  labelKind,
  labelNewsDirection,
  labelPostEvent,
  labelPrefix,
  labelPricedIn,
  labelProvider,
  labelSession,
  labelTradeDirection,
  minutesBetween,
  newsSourceName,
  pricedInTone
} from "../../lib/live-delta-pm/labels";
import styles from "./report.module.css";

type Bi = { zh: string; en: string };

// ---------------------------------------------------------------------------
// Small building blocks

function Chip({ label, raw, tone, strong }: { label: string; raw?: string; tone?: string; strong?: boolean }) {
  const toneClass = tone ? (styles[tone] ?? "") : "";
  return (
    <span className={`${styles.chip} ${toneClass} ${strong ? styles.chipStrong : ""}`}>
      {label}
      {raw && raw !== label ? <span className={styles.chipRaw}>{raw}</span> : null}
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
  lang,
  no,
  title,
  sub,
  tag,
  skipReason,
  children
}: {
  lang: Lang;
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
        {skipped ? (
          <p className={styles.skipNote}>{lang === "zh" ? `未进行 — ${skipReason}` : `Not run — ${skipReason}`}</p>
        ) : (
          children
        )}
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

const VETO_LABELS: Record<string, Bi> = {
  halted: { zh: "账本熔断中", en: "book halted" },
  cooldown: { zh: "止损冷却期", en: "stop-loss cooldown" },
  earnings: { zh: "财报窗口", en: "earnings window" },
  earnings_window: { zh: "财报窗口", en: "earnings window" }
};

const vetoLabel = (lang: Lang, raw: string): string => VETO_LABELS[raw]?.[lang] ?? raw;

const ARCHIVE_STATUSES = new Set(["full", "leaked", "reverse"]);

function oneLine(text: string, max = 110): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function caseOutcome(lang: Lang, c: CaseView): Outcome {
  const d = c.decision;
  const mat = c.signal?.materiality ?? null;
  const pin = c.signal?.pricedIn ?? null;
  const zh = lang === "zh";

  // A real PM action (or veto) is the strongest outcome — report it first.
  if (d?.audit?.vetoedBy) {
    return {
      label: zh ? `PM 否决 · ${vetoLabel("zh", d.audit.vetoedBy)}` : `PM veto · ${vetoLabel("en", d.audit.vetoedBy)}`,
      tone: "outRed",
      rawLine: `vetoedBy=${d.audit.vetoedBy}`
    };
  }
  if (d && (d.action === "open" || d.action === "add" || d.action === "flip")) {
    const dir = d.direction ? ` · ${labelTradeDirection(lang, d.direction)}` : "";
    return {
      label: zh ? `已开仓${dir}` : `Opened${dir}`,
      tone: "outGreen",
      rawLine: `action=${d.action}${d.direction ? ` direction=${d.direction}` : ""}`
    };
  }
  if (d && (d.action === "close" || d.action === "trim")) {
    return {
      label: zh ? `已${labelAction("zh", d.action)}` : d.action === "close" ? "Closed" : "Trimmed",
      tone: "outBlue",
      rawLine: `action=${d.action}`
    };
  }
  if (c.thesis && d && d.action === "no_trade") {
    return {
      label: zh ? "已分析 · 不开仓" : "Analyzed · no trade",
      tone: "outAmber",
      rawLine: "action=no_trade",
      note: d.reason ? oneLine(d.reason) : undefined
    };
  }

  // No decision — say where the pipeline stopped, in reader terms.
  if (!c.signal || !mat || mat.tickers.length === 0) {
    return {
      label: zh ? "不相关 · 非股票池" : "Irrelevant · outside universe",
      tone: "outGrey",
      rawLine: c.signal ? (mat ? "materiality.tickers=[]" : "materiality=null") : "signal=null"
    };
  }
  if (mat.factLevel === "opinion" || mat.tradeable === false) {
    const reason = mat.reason.toLowerCase();
    const isRepeat = reason.includes("stale") || reason.includes("duplicate");
    return {
      label: isRepeat ? (zh ? "重复旧闻" : "Stale repeat") : zh ? "重要性不足" : "Below importance bar",
      tone: "outGrey",
      rawLine: `tradeable=${mat.tradeable === null ? "null" : String(mat.tradeable)} factLevel=${mat.factLevel || "—"} score=${mat.score ?? "—"}`
    };
  }
  if (pin?.status === "full") {
    return { label: zh ? "已被市场定价" : "Already priced in", tone: "outSlate", rawLine: "pricedIn=full" };
  }
  if (pin?.status === "reverse") {
    return {
      label: zh ? "走势反向 · 仅记录" : "Reverse move · logged only",
      tone: "outPurple",
      rawLine: "pricedIn=reverse"
    };
  }
  if (pin?.status === "awaiting_market") {
    return { label: zh ? "待行情" : "Awaiting market", tone: "outBlue", rawLine: "pricedIn=awaiting_market" };
  }
  if (pin?.status === "leaked") {
    return {
      label: zh ? "疑似提前泄露 · 已分析" : "Possible leak · analyzed",
      tone: "outOrange",
      rawLine: "pricedIn=leaked"
    };
  }
  if (c.thesis) {
    return {
      label: zh ? "已分析 · 无决策记录" : "Analyzed · no decision recorded",
      tone: "outGrey",
      rawLine: "thesis!=null decision=null"
    };
  }
  if (!pin) {
    return {
      label: zh ? "通过重要性检查 · 定价检查未运行" : "Passed importance gate · priced-in gate not run",
      tone: "outGrey",
      rawLine: "pricedIn=null"
    };
  }
  return {
    label: zh ? "通过两道检查 · 无研究记录" : "Passed both gates · no research recorded",
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

function TimingStrip({ lang, t: timings }: { lang: Lang; t: TimingsMsView | null }) {
  if (!timings) return null;
  const s = t(lang);
  const segs: Array<{ label: string; key: string; v: number | null; title?: string }> = [
    { label: s("timingPublish"), key: "publishToSeen", v: timings.publishToSeen, title: s("timingTitle") },
    { label: s("timingGates"), key: "seenToSignal", v: timings.seenToSignal },
    { label: s("timingResearch"), key: "signalToThesis", v: timings.signalToThesis },
    { label: s("timingDecision"), key: "thesisToDecision", v: timings.thesisToDecision },
    { label: s("timingE2E"), key: "seenToDecision", v: timings.seenToDecision }
  ];
  return (
    <div className={styles.timingStrip} aria-label={s("timingAria")}>
      <span className={styles.timingCaption}>{s("timingCaption")}</span>
      {segs.map((seg) => (
        <span key={seg.key} className={styles.timingSeg} title={seg.title}>
          <span className={styles.timingLabel}>{seg.label}</span>
          <span className={styles.timingValue}>{fmtDurationMs(lang, seg.v)}</span>
        </span>
      ))}
      <span className={styles.timingNote}>{s("timingNote")}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Station 1 — 情报台

/** Archived original text of the news item: full paste tier > feed teaser tier. */
function ArchivedOriginal({ lang, news }: { lang: Lang; news: NewsView }) {
  const s = t(lang);
  const body = news.fullText ?? news.teaser;
  const tier = news.fullText ? s("archiveFull") : news.teaser ? s("archiveTeaser") : null;
  return (
    <div className={styles.archive}>
      <div className={styles.archiveHead}>
        <span className={styles.archiveTitle}>{s("archiveTitle")}</span>
        {tier ? <Chip label={tier} raw={news.fullText ? "fullText" : "teaser"} tone="outBlue" /> : null}
        {news.source ? <Chip label={newsSourceName(news.source)} raw={news.source} /> : null}
        {news.url ? (
          <a className={styles.srcLink} href={news.url} target="_blank" rel="noopener noreferrer">
            {s("archiveLink")}
          </a>
        ) : null}
      </div>
      {body ? (
        <div className={styles.archiveBody}>{body}</div>
      ) : (
        <p className={styles.archiveEmpty}>{s("archiveEmpty")}</p>
      )}
    </div>
  );
}

function NewsStation({ lang, c }: { lang: Lang; c: CaseView }) {
  const s = t(lang);
  const { news, signal } = c;
  const lagMin = minutesBetween(news.publishedUtc, news.seenAtUtc);
  return (
    <Station lang={lang} no={1} title={s("st1Title")} sub={s("st1Sub")} tag="ingest">
      <div className={styles.chipRow}>
        <Chip label={labelKind(lang, news.kind)} raw={news.kind} />
        <Chip
          label={labelPrefix(lang, news.prefix)}
          raw={news.prefix}
          tone={news.prefix === "reportedly" ? "outAmber" : undefined}
        />
      </div>
      <ArchivedOriginal lang={lang} news={news} />
      <div className={styles.kvGrid}>
        <KV label={s("kvPublished")}>{fmtUtc(news.publishedUtc)}</KV>
        <KV label={s("kvSeen")}>{fmtUtc(news.seenAtUtc)}</KV>
        <KV label={s("kvPubSeenDelta")}>{fmtMinutes(lang, lagMin)}</KV>
        <KV label={s("kvFirstSeen")}>{signal ? fmtUtc(signal.firstSeenUtc) : "—"}</KV>
        <KV label={s("kvFingerprint")}>
          <span className={styles.mono}>{signal?.fingerprint || "—"}</span>
        </KV>
        <KV label={s("kvNewsId")}>
          <span className={styles.mono}>{news.newsId || "—"}</span>
        </KV>
      </div>
      {signal?.firstSeenBasis ? <Quote label={s("quoteFirstSeenBasis")} text={signal.firstSeenBasis} /> : null}
    </Station>
  );
}

// ---------------------------------------------------------------------------
// Station 2 — 重要性检查（原 M1 · 闸门1）

function MaterialityStation({
  lang,
  signal,
  skipReason
}: {
  lang: Lang;
  signal: SignalView | null;
  skipReason: string | null;
}) {
  const s = t(lang);
  const mat = signal?.materiality ?? null;
  if (!signal || !mat) {
    return (
      <Station
        lang={lang}
        no={2}
        title={s("st2Title")}
        sub={s("st2Sub")}
        tag={s("st2Tag")}
        skipReason={skipReason ?? s("matNotRecorded")}
      />
    );
  }
  return (
    <Station lang={lang} no={2} title={s("st2Title")} sub={s("st2Sub")} tag={s("st2Tag")}>
      <div className={styles.chipRow}>
        {mat.tradeable === null ? (
          <Chip label={s("matVerdictMissing")} raw="tradeable:null" tone="outGrey" />
        ) : (
          <Chip
            label={mat.tradeable ? s("matPass") : s("matFail")}
            raw={`tradeable:${mat.tradeable}`}
            tone={mat.tradeable ? "outGreen" : "outGrey"}
            strong
          />
        )}
        <Chip
          label={
            lang === "zh"
              ? `评分 ${mat.score === null ? "—" : mat.score}/100`
              : `Score ${mat.score === null ? "—" : mat.score}/100`
          }
          raw="score"
          strong
        />
        <Chip label={labelEventType(lang, mat.eventType)} raw={mat.eventType} />
        <Chip label={labelFactLevel(lang, mat.factLevel)} raw={mat.factLevel} />
        <Chip label={labelNewsDirection(lang, signal.expectedDirection)} raw={signal.expectedDirection} />
        <Chip
          label={
            lang === "zh"
              ? `预估幅度：${labelImpactBand("zh", signal.coarseImpactBand)}`
              : `Est. move: ${labelImpactBand("en", signal.coarseImpactBand)}`
          }
          raw={signal.coarseImpactBand}
        />
        {mat.tickers.length > 0 ? (
          mat.tickers.map((ticker) => <Chip key={ticker} label={ticker} tone="outBlue" strong />)
        ) : (
          <Chip label={s("matNoTicker")} tone="outGrey" />
        )}
      </div>
      <Quote label={s("quoteSurprise")} text={mat.surpriseNote} />
      <Quote label={s("quoteReason")} text={mat.reason} />
    </Station>
  );
}

// ---------------------------------------------------------------------------
// Station 3 — 定价检查（原 M1 · 闸门2）

function PricedInStation({
  lang,
  signal,
  skipReason
}: {
  lang: Lang;
  signal: SignalView | null;
  skipReason: string | null;
}) {
  const s = t(lang);
  const pin = signal?.pricedIn ?? null;
  if (!pin) {
    return (
      <Station
        lang={lang}
        no={3}
        title={s("st3Title")}
        sub={s("st3Sub")}
        tag={s("st3Tag")}
        skipReason={skipReason ?? s("pinNotRecorded")}
      />
    );
  }
  return (
    <Station lang={lang} no={3} title={s("st3Title")} sub={s("st3Sub")} tag={s("st3Tag")}>
      <div className={styles.chipRow}>
        <Chip label={labelPricedIn(lang, pin.status)} raw={pin.status} tone={pricedInTone(pin.status)} strong />
        <Chip
          label={
            lang === "zh"
              ? `判定信心：${labelConfidence("zh", pin.confidence)}`
              : `Verdict confidence: ${labelConfidence("en", pin.confidence)}`
          }
          raw={pin.confidence}
        />
        <Chip label={labelSession(lang, pin.sessionBucket)} raw={pin.sessionBucket} />
        <Chip
          label={lang === "zh" ? `行情源：${pin.dataBasis || "—"}` : `Data basis: ${pin.dataBasis || "—"}`}
          raw={pin.dataBasis}
        />
      </div>
      <div className={styles.kvGrid}>
        <KV label={s("kvRealizedExcess")}>{fmtPct(pin.realizedExcessPct, { signed: true })}</KV>
        <KV label={s("kvBetaBench")}>
          {lang === "zh"
            ? `${fmtBeta(pin.betaUsed)}（${labelBenchmark("zh", pin.benchmarkUsed) || "—"}）`
            : `${fmtBeta(pin.betaUsed)} (${labelBenchmark("en", pin.benchmarkUsed) || "—"})`}
        </KV>
        <KV label={s("kvVolumeZ")}>{pin.volumeZ === null ? "—" : pin.volumeZ.toFixed(2)}</KV>
        <KV label={s("kvTEval")}>{fmtUtc(pin.tEvalUtc)}</KV>
        <KV label={s("kvDeltaT")}>{fmtMinutes(lang, pin.deltaTMinutes)}</KV>
      </div>
      <Quote label={s("quotePinNote")} text={pin.note} />
    </Station>
  );
}

// ---------------------------------------------------------------------------
// Station 4 — 研究 memo (M2)

function ThesisStation({
  lang,
  thesis,
  skipReason
}: {
  lang: Lang;
  thesis: ThesisView | null;
  skipReason: string | null;
}) {
  const s = t(lang);
  if (!thesis) {
    return (
      <Station
        lang={lang}
        no={4}
        title={s("st4Title")}
        sub={s("st4Sub")}
        tag="M2 · analysis"
        skipReason={skipReason ?? s("thesisNotRecorded")}
      />
    );
  }
  const fair = thesis.fairImpactPct;
  const contaminationTone =
    thesis.contamination === "hard" ? "outRed" : thesis.contamination === "soft" ? "outAmber" : "outGreen";
  return (
    <Station lang={lang} no={4} title={s("st4Title")} sub={s("st4Sub")} tag="M2 · analysis">
      <div className={styles.chipRow}>
        <Chip label={thesis.ticker || "—"} tone="outBlue" strong />
        <Chip
          label={labelTradeDirection(lang, thesis.direction)}
          raw={thesis.direction}
          tone={thesis.direction === "long" ? "outGreen" : thesis.direction === "short" ? "outRed" : undefined}
          strong
        />
        <Chip
          label={
            lang === "zh"
              ? `信心：${labelConfidence("zh", thesis.confidence)}`
              : `Confidence: ${labelConfidence("en", thesis.confidence)}`
          }
          raw={thesis.confidence}
        />
        <Chip
          label={labelContamination(lang, thesis.contamination)}
          raw={thesis.contamination}
          tone={contaminationTone}
        />
        <Chip
          label={
            lang === "zh"
              ? `分析引擎：${labelProvider("zh", thesis.provider)}`
              : `Engine: ${labelProvider("en", thesis.provider)}`
          }
          raw={thesis.provider}
        />
        <Chip
          label={
            lang === "zh"
              ? `持有窗口 ${fmtHours("zh", thesis.horizonHours)}`
              : `Horizon ${fmtHours("en", thesis.horizonHours)}`
          }
          raw="horizonHours"
        />
      </div>
      {fair ? (
        <div className={styles.bigNums}>
          <div className={styles.bigNum}>
            <span className={styles.bigNumLabel}>{s("bigMin")}</span>
            <span className={styles.bigNumValue}>{fmtPct(fair.min, { signed: true })}</span>
          </div>
          <div className={`${styles.bigNum} ${styles.bigNumMain}`}>
            <span className={styles.bigNumLabel}>{s("bigPoint")}</span>
            <span className={styles.bigNumValue}>{fmtPct(fair.point, { signed: true })}</span>
          </div>
          <div className={styles.bigNum}>
            <span className={styles.bigNumLabel}>{s("bigMax")}</span>
            <span className={styles.bigNumValue}>{fmtPct(fair.max, { signed: true })}</span>
          </div>
        </div>
      ) : (
        <p className={styles.skipNote}>{s("fairMissing")}</p>
      )}
      {thesis.impactPath.length > 0 ? (
        <>
          <p className={styles.subHead}>{s("subImpactPath")}</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>step</th>
                  <th>value</th>
                </tr>
              </thead>
              <tbody>
                {thesis.impactPath.map((step, i) => (
                  <tr key={i}>
                    <td>{step.step}</td>
                    <td>{step.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {thesis.evidence.length > 0 ? (
        <>
          <p className={styles.subHead}>{s("subEvidence")}</p>
          <ul className={styles.plainList}>
            {thesis.evidence.map((e, i) => (
              <li key={i}>
                {e.point}
                <span className={styles.srcMeta}>
                  {e.source ? (lang === "zh" ? `来源：${e.source} · ` : `Source: ${e.source} · `) : ""}
                  {labelCredibility(lang, e.credibility)}
                  <span className={styles.mono}> {e.credibility}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {thesis.catalysts.length > 0 ? (
        <>
          <p className={styles.subHead}>{s("subCatalysts")}</p>
          <ul className={styles.plainList}>
            {thesis.catalysts.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </>
      ) : null}
      {thesis.falsifiers.length > 0 ? (
        <>
          <p className={styles.subHead}>{s("subFalsifiers")}</p>
          <ul className={styles.plainList}>
            {thesis.falsifiers.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </>
      ) : null}
      {thesis.limitations.length > 0 ? (
        <>
          <p className={styles.subHead}>{s("subLimitations")}</p>
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

function DecisionStation({
  lang,
  decision,
  skipReason
}: {
  lang: Lang;
  decision: DecisionView | null;
  skipReason: string | null;
}) {
  const s = t(lang);
  if (!decision) {
    return (
      <Station
        lang={lang}
        no={5}
        title={s("st5Title")}
        sub={s("st5Sub")}
        tag="M3 · decision"
        skipReason={skipReason ?? s("decNotRecorded")}
      />
    );
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
    <Station lang={lang} no={5} title={s("st5Title")} sub={s("st5Sub")} tag="M3 · decision">
      <div className={styles.chipRow}>
        <Chip
          label={
            vetoed
              ? lang === "zh"
                ? `否决 · ${vetoLabel("zh", vetoed)}`
                : `Veto · ${vetoLabel("en", vetoed)}`
              : labelAction(lang, decision.action)
          }
          raw={vetoed ? `vetoedBy:${vetoed}` : decision.action}
          tone={vetoed ? "outRed" : actionTone(decision.action)}
          strong
        />
        {decision.direction ? (
          <Chip label={labelTradeDirection(lang, decision.direction)} raw={decision.direction} />
        ) : null}
        <Chip label={decision.ticker || "—"} tone="outBlue" />
        <Chip
          label={lang === "zh" ? `决策参考价 ${fmtPx(decision.refPx)}` : `Ref px ${fmtPx(decision.refPx)}`}
          raw="refPx"
        />
        <Chip label={fmtUtc(decision.createdAtUtc)} raw="createdAtUtc" />
      </div>

      {audit ? (
        <>
          {edge ? (
            <>
              <p className={styles.subHead}>{s("subEdge")}</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>
                        {s("thConservative")} <span className={styles.mono}>conservativePct</span>
                      </th>
                      <th>
                        {s("thPoint")} <span className={styles.mono}>pointPct</span>
                      </th>
                      <th>
                        {s("thRealized")} <span className={styles.mono}>realizedPct</span>
                      </th>
                      <th>
                        {s("thResidual")} <span className={styles.mono}>residualPct</span>
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
            <p className={styles.skipNote}>{s("edgeMissing")}</p>
          )}

          {thr ? (
            <>
              <p className={styles.subHead}>{s("subThreshold")}</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{s("thCostItem")}</th>
                      <th>{s("thFormula")}</th>
                      <th className={styles.num}>{s("thValue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        {s("rowTakerFee")} <span className={styles.mono}>takerFeePct</span>
                      </td>
                      <td className={styles.formulaCell}>{s("fOneWay")}</td>
                      <td className={styles.num}>{fmtPct(thr.takerFeePct)}</td>
                    </tr>
                    <tr>
                      <td>
                        {s("rowSlippage")} <span className={styles.mono}>slippagePct</span>
                      </td>
                      <td className={styles.formulaCell}>{s("fOneWayEst")}</td>
                      <td className={styles.num}>{fmtPct(thr.slippagePct)}</td>
                    </tr>
                    <tr>
                      <td>
                        {s("rowFunding")} <span className={styles.mono}>fundingPct</span>
                      </td>
                      <td className={styles.formulaCell}>{s("fFunding")}</td>
                      <td className={styles.num}>{fmtPct(thr.fundingPct)}</td>
                    </tr>
                    <tr>
                      <td>
                        {s("rowRoundTrip")} <span className={styles.mono}>roundTripPct</span>
                      </td>
                      <td className={styles.formulaCell}>{s("fRoundTrip")}</td>
                      <td className={styles.num}>{fmtPct(thr.roundTripPct)}</td>
                    </tr>
                    <tr className={costBinds ? styles.hlRow : undefined}>
                      <td>
                        {s("rowCostFloor")} <span className={styles.mono}>costFloorPct</span>
                      </td>
                      <td className={styles.formulaCell}>{s("fCostFloor")}</td>
                      <td className={styles.num}>{fmtPct(thr.costFloorPct)}</td>
                    </tr>
                    <tr className={volBinds ? styles.hlRow : undefined}>
                      <td>
                        {s("rowVolFloor")} <span className={styles.mono}>volFloorPct</span>
                      </td>
                      <td className={styles.formulaCell}>{s("fVolFloor")}</td>
                      <td className={styles.num}>{fmtPct(thr.volFloorPct)}</td>
                    </tr>
                    <tr className={styles.hlRow}>
                      <td>
                        {s("rowThreshold")} <span className={styles.mono}>thresholdPct</span>
                      </td>
                      <td className={styles.formulaCell}>
                        {s("fThreshold")}
                        {volBinds ? s("fVolBinds") : costBinds ? s("fCostBinds") : ""}
                      </td>
                      <td className={styles.num}>{fmtPct(thr.thresholdPct)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {passed !== null && edge ? (
                <p className={styles.verdictLine}>
                  {lang === "zh"
                    ? `残余 edge ${fmtPct(edge.residualPct, { signed: true })} ${passed ? "≥" : "<"} 门槛 ${fmtPct(thr.thresholdPct)} → `
                    : `Residual edge ${fmtPct(edge.residualPct, { signed: true })} ${passed ? "≥" : "<"} threshold ${fmtPct(thr.thresholdPct)} → `}
                  <Chip
                    label={passed ? s("verdictPass") : s("verdictFail")}
                    tone={passed ? "outGreen" : "outRed"}
                    strong
                  />
                </p>
              ) : null}
            </>
          ) : (
            <p className={styles.skipNote}>{s("thresholdMissing")}</p>
          )}

          {stop ? (
            <>
              <p className={styles.subHead}>{s("subStopMenu")}</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{s("thCandidate")}</th>
                      <th className={styles.num}>{s("thPxValue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        {s("rowAtr")} <span className={styles.mono}>atr20d</span>
                      </td>
                      <td className={styles.num}>{fmtPx(stop.atr20d)}</td>
                    </tr>
                    <tr>
                      <td>
                        {s("rowAtrStop")} <span className={styles.mono}>atrStopPx</span>
                      </td>
                      <td className={styles.num}>{fmtPx(stop.atrStopPx)}</td>
                    </tr>
                    <tr>
                      <td>
                        {s("rowSwing")} <span className={styles.mono}>swingPx</span>
                      </td>
                      <td className={styles.num}>{fmtPx(stop.swingPx)}</td>
                    </tr>
                    <tr>
                      <td>
                        {s("rowHardFloor")} <span className={styles.mono}>hardFloorPx</span>
                        {s("hardFloorSuffix")}
                      </td>
                      <td className={styles.num}>{fmtPx(stop.hardFloorPx)}</td>
                    </tr>
                    <tr className={styles.hlRow}>
                      <td>
                        {s("rowChosenStop")} <span className={styles.mono}>chosenPx</span>
                      </td>
                      <td className={styles.num}>{fmtPx(stop.chosenPx)}</td>
                    </tr>
                    <tr>
                      <td>
                        {s("rowStopDist")} <span className={styles.mono}>stopDistPct</span>
                      </td>
                      <td className={styles.num}>{fmtFracPct(stop.stopDistPct)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className={styles.skipNote}>{s("stopMenuMissing")}</p>
          )}

          {sizing ? (
            <>
              <p className={styles.subHead}>{s("subSizing")}</p>
              <div className={styles.eqLine}>
                <span className={styles.eqPart}>
                  <span className={styles.eqValue}>{fmtUsd(sizing.equityUsd)}</span>
                  <span className={styles.eqLabel}>{s("eqEquity")}</span>
                </span>
                <span className={styles.eqOp}>×</span>
                <span className={styles.eqPart}>
                  <span className={styles.eqValue}>{fmtFracPct(sizing.riskBudgetPct)}</span>
                  <span className={styles.eqLabel}>{s("eqRiskBudget")}</span>
                </span>
                <span className={styles.eqOp}>÷</span>
                <span className={styles.eqPart}>
                  <span className={styles.eqValue}>{fmtFracPct(stop?.stopDistPct ?? null)}</span>
                  <span className={styles.eqLabel}>{s("eqStopDist")}</span>
                </span>
                <span className={styles.eqOp}>=</span>
                <span className={`${styles.eqPart} ${styles.eqPartHl}`}>
                  <span className={styles.eqValue}>{fmtUsd(sizing.intendedNotionalUsd)}</span>
                  <span className={styles.eqLabel}>{s("eqIntended")}</span>
                </span>
              </div>
              {sizing.guards.length > 0 ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{s("thGuard")}</th>
                        <th className={styles.num}>{s("thCap")}</th>
                        <th className={styles.num}>{s("thNotionalAfter")}</th>
                        <th>{s("thStatus")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sizing.guards.map((g, i) => {
                        const binding = decision.bindingConstraint !== null && g.name === decision.bindingConstraint;
                        return (
                          <tr key={i} className={g.clipped ? styles.hlRow : undefined}>
                            <td>
                              {labelGuard(lang, g.name)} <span className={styles.mono}>{g.name}</span>
                            </td>
                            <td className={styles.num}>{fmtUsd(g.capUsd)}</td>
                            <td className={styles.num}>{fmtUsd(g.notionalAfterUsd)}</td>
                            <td>
                              {g.clipped ? <span className={styles.tagClipped}>{s("tagClipped")}</span> : s("tagPass")}
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
                <KV label={s("kvFinalNotional")}>
                  <strong>{fmtUsd(sizing.finalNotionalUsd)}</strong>
                </KV>
                {sizing.leverage ? (
                  <KV label={s("kvLevCaps")}>
                    {fmtX(sizing.leverage.configCap)} / {fmtX(sizing.leverage.volCap)} /{" "}
                    {fmtX(sizing.leverage.venueCap)} → <strong>{fmtX(sizing.leverage.chosen)}</strong>
                    {sizing.leverage.chosen !== null && sizing.leverage.chosen <= 1 ? (
                      <span className={styles.kvNote}>{s("levNote")}</span>
                    ) : null}
                  </KV>
                ) : (
                  <KV label={s("kvLevCapsShort")}>—</KV>
                )}
              </div>
            </>
          ) : (
            <p className={styles.skipNote}>{s("sizingMissing")}</p>
          )}

          {mkt ? (
            <div className={styles.chipRow}>
              <Chip label={`mark ${fmtPx(mkt.markPx)}`} raw="markPx" />
              <Chip
                label={
                  lang === "zh" ? `日波动 ${fmtFracPct(mkt.dailyVolPct)}` : `daily vol ${fmtFracPct(mkt.dailyVolPct)}`
                }
                raw="dailyVolPct"
              />
              <Chip
                label={
                  lang === "zh"
                    ? `最大日内波动 ${fmtFracPct(mkt.maxDailyMovePct)}`
                    : `max daily move ${fmtFracPct(mkt.maxDailyMovePct)}`
                }
                raw="maxDailyMovePct"
              />
              <Chip
                label={
                  lang === "zh"
                    ? `资金费率 ${fmtFracPct(mkt.fundingHourly)}/小时`
                    : `funding ${fmtFracPct(mkt.fundingHourly)}/h`
                }
                raw="fundingHourly"
              />
              <Chip label={`β ${fmtBeta(mkt.beta)}`} raw="beta" />
            </div>
          ) : null}
        </>
      ) : (
        <p className={styles.skipNote}>{s("noAuditNote")}</p>
      )}

      {decision.action !== "no_trade" || decision.sizeUsd ? (
        <div className={styles.kvGrid}>
          <KV label={s("kvSizeUsd")}>{fmtUsd(decision.sizeUsd)}</KV>
          <KV label={s("kvLeverage")}>{fmtX(decision.leverage)}</KV>
          <KV label={s("kvIntendedRisk")}>{fmtFracPct(decision.intendedRiskPct)}</KV>
          <KV label={s("kvRealizedRisk")}>{fmtFracPct(decision.realizedRiskPct)}</KV>
          <KV label={s("kvResidualEdge")}>{fmtPct(decision.residualEdgePct)}</KV>
          <KV label={s("kvBinding")}>
            {decision.bindingConstraint ? (
              <>
                {labelGuard(lang, decision.bindingConstraint)}{" "}
                <span className={styles.mono}>{decision.bindingConstraint}</span>
              </>
            ) : (
              "—"
            )}
          </KV>
          <KV label={s("kvHorizon")}>{fmtUtc(decision.horizonUtc)}</KV>
          <KV label={s("kvTarget")}>
            {decision.targetPctExcess
              ? `${fmtPct(decision.targetPctExcess.lo)} ~ ${fmtPct(decision.targetPctExcess.hi)}`
              : "—"}
          </KV>
          {decision.stop ? (
            <KV label={s("kvStopPair")}>
              {fmtPx(decision.stop.initialPx)} / {fmtPx(decision.stop.hardFloorPx)}
              {s("hardFloorSuffix")}
            </KV>
          ) : null}
        </div>
      ) : null}
      {decision.stop?.rule ? <Quote label={s("quoteStopRule")} text={decision.stop.rule} /> : null}
      <Quote label={s("quoteDecisionReason")} text={decision.reason} />
      <p className={styles.mono}>decision id: {decision.id || "—"}</p>
    </Station>
  );
}

// ---------------------------------------------------------------------------
// Station 6 — 执行与风控

function PostStation({ lang, c, skipReason }: { lang: Lang; c: CaseView; skipReason: string | null }) {
  const s = t(lang);
  const { execution, positionNow, postEvents, decision } = c;
  if (!execution && !positionNow && postEvents.length === 0) {
    return (
      <Station lang={lang} no={6} title={s("st6Title")} tag="paper book" skipReason={skipReason ?? s("postNoRecord")} />
    );
  }
  const slippage =
    execution !== null &&
    execution.fillPx !== null &&
    decision !== null &&
    decision.refPx !== null &&
    decision.refPx !== 0
      ? (execution.fillPx - decision.refPx) / decision.refPx
      : null;
  return (
    <Station lang={lang} no={6} title={s("st6Title")} tag="paper book">
      {execution ? (
        <>
          <p className={styles.subHead}>{s("subExecution")}</p>
          <div className={styles.kvGrid}>
            <KV label={s("kvExecType")}>
              {labelPostEvent(lang, execution.type)} <span className={styles.mono}>{execution.type}</span>
            </KV>
            <KV label={s("kvExecTs")}>{fmtUtc(execution.ts)}</KV>
            <KV label={s("kvDirQty")}>
              {execution.direction ? labelTradeDirection(lang, execution.direction) : "—"} · {fmtQty(execution.qty)}
            </KV>
            <KV label={s("kvFillPx")}>{fmtPx(execution.fillPx)}</KV>
            <KV label={s("kvExecNotional")}>{fmtUsd(execution.sizeUsd)}</KV>
            <KV label={s("kvSlippage")}>
              {slippage === null ? (
                "—"
              ) : (
                <>
                  {fmtPx(execution.fillPx)} vs {fmtPx(decision?.refPx ?? null)} ={" "}
                  {fmtFracPct(slippage, { signed: true })}
                </>
              )}
            </KV>
          </div>
        </>
      ) : null}
      {positionNow ? (
        <PositionBlock lang={lang} p={positionNow} />
      ) : execution ? (
        <p className={styles.skipNote}>{s("posGone")}</p>
      ) : null}
      <p className={styles.subHead}>{s("subPostEvents")}</p>
      {postEvents.length === 0 ? (
        <p className={styles.skipNote}>{s("postEventsEmpty")}</p>
      ) : (
        <ul className={styles.timeline}>
          {postEvents.map((e, i) => (
            <li key={i} className={styles.timelineItem}>
              <Chip
                label={labelPostEvent(lang, e.type)}
                raw={e.type}
                tone={e.type === "hard_floor_stop" ? "outRed" : e.type === "stop_loss" ? "outAmber" : "outBlue"}
                strong
              />
              <span>{fmtUtc(e.ts)}</span>
              {e.pnlUsd !== null ? (
                <span className={e.pnlUsd >= 0 ? styles.pos : styles.neg}>
                  {lang === "zh" ? `盈亏 ${fmtSignedUsd(e.pnlUsd)}` : `PnL ${fmtSignedUsd(e.pnlUsd)}`}
                </span>
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

function PositionBlock({ lang, p }: { lang: Lang; p: PositionNowView }) {
  const s = t(lang);
  return (
    <>
      <p className={styles.subHead}>{s("subPosition")}</p>
      <div className={styles.kvGrid}>
        <KV label={s("kvTickerDir")}>
          {p.ticker} · {labelTradeDirection(lang, p.direction)}
        </KV>
        <KV label={s("kvEntryQty")}>
          {fmtPx(p.entryPx)} · {fmtQty(p.qty)}
        </KV>
        <KV label={s("kvEntryNotional")}>{fmtUsd(p.notionalUsdAtEntry)}</KV>
        <KV label={s("kvLeverage")}>{fmtX(p.leverage)}</KV>
        <KV label={s("kvCurMark")}>{p.markPx === null ? s("noLiveMark") : fmtPx(p.markPx)}</KV>
        <KV label={s("kvUnrealized")}>
          {p.unrealizedPnlUsd === null ? s("noLiveMark") : fmtSignedUsd(p.unrealizedPnlUsd)}
        </KV>
        <KV label={s("kvStopPx")}>{fmtPx(p.stopPx)}</KV>
        <KV label={s("kvHardFloorPx")}>{fmtPx(p.hardFloorPx)}</KV>
        <KV label={s("kvHorizon")}>{fmtUtc(p.horizonUtc)}</KV>
        <KV label={s("kvBaseline")}>{fmtPx(p.baselinePx)}</KV>
        <KV label={s("kvBenchBaseline")}>{fmtPx(p.benchmarkBaselinePx)}</KV>
        <KV label={s("kvBetaTrail")}>
          {fmtBeta(p.beta)} · {p.trailArmed === null ? "—" : p.trailArmed ? s("trailArmed") : s("trailNot")}
        </KV>
        <KV label={s("kvTarget")}>
          {p.targetPctExcess ? `${fmtPct(p.targetPctExcess.lo)} ~ ${fmtPct(p.targetPctExcess.hi)}` : "—"}
        </KV>
        <KV label={s("kvHighClose")}>{fmtPx(p.highestClosePx)}</KV>
        <KV label={s("kvEntryUtc")}>{fmtUtc(p.entryUtc)}</KV>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Case card: summary line + six-station chain

function skipReasons(
  lang: Lang,
  c: CaseView
): { st2: string | null; st3: string | null; st4: string | null; st5: string | null; st6: string | null } {
  const s = t(lang);
  const zh = lang === "zh";
  const mat = c.signal?.materiality ?? null;
  const pin = c.signal?.pricedIn ?? null;
  const notTradeable = mat !== null && mat.tradeable === false;
  const pinArchived = pin !== null && ARCHIVE_STATUSES.has(pin.status);
  const st2 =
    c.signal && mat
      ? null
      : c.signal
        ? s("matNotRecorded")
        : zh
          ? "该新闻未生成信号记录"
          : "no signal record for this item";
  const st3 = pin
    ? null
    : !c.signal
      ? zh
        ? "前站已归档（无信号，重要性检查未运行）"
        : "archived upstream (no signal; importance gate never ran)"
      : notTradeable
        ? zh
          ? `前站已归档（重要性检查未通过，评分 ${mat?.score ?? "—"}/100）`
          : `archived upstream (failed the importance gate, score ${mat?.score ?? "—"}/100)`
        : s("pinNotRecorded");
  const st4 = c.thesis
    ? null
    : notTradeable
      ? zh
        ? "前站已归档（重要性检查未通过）"
        : "archived upstream (failed the importance gate)"
      : pinArchived && pin
        ? zh
          ? `前站已归档（定价检查判定「${labelPricedIn("zh", pin.status)}」）`
          : `archived upstream (priced-in gate: "${labelPricedIn("en", pin.status)}")`
        : c.signal
          ? s("thesisNotRecorded")
          : zh
            ? "前站已归档（无信号）"
            : "archived upstream (no signal)";
  const st5 = c.decision
    ? null
    : c.thesis
      ? s("decNotRecorded")
      : zh
        ? "前站已归档（无研究 memo）"
        : "archived upstream (no research memo)";
  const st6 =
    c.execution || c.positionNow || c.postEvents.length > 0
      ? null
      : c.decision
        ? c.decision.action === "open" || c.decision.action === "add" || c.decision.action === "flip"
          ? zh
            ? "上游未记录执行"
            : "execution not recorded upstream"
          : zh
            ? `PM 决策为「${labelAction("zh", c.decision.action)}」，无需执行`
            : `PM decision was "${labelAction("en", c.decision.action)}" — nothing to execute`
        : zh
          ? "前站已归档（无决策）"
          : "archived upstream (no decision)";
  return { st2, st3, st4, st5, st6 };
}

function CaseCard({ lang, c, defaultOpen }: { lang: Lang; c: CaseView; defaultOpen: boolean }) {
  const s = t(lang);
  const outcome = caseOutcome(lang, c);
  const reached = stationsReached(c);
  const tickers = c.thesis?.ticker
    ? [c.thesis.ticker]
    : c.signal?.materiality?.tickers?.length
      ? c.signal.materiality.tickers
      : [];
  const skip = skipReasons(lang, c);
  return (
    <details className={styles.caseCard} open={defaultOpen}>
      <summary className={styles.caseSummary}>
        <div className={styles.sumTop}>
          <Chip label={outcome.label} tone={outcome.tone} strong />
          <span className={styles.sumTitle}>{c.news.title}</span>
        </div>
        {outcome.note ? (
          <p className={styles.sumNote}>{lang === "zh" ? `原因：${outcome.note}` : `Why: ${outcome.note}`}</p>
        ) : null}
        <div className={styles.sumMeta}>
          <span>{lang === "zh" ? `见到 ${fmtUtc(c.news.seenAtUtc)}` : `Seen ${fmtUtc(c.news.seenAtUtc)}`}</span>
          {tickers.length > 0 ? <span>{tickers.join(" · ")}</span> : null}
          <span>{lang === "zh" ? `流程 ${reached}/6 站` : `${reached}/6 stations`}</span>
          <span className={styles.mono}>{outcome.rawLine}</span>
          <span className={styles.sumChevron}>{s("sumExpand")}</span>
        </div>
      </summary>
      <div className={styles.caseBody}>
        <TimingStrip lang={lang} t={c.timingsMs} />
        <ol className={styles.chain}>
          <NewsStation lang={lang} c={c} />
          <MaterialityStation lang={lang} signal={c.signal} skipReason={skip.st2} />
          <PricedInStation lang={lang} signal={c.signal} skipReason={skip.st3} />
          <ThesisStation lang={lang} thesis={c.thesis} skipReason={skip.st4} />
          <DecisionStation lang={lang} decision={c.decision} skipReason={skip.st5} />
          <PostStation lang={lang} c={c} skipReason={skip.st6} />
        </ol>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Reflection footer

function ReflectionFooter({ lang, r }: { lang: Lang; r: ReflectionView }) {
  const s = t(lang);
  const zh = lang === "zh";
  const f = r.funnel;
  const cont = r.contamination;
  const m1 = r.m1Calibration;
  return (
    <section className={styles.section} aria-labelledby="sec-reflection">
      <h2 id="sec-reflection" className={styles.sectionTitle}>
        {zh ? `当日反思关键数（${r.date || "—"}）` : `Daily reflection key numbers (${r.date || "—"})`}
      </h2>
      {f ? (
        <div className={styles.funnelLine}>
          <span className={styles.funnelStep}>{zh ? `新闻 ${fmtInt(f.newsSeen)}` : `News ${fmtInt(f.newsSeen)}`}</span>
          <span className={styles.funnelArrow}>→</span>
          <span className={styles.funnelStep}>{zh ? `信号 ${fmtInt(f.signals)}` : `Signals ${fmtInt(f.signals)}`}</span>
          <span className={styles.funnelArrow}>→</span>
          <span className={styles.funnelStep}>
            {zh
              ? `归档：非股票池 ${fmtInt(f.archivedNoTicker)} · 重要性不足 ${fmtInt(f.archivedNotMaterial)} · 重复旧闻 ${fmtInt(f.archivedStale)} · 已被市场定价 ${fmtInt(f.archivedPricedIn)}`
              : `Archived: outside universe ${fmtInt(f.archivedNoTicker)} · below importance bar ${fmtInt(f.archivedNotMaterial)} · stale repeats ${fmtInt(f.archivedStale)} · already priced in ${fmtInt(f.archivedPricedIn)}`}
          </span>
          <span className={styles.funnelArrow}>→</span>
          <span className={styles.funnelStep}>
            {zh ? `研究 memo ${fmtInt(f.theses)}` : `Research memos ${fmtInt(f.theses)}`}
          </span>
          <span className={styles.funnelArrow}>→</span>
          <span className={styles.funnelStep}>
            {zh
              ? `开仓 ${fmtInt(f.decisionsOpen)} · 不开仓 ${fmtInt(f.decisionsNoTrade)}`
              : `Open ${fmtInt(f.decisionsOpen)} · no-trade ${fmtInt(f.decisionsNoTrade)}`}
          </span>
        </div>
      ) : (
        <p className={styles.sectionNote}>{s("reflectionNoFunnel")}</p>
      )}
      <div className={styles.chipRow}>
        {cont ? (
          <Chip
            label={
              zh
                ? `污染率 ${cont.rate === null ? "—" : `${(cont.rate * 100).toFixed(0)}%`}（研究 ${fmtInt(cont.theses)} 份：重度 ${fmtInt(cont.hard)} · 轻度 ${fmtInt(cont.soft)}）`
                : `Contamination ${cont.rate === null ? "—" : `${(cont.rate * 100).toFixed(0)}%`} (${fmtInt(cont.theses)} memos: hard ${fmtInt(cont.hard)} · soft ${fmtInt(cont.soft)})`
            }
            raw="contamination"
            tone={cont.rate !== null && cont.rate > 0 ? "outAmber" : "outGreen"}
          />
        ) : null}
        {m1?.forwarded ? (
          <Chip
            label={
              zh
                ? `放行样本方向命中 ${fmtInt(m1.forwarded.hits)}/${fmtInt(m1.forwarded.n)}${m1.forwarded.hitRate === null ? "（样本不足）" : ` = ${(m1.forwarded.hitRate * 100).toFixed(0)}%`}`
                : `Forwarded direction hits ${fmtInt(m1.forwarded.hits)}/${fmtInt(m1.forwarded.n)}${m1.forwarded.hitRate === null ? " (sample too small)" : ` = ${(m1.forwarded.hitRate * 100).toFixed(0)}%`}`
            }
            raw="m1Calibration.forwarded"
          />
        ) : null}
        {m1?.archivedFullReverse ? (
          <Chip
            label={
              zh
                ? `错杀检查：归档「已被市场定价/走势反向」${fmtInt(m1.archivedFullReverse.n)} 条，其中随新闻方向走 ${fmtInt(m1.archivedFullReverse.movedWithNews)} 条`
                : `False-kill check: ${fmtInt(m1.archivedFullReverse.n)} archived as priced-in/reverse; ${fmtInt(m1.archivedFullReverse.movedWithNews)} moved with the news`
            }
            raw="m1Calibration.archivedFullReverse"
          />
        ) : null}
        {r.deltaT ? (
          <Chip
            label={
              zh
                ? `t0→评估延迟中位数 ${fmtMinutes("zh", r.deltaT.medianMinutes)}（n=${fmtInt(r.deltaT.n)}）`
                : `Median t0→eval delay ${fmtMinutes("en", r.deltaT.medianMinutes)} (n=${fmtInt(r.deltaT.n)})`
            }
            raw="deltaT"
          />
        ) : null}
        {r.engines.map((e) => (
          <Chip
            key={e.name}
            label={zh ? `${labelProvider("zh", e.name)} ${e.count} 次` : `${labelProvider("en", e.name)} ×${e.count}`}
            raw={e.name}
          />
        ))}
      </div>
      {r.pricedInDistribution.length > 0 ? (
        <p className={styles.sectionNote}>
          {zh ? "定价检查分布：" : "Priced-in gate distribution: "}
          {r.pricedInDistribution
            .map(
              (d) =>
                `${d.status === "not_evaluated" ? (zh ? "未评估" : "not evaluated") : labelPricedIn(lang, d.status)} ${d.count}`
            )
            .join(" · ")}
        </p>
      ) : null}
      {r.noTradeReasons.length > 0 ? (
        <p className={styles.sectionNote}>
          {zh
            ? `不开仓原因：${r.noTradeReasons.map((x) => `「${x.reason}」× ${x.count}`).join("；")}`
            : `No-trade reasons: ${r.noTradeReasons.map((x) => `"${x.reason}" × ${x.count}`).join("; ")}`}
        </p>
      ) : null}
      {r.book ? (
        <p className={styles.sectionNote}>
          {zh
            ? `反思时点账本：权益 ${fmtUsd(r.book.equityUsd)} · 已实现 ${fmtSignedUsd(r.book.realizedPnlUsd)} · 持仓 ${fmtInt(r.book.positions)} · ${r.book.halted ? "已熔断" : "未熔断"}`
            : `Book at reflection: equity ${fmtUsd(r.book.equityUsd)} · realized ${fmtSignedUsd(r.book.realizedPnlUsd)} · positions ${fmtInt(r.book.positions)} · ${r.book.halted ? "halted" : "not halted"}`}
        </p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Glossary (术语表) — plain definitions for every term of art on this page.

const GLOSSARY: Array<{ tag: string; term: Bi; def: Bi }> = [
  {
    tag: "materiality gate",
    term: { zh: "重要性检查", en: "Importance gate" },
    def: {
      zh: "判断新闻是否属于可交易事件类别、主角是否在 21 只股票池内、内容是否超出市场共识。不通过 = 归档，不再消耗任何分析资源。",
      en: "Is this a tradeable event class, is the subject in the 21-stock universe, does it beat market consensus? Fail = archive — no further analyst spend."
    }
  },
  {
    tag: "priced-in gate",
    term: { zh: "定价检查", en: "Priced-in gate" },
    def: {
      zh: "用新闻最早出现时间之后的真实价格走势（β 调整后的超额涨跌），判断市场是否已经消化这条新闻。已定价 / 走势反向 = 归档。",
      en: "Uses the real price path after the news first surfaced (beta-adjusted excess move) to judge whether the market has already digested it. Fully priced / reverse move = archive."
    }
  },
  {
    tag: "residual",
    term: { zh: "残余空间", en: "Residual edge" },
    def: {
      zh: "分析师保守估计的合理涨跌幅，减去市场已经走掉的部分——决定开不开仓的核心数字。",
      en: "The analyst's conservative fair-impact estimate minus what the market has already moved — the single number that decides whether to open."
    }
  },
  {
    tag: "threshold",
    term: { zh: "门槛", en: "Threshold" },
    def: {
      zh: "开仓要求的最小残余空间 = max(3×往返交易成本, 0.5×日波动)，防止为噪音下单。",
      en: "Minimum residual edge required to open = max(3× round-trip cost, 0.5× daily vol) — keeps noise from becoming orders."
    }
  },
  {
    tag: "hard floor",
    term: { zh: "硬地板", en: "Hard floor" },
    def: {
      zh: "用户红线——持仓对入场价反向 20% 无条件平仓，优先级高于一切模型判断。",
      en: "User red line — a position 20% against entry closes unconditionally, overriding every model view."
    }
  },
  {
    tag: "guard",
    term: { zh: "风控闸", en: "Sizing guard" },
    def: {
      zh: "六道敞口上限（单标的 / 总多空 / 同题材簇 / 隔离保证金等），只会把仓位向下裁剪，从不放大。",
      en: "Six exposure caps (per-name / gross long-short / theme cluster / isolated margin, etc.); they only clip size down, never up."
    }
  },
  {
    tag: "beta / excess",
    term: { zh: "β / 超额", en: "Beta / excess" },
    def: {
      zh: "个股涨跌扣掉大盘（XYZ100 指数）联动后的剩余部分——避免把大盘行情误认成新闻反应。",
      en: "The stock's move net of index (XYZ100) co-movement — keeps a market-wide move from being mistaken for news reaction."
    }
  },
  {
    tag: "shadow mode",
    term: { zh: "影子模式", en: "Shadow mode" },
    def: {
      zh: "全流程真实运行但只记账，不向任何交易所发订单。",
      en: "The full pipeline runs for real but only writes to the book; no orders reach any exchange."
    }
  }
];

function Glossary({ lang }: { lang: Lang }) {
  const s = t(lang);
  return (
    <details className={styles.glossary}>
      <summary className={styles.glossarySummary}>{s("glossarySummary")}</summary>
      <dl className={styles.glossaryList}>
        {GLOSSARY.map((g) => (
          <div key={g.tag} className={styles.glossaryItem}>
            <dt className={styles.glossaryTerm}>
              {g.term[lang]} <span className={styles.mono}>{g.tag}</span>
            </dt>
            <dd className={styles.glossaryDef}>{g.def[lang]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Page shell

export function DeltaPmReport({
  payload,
  dataSource,
  lang
}: {
  payload: AuditPayload;
  dataSource: "live" | "baked";
  lang: Lang;
}) {
  const s = t(lang);
  const zh = lang === "zh";
  const p = payload.portfolio;
  const book = payload.latestReflection?.book ?? null;
  const initial = p?.initialCapitalUsd ?? null;
  const realized = p?.realizedPnlUsd ?? null;
  const equity = book?.equityUsd ?? (initial !== null && realized !== null ? initial + realized : null);
  const firstThesisIdx = payload.cases.findIndex((c) => c.thesis !== null);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.kicker}>{s("kicker")}</span>
        <a className={styles.langToggle} href={`/live-delta-pm/lang?to=${otherLang(lang)}`}>
          {LANG_TOGGLE_LABEL[lang]}
        </a>
        <h1 className={styles.title}>{s("title")}</h1>
        <p className={styles.meta}>{s("headerMeta")}</p>
        <div className={styles.bannerRow}>
          <span className={`${styles.banner} ${styles.bannerShadow}`}>{s("bannerShadow")}</span>
          {dataSource === "live" ? (
            <span className={`${styles.banner} ${styles.bannerLive}`}>{s("bannerLive")}</span>
          ) : (
            <span className={`${styles.banner} ${styles.bannerBaked}`}>
              {zh
                ? `烘焙快照回退 · 实时数据暂不可用，显示 ${payload.generatedAtUtc.slice(0, 10) || "—"} 留档`
                : `Baked snapshot fallback · live feed unavailable — showing the ${payload.generatedAtUtc.slice(0, 10) || "—"} archive`}
            </span>
          )}
        </div>
        <p className={styles.meta}>
          {zh
            ? `账本起始 ${fmtUtc(payload.bookStartedUtc)} · 数据生成 ${fmtUtc(payload.generatedAtUtc)}${p ? ` · 组合更新 ${fmtUtc(p.updatedAtUtc)}` : ""}`
            : `Book started ${fmtUtc(payload.bookStartedUtc)} · data generated ${fmtUtc(payload.generatedAtUtc)}${p ? ` · portfolio updated ${fmtUtc(p.updatedAtUtc)}` : ""}`}
        </p>
        {p?.halted ? (
          <div className={styles.haltBar}>
            {zh ? "账本已熔断 HALTED" : "Book HALTED"}
            {p.haltedReason ? ` — ${p.haltedReason}` : ""}
          </div>
        ) : null}
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>{s("tileEquity")}</span>
            <strong className={styles.tileValue}>{fmtUsd(equity)}</strong>
            <span className={styles.tileSub}>
              {initial !== null && equity !== null
                ? `${fmtPct(((equity - initial) / initial) * 100, { signed: true })} ${zh ? "vs 初始" : "vs initial"}`
                : "—"}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>{s("tileInitial")}</span>
            <strong className={styles.tileValue}>{fmtUsd(initial)}</strong>
            <span className={styles.tileSub}>mode: {p?.mode || "—"}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>{s("tileRealized")}</span>
            <strong className={`${styles.tileValue} ${realized !== null && realized < 0 ? styles.neg : styles.pos}`}>
              {fmtSignedUsd(realized)}
            </strong>
            <span className={styles.tileSub}>{s("tileRealizedSub")}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>{s("tilePositions")}</span>
            <strong className={styles.tileValue}>{p ? p.positions.length : "—"}</strong>
            <span className={styles.tileSub}>
              {p && p.positions.length > 0
                ? p.positions.map((x) => `${x.ticker} ${labelTradeDirection(lang, x.direction)}`).join(" · ")
                : s("tileFlat")}
            </span>
          </div>
        </div>
      </header>

      <Glossary lang={lang} />

      <section className={styles.section} aria-labelledby="sec-cases">
        <h2 id="sec-cases" className={styles.sectionTitle}>
          {zh
            ? `决策链（${payload.cases.length} 条新闻，新 → 旧）`
            : `Decision chains (${payload.cases.length} news items, newest → oldest)`}
        </h2>
        <p className={styles.sectionNote}>{s("casesNote")}</p>
        {payload.cases.length === 0 ? (
          <p className={styles.sectionNote}>{s("casesEmpty")}</p>
        ) : (
          payload.cases.map((c, i) => (
            <CaseCard
              key={`${c.news.newsId}-${i}`}
              lang={lang}
              c={c}
              defaultOpen={i === (firstThesisIdx === -1 ? 0 : firstThesisIdx)}
            />
          ))
        )}
      </section>

      {payload.latestReflection ? <ReflectionFooter lang={lang} r={payload.latestReflection} /> : null}

      <footer className={styles.footer}>
        {zh ? "数据来自 Tokyo VM " : "Data from the Tokyo VM "}
        <span className={styles.mono}>/delta-pm/audit</span>
        {zh
          ? "（每次页面请求服务端拉取，成功后缓存 60 秒；连续失败退避 30 秒）。上游不可达时退回烘焙快照，页首会标注数据源。本页为 Phase 0 影子模式审计——所有决策仅记账，不向任何交易所下真实订单。"
          : " (server-side fetch on every page view; 60 s cache after success, 30 s backoff after failures). Falls back to the baked snapshot when the upstream is unreachable — the banner names the source. Phase 0 shadow-mode audit: decisions are book-only; no real orders reach any exchange."}
      </footer>
    </main>
  );
}
