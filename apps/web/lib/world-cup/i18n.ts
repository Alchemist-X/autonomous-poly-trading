// UI strings for the bilingual site. Forecast content (questions, one-liners,
// key reasons, team names) is already bilingual in the data layer; this file
// covers chrome and labels. Lang travels as the ?lang=en query param.

export type Lang = "zh" | "en";

export function langOf(param: string | undefined): Lang {
  return param === "en" ? "en" : "zh";
}

export function withLang(href: string, lang: Lang): string {
  if (lang !== "en") return href;
  return href.includes("?") ? `${href}&lang=en` : `${href}?lang=en`;
}

export const STR = {
  navForecasts: { zh: "预测", en: "Forecasts" },
  navBracket: { zh: "对阵", en: "Bracket" },
  navDeploy: { zh: "本地部署", en: "Self-host" },
  edition: { zh: "世界杯版", en: "World Cup" },
  heroTitle: { zh: "世界杯", en: "World Cup" },
  tabChampion: { zh: "冠军", en: "Champion" },
  tabGroups: { zh: "小组赛", en: "Groups" },
  tabKnockout: { zh: "出线名单", en: "Knockouts" },
  heroMeta: {
    zh: "87 个问题公开预测 · 不读取任何市场价格 · Brier 公开记分 · 预测时间",
    en: "87 public forecasts · no market prices consulted · publicly Brier-scored · forecast time"
  },
  subChampion: {
    zh: "谁会捧起 2026 年 7 月 19 日的大力神杯？48 支球队的夺冠概率，来自 10 万次纯 Elo 蒙特卡洛模拟与逐队证据修正——全程没有看过任何盘口。",
    en: "Who lifts the trophy on July 19, 2026? Championship probabilities for all 48 teams, from 100,000 Elo Monte-Carlo simulations plus per-team evidence adjustments — built without ever looking at a single market price."
  },
  subGroups: {
    zh: "72 场小组赛逐场预测：每一场给出胜 / 平 / 负三路概率与模型判断。点开任意一场看主要理由与完整推理。",
    en: "All 72 group-stage matches: win / draw / loss probabilities and the model's pick for every fixture. Open any match for the key reasons and full reasoning."
  },
  subKnockout: {
    zh: "从小组出线到决赛的完整对阵推演：淘汰赛每个节点取最可能的结果并旁标该场胜率，连线一路通向决赛。",
    en: "The complete run from group qualification to the final: every knockout node takes the most likely result with its per-tie win probability, lines running all the way to the final."
  },
  ruleNote: {
    zh: "规则：每组前两名直接晋级 32 强；12 个小组的第三名中，成绩最好的 8 支同样晋级——所以每个组会有 2 支或 3 支球队出线。",
    en: "Format: the top two in every group advance to the round of 32, joined by the 8 best third-placed teams across the 12 groups — so each group sends 2 or 3 teams through."
  },
  groupsCol: { zh: "小组出线 · 含出线概率", en: "Group qualification · advance %" },
  r32: { zh: "32 强", en: "Round of 32" },
  r16: { zh: "16 强", en: "Round of 16" },
  qf: { zh: "八强", en: "Quarterfinals" },
  sf: { zh: "四强", en: "Semifinals" },
  finalCol: { zh: "决赛 · 7 月 19 日", en: "Final · July 19" },
  out: { zh: "出局", en: "OUT" },
  predictedChampion: { zh: "预测冠军", en: "Predicted champion" },
  finalWinProb: { zh: "决赛胜率", en: "Final win prob" },
  marginalTitle: {
    zh: "边际概率（每队独立计算，与上方单一剧本互补）",
    en: "Marginal probabilities (per team, complementary to the single bracket path above)"
  },
  qfBoard: { zh: "八强概率榜", en: "Quarterfinal probabilities" },
  sfBoard: { zh: "四强概率榜", en: "Semifinal probabilities" },
  sumQf: { zh: "48 队概率之和 ≈ 8", en: "48 teams sum ≈ 8" },
  sumSf: { zh: "48 队概率之和 ≈ 4", en: "48 teams sum ≈ 4" },
  ourTake: { zh: "我们的观点", en: "Our take" },
  fullReasoning: { zh: "查看完整推理 →", en: "Read the full reasoning →" },
  fullReport: { zh: "完整推理报告 →", en: "Full reasoning report →" },
  sources: { zh: "个来源", en: "sources" },
  confidence: { zh: "置信", en: "confidence" },
  source: { zh: "来源", en: "source" },
  cloudNote: {
    zh: "旗帜大小 ∝ 夺冠概率 · 点击查看完整推理",
    en: "Flag size ∝ title probability · click for full reasoning"
  },
  winnerPick: { zh: "头名预测", en: "Winner pick" },
  group: { zh: "组", en: "Group" },
  draw: { zh: "平局", en: "Draw" },
  drawShort: { zh: "平", en: "D" },
  winSuffix: { zh: "胜", en: "" },
  importing: { zh: "预测数据导入中。", en: "Forecast data is being imported." },
  qualified: { zh: "晋级", en: "IN" }
} as const;

export type StrKey = keyof typeof STR;

export function t(lang: Lang, key: StrKey): string {
  return STR[key][lang];
}

const TIER: Record<string, { zh: string; en: string }> = {
  高: { zh: "高", en: "high" },
  中: { zh: "中", en: "medium" },
  低: { zh: "低", en: "low" }
};

export function tierLabel(lang: Lang, tier: string): string {
  return TIER[tier]?.[lang] ?? tier;
}
