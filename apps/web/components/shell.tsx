import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/positions", label: "Positions" },
  { href: "/trades", label: "Trades" },
  { href: "/runs", label: "Runs" },
  { href: "/reports", label: "Reports" },
  { href: "/backtests", label: "Backtests" },
  { href: "/admin", label: "Admin" }
];

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Autonomous Polymarket Agent</p>
          <h1>Cloud-run real money, open for spectators.</h1>
        </div>
        <p className="hero-copy">
          A Vercel spectator site over a single live wallet, with agent decisions,
          risk state, positions, fills, backtests, and admin controls.
        </p>
      </header>

      <nav className="nav">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href as never} className="nav-link">
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="page-grid">{children}</main>
    </div>
  );
}
