// Output-language control for the forecaster's user-facing prose.
//
// Opt-in via FORECAST_LANGUAGE=zh (set per-run by the Raven app; defaults to
// English so the trading pipeline and every existing caller are unaffected).
// The directive only touches free-text fields — JSON keys, enum values, URLs,
// dates and numbers stay ASCII so validators and the Bayesian harness see the
// exact same machine contract in every language.

export type ForecastLanguage = "en" | "zh";

export function forecastLanguage(): ForecastLanguage {
  return process.env.FORECAST_LANGUAGE === "zh" ? "zh" : "en";
}

export function languageDirective(lang: ForecastLanguage = forecastLanguage()): string {
  if (lang !== "zh") return "";
  return `
LANGUAGE: Write every free-text field of your output in Simplified Chinese (简体中文) — claims, rationales, summaries, criteria, assumptions, caveats, verdict prose, notes, quips. Keep JSON keys, enum values ("supports_yes", "weak", "official", "high", …), URLs, dates and numbers exactly as specified above, in English/ASCII.
`;
}
