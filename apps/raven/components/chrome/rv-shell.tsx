"use client";

// Shared chrome for all three screens: the .rv theme root, header bar,
// three-step tab nav, and footer — layout and copy from the design handoff.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GTA6_DEMO_ID } from "../../lib/demo/gta6";

type Screen = "ask" | "research" | "verdict";

const THEME_KEY = "raven-theme";

export function RvShell({
  active,
  forecastId,
  headerRight,
  showFooter = true,
  children
}: {
  active: Screen;
  forecastId?: string;
  headerRight?: React.ReactNode;
  showFooter?: boolean;
  children: React.ReactNode;
}) {
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
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
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
    { key: "ask", label: "01 · Ask", href: "/" },
    { key: "research", label: "02 · Research", href: `/forecast/${fid}/research` },
    { key: "verdict", label: "03 · Verdict", href: `/forecast/${fid}` }
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
            src="/raven-mascot.png"
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
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
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
            {theme === "dark" ? "LIGHT" : "DARK"}
          </button>
        </div>
      </header>

      <nav className="rv-nav">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} className={`nvl${t.key === active ? " on" : ""}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>

      {showFooter && (
        <footer className="rv-ftr">
          <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--faint)" }}>
            Raven is a research instrument — probabilities with sources, not advice.
          </span>
          <span style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--faint)" }}>
            No prediction-market or betting data is used as evidence.
          </span>
        </footer>
      )}
    </div>
  );
}
