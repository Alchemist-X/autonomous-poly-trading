// Shared display helpers, lifted verbatim from the design handoff's decorator
// logic so both demo and live data render identically.

import type { NetDir, Tier } from "./types";

export const arrowFor = (d: number): string => (d < 0 ? "▼" : d > 0 ? "▲" : "—");

export const dirFor = (d: number): NetDir => (d < 0 ? "down" : d > 0 ? "up" : "flat");

export const diamondsFor = (t: Tier): string => ({ high: "◆◆◆", med: "◆◆◇", low: "◆◇◇" })[t];

export const cap = (x: string): string => x.charAt(0).toUpperCase() + x.slice(1);

export const pct = (p: number): string => `${Math.round(p * 100)}%`;

// Verdict word buckets for P(YES). The demo's 7% → "Very unlikely".
export function verdictFor(p: number): string {
  if (p < 0.1) return "Very unlikely";
  if (p < 0.25) return "Unlikely";
  if (p < 0.45) return "Leaning no";
  if (p < 0.55) return "Too close to call";
  if (p < 0.75) return "Leaning yes";
  if (p < 0.9) return "Likely";
  return "Very likely";
}

export function formatDuration(fromIso: string, toIso: string): string {
  const ms = Math.max(0, new Date(toIso).getTime() - new Date(fromIso).getTime());
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatElapsed(fromIso: string, now: number): string {
  const totalSec = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] ?? url;
  }
}

export const srcLabelFor = (t: "official" | "press" | "insider"): string =>
  ({ official: "Official source", press: "Press", insider: "Insider report" })[t];

export const credWord = (c: "high" | "medium" | "low"): Tier => (c === "medium" ? "med" : c);

const STRENGTH_TIER: Record<"weak" | "moderate" | "strong", Tier> = { weak: "low", moderate: "med", strong: "high" };
export const strengthToValue = (s: "weak" | "moderate" | "strong"): Tier => STRENGTH_TIER[s];
