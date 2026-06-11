"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./world-cup.module.css";

const TABS = [
  { href: "/world-cup", label: "冠军" },
  { href: "/world-cup/groups", label: "小组赛" },
  { href: "/world-cup/bracket", label: "出线名单" }
] as const;

export function TabNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.tabNav} aria-label="预测板块">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`${styles.tabLink} ${pathname === tab.href ? styles.tabActive : ""}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
