// Raven Delta rules fallback engine.
//
// Deterministic keyword/scoring pipeline ported from the legacy demo
// (apps/web/lib/stock-news-impact.ts), reshaped to the DeltaAnalysis
// contract. It runs when no LLM provider is configured or reachable; the
// caller is responsible for labelling the run as engine="rules". Honesty
// rules baked in: a zero-signal run never claims "highest-impact names"
// (#31), and the credibility note always says sources were not verified.

import { MAX_IMPACTED_STOCKS, type DeltaAnalysis, type ImpactedStock, type NewsInput } from "./schema";
import { ACTION_LABELS, DIRECTION_LABELS, getRule, pick, type Locale } from "./rules-data";
import {
  actionFor,
  attentionScore,
  confidenceFor,
  detectSignals,
  directionFor,
  expectedMoveRange,
  magnitudeFor,
  normalizeText,
  scoreUniverse,
  type RuleSignal,
  type ScoredStock
} from "./rules-scoring";

// Single import surface for callers and tests.
export {
  actionFor,
  attentionScore,
  confidenceFor,
  detectSignals,
  directionFor,
  expectedMoveRange,
  findMatches,
  magnitudeFor,
  normalizeText,
  scoreStock,
  scoreUniverse
} from "./rules-scoring";
export type { RuleSignal, ScoredStock } from "./rules-scoring";

// Universe tags through which the stock's hit catalysts transmit.
function transmissionTags(item: ScoredStock): string[] {
  const tags = item.stock.tags.filter((tag) =>
    item.signalHits.some((signal) => (getRule(signal.id).tagBias[tag] ?? 0) !== 0)
  );
  return [...new Set(tags)];
}

function directMentionText(item: ScoredStock, locale: Locale): string {
  return item.directHits.length > 0
    ? pick(locale, `Direct mention: ${item.directHits.join(", ")}`, `直接命中：${item.directHits.join("、")}`)
    : pick(locale, "Sector exposure only; the company is not named in this news", "仅板块暴露，新闻未直接点名该公司");
}

// Schema allows at most 6 evidence entries: up to 5 catalysts + 1 mention line.
const MAX_CATALYST_EVIDENCE = 5;

function buildEvidence(item: ScoredStock, locale: Locale): { point: string }[] {
  const catalystPoints = item.signalHits.slice(0, MAX_CATALYST_EVIDENCE).map((signal) => ({
    point: pick(
      locale,
      `Catalyst: ${signal.label} (matched: ${signal.matchedKeywords.join(", ")})`,
      `催化：${signal.label}（命中关键词：${signal.matchedKeywords.join("、")}）`
    )
  }));
  return [...catalystPoints, { point: directMentionText(item, locale) }];
}

function buildReasoning(item: ScoredStock, locale: Locale): string {
  const direction = directionFor(item.score);
  const primary = item.signalHits[0]?.label ?? pick(locale, "a direct company mention", "个股直接点名");
  const channel = transmissionTags(item).join(", ") || pick(locale, "single-name exposure", "个股直接暴露");
  return pick(
    locale,
    `${item.stock.ticker} screens ${DIRECTION_LABELS[direction][0].toLowerCase()} on ${primary}. ` +
      `Transmission channel: ${channel}. Deterministic keyword rules — a news-delta view, not a fair-value call.`,
    `${item.stock.ticker} 因「${primary}」被判定为${DIRECTION_LABELS[direction][1]}。` +
      `传导渠道：${channel}。这是确定性关键词规则给出的新闻增量观点，不是估值结论。`
  );
}

function buildImpactedStock(item: ScoredStock, locale: Locale): ImpactedStock {
  const hasDirect = item.directHits.length > 0;
  const action = actionFor(item.score, hasDirect);
  const [actionEn, actionZh] = ACTION_LABELS[action];
  return {
    ticker: item.stock.ticker,
    company: pick(locale, item.stock.company, item.stock.companyZh ?? item.stock.company),
    inUniverse: true,
    direction: directionFor(item.score),
    magnitude: magnitudeFor(item.score),
    expectedMovePct: expectedMoveRange(item.score),
    confidence: confidenceFor(item.score, item.signalHits.length, hasDirect),
    horizon: pick(locale, "1-5 trading days", "1-5 个交易日"),
    reasoning: buildReasoning(item, locale),
    evidence: buildEvidence(item, locale),
    action,
    actionRationale: pick(
      locale,
      `${actionEn}: rules score ${item.score}${hasDirect ? " with a direct company mention" : ", sector exposure only"}.`,
      `${actionZh}：规则得分 ${item.score}${hasDirect ? "，且新闻直接点名该公司" : "，仅为板块暴露"}。`
    ),
    risks: [
      pick(
        locale,
        "The first headline may be revised, denied, or already priced in before the cash open.",
        "首条新闻可能被修正、否认，或在开盘前已被市场消化。"
      ),
      pick(
        locale,
        "Macro beta can overwhelm the single-name effect within the horizon.",
        "宏观 beta 可能在时间窗口内覆盖个股效应。"
      )
    ]
  };
}

function buildVerdict(
  signals: readonly RuleSignal[],
  scored: readonly ScoredStock[],
  newsType: string,
  locale: Locale
): string {
  if (signals.length === 0) {
    // Fix #31: never claim "highest-impact names" on a zero-signal run.
    return pick(
      locale,
      "No recognized catalyst in this news; the rules engine takes no view and flags nothing as high impact.",
      "本条新闻未命中任何已知催化；规则引擎不给出观点，也不标记任何高影响股票。"
    );
  }
  if (scored.length === 0) {
    return pick(
      locale,
      `A "${newsType}" catalyst was detected, but no tracked stock clears the impact threshold.`,
      `识别到「${newsType}」催化，但观察范围内没有股票达到影响阈值。`
    );
  }
  const top = scored.slice(0, MAX_IMPACTED_STOCKS);
  const bulls = top.filter((item) => directionFor(item.score) === "bullish").length;
  const bears = top.filter((item) => directionFor(item.score) === "bearish").length;
  const tickers = top.map((item) => item.stock.ticker);
  return pick(
    locale,
    `${tickers.join(", ")} screen as most exposed to ${newsType}: ${bulls} bullish, ${bears} bearish in the tracked universe.`,
    `${tickers.join("、")} 对「${newsType}」暴露最高：利多 ${bulls} 个、利空 ${bears} 个。`
  );
}

function buildAttention(
  signals: readonly RuleSignal[],
  scored: readonly ScoredStock[],
  locale: Locale
): DeltaAnalysis["attention"] {
  const strongest = [...signals].sort((a, b) => b.strength - a.strength)[0];
  const topAbsScore = Math.abs(scored[0]?.score ?? 0);
  const newsType = strongest?.label ?? pick(locale, "No recognized catalyst", "未识别到催化");
  return {
    worthAttention: signals.length > 0 && topAbsScore >= 0.65,
    score: attentionScore(topAbsScore, signals.length),
    verdict: buildVerdict(signals, scored, newsType, locale),
    newsType,
    credibilityNote: pick(
      locale,
      "Rules engine: source credibility and timestamps were not verified; treat this input as unconfirmed.",
      "规则引擎：未核实消息来源与时间戳，请将本条输入视为未经确认的信息。"
    )
  };
}

function buildMarketReadout(signals: readonly RuleSignal[], locale: Locale): string {
  if (signals.length === 0) {
    return pick(
      locale,
      "No catalyst keywords matched, so the rules engine has no mechanism to transmit this news onto stock prices. Nothing in the tracked universe is flagged.",
      "没有命中任何催化关键词，规则引擎无法建立这条新闻向股价传导的机制，观察范围内不标记任何股票。"
    );
  }
  const labels = signals.map((signal) => signal.label);
  return pick(
    locale,
    `Detected catalysts: ${labels.join(", ")}. Each catalyst transmits through sector tags weighted by keyword strength and per-stock beta; a direct company mention adds the rule's direct-impact weight. This is a delta on the pre-news baseline, not a fair-value view.`,
    `识别到的催化：${labels.join("、")}。每个催化通过板块标签传导，按关键词强度与个股 beta 加权；新闻直接点名的公司额外叠加该规则的直接冲击权重。这是相对新闻前基线的增量判断，不是估值结论。`
  );
}

function buildTradingPlan(top: readonly ScoredStock[], locale: Locale): string {
  if (top.length === 0) {
    return pick(
      locale,
      "No action. Re-run when a headline carries a recognizable catalyst (earnings, regulation, rates, supply, or security events).",
      "暂不操作。当新闻包含可识别催化（盈利、监管、利率、供给或安全事件）时再重新运行。"
    );
  }
  const parts = top.map((item) => {
    const [actionEn, actionZh] = ACTION_LABELS[actionFor(item.score, item.directHits.length > 0)];
    return `${item.stock.ticker} — ${pick(locale, actionEn, actionZh)}`;
  });
  return pick(
    locale,
    `Top actions: ${parts.join("; ")}. Confirm the headline with a second independent source and compare the premarket move against the expected range before sizing.`,
    `优先操作：${parts.join("；")}。下单前先用第二个独立信源确认新闻，并将盘前波动与预期区间对比后再决定仓位。`
  );
}

function buildLimitations(locale: Locale): string[] {
  return [
    pick(
      locale,
      "Deterministic rules demo: keyword matching only, no LLM judgment and no comprehension beyond the rule table.",
      "确定性规则 Demo：仅做关键词匹配，没有 LLM 判断，也无法理解规则表以外的语义。"
    ),
    pick(
      locale,
      "No live prices or market data are fetched; expected move ranges are heuristic, not calibrated forecasts.",
      "不抓取实时价格或行情数据；预期波动区间是启发式估计，不是校准过的预测。"
    ),
    pick(
      locale,
      "Source credibility is not verified and duplicate or stale headlines are not detected.",
      "不验证消息来源可信度，也不检测重复或过期新闻。"
    )
  ];
}

// First-seen timing: the rules engine has no network access, so the only
// honest anchors are a caller-provided timestamp or nothing at all.
function buildTiming(news: NewsInput, locale: Locale): DeltaAnalysis["timing"] {
  if (news.publishedAtUtc) {
    return {
      firstSeenUtc: news.publishedAtUtc,
      basis: pick(
        locale,
        "Caller-provided timestamp (e.g. feed/tweet time); earliest public appearance was not independently verified.",
        "调用方提供的时间戳（如信息流/推文时间）；未独立核实全网最早出现时间。"
      )
    };
  }
  return {
    firstSeenUtc: null,
    basis: pick(
      locale,
      "Rules engine cannot verify when this news first appeared (no web access in this mode).",
      "规则引擎无法核实这条新闻全网最早出现时间（该模式下无联网检索）。"
    )
  };
}

// nowIso is part of the shared engine contract (the LLM engine anchors
// recency framing on it); the deterministic rules are time-independent.
export function runRulesAnalysis(news: NewsInput, _nowIso: string): DeltaAnalysis {
  const locale = news.locale;
  const text = normalizeText(news.text);
  const signals = detectSignals(text, locale);
  const scored = scoreUniverse(text, signals);
  const top = scored.slice(0, MAX_IMPACTED_STOCKS);
  return {
    attention: buildAttention(signals, scored, locale),
    timing: buildTiming(news, locale),
    marketReadout: buildMarketReadout(signals, locale),
    impactedStocks: top.map((item) => buildImpactedStock(item, locale)),
    tradingPlan: buildTradingPlan(top, locale),
    limitations: buildLimitations(locale)
  };
}
