// Raven Delta rules fallback — text matching, signal detection, and the
// deterministic scoring pipeline. Pure functions only; all classifiers are
// exported so tests can exercise thresholds directly (#36).
//
// The engine always scans the whole maintained universe — the legacy
// fallback-watchlist semantics were removed (#34).

import type { Confidence, Direction, Magnitude } from "./schema";
import { getUniverse, type UniverseStock } from "./universe";
import { CATALYST_RULES, GENERIC_TOPIC_ALIASES, getRule, pick, type Locale } from "./rules-data";

export interface RuleSignal {
  readonly id: string;
  readonly label: string;
  readonly direction: Direction;
  readonly strength: number;
  readonly matchedKeywords: readonly string[];
}

export interface ScoredStock {
  readonly stock: UniverseStock;
  readonly score: number;
  readonly directHits: readonly string[];
  readonly signalHits: readonly RuleSignal[];
}

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 1): number {
  return Number(value.toFixed(digits));
}

// Latin/numeric needles match on word boundaries so "meta" does not hit
// "metadata"; CJK needles (no latin characters) match as substrings because
// Chinese text has no word delimiters.
export function findMatches(text: string, keywords: readonly string[]): string[] {
  return keywords.filter((keyword) => {
    const needle = normalizeText(keyword);
    if (!needle) return false;
    if (!/[a-z0-9]/.test(needle)) return text.includes(needle);
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`, "i");
    return pattern.test(text);
  });
}

export function detectSignals(text: string, locale: Locale): RuleSignal[] {
  return CATALYST_RULES.flatMap((rule) => {
    const matchedKeywords = findMatches(text, rule.keywords);
    if (matchedKeywords.length === 0) return [];
    return [
      {
        id: rule.id,
        label: pick(locale, rule.labelEn, rule.labelZh),
        direction: rule.direction,
        strength: round(clamp(0.8 + matchedKeywords.length * 0.18, 0.8, 1.55), 2),
        matchedKeywords: matchedKeywords.slice(0, 5)
      }
    ];
  });
}

// Identity aliases: ticker, company names, and product names from the
// universe file. Generic topic words are filtered out so they can never
// create a "direct mention" (#12).
export function identityAliases(stock: UniverseStock): string[] {
  const raw = [
    stock.ticker,
    `$${stock.ticker}`,
    stock.company,
    ...(stock.companyZh ? [stock.companyZh] : []),
    ...stock.aliases
  ];
  return raw.filter((alias) => !GENERIC_TOPIC_ALIASES.has(normalizeText(alias)));
}

export function scoreStock(text: string, signals: readonly RuleSignal[], stock: UniverseStock): ScoredStock {
  // Case-insensitive dedupe: "Oracle" (company) and "oracle" (alias) are one hit.
  const hitsByNorm = new Map(findMatches(text, identityAliases(stock)).map((hit) => [normalizeText(hit), hit]));
  const directHits = [...hitsByNorm.values()].slice(0, 4);
  const hasDirect = directHits.length > 0;
  const contributions = signals
    .map((signal) => {
      const rule = getRule(signal.id);
      const sectorBias = clamp(
        stock.tags.reduce((sum, tag) => sum + (rule.tagBias[tag] ?? 0), 0),
        -2.4,
        2.4
      );
      const directImpact = hasDirect ? rule.directImpact : 0;
      return { signal, contribution: (sectorBias + directImpact) * signal.strength };
    })
    .filter((entry) => Math.abs(entry.contribution) >= 0.12);
  const rawScore =
    (hasDirect ? 0.35 : 0) + contributions.reduce((sum, entry) => sum + entry.contribution, 0);
  return {
    stock,
    score: round(rawScore * stock.beta, 2),
    directHits,
    signalHits: contributions.map((entry) => entry.signal)
  };
}

// Score every universe stock, keep the ones that clear the impact threshold
// or are named directly, strongest impact first.
export function scoreUniverse(text: string, signals: readonly RuleSignal[]): ScoredStock[] {
  return getUniverse()
    .stocks.map((stock) => scoreStock(text, signals, stock))
    .filter((item) => Math.abs(item.score) >= 0.45 || item.directHits.length > 0)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}

export function directionFor(score: number): Direction {
  if (score >= 0.45) return "bullish";
  if (score <= -0.45) return "bearish";
  return "mixed";
}

export function magnitudeFor(score: number): Magnitude {
  const abs = Math.abs(score);
  if (abs >= 3) return "large";
  if (abs >= 1.2) return "medium";
  return "small";
}

export function actionFor(score: number, hasDirectHit: boolean): "add" | "watch" | "trim" | "hedge" | "avoid" {
  if (score >= 3.1) return "add";
  if (score >= 0.65) return "watch";
  if (score <= -3.1) return hasDirectHit ? "trim" : "hedge";
  if (score <= -1.0) return "hedge";
  return "avoid";
}

export function confidenceFor(score: number, signalHitCount: number, hasDirectHit: boolean): Confidence {
  const abs = Math.abs(score);
  if (abs >= 3 && signalHitCount >= 2) return "high";
  if (abs >= 1.2 || hasDirectHit) return "medium";
  return "low";
}

// Point estimate = score * 1.15 clamped to [-9, 9], widened +/-40% into a
// range (point 4.0 -> {min: 2.4, max: 5.6}); for negative points the wider
// end becomes min so min <= max always holds.
export function expectedMoveRange(score: number): { min: number; max: number } {
  const point = clamp(score * 1.15, -9, 9);
  const nearZero = round(point * 0.6, 1);
  const farFromZero = round(point * 1.4, 1);
  return point >= 0 ? { min: nearZero, max: farFromZero } : { min: farFromZero, max: nearZero };
}

// 0-100 attention score: top |impact| dominates, each detected catalyst adds.
export function attentionScore(topAbsScore: number, signalCount: number): number {
  return clamp(Math.round(topAbsScore * 18 + signalCount * 8), 0, 100);
}
