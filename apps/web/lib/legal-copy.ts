// Centralized compliance copy for the World Cup probability-research surface.
// Single source of truth so the disclaimer is identical across the footer,
// report pages, /terms, /privacy, the run API response, and exported PDFs.
// Positioning red line: this is probability RESEARCH, never betting advice.
// Wording is intentionally aligned with the public Kimi World Cup report's
// "consensus bias research variable" framing (see plan doc §8 / §11).

export type LocaleCopy = {
  readonly zh: string;
  readonly en: string;
};

export const DISCLAIMER_SHORT: LocaleCopy = {
  zh: "本工具仅提供基于公开数据的概率研究，不构成任何金融、投资或投注建议。预测是概率而非确定性结果。部分地区要求年满 18 岁。",
  en: "Probability research from public data only. Not financial or betting advice. Forecasts are probabilities, not certainties. 18+ where required."
};

export const DISCLAIMER_FULL: LocaleCopy = {
  zh: "本工具提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。市场赔率仅作为“共识偏差研究变量”用于研究对比。",
  en: "This tool provides probability estimates and research analysis derived from public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions — confirm your local laws; some regions require you to be 18+. We do not accept, place, or facilitate any wagers, and we provide no funding path to any betting platform. Market odds are used only as a “consensus bias research variable” for comparison."
};

// Words that must never appear in product or marketing copy (compliance gate).
// Kept here so a lint/test can assert against rendered strings.
export const PROHIBITED_TERMS: readonly string[] = [
  "稳赚",
  "必中",
  "包赢",
  "跟单",
  "荐单",
  "稳胆",
  "tips",
  "picks",
  "guaranteed",
  "lock"
];

// Neutral, research-framed vocabulary we DO use (mirrors Kimi report §2.5).
export const APPROVED_FRAMING: readonly string[] = [
  "模型输出显示 / Model output indicates",
  "历史数据表明 / Historical data suggests",
  "概率估计 / probability estimate",
  "置信区间 / confidence interval",
  "research signal"
];
