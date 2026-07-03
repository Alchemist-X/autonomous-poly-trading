"use client";

// Minimal locale layer for the Raven app: a context provider (persisted to
// localStorage, same pattern as the theme toggle), a `useT` hook that renders
// an Entry in the active locale with {var} interpolation, and tier/verdict
// label maps for engine-produced English words.
//
// Entries are plain objects passed directly to t() — no central key registry,
// so domain dictionaries (core/home/verdict) can't collide and TS checks
// existence at the call site.

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Locale = "en" | "zh";

export interface Entry {
  en: string;
  zh: string;
}

const STORE_KEY = "raven-locale";

const LocaleCtx = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({
  locale: "en",
  setLocale: () => undefined
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved === "zh") setLocaleState("zh");
    } catch {
      /* private mode etc. — stay en */
    }
  }, []);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORE_KEY, l);
    } catch {
      /* non-persistent is fine */
    }
  }, []);
  return <LocaleCtx.Provider value={{ locale, setLocale }}>{children}</LocaleCtx.Provider>;
}

export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void } {
  return useContext(LocaleCtx);
}

export type TFn = (entry: Entry, vars?: Record<string, string | number>) => string;

export function render(entry: Entry, locale: Locale, vars?: Record<string, string | number>): string {
  let s = entry[locale];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

export function useT(): TFn {
  const { locale } = useLocale();
  return useCallback((entry: Entry, vars?: Record<string, string | number>) => render(entry, locale, vars), [locale]);
}

// --- engine-word localization (adapter emits English; display maps it) ---

const VERDICT_ZH: Record<string, string> = {
  "Very unlikely": "基本不会",
  Unlikely: "不太可能",
  "Leaning no": "偏否",
  "Too close to call": "五五开",
  "Leaning yes": "偏是",
  Likely: "很可能",
  "Very likely": "几乎确定"
};

export function verdictLabel(verdict: string, locale: Locale): string {
  return locale === "zh" ? (VERDICT_ZH[verdict] ?? verdict) : verdict;
}

const CONF_ZH: Record<string, string> = { high: "高", medium: "中", low: "低" };

export function confidenceLabel(conf: string, locale: Locale): string {
  return locale === "zh" ? (CONF_ZH[conf] ?? conf) : conf;
}

// Tier words as decorated by the VM ("High" | "Med" | "Low").
const TIER_ZH: Record<string, string> = { High: "高", Med: "中", Low: "低" };

export function tierWord(tier: string, locale: Locale): string {
  return locale === "zh" ? (TIER_ZH[tier] ?? tier) : tier;
}

export function sourcesLabel(n: number | string, locale: Locale): string {
  if (locale === "zh") return `${n} 个来源`;
  return `${n} source${Number(n) === 1 ? "" : "s"}`;
}
