"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LANGS, langOf, t, withLang } from "../../lib/world-cup/i18n";
import styles from "./world-cup.module.css";

// Product header — research-framed branding (compliance R1), no trading copy.
// Client component: reads ?lang= to localize labels and render the toggle.

function HeaderInner() {
  const pathname = usePathname();
  const params = useSearchParams();
  const lang = langOf(params.get("lang") ?? undefined);

  return (
    <div className={styles.headerRow}>
      <Link className={styles.brand} href={withLang("/world-cup", lang)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/raven-icon.png" alt="Predict Raven" className={styles.brandLogo} />
        Predict Raven<span className={styles.brandEd}>{t(lang, "edition")}</span>
      </Link>
      <nav className={styles.headerNav}>
        <Link href={withLang("/world-cup", lang)}>{t(lang, "navForecasts")}</Link>
        <Link href={withLang("/world-cup/bracket", lang)}>{t(lang, "navBracket")}</Link>
        <Link href={withLang("/prediction-engine", lang)}>{t(lang, "navDeploy")}</Link>
        <a
          href="https://github.com/Alchemist-X/predict-raven"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.ghLink}
          aria-label="GitHub: predict-raven"
        >
          <svg viewBox="0 0 16 16" width="19" height="19" fill="currentColor" aria-hidden>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          predict-raven
        </a>
        <details className={styles.langMenu}>
          <summary className={styles.langToggle}>{t(lang, "langLabel")}</summary>
          <div className={styles.langList}>
            {LANGS.map((l) => (
              <Link
                key={l.code}
                href={l.code === "zh" ? pathname : `${pathname}?lang=${l.code}`}
                className={`${styles.langItem} ${l.code === lang ? styles.langItemActive : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </details>
      </nav>
    </div>
  );
}

export function WorldCupHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Suspense fallback={<div className={styles.headerRow} />}>
          <HeaderInner />
        </Suspense>
      </div>
    </header>
  );
}
