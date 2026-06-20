"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeFromPath, stripLocale, t, withLocale, type StrKey } from "../../lib/world-cup/i18n";
import styles from "./world-cup.module.css";

const TABS: ReadonlyArray<{ href: string; key: StrKey }> = [
  { href: "/world-cup", key: "tabChampion" },
  { href: "/world-cup/groups", key: "tabGroups" },
  { href: "/world-cup/bracket", key: "tabKnockout" },
  { href: "/world-cup/performance", key: "tabPerformance" }
];

export function TabNav() {
  const pathname = usePathname();
  const locale = localeFromPath(pathname);
  const current = stripLocale(pathname);
  return (
    <nav className={styles.tabNav} aria-label="forecast sections">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={withLocale(tab.href, locale)}
          className={`${styles.tabLink} ${current === tab.href ? styles.tabActive : ""}`}
        >
          {t(locale, tab.key)}
        </Link>
      ))}
    </nav>
  );
}
