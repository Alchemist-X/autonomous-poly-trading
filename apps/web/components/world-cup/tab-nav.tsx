"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { langOf, t, withLang, type StrKey } from "../../lib/world-cup/i18n";
import styles from "./world-cup.module.css";

const TABS: ReadonlyArray<{ href: string; key: StrKey }> = [
  { href: "/world-cup", key: "tabChampion" },
  { href: "/world-cup/groups", key: "tabGroups" },
  { href: "/world-cup/bracket", key: "tabKnockout" }
];

export function TabNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const lang = langOf(params.get("lang") ?? undefined);
  return (
    <nav className={styles.tabNav} aria-label="forecast sections">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={withLang(tab.href, lang)}
          className={`${styles.tabLink} ${pathname === tab.href ? styles.tabActive : ""}`}
        >
          {t(lang, tab.key)}
        </Link>
      ))}
    </nav>
  );
}
