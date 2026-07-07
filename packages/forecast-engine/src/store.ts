// Per-event state persistence + a human-readable, fully-traceable report.
//
// Each forecast lives in runtime-artifacts/forecasts/<eventId>/:
//   state.json  — the machine state (resumable; the loop persists after every round)
//   report.md   — the audit log a human reads: per round, per source, prob from->to
//
// We persist after every round so a crash mid-loop resumes from the last
// committed state (the persist-after-each-transition discipline from rough-loop).

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PROB_CEIL, PROB_FLOOR } from "./bayes";
import { forecastLanguage } from "./language";
import type { ForecastLanguage } from "./language";
import type { AnalystNote, AnalystState, ForecastState, PerSourceUpdate, RoundRecord } from "./types";

export function forecastsRoot(): string {
  const root = process.env.ARTIFACT_STORAGE_ROOT
    ? path.join(process.env.ARTIFACT_STORAGE_ROOT, "forecasts")
    : path.join(process.cwd(), "runtime-artifacts", "forecasts");
  return root;
}

export function makeEventId(question: string): string {
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join("-")
    .slice(0, 48);
  const hash = createHash("sha1").update(question).digest("hex").slice(0, 8);
  return `${slug || "event"}-${hash}`;
}

export function eventDir(eventId: string): string {
  return path.join(forecastsRoot(), eventId);
}

export function loadState(eventId: string): ForecastState | null {
  const file = path.join(eventDir(eventId), "state.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as ForecastState;
  } catch {
    return null;
  }
}

// Atomic write: write to <file>.tmp then rename, so a crash (or a concurrent
// reader — the app polls state.json) can never observe a truncated JSON.
function writeFileAtomic(file: string, data: string): void {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, data, "utf8");
  renameSync(tmp, file);
}

export function saveState(state: ForecastState): string {
  const dir = eventDir(state.eventId);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "state.json");
  writeFileAtomic(file, JSON.stringify(state, null, 2));
  return file;
}

// ---- Analyst-in-the-loop state (analyst.json, written by the app / a human). ----

export function analystPath(eventId: string): string {
  return path.join(eventDir(eventId), "analyst.json");
}

const ANALYST_STANCES = new Set(["yes", "no", "question"]);
const ANALYST_MARKS = new Set(["keep", "doubt"]);

// The analyst file is an external input, so it is normalized defensively:
// missing/corrupt file => empty state; malformed notes and unknown marks are
// dropped rather than crashing a round.
export function loadAnalyst(eventId: string): AnalystState {
  const empty: AnalystState = { notes: [], marks: {} };
  const file = analystPath(eventId);
  if (!existsSync(file)) return empty;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return empty;
  }
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const notes: AnalystNote[] = (Array.isArray(o.notes) ? o.notes : [])
    .map((n) => n as Record<string, unknown>)
    .filter(
      (n) =>
        typeof n.id === "string" &&
        n.id.trim() &&
        typeof n.text === "string" &&
        n.text.trim() &&
        ANALYST_STANCES.has(n.stance as string)
    )
    .map((n) => ({
      id: n.id as string,
      text: n.text as string,
      stance: n.stance as AnalystNote["stance"],
      targetId: typeof n.targetId === "string" && n.targetId ? n.targetId : null,
      createdAtUtc: typeof n.createdAtUtc === "string" ? n.createdAtUtc : "",
      consumedRound:
        typeof n.consumedRound === "number" && Number.isFinite(n.consumedRound) ? n.consumedRound : null,
    }));
  const marks: AnalystState["marks"] = {};
  if (o.marks && typeof o.marks === "object" && !Array.isArray(o.marks)) {
    for (const [k, v] of Object.entries(o.marks as Record<string, unknown>)) {
      if (ANALYST_MARKS.has(v as string)) marks[k] = v as AnalystState["marks"][string];
    }
  }
  const doubtsHandled: Record<string, number> = {};
  if (o.doubtsHandled && typeof o.doubtsHandled === "object" && !Array.isArray(o.doubtsHandled)) {
    for (const [k, v] of Object.entries(o.doubtsHandled as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) doubtsHandled[k] = v;
    }
  }
  return { notes, marks, doubtsHandled };
}

export function saveAnalyst(eventId: string, a: AnalystState): void {
  mkdirSync(eventDir(eventId), { recursive: true });
  writeFileAtomic(analystPath(eventId), JSON.stringify(a, null, 2));
}

// Diagnostic artifacts (e.g. an agent's invalid round output) — persisted next
// to the dossier so production failures are diagnosable after the fact.
export function writeDiagnostic(eventId: string, name: string, content: string): string {
  const dir = eventDir(eventId);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  writeFileSync(file, content, "utf8");
  return file;
}

const pct = (p: number): string => `${(p * 100).toFixed(1)}%`;
const signed = (pp: number): string => `${pp >= 0 ? "+" : ""}${pp.toFixed(1)}pp`;

// ---- report.md rendering (decision-first layout, review 2026-07-06). ----
//
// The verdict block leads (P(YES) + one-line answer + key factors), the audit
// trail follows (trajectory, rounds, ledger), and ALL framing metadata is
// relocated to a bottom appendix — nothing deleted, only reordered for a
// reader who wants the answer first. Static template strings are bilingual
// via FORECAST_LANGUAGE; free text from the state (verdict prose, claims)
// stays in whatever language the LLM wrote.

const H1_MAX_CHARS = 120;
const SOURCE_TITLE_MAX_CHARS = 80;

// Escape a source title for use as a markdown link label: unescaped pipes
// break table rows, unescaped brackets break link syntax, and newlines break
// the row outright. Long titles are truncated so one source cannot swamp a
// table row. Falls back to the bare URL when the title is empty.
export function sourceLabel(title: string, url: string): string {
  const safeUrl = url.replace(/\|/g, "%7C");
  const collapsed = title.replace(/\s+/g, " ").trim();
  if (!collapsed) return safeUrl;
  const truncated =
    collapsed.length > SOURCE_TITLE_MAX_CHARS ? `${collapsed.slice(0, SOURCE_TITLE_MAX_CHARS)}…` : collapsed;
  const escaped = truncated.replace(/\|/g, "\\|").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  return `[${escaped}](${safeUrl})`;
}

// Two-digit anchor id shared by the ledger rows and inline [NN] citations.
const srcAnchor = (n: number): string => `src-${String(n).padStart(2, "0")}`;

// Convert inline [N]/[NN] citations in summary prose into links pointing at
// the cumulative-ledger anchors. Only numbers within the ledger are linked.
function linkCitations(text: string, ledgerLength: number): string {
  return text.replace(/\[(\d{1,2})\]/g, (match, digits: string) => {
    const n = Number.parseInt(digits, 10);
    return n >= 1 && n <= ledgerLength ? `[[${digits}]](#${srcAnchor(n)})` : match;
  });
}

// First sentence of a paragraph — the fallback one-line answer when the
// summary has no whySentence. Heuristic sentence split; good enough for prose.
function firstSentence(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  const match = collapsed.match(/^.*?[.!?。！？](?=\s|$)/);
  return match ? match[0] : collapsed;
}

const truncateChars = (text: string, max: number): string => {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
};

// Static report strings, bilingual. Free text from the state is NOT translated.
interface ReportDict {
  readonly floorNote: string;
  readonly ceilNote: string;
  readonly band: (lo: string, hi: string) => string;
  readonly marketBlindPrefix: string;
  readonly marketBlindJoin: string;
  readonly marketBlindBlocked: (n: number) => string;
  readonly marketBlindPrior: string;
  readonly stillResearching: (round: number) => string;
  readonly towardYes: string;
  readonly towardNo: string;
  readonly openEnded: string;
  readonly metaLine: (date: string, status: string, rounds: number, sources: number) => string;
  readonly fullVerdict: string;
  readonly mainUncertainties: string;
  readonly calibrationNote: string;
  readonly trajectoryHeader: string;
  readonly trajectoryCols: string;
  readonly dupSkipped: (n: number) => string;
  readonly roundHeader: (round: number, from: string, to: string) => string;
  readonly searches: (n: number) => string;
  readonly unverifiedWarning: (pp: string) => string;
  readonly confirmationLine: (share: string) => string;
  readonly oneSided: string;
  readonly noNewEvidence: string;
  readonly sourcesLine: (n: number, clusters: number, reflections: number) => string;
  readonly sourceCols: string;
  readonly flagReflection: string;
  readonly flagNotInTrace: string;
  readonly flagCorrelated: (factor: number) => string;
  readonly flagExcluded: string;
  readonly correlatedFootnote: string;
  readonly whyChanged: (
    net: string,
    up: string,
    down: string,
    mover: string,
    moverPp: string,
    isReflection: boolean
  ) => string;
  readonly ledgerHeader: string;
  readonly ledgerCols: string;
  readonly appendixHeader: string;
  readonly appendix: {
    readonly eventId: string;
    readonly prompt: string;
    readonly normalizedQuestion: string;
    readonly resolutionCriteria: string;
    readonly resolutionDate: string;
    readonly settlementSource: string;
    readonly assumptions: string;
    readonly prior: string;
    readonly framingCaveats: string;
    readonly framingConfidence: string;
    readonly lastUpdated: string;
  };
  readonly footer: string;
}

const REPORT_DICTS: Record<ForecastLanguage, ReportDict> = {
  en: {
    floorNote: " (engine floor — the true estimate may be lower; not a point estimate)",
    ceilNote: " (engine ceiling — the true estimate may be higher; not a point estimate)",
    band: (lo, hi) => `estimated range ${lo}–${hi} (heuristic width, not a calibrated interval)`,
    marketBlindPrefix: "⚠ Market-blind: ",
    marketBlindJoin: "; ",
    marketBlindBlocked: (n) => `${n} source(s) were zero-weighted as prediction-market prices`,
    marketBlindPrior:
      "the base-rate prior reads market-anchored — treat any market-edge comparison as contaminated",
    stillResearching: (round) => `round ${round} — still researching`,
    towardYes: "**Toward YES:**",
    towardNo: "**Toward NO:**",
    openEnded: "open-ended",
    metaLine: (date, status, rounds, sources) =>
      `Resolution: ${date} · Status: ${status} · Rounds: ${rounds} · Sources: ${sources}`,
    fullVerdict: "## Full verdict",
    mainUncertainties: "**Main uncertainties:**",
    calibrationNote: "**Calibration note:**",
    trajectoryHeader: "## Probability trajectory",
    trajectoryCols: "| Round | Prior | → Posterior | New sources |",
    dupSkipped: (n) => ` (+${n} dup skipped)`,
    roundHeader: (round, from, to) => `## Round ${round} — ${from} → ${to}`,
    searches: (n) => `*${n} searches (see state.json)*`,
    unverifiedWarning: (pp) =>
      `> ⚠ ${pp}pp of this round's movement came from soft-clamped UNVERIFIED sources (URLs not found in the agent's tool trace).`,
    confirmationLine: (share) => `*Confirmation ratio:* ${share}% of evidence weight reinforced the prior lean`,
    oneSided: " ⚠ one-sided (possible confirmation bias)",
    noNewEvidence: "_No new evidence this round._",
    sourcesLine: (n, clusters, reflections) =>
      `*${n} new source(s) in ${clusters} independent cluster(s)${
        reflections ? `, ${reflections} reflection(s) on prior sources` : ""
      }.*`,
    sourceCols: "| Source | Moved | From → To | Flags |",
    flagReflection: "↻ reflection",
    flagNotInTrace: "⚠ not in trace",
    flagCorrelated: (factor) => `↓×${factor} correlated`,
    flagExcluded: "⛔ excluded: market price",
    correlatedFootnote: "_↓ = repeat coverage of the same story, counted at decayed weight_",
    whyChanged: (net, up, down, mover, moverPp, isReflection) =>
      `**Why it changed:** net ${net} this round — ${up} from supporting sources, ${down} against. Biggest mover: ${mover} (${moverPp}${
        isReflection ? ", reflection" : ""
      }).`,
    ledgerHeader: "## Cumulative evidence ledger",
    ledgerCols: "| # | Source | Stance | Δ | Round |",
    appendixHeader: "## Appendix: framing",
    appendix: {
      eventId: "Event ID",
      prompt: "Your prompt",
      normalizedQuestion: "Normalized question",
      resolutionCriteria: "Resolution criteria",
      resolutionDate: "Resolution date",
      settlementSource: "Settlement source",
      assumptions: "Framing assumptions",
      prior: "Base-rate prior",
      framingCaveats: "Framing caveats (audit)",
      framingConfidence: "Framing confidence",
      lastUpdated: "Last updated",
    },
    footer:
      "_Probabilities come from an AI agent's web research; every move is attributed to a cited source. Not betting advice._",
  },
  zh: {
    floorNote: "（引擎可表达的下限——真实估计可能更低，勿当精确值）",
    ceilNote: "（引擎可表达的上限——真实估计可能更高，勿当精确值）",
    band: (lo, hi) => `估计范围 ${lo}–${hi}（启发式宽度，非校准区间）`,
    marketBlindPrefix: "⚠ 市场盲测：",
    marketBlindJoin: "；",
    marketBlindBlocked: (n) => `${n} 个来源为预测市场价格，已按零权重处理`,
    marketBlindPrior: "基础先验疑似锚定市场价——与市场对比的 edge 参考价值受污染",
    stillResearching: (round) => `第 ${round} 轮 — 研究进行中`,
    towardYes: "**支持 YES：**",
    towardNo: "**支持 NO：**",
    openEnded: "无固定日期",
    metaLine: (date, status, rounds, sources) =>
      `结算日期：${date} · 状态：${status} · 轮次：${rounds} · 来源：${sources}`,
    fullVerdict: "## 完整判断",
    mainUncertainties: "**主要不确定性：**",
    calibrationNote: "**校准说明：**",
    trajectoryHeader: "## 概率轨迹",
    trajectoryCols: "| 轮次 | 先验 | → 后验 | 新来源 |",
    dupSkipped: (n) => `（另跳过 ${n} 条重复）`,
    roundHeader: (round, from, to) => `## 第 ${round} 轮 — ${from} → ${to}`,
    searches: (n) => `*${n} 次搜索（详见 state.json）*`,
    unverifiedWarning: (pp) =>
      `> ⚠ 本轮 ${pp}pp 的概率变动来自软钳制的未验证来源（URL 未出现在 agent 的工具轨迹中）。`,
    confirmationLine: (share) => `*确认比：* ${share}% 的证据权重与先验方向一致`,
    oneSided: " ⚠ 单边（可能存在确认偏误）",
    noNewEvidence: "_本轮无新证据。_",
    sourcesLine: (n, clusters, reflections) =>
      `*本轮新增 ${n} 个来源、${clusters} 个独立信息簇${
        reflections ? `，另有 ${reflections} 次对既有来源的反思修正` : ""
      }。*`,
    sourceCols: "| 来源 | 变动 | 从 → 到 | 标记 |",
    flagReflection: "↻ 反思修正",
    flagNotInTrace: "⚠ 未见于搜索轨迹",
    flagCorrelated: (factor) => `↓×${factor} 同簇折减`,
    flagExcluded: "⛔ 已剔除：市场价格",
    correlatedFootnote: "_↓ = 同一故事的重复报道，按衰减权重计入_",
    whyChanged: (net, up, down, mover, moverPp, isReflection) =>
      `**变动原因：** 本轮净变动 ${net}——支持方向 ${up}，反对方向 ${down}。最大推动：${mover}（${moverPp}${
        isReflection ? "，反思修正" : ""
      }）。`,
    ledgerHeader: "## 累计证据清单",
    ledgerCols: "| # | 来源 | 立场 | Δ | 轮次 |",
    appendixHeader: "## 附录：问题框架",
    appendix: {
      eventId: "事件 ID",
      prompt: "原始提问",
      normalizedQuestion: "规范化问题",
      resolutionCriteria: "判定标准",
      resolutionDate: "结算日期",
      settlementSource: "结算依据",
      assumptions: "框架假设",
      prior: "基础先验",
      framingCaveats: "框架疑点（审计）",
      framingConfidence: "框架置信度",
      lastUpdated: "最后更新",
    },
    footer: "_概率由 AI 网络调研产生，每条来源的影响均可追溯。非投注建议。_",
  },
};

// The verdict block: H1 (truncated user prompt), P(YES) + band (+ saturation
// annotation), market-blind banner, the one-line answer, up to 3 key factors
// each way, and the resolution/status meta line.
function renderVerdictBlock(state: ForecastState, d: ReportDict, cite: (text: string) => string): string[] {
  const lines: string[] = [`# ${truncateChars(state.eventText, H1_MAX_CHARS)}`, ""];
  const bound =
    state.saturatedAt === "floor" ? PROB_FLOOR : state.saturatedAt === "ceil" ? PROB_CEIL : state.currentProb;
  const saturationNote = state.saturatedAt === "floor" ? d.floorNote : state.saturatedAt === "ceil" ? d.ceilNote : "";
  lines.push(
    `**P(YES): ${pct(bound)}**${saturationNote} — ${d.band(pct(state.credibleInterval[0]), pct(state.credibleInterval[1]))}`,
    ""
  );
  const mb = state.marketBlind;
  if (mb && (mb.blockedCount > 0 || mb.priorSuspect)) {
    const parts = [
      ...(mb.blockedCount > 0 ? [d.marketBlindBlocked(mb.blockedCount)] : []),
      ...(mb.priorSuspect ? [d.marketBlindPrior] : []),
    ];
    lines.push(`> ${d.marketBlindPrefix}${parts.join(d.marketBlindJoin)}`, "");
  }
  if (state.summary) {
    const s = state.summary;
    const answer = s.whySentence?.trim() ? s.whySentence.trim() : firstSentence(s.verdict);
    lines.push(cite(answer), "");
    if (s.keyFactorsYes.length) {
      lines.push(d.towardYes, ...s.keyFactorsYes.slice(0, 3).map((f) => `- ${cite(f)}`), "");
    }
    if (s.keyFactorsNo.length) {
      lines.push(d.towardNo, ...s.keyFactorsNo.slice(0, 3).map((f) => `- ${cite(f)}`), "");
    }
  } else {
    lines.push(`_${d.stillResearching(state.round)}_`, "");
  }
  lines.push(
    d.metaLine(state.framing.resolutionDate ?? d.openEnded, state.status, state.round, state.evidenceLedger.length),
    ""
  );
  return lines;
}

// The full verdict prose + uncertainties, below the verdict block.
function renderSummaryDetail(state: ForecastState, d: ReportDict, cite: (text: string) => string): string[] {
  if (!state.summary) return [];
  const s = state.summary;
  return [
    d.fullVerdict,
    "",
    cite(s.verdict),
    "",
    ...(s.mainUncertainties ? [`${d.mainUncertainties} ${cite(s.mainUncertainties)}`, ""] : []),
    ...(s.calibrationNote ? [`${d.calibrationNote} ${cite(s.calibrationNote)}`, ""] : []),
  ];
}

function renderTrajectory(state: ForecastState, d: ReportDict): string[] {
  if (state.roundHistory.length === 0) return [];
  const rows = state.roundHistory.map(
    (r) =>
      `| ${r.round} | ${pct(r.priorProb)} | ${pct(r.postProb)} | ${r.newSourceCount}${
        r.duplicateCount ? d.dupSkipped(r.duplicateCount) : ""
      } |`
  );
  return [d.trajectoryHeader, "", d.trajectoryCols, "| --- | --- | --- | --- |", ...rows, ""];
}

// Flags cell: only anomalies (reflection, unverified, correlated, excluded);
// an unremarkable source gets an empty cell instead of constant filler.
function sourceFlags(u: PerSourceUpdate, d: ReportDict): string {
  return [
    u.kind === "reflection" ? d.flagReflection : null,
    !u.verified ? d.flagNotInTrace : null,
    u.kind === "evidence" && u.clusterFactor < 1 ? d.flagCorrelated(u.clusterFactor) : null,
    u.excluded ? d.flagExcluded : null,
  ]
    .filter((p): p is string => p !== null)
    .join(", ");
}

// Which round (if any) gets each once-per-report annotation: the ⚠ warnings
// used to repeat in every qualifying round, drowning the reader in the same
// caveat — now only the WORST round carries the decoration.
function pickWorstRound(rounds: readonly RoundRecord[], metric: (r: RoundRecord) => number | null): number | null {
  const worst = rounds.reduce<{ round: number; value: number } | null>((acc, r) => {
    const value = metric(r);
    return value != null && (acc === null || value > acc.value) ? { round: r.round, value } : acc;
  }, null);
  return worst ? worst.round : null;
}

interface RoundAnnotations {
  readonly showUnverifiedWarning: boolean;
  readonly decorateConfirmation: boolean;
  readonly showCorrelatedFootnote: boolean;
}

function renderRound(r: RoundRecord, d: ReportDict, ann: RoundAnnotations): string[] {
  const lines: string[] = [d.roundHeader(r.round, pct(r.priorProb), pct(r.postProb)), ""];
  // Drop the "Notes:" tail — those are the agent's self-instructions for the
  // NEXT round (e.g. "Next round should check…"), not reader-facing findings.
  const reasoning = r.reasoning ? (r.reasoning.split("  Notes: ")[0] ?? "").replace(/\s+/g, " ").trim() : "";
  if (reasoning) lines.push(`> ${reasoning}`, "");
  if (r.searchQueries.length) lines.push(d.searches(r.searchQueries.length), "");
  if (ann.showUnverifiedWarning) lines.push(d.unverifiedWarning(r.unverifiedPp.toFixed(1)), "");
  if (r.confirmationRatio != null) {
    const suffix = ann.decorateConfirmation ? d.oneSided : "";
    lines.push(`${d.confirmationLine((r.confirmationRatio * 100).toFixed(0))}${suffix}`, "");
  }
  if (r.perSourceUpdates.length === 0) return [...lines, d.noNewEvidence, ""];
  const evidence = r.perSourceUpdates.filter((u) => u.kind === "evidence");
  const clusters = new Set(evidence.map((u) => u.clusterId)).size;
  lines.push(d.sourcesLine(evidence.length, clusters, r.reflectionCount), "");
  lines.push(d.sourceCols, "| --- | --- | --- | --- |");
  for (const u of r.perSourceUpdates) {
    lines.push(`| ${sourceLabel(u.title, u.url)} | ${signed(u.deltaPp)} | ${pct(u.from)} → ${pct(u.to)} | ${sourceFlags(u, d)} |`);
  }
  lines.push("");
  if (ann.showCorrelatedFootnote) lines.push(d.correlatedFootnote, "");
  if (r.whyChanged) {
    const w = r.whyChanged;
    lines.push(
      d.whyChanged(
        signed(w.netPp),
        signed(w.upPp),
        signed(w.downPp),
        sourceLabel(w.dominantTitle, w.dominantUrl),
        signed(w.dominantPp),
        w.dominantKind === "reflection"
      ),
      ""
    );
  }
  // Per-source reasoning bullets. Excluded sources keep their table row only —
  // a zero-weighted source needs no argument for a move it did not make.
  const bullets = r.perSourceUpdates.filter((u) => !u.excluded && u.explanation);
  for (const u of bullets) {
    lines.push(`- **${signed(u.deltaPp)}** — ${u.explanation.replace(/\s+/g, " ").trim()}  \n  ${u.url}`);
  }
  if (bullets.length) lines.push("");
  return lines;
}

function renderRounds(state: ForecastState, d: ReportDict): string[] {
  const worstUnverified = pickWorstRound(state.roundHistory, (r) => (r.unverifiedPp > 0.1 ? r.unverifiedPp : null));
  const worstConfirmation = pickWorstRound(state.roundHistory, (r) =>
    r.confirmationRatio != null && r.confirmationRatio >= 0.85 ? r.confirmationRatio : null
  );
  const firstCorrelated =
    state.roundHistory.find((r) => r.perSourceUpdates.some((u) => u.kind === "evidence" && u.clusterFactor < 1))
      ?.round ?? null;
  return state.roundHistory.flatMap((r) =>
    renderRound(r, d, {
      showUnverifiedWarning: worstUnverified === r.round,
      decorateConfirmation: worstConfirmation === r.round,
      showCorrelatedFootnote: firstCorrelated === r.round,
    })
  );
}

function renderLedger(state: ForecastState, d: ReportDict): string[] {
  const rows = state.evidenceLedger.map((e, i) => {
    const n = i + 1;
    const stance = e.stance === "supports_yes" ? "→YES" : e.stance === "supports_no" ? "→NO" : "·";
    const marks = `${e.kind === "reflection" ? " ↻" : ""}${e.excluded ? " ⛔" : ""}`;
    return `| <a id="${srcAnchor(n)}"></a>${n} | ${sourceLabel(e.title, e.url)} | ${stance}${marks} | ${signed(
      e.deltaPp
    )} | ${e.firstSeenRound} |`;
  });
  return [d.ledgerHeader, "", d.ledgerCols, "| --- | --- | --- | --- | --- |", ...rows, ""];
}

// Every framing field the old header dumped up front, relocated verbatim.
function renderAppendix(state: ForecastState, d: ReportDict): string[] {
  const f = state.framing;
  const a = d.appendix;
  return [
    d.appendixHeader,
    "",
    `- **${a.eventId}**: \`${state.eventId}\``,
    `- **${a.prompt}**: ${state.eventText}`,
    `- **${a.normalizedQuestion}**: ${f.normalizedQuestion}`,
    `- **${a.resolutionCriteria}**: ${f.resolutionCriteria}`,
    ...(f.resolutionDate ? [`- **${a.resolutionDate}**: ${f.resolutionDate}`] : []),
    ...(f.settlementSource ? [`- **${a.settlementSource}**: ${f.settlementSource}`] : []),
    ...(f.assumptions ? [`- **${a.assumptions}**: ${f.assumptions}`] : []),
    `- **${a.prior}**: ${pct(f.priorProbability)}${f.priorRationale ? ` — ${f.priorRationale}` : ""}`,
    ...(f.framingCaveats ? [`- **${a.framingCaveats}**: ${f.framingCaveats}`] : []),
    `- **${a.framingConfidence}**: ${f.framingConfidence}`,
    `- **${a.lastUpdated}**: ${state.updatedAtUtc}`,
    "",
  ];
}

export function renderReport(state: ForecastState): string {
  const d = REPORT_DICTS[forecastLanguage()];
  const cite = (text: string): string => linkCitations(text, state.evidenceLedger.length);
  return [
    ...renderVerdictBlock(state, d, cite),
    ...renderSummaryDetail(state, d, cite),
    ...renderTrajectory(state, d),
    ...renderRounds(state, d),
    ...renderLedger(state, d),
    ...renderAppendix(state, d),
    d.footer,
  ].join("\n");
}

export function writeReport(state: ForecastState): string {
  const dir = eventDir(state.eventId);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "report.md");
  writeFileSync(file, renderReport(state), "utf8");
  return file;
}
