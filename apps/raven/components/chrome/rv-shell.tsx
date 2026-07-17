"use client";

// Shared chrome for all three screens: the .rv theme root, header bar,
// three-step tab nav, and footer — layout and copy from the design handoff.
// Also mounts the LocaleProvider and the 中文/EN toggle (persisted like the
// theme choice).

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "../../lib/base-path";
import { useLocale, useT } from "../../lib/i18n";
import { CHROME } from "../../lib/i18n/ui";
import { GTA6_DEMO_ID } from "../../lib/demo/gta6";

type Screen = "ask" | "research" | "verdict";

const THEME_KEY = "raven-theme";

interface ShellProps {
  active: Screen;
  forecastId?: string;
  headerRight?: React.ReactNode;
  showFooter?: boolean;
  children: React.ReactNode;
}

// LocaleProvider is mounted once in app/layout.tsx so page components outside
// this shell's subtree share the same locale context.
export function RvShell({ active, forecastId, headerRight, showFooter = true, children }: ShellProps) {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light") setTheme("light");
    } catch {
      /* private mode etc. — stay dark */
    }
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((cur) => {
      const next = cur === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* non-persistent is fine */
      }
      return next;
    });
  }, []);

  const fid = forecastId ?? GTA6_DEMO_ID;
  const tabs: Array<{ key: Screen; label: string; href: string }> = [
    { key: "ask", label: t(CHROME.navAsk), href: "/" },
    { key: "research", label: t(CHROME.navResearch), href: `/forecast/${fid}/research` },
    { key: "verdict", label: t(CHROME.navVerdict), href: `/forecast/${fid}` }
  ];

  return (
    <div
      className={`rv${theme === "light" ? " rv-light" : ""}`}
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "var(--fd)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <header className="rv-hdr">
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "inherit" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBasePath("/raven-mascot.png")}
            alt="Raven mascot"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid var(--line2)"
            }}
          />
          <span
            className="rv-wordmark"
            style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 17, letterSpacing: ".01em", whiteSpace: "nowrap" }}
          >
            Raven <span style={{ color: "var(--accent)" }}>Forecasting Engine</span>
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {headerRight}
          <button
            type="button"
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            title={t(CHROME.langSwitchTitle)}
            style={{
              cursor: "pointer",
              background: "none",
              border: "1px solid var(--line2)",
              borderRadius: 20,
              color: "var(--faint)",
              fontFamily: "var(--fm)",
              fontSize: 9,
              letterSpacing: ".1em",
              padding: "4px 10px"
            }}
          >
            {t(CHROME.langSwitch)}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? t(CHROME.themeToLight) : t(CHROME.themeToDark)}
            style={{
              cursor: "pointer",
              background: "none",
              border: "1px solid var(--line2)",
              borderRadius: 20,
              color: "var(--faint)",
              fontFamily: "var(--fm)",
              fontSize: 9,
              letterSpacing: ".1em",
              padding: "4px 10px"
            }}
          >
            {theme === "dark" ? t(CHROME.themeLight) : t(CHROME.themeDark)}
          </button>
        </div>
      </header>

      <nav className="rv-nav">
        {tabs.map((tab) => (
          <Link key={tab.key} href={tab.href} className={`nvl${tab.key === active ? " on" : ""}`}>
            {tab.label}
          </Link>
        ))}
      </nav>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>

      {showFooter && (
        <footer className="rv-ftr">
          <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--faint)" }}>
            {t(CHROME.footerInstrument)}
          </span>
          <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--faint)" }}>
            {t(CHROME.footerMarketBlind)}
          </span>
        </footer>
      )}
    </div>
  );
}
