"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

type Portfolio = {
  userId: string;
  safeAddress: string | null;
  status: string;
  aiAutoTradeEnabled: boolean;
  balanceUsdc: string;
  positions: ReadonlyArray<unknown>;
};

export default function DashboardPage() {
  const router = useRouter();
  const { ready, authenticated, user, getAccessToken, logout } = usePrivy();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace("/signup");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/users/portfolio", {
          headers: { authorization: `Bearer ${token ?? ""}` }
        });
        if (!res.ok) throw new Error(`portfolio failed: ${res.status}`);
        const data = (await res.json()) as Portfolio;
        if (!cancelled) setPortfolio(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, router]);

  if (!ready || !authenticated) {
    return <div className="empty">Loading…</div>;
  }

  return (
    <div>
      <div className="panel">
        <h2>Account</h2>
        <div className="row">
          <span className="row-label">Email</span>
          <span className="row-value">{user?.email?.address ?? "—"}</span>
        </div>
        <div className="row">
          <span className="row-label">EOA</span>
          <span className="row-value">{user?.wallet?.address ?? "—"}</span>
        </div>
        <div className="row">
          <span className="row-label">Safe</span>
          <span className="row-value">{portfolio?.safeAddress ?? "(not deployed)"}</span>
        </div>
        <div className="row">
          <span className="row-label">Status</span>
          <span className="badge badge-pending">{portfolio?.status ?? "loading…"}</span>
        </div>
      </div>

      <div className="panel">
        <h2>Balance</h2>
        <div className="row">
          <span className="row-label">USDC.e (on Safe)</span>
          <span className="row-value">${portfolio?.balanceUsdc ?? "0.00"}</span>
        </div>
        <div className="row">
          <span className="row-label">Open positions</span>
          <span className="row-value">{portfolio?.positions.length ?? 0}</span>
        </div>
      </div>

      <div className="panel">
        <h2>AI auto-trading</h2>
        <p style={{ color: "var(--text-soft)", marginTop: 0 }}>
          Phase 2 placeholder. When enabled, Raven&apos;s daily-pulse engine will trade Polymarket
          markets on your behalf using a non-withdrawal session key. Coming next sprint.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn" disabled>
            {portfolio?.aiAutoTradeEnabled ? "Disable AI trading" : "Enable AI trading"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <div className="disclaimer">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
