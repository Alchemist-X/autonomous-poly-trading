"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { langOf, t, withLang } from "../../lib/world-cup/i18n";
import styles from "./world-cup.module.css";

// Product header — research-framed branding (compliance R1), no trading copy.
// Client component: reads ?lang= to localize labels and render the toggle.

function HeaderInner() {
  const pathname = usePathname();
  const params = useSearchParams();
  const lang = langOf(params.get("lang") ?? undefined);
  const other = lang === "en" ? pathname : `${pathname}?lang=en`;

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
        <Link href={other} className={styles.langToggle}>
          {lang === "en" ? "中文" : "EN"}
        </Link>
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
