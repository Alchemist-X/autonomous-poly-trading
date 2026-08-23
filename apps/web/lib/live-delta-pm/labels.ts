// Chinese labels + number formatters for the Delta PM audit page. Every enum
// keeps its raw value visible in the UI (small mono next to the translated
// label) so a reviewer can line the page up against the raw ledger; the maps
// here fall back to the raw string for unknown values instead of hiding them.

const pick = (map: Record<string, string>, raw: string): string => map[raw] ?? raw;

export const zhKind = (raw: string): string =>
  pick({ article: "文章", briefing: "简报", manual: "手工录入" }, raw);

export const zhPrefix = (raw: string): string =>
  pick(
    {
      exclusive: "独家（本刊首发，t0=发布时刻）",
      reportedly: "转述（转引他家报道，须核实真实首见时间）",
      none: "常规"
    },
    raw
  );

export const zhEventType = (raw: string): string =>
  pick(
    {
      earnings_guidance: "业绩/指引",
      order_contract: "订单/合同",
      mna: "并购",
      product_tech: "产品/技术",
      regulatory_legal: "监管/法律",
      management: "管理层",
      supply_chain: "供应链",
      macro_direct: "宏观直接",
      other: "其他"
    },
    raw
  );

export const zhFactLevel = (raw: string): string =>
  pick({ fact: "事实", forecast: "预测", opinion: "观点" }, raw);

export const zhNewsDirection = (raw: string): string =>
  pick({ bullish: "利多", bearish: "利空", mixed: "多空混合" }, raw);

export const zhTradeDirection = (raw: string): string => pick({ long: "做多", short: "做空" }, raw);

export const zhImpactBand = (raw: string): string =>
  pick({ small: "小（0.5–2%）", medium: "中（2–6%）", large: "大（6–20%）" }, raw);

export const zhPricedIn = (raw: string): string =>
  pick(
    {
      none: "未定价",
      partial: "部分定价",
      full: "已定价",
      leaked: "疑似泄露",
      reverse: "反向",
      awaiting_market: "待行情"
    },
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

export const zhSession = (raw: string): string =>
  pick({ rth: "常规交易时段", offhours: "盘前/盘后", weekend: "周末" }, raw);

export const zhConfidence = (raw: string): string => pick({ high: "高", medium: "中", low: "低" }, raw);

export const zhContamination = (raw: string): string =>
  pick({ none: "无污染", soft: "轻度污染", hard: "重度污染" }, raw);

export const zhAction = (raw: string): string =>
  pick({ open: "开仓", add: "加仓", trim: "减仓", close: "平仓", flip: "反手", no_trade: "不开仓" }, raw);

export const zhBenchmark = (raw: string): string => pick({ none: "无基准（原始反应）" }, raw);

export const zhProvider = (raw: string): string =>
  pick({ rules: "规则回退（非分析引擎）", "claude-cli": "Claude CLI", deepseek: "DeepSeek" }, raw);

export const zhCredibility = (raw: string): string =>
  pick({ high: "可信度高", medium: "可信度中", low: "可信度低" }, raw);

export const zhPostEvent = (raw: string): string =>
  pick(
    {
      stop_loss: "止损触发",
      hard_floor_stop: "硬性红线止损（−20%）",
      paper_close: "模拟平仓",
      paper_open: "模拟开仓",
      halt: "账本熔断",
      resume: "恢复"
    },
    raw
  );

export const zhGuard = (raw: string): string => {
  const fixed: Record<string, string> = {
    tier1_cap: "一档流动性上限",
    tier2_cap: "二档流动性上限",
    tier3_cap: "三档流动性上限",
    gross_cap: "总敞口上限",
    net_cap: "净敞口上限",
    isolated_margin_cap: "逐仓保证金上限"
  };
  if (fixed[raw]) return fixed[raw];
  if (raw.startsWith("cluster_cap:")) return `关联簇上限（${raw.slice("cluster_cap:".length)}）`;
  return raw;
};

// ---------------------------------------------------------------------------
// Number formatting. Two percent conventions coexist in the ledger:
//  - percent-unit fields (5.9 => "5.90%"): edge/threshold/fairImpact/realizedExcess
//  - fraction fields (0.01 => "1.00%"): riskBudgetPct/stopDistPct/dailyVolPct/funding
// fmtPct handles the former; fmtFracPct multiplies by 100 first.

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

/** Minute count for Δt displays: 43.2 => "43.2 分钟", 1500 => "25.0 小时". */
export function fmtMinutes(mins: number | null): string {
  if (mins === null) return "—";
  if (mins < 1) return `${(mins * 60).toFixed(0)} 秒`;
  if (mins < 120) return `${mins.toFixed(1)} 分钟`;
  if (mins < 48 * 60) return `${(mins / 60).toFixed(1)} 小时`;
  return `${(mins / 1440).toFixed(1)} 天`;
}

export function fmtHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 48) return `${hours} 小时`;
  const days = hours / 24;
  return `${hours} 小时（≈ ${Number.isInteger(days) ? days : days.toFixed(1)} 天）`;
}

/** Minutes between two ISO timestamps (b − a); null when either is invalid. */
export function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return (tb - ta) / 60_000;
}
