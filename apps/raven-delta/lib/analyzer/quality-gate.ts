// Ingest quality gate — the cheap "is this news big enough?" judgment that
// runs BEFORE the full delta analysis on machine-fed items (tweets, feeds).
// Flow per product spec: news arrives -> a model judges quality -> only if it
// clears the bar does Raven Delta run the full analysis and push email/WS.
//
// With an LLM configured the gate is a small, fast prompt; without one it
// degrades to catalyst-signal detection from the rules engine (labeled).

import { z } from "zod";
import type { NewsInput } from "./schema";
import { resolveEngine, runLlmJson } from "./provider";
import { detectSignals, normalizeText, scoreUniverse } from "./rules-engine";

export const gateVerdictSchema = z.object({
  pass: z.boolean(),
  score: z.number().gte(0).lte(100),
  reason: z.string().trim().min(1).max(400)
});
export type GateVerdict = z.infer<typeof gateVerdictSchema>;

export interface GateResult extends GateVerdict {
  gateEngine: "llm" | "rules";
  threshold: number;
}

export function gateThreshold(): number {
  const parsed = Number(process.env.DELTA_GATE_MIN_SCORE);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 60;
}

export function buildGatePrompt(news: NewsInput): string {
  return `You are the intake quality gate for Raven Delta, a real-time news-impact engine for US equities. Judge whether this news item is BIG enough to justify a full impact analysis and a push alert to traders.

Score 0-100 for market materiality (would a US-equity desk want an alert?). Consider: does it plausibly move any large-cap US stock or sector; is it new information rather than commentary/recap; is it concrete (numbers, names, decisions) rather than vague. Judge the TEXT itself — do not assume credibility you cannot see.

pass = true only if the item deserves a full analysis and an immediate alert.

News text:
${news.text}
URL: ${news.url ?? "(none)"}

Return EXACTLY ONE JSON object: {"pass": boolean, "score": number, "reason": string}`;
}

function rulesGate(news: NewsInput, threshold: number): GateResult {
  const text = normalizeText(news.text);
  const signals = detectSignals(text, news.locale);
  const scored = scoreUniverse(text, signals);
  const topAbs = Math.abs(scored[0]?.score ?? 0);
  const score = Math.min(100, Math.round(topAbs * 18 + signals.length * 8));
  const pass = signals.length > 0 && score >= threshold;
  return {
    pass,
    score,
    reason:
      signals.length === 0
        ? "Rules gate: no recognized catalyst keywords."
        : `Rules gate: catalysts ${signals.map((signal) => signal.id).join(", ")}, top impact score ${topAbs}.`,
    gateEngine: "rules",
    threshold
  };
}

export async function runQualityGate(news: NewsInput): Promise<GateResult> {
  const threshold = gateThreshold();
  const resolution = resolveEngine();
  if (resolution.engine === "rules") {
    return rulesGate(news, threshold);
  }
  try {
    const verdict = gateVerdictSchema.parse(await runLlmJson(resolution.engine, buildGatePrompt(news)));
    // The threshold is harness policy, not model policy: enforce it here.
    return { ...verdict, pass: verdict.pass && verdict.score >= threshold, gateEngine: "llm", threshold };
  } catch (error) {
    const fallback = rulesGate(news, threshold);
    return {
      ...fallback,
      reason: `LLM gate failed (${error instanceof Error ? error.message : String(error)}); ${fallback.reason}`
    };
  }
}
