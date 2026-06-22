// Shared pure formatters for the Predict Raven components. Not components
// themselves (camelCase) — internal helpers, kept out of the public barrel.
import type * as React from "react";

export const pct = (p: number, d = 1): string => `${(p * 100).toFixed(d)}%`;
export const absPp = (pp: number): string => Math.abs(pp).toFixed(1);
export const arrow = (pp: number): string => (pp >= 0 ? "▲" : "▼"); // ▲ ▼
export const signPp = (pp: number): string => `${pp >= 0 ? "+" : "−"}${absPp(pp)}`; // +/−
export const dirColor = (pp: number): string => (pp >= 0 ? "var(--rv-yes)" : "var(--rv-no)");

export const canon = (url: string): string =>
  String(url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

export const reflectionTitle = (t: string): string =>
  String(t || "").replace(/^↻\s*reflection on:\s*/i, ""); // strip "↻ reflection on:"

export const verdictLabel = (prob: number): string => {
  const v = prob * 100;
  if (v < 10) return "Very unlikely";
  if (v < 25) return "Unlikely";
  if (v < 40) return "Leaning no";
  if (v <= 60) return "Toss-up";
  if (v < 75) return "Leaning yes";
  if (v < 90) return "Likely";
  return "Very likely";
};

// Inline-style fragment for a signed pp chip (green up / red down).
export const chipStyle = (pp: number): React.CSSProperties => {
  const up = pp >= 0;
  return {
    color: up ? "var(--rv-yes)" : "var(--rv-no)",
    background: up ? "rgba(70,196,154,0.14)" : "rgba(229,100,93,0.14)",
  };
};
