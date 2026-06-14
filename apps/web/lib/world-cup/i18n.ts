// World Cup i18n — three locales: en (default + fallback), zh-CN, zh-TW.
//
// UI strings live in messages/*.json — en + zh-CN are hand-authored resource
// files; zh-TW.generated.json is produced from zh-CN by
// scripts/world-cup/gen-traditional.ts (opencc, Simplified → Taiwan-standard
// Traditional). Locale travels as the FIRST path segment (/en, /zh-CN, /zh-TW);
// middleware.ts detects the browser language on first visit, redirects to the
// matching prefix, and remembers the choice in the NEXT_LOCALE cookie.

import en from "./messages/en.json";
import zhCN from "./messages/zh-CN.json";
import zhTW from "./messages/zh-TW.generated.json";
import teamsTW from "./generated/teams-zh-TW.generated.json";

export type Locale = "en" | "zh-CN" | "zh-TW";

export const LOCALES: ReadonlyArray<{ code: Locale; label: string }> = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" }
];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(x: string | undefined | null): x is Locale {
  return x === "en" || x === "zh-CN" || x === "zh-TW";
}

export function localeOf(x: string | undefined | null): Locale {
  return isLocale(x) ? x : DEFAULT_LOCALE;
}

// Map an Accept-Language header (or a single tag) to a supported locale.
// Traditional variants (zh-TW / zh-HK / zh-MO / *-Hant) take the traditional
// set; other Chinese tags take Simplified; everything else falls back to en.
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  const header = (acceptLanguage ?? "").toLowerCase();
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const tag = (part.split(";")[0] ?? "").trim();
    if (!tag) continue;
    if (tag === "zh-tw" || tag === "zh-hk" || tag === "zh-mo" || tag.includes("hant")) return "zh-TW";
    if (tag === "zh" || tag.startsWith("zh-") || tag.includes("hans")) return "zh-CN";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return DEFAULT_LOCALE;
}

// ---- path helpers ----
//
// Public URLs carry the locale as an OPTIONAL TRAILING segment: English is the
// clean default (/world-cup/groups) and the other locales append a suffix
// (/world-cup/groups/zh-CN). Internally Next still serves the /[locale]/… routes
// — next.config rewrites map the trailing-locale URLs onto them — so the parse
// helpers accept the locale at EITHER the first or the last path segment.

export function withLocale(href: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return href; // English keeps the clean URL
  const base = href === "/" ? "" : href.replace(/\/+$/, "");
  return `${base}/${locale}`;
}

export function localeFromPath(pathname: string): Locale {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return DEFAULT_LOCALE;
  if (isLocale(parts[0])) return parts[0]; // internal /zh-CN/…
  const last = parts[parts.length - 1];
  if (isLocale(last)) return last; // public /…/zh-CN
  return DEFAULT_LOCALE;
}

export function stripLocale(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (isLocale(parts[0])) parts.shift();
  else if (parts.length > 0 && isLocale(parts[parts.length - 1])) parts.pop();
  return `/${parts.join("/")}`;
}

// ---- messages ----

const MESSAGES: Record<Locale, Record<string, string>> = {
  en: en as Record<string, string>,
  "zh-CN": zhCN as Record<string, string>,
  "zh-TW": zhTW as Record<string, string>
};

export type StrKey = keyof typeof en;

export function t(locale: Locale, key: StrKey): string {
  return MESSAGES[locale]?.[key] ?? MESSAGES.en[key] ?? String(key);
}

// True for any Chinese locale — used where layout differs from English
// (e.g. "A 组" vs "Group A"), regardless of simplified/traditional.
export function isZh(locale: Locale): boolean {
  return locale !== "en";
}

// ---- teams ----

const TEAMS_TW = teamsTW as Record<string, string>;

export function teamLabel(meta: { cn: string; en: string }, locale: Locale): string {
  if (locale === "en") return meta.en;
  if (locale === "zh-TW") return TEAMS_TW[meta.en] ?? meta.cn;
  return meta.cn;
}

// ---- confidence tiers (source data is Chinese: 高/中/低) ----

const TIER_KEY: Record<string, StrKey> = { 高: "tierHigh", 中: "tierMedium", 低: "tierLow" };

export function tierLabel(locale: Locale, tier: string): string {
  const key = TIER_KEY[tier];
  return key ? t(locale, key) : tier;
}
