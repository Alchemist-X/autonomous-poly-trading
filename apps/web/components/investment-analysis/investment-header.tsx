"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { investmentHref, stripInvestmentLocale } from "../../lib/investment-analysis/routes";
import { LOCALES, t, type Locale } from "../../lib/world-cup/i18n";
import styles from "./investment-analysis.module.css";

const WORLD_CUP_HREF: Record<Locale, string> = {
  en: "/world-cup",
  "zh-CN": "/world-cup/zh-CN",
  "zh-TW": "/world-cup/zh-TW"
};

export function InvestmentHeader({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const currentPath = stripInvestmentLocale(pathname);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} href={investmentHref("/investment-analysis", locale)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/raven-icon.png" alt="" className={styles.brandMark} />
          <span>Predict Raven</span>
          <span className={styles.brandSection}>{t(locale, "iaBrand")}</span>
        </Link>

        <nav className={styles.headerNav} aria-label={t(locale, "iaPrimaryNavLabel")}>
          <Link className={styles.headerLink} href={WORLD_CUP_HREF[locale]}>
            {t(locale, "iaNavWorldCup")}
          </Link>
          <details className={styles.languageMenu}>
            <summary>{t(locale, "langLabel")}</summary>
            <div className={styles.languageList}>
              {LOCALES.map((option) => (
                <Link
                  key={option.code}
                  href={investmentHref(currentPath, option.code)}
                  className={option.code === locale ? styles.languageActive : undefined}
                  aria-current={option.code === locale ? "page" : undefined}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}
