// Bilingual labels + number formatters for the Delta PM audit page. Every enum
// keeps its raw value visible in the UI (small mono next to the translated
// label) so a reviewer can line the page up against the raw ledger; the maps
// here fall back to the raw string for unknown values instead of hiding them.
// Chinese is the source of truth (byte-identical to the original zh-only page);
// English fills the same slots.

import type { Lang } from "./i18n";

type Bi = { zh: string; en: string };

const pick = (map: Record<string, Bi>, lang: Lang, raw: string): string => map[raw]?.[lang] ?? raw;

export const labelKind = (lang: Lang, raw: string): string =>
  pick(
    {
      article: { zh: "文章", en: "Article" },
      briefing: { zh: "简报", en: "Briefing" },
      manual: { zh: "手工录入", en: "Manual entry" }
    },
    lang,
    raw
  );

export const labelPrefix = (lang: Lang, raw: string): string =>
  pick(
    {
      exclusive: {
        zh: "独家（本刊首发，t0=发布时刻）",
        en: "Exclusive (first published here, t0 = publish time)"
      },
      reportedly: {
        zh: "转述（转引他家报道，须核实真实首见时间）",
        en: "Reportedly (second-hand — verify the true first-seen time)"
      },
      none: { zh: "常规", en: "Regular" }
    },
    lang,
    raw
  );

export const labelEventType = (lang: Lang, raw: string): string =>
  pick(
    {
      earnings_guidance: { zh: "业绩/指引", en: "Earnings/guidance" },
      order_contract: { zh: "订单/合同", en: "Order/contract" },
      mna: { zh: "并购", en: "M&A" },
      product_tech: { zh: "产品/技术", en: "Product/tech" },
      regulatory_legal: { zh: "监管/法律", en: "Regulatory/legal" },
      management: { zh: "管理层", en: "Management" },
      supply_chain: { zh: "供应链", en: "Supply chain" },
      macro_direct: { zh: "宏观直接", en: "Direct macro" },
      other: { zh: "其他", en: "Other" }
    },
    lang,
    raw
  );

export const labelFactLevel = (lang: Lang, raw: string): string =>
  pick(
    {
      fact: { zh: "事实", en: "Fact" },
      forecast: { zh: "预测", en: "Forecast" },
      opinion: { zh: "观点", en: "Opinion" }
    },
    lang,
    raw
  );

export const labelNewsDirection = (lang: Lang, raw: string): string =>
  pick(
    {
      bullish: { zh: "利多", en: "Bullish" },
      bearish: { zh: "利空", en: "Bearish" },
      mixed: { zh: "多空混合", en: "Mixed" }
    },
    lang,
    raw
  );

export const labelTradeDirection = (lang: Lang, raw: string): string =>
  pick({ long: { zh: "做多", en: "Long" }, short: { zh: "做空", en: "Short" } }, lang, raw);

export const labelImpactBand = (lang: Lang, raw: string): string =>
  pick(
    {
      small: { zh: "小（0.5–2%）", en: "Small (0.5–2%)" },
      medium: { zh: "中（2–6%）", en: "Medium (2–6%)" },
      large: { zh: "大（6–20%）", en: "Large (6–20%)" }
    },
    lang,
    raw
  );

export const labelPricedIn = (lang: Lang, raw: string): string =>
  pick(
    {
      none: { zh: "未定价", en: "Not priced in" },
      partial: { zh: "部分定价", en: "Partially priced" },
      full: { zh: "已定价", en: "Fully priced" },
      leaked: { zh: "疑似泄露", en: "Possible leak" },
      reverse: { zh: "反向", en: "Reverse" },
      awaiting_market: { zh: "待行情", en: "Awaiting market" }
    },
    lang,
    raw
  );

/** Tone class key for the six priced-in states (report.module.css chip colors). */
const PRICED_IN_TONES: Record<string, string> = {
  none: "pinNone",
  partial: "pinPartial",
  full: "pinFull",
  leaked: "pinLeaked",
  reverse: "pinReverse",
  awaiting_market: "pinAwait"
};

export const pricedInTone = (raw: string): string => PRICED_IN_TONES[raw] ?? "pinOther";

export const labelSession = (lang: Lang, raw: string): string =>
  pick(
    {
      rth: { zh: "常规交易时段", en: "Regular hours" },
      offhours: { zh: "盘前/盘后", en: "Pre/post market" },
      weekend: { zh: "周末", en: "Weekend" }
    },
    lang,
    raw
  );

export const labelConfidence = (lang: Lang, raw: string): string =>
  pick({ high: { zh: "高", en: "High" }, medium: { zh: "中", en: "Medium" }, low: { zh: "低", en: "Low" } }, lang, raw);

export const labelContamination = (lang: Lang, raw: string): string =>
  pick(
    {
      none: { zh: "无污染", en: "No contamination" },
      soft: { zh: "轻度污染", en: "Soft contamination" },
      hard: { zh: "重度污染", en: "Hard contamination" }
    },
    lang,
    raw
  );

export const labelAction = (lang: Lang, raw: string): string =>
  pick(
    {
      open: { zh: "开仓", en: "Open" },
      add: { zh: "加仓", en: "Add" },
      trim: { zh: "减仓", en: "Trim" },
      close: { zh: "平仓", en: "Close" },
      flip: { zh: "反手", en: "Flip" },
      no_trade: { zh: "不开仓", en: "No trade" }
    },
    lang,
    raw
  );

export const labelBenchmark = (lang: Lang, raw: string): string =>
  pick(
    {
      none: { zh: "无基准（原始反应）", en: "No benchmark (raw reaction)" },
      XYZ100: { zh: "XYZ100 指数", en: "XYZ100 index" },
      SP500: { zh: "标普 500", en: "S&P 500" }
    },
    lang,
    raw
  );

export const labelProvider = (lang: Lang, raw: string): string =>
  pick(
    {
      rules: { zh: "规则回退（非分析引擎）", en: "Rules fallback (not the analysis engine)" },
      "claude-cli": { zh: "Claude CLI", en: "Claude CLI" },
      deepseek: { zh: "DeepSeek", en: "DeepSeek" }
    },
    lang,
    raw
  );

export const labelCredibility = (lang: Lang, raw: string): string =>
  pick(
    {
      high: { zh: "可信度高", en: "High credibility" },
      medium: { zh: "可信度中", en: "Medium credibility" },
      low: { zh: "可信度低", en: "Low credibility" }
    },
    lang,
    raw
  );

export const labelPostEvent = (lang: Lang, raw: string): string =>
  pick(
    {
      stop_loss: { zh: "止损触发", en: "Stop-loss hit" },
      hard_floor_stop: { zh: "硬性红线止损（−20%）", en: "Hard-floor stop (−20%)" },
      paper_close: { zh: "模拟平仓", en: "Paper close" },
      paper_open: { zh: "模拟开仓", en: "Paper open" },
      halt: { zh: "账本熔断", en: "Book halt" },
      resume: { zh: "恢复", en: "Resume" }
    },
    lang,
    raw
  );

export const labelGuard = (lang: Lang, raw: string): string => {
  const fixed: Record<string, Bi> = {
    tier1_cap: { zh: "一档流动性上限", en: "Tier-1 liquidity cap" },
    tier2_cap: { zh: "二档流动性上限", en: "Tier-2 liquidity cap" },
    tier3_cap: { zh: "三档流动性上限", en: "Tier-3 liquidity cap" },
    gross_cap: { zh: "总敞口上限", en: "Gross exposure cap" },
    net_cap: { zh: "净敞口上限", en: "Net exposure cap" },
    isolated_margin_cap: { zh: "逐仓保证金上限", en: "Isolated margin cap" }
  };
  if (fixed[raw]) return fixed[raw][lang];
  if (raw.startsWith("cluster_cap:")) {
    const cluster = raw.slice("cluster_cap:".length);
    return lang === "zh" ? `关联簇上限（${cluster}）` : `Cluster cap (${cluster})`;
  }
  return raw;
};

// ---------------------------------------------------------------------------
// Number formatting. Two percent conventions coexist in the ledger:
//  - percent-unit fields (5.9 => "5.90%"): edge/threshold/fairImpact/realizedExcess
//  - fraction fields (0.01 => "1.00%"): riskBudgetPct/stopDistPct/dailyVolPct/funding
// fmtPct handles the former; fmtFracPct multiplies by 100 first.
// Formatters that carry unit words (秒/分钟/…) take lang; pure-number ones do not
// (numbers, dates and currency render identically in both languages).

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function fmtUsd(value: number | null): string {
  return value === null ? "—" : usd2.format(value);
}

export function fmtSignedUsd(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "±";
  return `${sign}${usd2.format(Math.abs(value))}`;
}

/** Percent-unit input: 5.9 => "5.90%". Tiny non-zero values keep 2 significant digits. */
export function fmtPct(value: number | null, opts?: { signed?: boolean }): string {
  if (value === null) return "—";
  const abs = Math.abs(value);
  const body = abs === 0 ? "0.00" : abs < 0.005 ? abs.toPrecision(2) : abs.toFixed(2);
  const sign = opts?.signed ? (value > 0 ? "+" : value < 0 ? "-" : "±") : value < 0 ? "-" : "";
  return `${sign}${body}%`;
}

/** Fraction input: 0.0055 => "0.55%". */
export function fmtFracPct(value: number | null, opts?: { signed?: boolean }): string {
  return value === null ? "—" : fmtPct(value * 100, opts);
}

export function fmtPx(value: number | null): string {
  if (value === null) return "—";
  const digits = Math.abs(value) >= 1 ? 2 : 4;
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtQty(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function fmtX(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}×`;
}

export function fmtBeta(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

export function fmtInt(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

export function fmtUtc(iso: string | null): string {
  if (!iso || iso.length < 16 || !Number.isFinite(Date.parse(iso))) return iso && iso.length > 0 ? iso : "—";
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Minute count for Δt displays: 43.2 => "43.2 分钟" / "43.2 min". */
export function fmtMinutes(lang: Lang, mins: number | null): string {
  if (mins === null) return "—";
  if (mins < 1) return lang === "zh" ? `${(mins * 60).toFixed(0)} 秒` : `${(mins * 60).toFixed(0)} s`;
  if (mins < 120) return lang === "zh" ? `${mins.toFixed(1)} 分钟` : `${mins.toFixed(1)} min`;
  if (mins < 48 * 60) return lang === "zh" ? `${(mins / 60).toFixed(1)} 小时` : `${(mins / 60).toFixed(1)} h`;
  return lang === "zh" ? `${(mins / 1440).toFixed(1)} 天` : `${(mins / 1440).toFixed(1)} d`;
}

export function fmtHours(lang: Lang, hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 48) return lang === "zh" ? `${hours} 小时` : `${hours} h`;
  const days = hours / 24;
  const dayBody = Number.isInteger(days) ? days : days.toFixed(1);
  return lang === "zh" ? `${hours} 小时（≈ ${dayBody} 天）` : `${hours} h (≈ ${dayBody} d)`;
}

/**
 * Adaptive duration for the per-stage timing strip. Millisecond input:
 * 158 => "0.2 秒"/"0.2 s", 229646 => "3.8 分钟"/"3.8 min", 38506415 => "10.7 小时"/"10.7 h".
 */
export function fmtDurationMs(lang: Lang, ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 0) return "—";
  if (ms < 9_950) return lang === "zh" ? `${(ms / 1000).toFixed(1)} 秒` : `${(ms / 1000).toFixed(1)} s`;
  if (ms < 120_000) return lang === "zh" ? `${Math.round(ms / 1000)} 秒` : `${Math.round(ms / 1000)} s`;
  if (ms < 120 * 60_000) return lang === "zh" ? `${(ms / 60_000).toFixed(1)} 分钟` : `${(ms / 60_000).toFixed(1)} min`;
  if (ms < 48 * 3_600_000)
    return lang === "zh" ? `${(ms / 3_600_000).toFixed(1)} 小时` : `${(ms / 3_600_000).toFixed(1)} h`;
  return lang === "zh" ? `${(ms / 86_400_000).toFixed(1)} 天` : `${(ms / 86_400_000).toFixed(1)} d`;
}

/** News source slug → display name (not language-specific). Falls back to the raw slug. */
export const newsSourceName = (raw: string): string => ({ "the-information": "The Information" })[raw] ?? raw;

/** Minutes between two ISO timestamps (b − a); null when either is invalid. */
export function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return (tb - ta) / 60_000;
}
