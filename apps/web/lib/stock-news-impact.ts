import { pick, type ConsoleLocale } from "./research/locale";

export type StockImpactDirection = "bullish" | "bearish" | "mixed";
export type StockAction = "add" | "watch" | "trim" | "hedge" | "avoid";
export type StockConfidence = "high" | "medium" | "low";

export interface StockNewsImpactRequest {
  headline: string;
  body?: string | null;
  source?: string | null;
  url?: string | null;
  publishedAt?: string | null;
  watchlist?: readonly string[] | null;
  locale?: ConsoleLocale;
}

export interface StockNewsStage {
  id: string;
  order: number;
  title: string;
  detail: string;
  status: "complete";
  durationMs: number;
}

export interface StockNewsSignal {
  id: string;
  label: string;
  direction: StockImpactDirection;
  strength: number;
  matchedKeywords: string[];
}

export interface ImpactedStock {
  ticker: string;
  company: string;
  sector: string;
  direction: StockImpactDirection;
  directionLabel: string;
  action: StockAction;
  actionLabel: string;
  confidence: StockConfidence;
  confidenceLabel: string;
  horizon: string;
  impactScore: number;
  expectedMovePct: number;
  probabilityDeltaPct: number;
  incrementalEdgePct: number;
  thesis: string;
  risk: string;
  evidence: string[];
  triggers: string[];
}

export interface StockNewsDeliveryReceipt {
  channel: "email" | "websocket";
  status: "sent" | "simulated" | "skipped" | "failed";
  provider: string;
  target: string;
  detail: string;
  timestampUtc: string;
}

export interface StockNewsImpactRun {
  id: string;
  mode: "demo_read_only";
  generatedAtUtc: string;
  news: {
    headline: string;
    body: string | null;
    source: string | null;
    url: string | null;
    publishedAt: string;
  };
  watchlist: string[];
  summary: {
    title: string;
    verdict: string;
    marketMechanism: string;
    topTickers: string[];
    pushNarrative: string;
  };
  signals: StockNewsSignal[];
  stages: StockNewsStage[];
  affectedStocks: ImpactedStock[];
  delivery: StockNewsDeliveryReceipt[];
  limitations: string[];
}

interface StockProfile {
  ticker: string;
  company: string;
  sector: string;
  tags: readonly string[];
  aliases: readonly string[];
  beta: number;
}

interface CatalystRule {
  id: string;
  labelEn: string;
  labelZh: string;
  direction: StockImpactDirection;
  keywords: readonly string[];
  directImpact: number;
  tagBias: Readonly<Record<string, number>>;
}

interface ScoredStock {
  profile: StockProfile;
  score: number;
  directHits: string[];
  signalHits: StockNewsSignal[];
}

export const DEFAULT_STOCK_NEWS_HEADLINE =
  "OpenAI announces a $40B multi-year cloud and GPU capacity agreement with Microsoft, Nvidia, and Oracle";

export const DEFAULT_STOCK_NEWS_BODY =
  "The agreement expands AI data-center capacity through 2028. Management says demand for Blackwell-class GPUs remains above prior internal forecasts, while power availability is the main constraint.";

export const DEFAULT_STOCK_WATCHLIST = ["NVDA", "MSFT", "ORCL", "AMD", "TSM", "ASML", "GOOGL", "AMZN", "AAPL", "META"];

const STOCK_CATALOG: readonly StockProfile[] = [
  {
    ticker: "NVDA",
    company: "NVIDIA",
    sector: "Semiconductors",
    tags: ["semiconductors", "ai-infrastructure", "data-center"],
    aliases: ["nvidia", "nvda", "gpu", "blackwell", "cuda"],
    beta: 1.35
  },
  {
    ticker: "AMD",
    company: "Advanced Micro Devices",
    sector: "Semiconductors",
    tags: ["semiconductors", "ai-infrastructure", "data-center"],
    aliases: ["amd", "advanced micro devices", "mi300", "mi350"],
    beta: 1.25
  },
  {
    ticker: "TSM",
    company: "Taiwan Semiconductor",
    sector: "Semiconductors",
    tags: ["semiconductors", "foundry", "hardware-supply"],
    aliases: ["taiwan semiconductor", "tsmc", "tsm", "foundry"],
    beta: 1.05
  },
  {
    ticker: "ASML",
    company: "ASML",
    sector: "Semiconductor equipment",
    tags: ["semiconductors", "equipment", "hardware-supply"],
    aliases: ["asml", "euv", "lithography"],
    beta: 1.08
  },
  {
    ticker: "MSFT",
    company: "Microsoft",
    sector: "Cloud software",
    tags: ["cloud", "ai-infrastructure", "software", "mega-cap-tech"],
    aliases: ["microsoft", "msft", "azure", "openai"],
    beta: 0.95
  },
  {
    ticker: "ORCL",
    company: "Oracle",
    sector: "Cloud software",
    tags: ["cloud", "ai-infrastructure", "software"],
    aliases: ["oracle", "orcl", "oci"],
    beta: 1.05
  },
  {
    ticker: "AMZN",
    company: "Amazon",
    sector: "Cloud and retail",
    tags: ["cloud", "consumer", "mega-cap-tech"],
    aliases: ["amazon", "amzn", "aws"],
    beta: 1.0
  },
  {
    ticker: "GOOGL",
    company: "Alphabet",
    sector: "Internet platforms",
    tags: ["cloud", "platforms", "ads", "mega-cap-tech"],
    aliases: ["alphabet", "google", "googl", "gemini"],
    beta: 0.98
  },
  {
    ticker: "META",
    company: "Meta Platforms",
    sector: "Internet platforms",
    tags: ["platforms", "ads", "ai-infrastructure", "mega-cap-tech"],
    aliases: ["meta", "facebook", "instagram", "threads"],
    beta: 1.12
  },
  {
    ticker: "AAPL",
    company: "Apple",
    sector: "Consumer hardware",
    tags: ["consumer-hardware", "mega-cap-tech", "china-supply"],
    aliases: ["apple", "aapl", "iphone", "app store"],
    beta: 0.9
  },
  {
    ticker: "TSLA",
    company: "Tesla",
    sector: "Electric vehicles",
    tags: ["ev", "consumer", "china-supply"],
    aliases: ["tesla", "tsla", "ev deliveries", "model y", "robotaxi"],
    beta: 1.55
  },
  {
    ticker: "JPM",
    company: "JPMorgan Chase",
    sector: "Banks",
    tags: ["banks", "rates", "credit"],
    aliases: ["jpmorgan", "jpm", "jamie dimon"],
    beta: 0.85
  },
  {
    ticker: "BAC",
    company: "Bank of America",
    sector: "Banks",
    tags: ["banks", "rates", "credit"],
    aliases: ["bank of america", "bac"],
    beta: 0.9
  },
  {
    ticker: "XOM",
    company: "Exxon Mobil",
    sector: "Energy",
    tags: ["energy", "oil"],
    aliases: ["exxon", "xom", "oil", "crude"],
    beta: 0.75
  },
  {
    ticker: "CVX",
    company: "Chevron",
    sector: "Energy",
    tags: ["energy", "oil"],
    aliases: ["chevron", "cvx", "oil", "crude"],
    beta: 0.75
  },
  {
    ticker: "LLY",
    company: "Eli Lilly",
    sector: "Healthcare",
    tags: ["healthcare", "pharma", "glp-1"],
    aliases: ["eli lilly", "lilly", "lly", "zepbound", "mounjaro", "glp-1"],
    beta: 0.78
  },
  {
    ticker: "PFE",
    company: "Pfizer",
    sector: "Healthcare",
    tags: ["healthcare", "pharma"],
    aliases: ["pfizer", "pfe", "vaccine", "drug trial"],
    beta: 0.68
  },
  {
    ticker: "NKE",
    company: "Nike",
    sector: "Consumer discretionary",
    tags: ["consumer", "china-supply"],
    aliases: ["nike", "nke", "sneaker", "footwear"],
    beta: 1.0
  },
  {
    ticker: "CRWD",
    company: "CrowdStrike",
    sector: "Cybersecurity",
    tags: ["cybersecurity", "software"],
    aliases: ["crowdstrike", "crwd", "cybersecurity", "endpoint"],
    beta: 1.25
  },
  {
    ticker: "PANW",
    company: "Palo Alto Networks",
    sector: "Cybersecurity",
    tags: ["cybersecurity", "software"],
    aliases: ["palo alto networks", "panw", "cybersecurity", "firewall"],
    beta: 1.12
  }
];

const CATALYST_RULES: readonly CatalystRule[] = [
  {
    id: "ai-capex",
    labelEn: "AI capex demand",
    labelZh: "AI 资本开支需求",
    direction: "bullish",
    keywords: ["ai", "artificial intelligence", "llm", "gpu", "data center", "datacenter", "blackwell", "openai", "compute", "capacity agreement", "云计算", "算力", "数据中心"],
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
    keywords: ["export control", "tariff", "sanction", "china ban", "entity list", "chip restriction", "关税", "制裁", "出口管制", "禁令"],
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
    keywords: ["antitrust", "doj", "ftc", "sec probe", "lawsuit", "class action", "regulator", "监管", "反垄断", "诉讼", "调查"],
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
    keywords: ["beat estimates", "raise guidance", "guidance raised", "above consensus", "record revenue", "上调指引", "超预期", "收入创新高"],
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
    keywords: ["miss estimates", "cut guidance", "guidance cut", "below consensus", "profit warning", "下调指引", "不及预期", "利润预警"],
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
    keywords: ["oil supply", "crude spike", "opec", "strait of hormuz", "refinery outage", "原油", "油价", "欧佩克", "霍尔木兹"],
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
    keywords: ["cyberattack", "outage", "ransomware", "breach", "data leak", "网络攻击", "宕机", "勒索软件", "数据泄露"],
    directImpact: -1.2,
    tagBias: {
      cybersecurity: 1.2,
      software: -0.25,
      platforms: -0.25,
      banks: -0.2
    }
  }
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(text: string, keywords: readonly string[]): string[] {
  const matches: string[] = [];
  for (const keyword of keywords) {
    const needle = normalizeText(keyword);
    if (!needle) continue;
    const pattern = /[a-z0-9]/.test(needle)
      ? new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`, "i")
      : null;
    if (pattern ? pattern.test(text) : text.includes(needle)) {
      matches.push(keyword);
    }
  }
  return matches;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 1): number {
  return Number(value.toFixed(digits));
}

function buildRunId(headline: string, now: Date): string {
  let hash = 2166136261;
  const seed = `${headline}|${now.toISOString()}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `sni_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function parseWatchlist(watchlist: readonly string[] | null | undefined): StockProfile[] {
  const requested = (watchlist && watchlist.length > 0 ? watchlist : DEFAULT_STOCK_WATCHLIST)
    .map((ticker) => ticker.trim().toUpperCase().replace(/^\$/, ""))
    .filter(Boolean);
  const unique = [...new Set(requested)];
  return unique.map((ticker) => {
    const known = STOCK_CATALOG.find((stock) => stock.ticker === ticker);
    if (known) return known;
    return {
      ticker,
      company: ticker,
      sector: "Watchlist",
      tags: ["watchlist"],
      aliases: [ticker.toLowerCase()],
      beta: 1
    };
  });
}

function detectSignals(text: string, locale: ConsoleLocale): StockNewsSignal[] {
  const signals: StockNewsSignal[] = [];
  for (const rule of CATALYST_RULES) {
    const matchedKeywords = findMatches(text, rule.keywords);
    if (matchedKeywords.length === 0) continue;
    signals.push({
      id: rule.id,
      label: pick(locale, rule.labelEn, rule.labelZh),
      direction: rule.direction,
      strength: round(clamp(0.8 + matchedKeywords.length * 0.18, 0.8, 1.55), 2),
      matchedKeywords: matchedKeywords.slice(0, 5)
    });
  }
  return signals;
}

function getRule(id: string): CatalystRule {
  const rule = CATALYST_RULES.find((item) => item.id === id);
  if (!rule) throw new Error(`Unknown catalyst rule: ${id}`);
  return rule;
}

function scoreStocks(input: {
  text: string;
  profiles: readonly StockProfile[];
  signals: readonly StockNewsSignal[];
}): ScoredStock[] {
  return input.profiles
    .map((profile) => {
      const directHits = findMatches(input.text, [profile.ticker, `$${profile.ticker}`, profile.company, ...profile.aliases]);
      let score = directHits.length > 0 ? 0.35 : 0;
      const signalHits: StockNewsSignal[] = [];

      for (const signal of input.signals) {
        const rule = getRule(signal.id);
        let sectorBias = 0;
        for (const tag of profile.tags) {
          sectorBias += rule.tagBias[tag] ?? 0;
        }
        sectorBias = clamp(sectorBias, -2.4, 2.4);
        const directImpact = directHits.length > 0 ? rule.directImpact : 0;
        const contribution = (sectorBias + directImpact) * signal.strength;
        if (Math.abs(contribution) >= 0.12) {
          score += contribution;
          signalHits.push(signal);
        }
      }

      return {
        profile,
        score: round(score * profile.beta, 2),
        directHits: [...new Set(directHits)].slice(0, 4),
        signalHits
      };
    })
    .filter((item) => Math.abs(item.score) >= 0.45 || item.directHits.length > 0)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}

function directionFor(score: number): StockImpactDirection {
  if (score >= 0.45) return "bullish";
  if (score <= -0.45) return "bearish";
  return "mixed";
}

function actionFor(score: number, directHits: readonly string[]): StockAction {
  if (score >= 3.1) return "add";
  if (score >= 0.65) return "watch";
  if (score <= -3.1) return directHits.length > 0 ? "trim" : "hedge";
  if (score <= -1.0) return "hedge";
  return "avoid";
}

function confidenceFor(item: ScoredStock): StockConfidence {
  const magnitude = Math.abs(item.score);
  if (magnitude >= 3 && item.signalHits.length >= 2) return "high";
  if (magnitude >= 1.2 || item.directHits.length > 0) return "medium";
  return "low";
}

function actionLabel(action: StockAction, locale: ConsoleLocale): string {
  const labels: Record<StockAction, [string, string]> = {
    add: ["Add / buy on confirmation", "确认后加仓 / 买入"],
    watch: ["Watch for entry", "观察入场"],
    trim: ["Trim / reduce", "减仓 / 降低暴露"],
    hedge: ["Hedge sector exposure", "对冲板块暴露"],
    avoid: ["Avoid chasing", "避免追价"]
  };
  const [en, zh] = labels[action];
  return pick(locale, en, zh);
}

function directionLabel(direction: StockImpactDirection, locale: ConsoleLocale): string {
  const labels: Record<StockImpactDirection, [string, string]> = {
    bullish: ["Bullish", "利多"],
    bearish: ["Bearish", "利空"],
    mixed: ["Mixed", "混合"]
  };
  const [en, zh] = labels[direction];
  return pick(locale, en, zh);
}

function confidenceLabel(confidence: StockConfidence, locale: ConsoleLocale): string {
  const labels: Record<StockConfidence, [string, string]> = {
    high: ["High", "高"],
    medium: ["Medium", "中"],
    low: ["Low", "低"]
  };
  const [en, zh] = labels[confidence];
  return pick(locale, en, zh);
}

function buildAffectedStock(item: ScoredStock, locale: ConsoleLocale): ImpactedStock {
  const direction = directionFor(item.score);
  const action = actionFor(item.score, item.directHits);
  const confidence = confidenceFor(item);
  const signalLabels = item.signalHits.map((signal) => signal.label);
  const primarySignal = signalLabels[0] ?? pick(locale, "single-name news", "个股新闻");
  const expectedMovePct = round(clamp(item.score * 1.15, -9, 9), 1);
  const probabilityDeltaPct = round(clamp(item.score * 3.2, -24, 24), 1);
  const incrementalEdgePct = round(clamp(item.score * 0.95, -7.5, 7.5), 1);
  const directText =
    item.directHits.length > 0
      ? pick(locale, `direct mention: ${item.directHits.join(", ")}`, `直接命中：${item.directHits.join(", ")}`)
      : pick(locale, "sector exposure, no direct company mention", "板块暴露，未直接点名公司");

  return {
    ticker: item.profile.ticker,
    company: item.profile.company,
    sector: item.profile.sector,
    direction,
    directionLabel: directionLabel(direction, locale),
    action,
    actionLabel: actionLabel(action, locale),
    confidence,
    confidenceLabel: confidenceLabel(confidence, locale),
    horizon: pick(locale, "1-5 trading days", "1-5 个交易日"),
    impactScore: item.score,
    expectedMovePct,
    probabilityDeltaPct,
    incrementalEdgePct,
    thesis: pick(
      locale,
      `${item.profile.ticker} screens ${directionLabel(direction, locale).toLowerCase()} from ${primarySignal}; ${directText}. The recommendation is incremental, not a static fair-value call.`,
      `${item.profile.ticker} 因「${primarySignal}」被判定为${directionLabel(direction, locale)}；${directText}。这是一条新闻增量建议，不是静态估值结论。`
    ),
    risk: pick(
      locale,
      "Main risk: the first headline may be revised, denied, already priced in premarket, or overwhelmed by macro beta before cash open.",
      "主要风险：首条新闻可能被修正、否认，或盘前已被消化；开盘前也可能被宏观 beta 覆盖。"
    ),
    evidence: [
      ...signalLabels.slice(0, 3).map((label) => pick(locale, `Catalyst: ${label}`, `催化：${label}`)),
      directText
    ],
    triggers: [
      pick(locale, "Check company response or filing before sizing.", "下单前核对公司回应或公告文件。"),
      pick(locale, "Compare premarket move with expected move; avoid chasing if the gap is already consumed.", "比较盘前涨跌与预期波动；若 gap 已消化则避免追价。"),
      pick(locale, "Re-run after the second independent source confirms the same catalyst.", "第二个独立来源确认同一催化后重新运行。")
    ]
  };
}

function buildStages(locale: ConsoleLocale): StockNewsStage[] {
  return [
    {
      id: "news-intake",
      order: 1,
      title: pick(locale, "News intake", "新闻接入"),
      detail: pick(locale, "Normalize the headline, source, timestamp, and body into a traceable event object.", "把标题、来源、时间和正文归一化为可追溯事件对象。"),
      status: "complete",
      durationMs: 180
    },
    {
      id: "catalyst-map",
      order: 2,
      title: pick(locale, "Catalyst map", "催化分类"),
      detail: pick(locale, "Classify whether the news changes demand, regulation, rates, supply, earnings, litigation, or product risk.", "判断新闻改变的是需求、监管、利率、供给、盈利、诉讼还是产品风险。"),
      status: "complete",
      durationMs: 260
    },
    {
      id: "exposure-graph",
      order: 3,
      title: pick(locale, "Exposure graph", "股票暴露图"),
      detail: pick(locale, "Map catalyst signals to direct tickers, suppliers, customers, sector peers, and macro-sensitive baskets.", "把催化信号映射到直接股票、供应商、客户、同业和宏观敏感篮子。"),
      status: "complete",
      durationMs: 310
    },
    {
      id: "delta-forecast",
      order: 4,
      title: pick(locale, "Incremental forecast", "增量预测"),
      detail: pick(locale, "Estimate the change from the pre-news baseline: direction, expected move, confidence, and time horizon.", "估计相对新闻前基线的变化：方向、预期波动、置信度与时间窗口。"),
      status: "complete",
      durationMs: 340
    },
    {
      id: "action-plan",
      order: 5,
      title: pick(locale, "Action plan", "推荐操作"),
      detail: pick(locale, "Convert the delta into a watch/add/trim/hedge plan with explicit caveats before trading.", "把增量影响转成观察、加仓、减仓或对冲计划，并写清交易前置条件。"),
      status: "complete",
      durationMs: 260
    },
    {
      id: "push",
      order: 6,
      title: pick(locale, "Push package", "推送包"),
      detail: pick(locale, "Package the same report for email and WebSocket delivery receipts.", "把同一份报告封装为邮件和 WebSocket 推送回执。"),
      status: "complete",
      durationMs: 150
    }
  ];
}

function buildFallbackAffectedStocks(profiles: readonly StockProfile[], locale: ConsoleLocale): ImpactedStock[] {
  return profiles.slice(0, 3).map((profile) =>
    buildAffectedStock({
      profile,
      score: 0.2,
      directHits: [],
      signalHits: []
    }, locale)
  );
}

export function buildStockNewsImpactRun(request: StockNewsImpactRequest, now = new Date()): StockNewsImpactRun {
  const locale = request.locale ?? "en";
  const headline = request.headline.trim().slice(0, 500) || DEFAULT_STOCK_NEWS_HEADLINE;
  const body = request.body?.trim() ? request.body.trim().slice(0, 1800) : null;
  const source = request.source?.trim() ? request.source.trim().slice(0, 140) : null;
  const url = request.url?.trim() ? request.url.trim().slice(0, 500) : null;
  const publishedAt = request.publishedAt?.trim() || now.toISOString();
  const text = normalizeText([headline, body, source].filter(Boolean).join(" "));
  const profiles = parseWatchlist(request.watchlist);
  const signals = detectSignals(text, locale);
  const scored = scoreStocks({ text, profiles, signals });
  const affectedStocks = scored.length > 0
    ? scored.slice(0, 8).map((item) => buildAffectedStock(item, locale))
    : buildFallbackAffectedStocks(profiles, locale);
  const topTickers = affectedStocks.slice(0, 4).map((stock) => stock.ticker);
  const netPositive = affectedStocks.filter((stock) => stock.direction === "bullish").length;
  const netNegative = affectedStocks.filter((stock) => stock.direction === "bearish").length;

  return {
    id: buildRunId(headline, now),
    mode: "demo_read_only",
    generatedAtUtc: now.toISOString(),
    news: {
      headline,
      body,
      source,
      url,
      publishedAt
    },
    watchlist: profiles.map((profile) => profile.ticker),
    summary: {
      title: pick(locale, "News delta impact report", "新闻增量影响报告"),
      verdict: pick(
        locale,
        `${topTickers.join(", ")} screen as the highest-impact names. Net map: ${netPositive} bullish, ${netNegative} bearish across the watchlist.`,
        `${topTickers.join("、")} 是本次最高影响股票。观察池中：${netPositive} 个利多、${netNegative} 个利空。`
      ),
      marketMechanism: pick(
        locale,
        "The engine treats news as a delta to the pre-news baseline: first classify the catalyst, then map second-order exposure before suggesting an action.",
        "引擎把新闻视为相对新闻前基线的增量：先识别催化，再映射二阶暴露，最后给出操作建议。"
      ),
      topTickers,
      pushNarrative: pick(
        locale,
        "Email carries the human-readable report; WebSocket carries the same run id plus top-ticker payload for live dashboards.",
        "邮件发送可读报告；WebSocket 推送同一 run id 与核心股票 payload，供实时看板消费。"
      )
    },
    signals,
    stages: buildStages(locale),
    affectedStocks,
    delivery: [],
    limitations: [
      pick(locale, "Demo mode uses deterministic rules and does not fetch live prices or execute trades.", "Demo 模式使用确定性规则，不抓实时价格，也不会执行交易。"),
      pick(locale, "Recommendations are event-response hypotheses; sizing still needs liquidity, spread, borrow, and risk checks.", "推荐只是新闻响应假设；实际仓位仍需检查流动性、价差、融券和风控。"),
      pick(locale, "A production feed should verify source credibility and deduplicate duplicate headlines before pushing.", "生产新闻流应先验证来源可信度，并在推送前去重。")
    ]
  };
}
