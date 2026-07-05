// Raven Delta rules fallback — catalyst rule table and label maps.
//
// Ported from the legacy demo (apps/web/lib/stock-news-impact.ts) with two
// fixes applied while porting:
// - (#7)  CJK substring collision: the standalone earnings keyword "超预期"
//         was a substring of the hawkish-rates keyword "通胀超预期", so hot-CPI
//         headlines wrongly fired the earnings-up rule. Earnings-up now
//         requires "业绩超预期" / "盈利超预期"; "通胀超预期" stays hawkish.
// - (#12) Identity vs topic split: generic topic words (oil, crude, gpu,
//         cybersecurity, ...) are catalyst keywords here, never identity
//         aliases. GENERIC_TOPIC_ALIASES additionally filters such words out
//         of the universe alias lists so they can never count as a
//         "direct mention" of a company.

import type { Direction, NewsInput, TradeAction } from "./schema";

export type Locale = NewsInput["locale"];

// Tiny local i18n helper (deliberately not imported from apps/web).
export function pick(locale: Locale, en: string, zh: string): string {
  return locale === "zh" ? zh : en;
}

export interface CatalystRule {
  readonly id: string;
  readonly labelEn: string;
  readonly labelZh: string;
  readonly direction: Direction;
  readonly keywords: readonly string[];
  /** Extra score applied only when the company itself is named in the text. */
  readonly directImpact: number;
  /** Transmission weights: universe sector tag -> score bias. */
  readonly tagBias: Readonly<Record<string, number>>;
}

export const CATALYST_RULES: readonly CatalystRule[] = [
  {
    id: "ai-capex",
    labelEn: "AI capex demand",
    labelZh: "AI 资本开支需求",
    direction: "bullish",
    keywords: [
      "ai",
      "artificial intelligence",
      "llm",
      "gpu",
      "data center",
      "datacenter",
      "blackwell",
      "openai",
      "compute",
      "capacity agreement",
      "云计算",
      "算力",
      "数据中心"
    ],
    directImpact: 1.6,
    tagBias: {
      "ai-infrastructure": 1.8,
      semiconductors: 1.35,
      cloud: 0.8,
      "data-center": 1.2,
      equipment: 0.85,
      software: 0.25,
      energy: 0.15
    }
  },
  {
    id: "export-controls",
    labelEn: "Export-control or tariff shock",
    labelZh: "出口管制或关税冲击",
    direction: "bearish",
    keywords: [
      "export control",
      "tariff",
      "sanction",
      "china ban",
      "entity list",
      "chip restriction",
      "关税",
      "制裁",
      "出口管制",
      "禁令"
    ],
    directImpact: -1.8,
    tagBias: {
      semiconductors: -1.5,
      "china-supply": -1.25,
      equipment: -1.3,
      "consumer-hardware": -0.8,
      cloud: -0.35
    }
  },
  {
    id: "dovish-rates",
    labelEn: "Dovish rates shock",
    labelZh: "利率下行冲击",
    direction: "bullish",
    keywords: ["rate cut", "dovish", "lower yields", "soft cpi", "cooler inflation", "降息", "鸽派", "通胀降温"],
    directImpact: 0.2,
    tagBias: {
      software: 0.75,
      semiconductors: 0.65,
      "mega-cap-tech": 0.5,
      consumer: 0.45,
      banks: -0.35
    }
  },
  {
    id: "hawkish-rates",
    labelEn: "Hawkish rates shock",
    labelZh: "利率上行冲击",
    direction: "bearish",
    // "通胀超预期" (hot inflation) must stay here; see fix #7 above.
    keywords: ["rate hike", "hawkish", "higher yields", "hot cpi", "sticky inflation", "加息", "鹰派", "通胀超预期"],
    directImpact: -0.2,
    tagBias: {
      software: -0.8,
      semiconductors: -0.65,
      "mega-cap-tech": -0.5,
      consumer: -0.45,
      banks: 0.35
    }
  },
  {
    id: "regulatory",
    labelEn: "Regulatory or litigation overhang",
    labelZh: "监管或诉讼压力",
    direction: "bearish",
    keywords: [
      "antitrust",
      "doj",
      "ftc",
      "sec probe",
      "lawsuit",
      "class action",
      "regulator",
      "监管",
      "反垄断",
      "诉讼",
      "调查"
    ],
    directImpact: -2.1,
    tagBias: {
      platforms: -0.8,
      "consumer-hardware": -0.7,
      "mega-cap-tech": -0.4,
      banks: -0.3,
      pharma: -0.2
    }
  },
  {
    id: "earnings-up",
    labelEn: "Positive earnings revision",
    labelZh: "盈利预期上修",
    direction: "bullish",
    // Fix #7: "超预期" alone collided with "通胀超预期" (hawkish). Earnings
    // beats must now be qualified as 业绩/盈利超预期.
    keywords: [
      "beat estimates",
      "raise guidance",
      "guidance raised",
      "above consensus",
      "record revenue",
      "上调指引",
      "业绩超预期",
      "盈利超预期",
      "收入创新高"
    ],
    directImpact: 2.4,
    tagBias: {
      semiconductors: 0.35,
      cloud: 0.3,
      software: 0.3,
      consumer: 0.25,
      banks: 0.2,
      healthcare: 0.2
    }
  },
  {
    id: "earnings-down",
    labelEn: "Negative earnings revision",
    labelZh: "盈利预期下修",
    direction: "bearish",
    keywords: [
      "miss estimates",
      "cut guidance",
      "guidance cut",
      "below consensus",
      "profit warning",
      "下调指引",
      "不及预期",
      "利润预警"
    ],
    directImpact: -2.4,
    tagBias: {
      semiconductors: -0.35,
      cloud: -0.3,
      software: -0.3,
      consumer: -0.25,
      banks: -0.2,
      healthcare: -0.2
    }
  },
  {
    id: "drug-approval",
    labelEn: "Drug approval or trial success",
    labelZh: "药品审批或临床成功",
    direction: "bullish",
    keywords: ["fda approval", "phase 3", "trial met", "clinical trial", "drug approval", "获批", "临床三期", "试验成功"],
    directImpact: 2.1,
    tagBias: {
      healthcare: 1.2,
      pharma: 1.4,
      "glp-1": 1.1
    }
  },
  {
    id: "oil-supply",
    labelEn: "Oil supply shock",
    labelZh: "原油供给冲击",
    direction: "bullish",
    // Fix #12: "oil" / "crude" moved here from the legacy XOM/CVX alias
    // lists — they are sector topics, not company identities.
    keywords: [
      "oil supply",
      "crude spike",
      "opec",
      "strait of hormuz",
      "refinery outage",
      "oil",
      "crude",
      "原油",
      "油价",
      "欧佩克",
      "霍尔木兹"
    ],
    directImpact: 0.8,
    tagBias: {
      energy: 1.55,
      oil: 1.7,
      consumer: -0.35,
      "consumer-hardware": -0.25
    }
  },
  {
    id: "cyber-incident",
    labelEn: "Cyber incident",
    labelZh: "网络安全事件",
    direction: "mixed",
    // Fix #12: "cybersecurity" moved here from the legacy CRWD/PANW alias
    // lists — it is a sector topic, not a company identity.
    keywords: [
      "cyberattack",
      "outage",
      "ransomware",
      "breach",
      "data leak",
      "cybersecurity",
      "网络攻击",
      "宕机",
      "勒索软件",
      "数据泄露"
    ],
    directImpact: -1.2,
    tagBias: {
      cybersecurity: 1.2,
      software: -0.25,
      platforms: -0.25,
      banks: -0.2
    }
  }
];

export function getRule(id: string): CatalystRule {
  const rule = CATALYST_RULES.find((item) => item.id === id);
  if (!rule) throw new Error(`Unknown catalyst rule: ${id}`);
  return rule;
}

// Fix #12: generic topic words that may appear in universe alias lists but do
// not identify a single company. They are excluded from identity matching so
// a topical headline never produces "direct mention" evidence. Entries must
// be lowercase (compared against normalized alias text).
export const GENERIC_TOPIC_ALIASES: ReadonlySet<string> = new Set([
  "gpu",
  "foundry",
  "euv",
  "lithography",
  "光刻机",
  "vaccine",
  "sneaker",
  "footwear",
  "firewall",
  "endpoint security",
  "endpoint",
  "glp-1",
  "ev deliveries",
  "oil",
  "crude",
  "cybersecurity"
]);

// Subset of the schema's TradeAction the rules ladder can emit.
export type RulesAction = Extract<TradeAction, "add" | "watch" | "trim" | "hedge" | "avoid">;

export const ACTION_LABELS: Readonly<Record<RulesAction, readonly [en: string, zh: string]>> = {
  add: ["Add / buy on confirmation", "确认后加仓 / 买入"],
  watch: ["Watch for entry", "观察入场"],
  trim: ["Trim / reduce", "减仓 / 降低暴露"],
  hedge: ["Hedge sector exposure", "对冲板块暴露"],
  avoid: ["Avoid chasing", "避免追价"]
};

export const DIRECTION_LABELS: Readonly<Record<Direction, readonly [en: string, zh: string]>> = {
  bullish: ["Bullish", "利多"],
  bearish: ["Bearish", "利空"],
  mixed: ["Mixed", "混合"]
};
