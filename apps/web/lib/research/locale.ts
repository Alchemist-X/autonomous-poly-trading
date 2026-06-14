// Console locale primitives for the Forecasting Engine.
//
// Leaf module: imports nothing so both the server-side content generator
// (prediction-engine-demo.ts) and the client chrome dictionary (i18n.ts) can
// depend on it without a cycle. English is the default to match the apex of
// forecasting-agent.com; Chinese is the toggle.

export type ConsoleLocale = "en" | "zh";

export const DEFAULT_CONSOLE_LOCALE: ConsoleLocale = "en";

export function isConsoleLocale(value: unknown): value is ConsoleLocale {
  return value === "en" || value === "zh";
}

export function normalizeConsoleLocale(value: unknown): ConsoleLocale {
  return isConsoleLocale(value) ? value : DEFAULT_CONSOLE_LOCALE;
}

// Pick localized prose. English first to keep call sites readable as
// `pick(locale, "English", "中文")`.
export function pick(locale: ConsoleLocale, en: string, zh: string): string {
  return locale === "zh" ? zh : en;
}
