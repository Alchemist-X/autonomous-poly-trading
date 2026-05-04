"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useSessionSigners } from "@privy-io/react-auth";
import {
  authorizeSessionSigner,
  formatAuthorizationTimestamp,
  revokeSessionSigner
} from "../../lib/session-signer";
import { AlertPanel, Badge, Button, DataRow, EmptyState, Panel } from "../../components/ui";

type Portfolio = {
  userId: string;
  safeAddress: string | null;
  status: string;
  aiAutoTradeEnabled: boolean;
  sessionSignerAuthorizedAt: string | null;
  sessionSignerRevokedAt: string | null;
  balanceUsdc: string;
  positions: ReadonlyArray<unknown>;
};

type SessionSignerResponse = {
  aiAutoTradeEnabled: boolean;
  sessionSignerAuthorizedAt: string | null;
  sessionSignerRevokedAt: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const { ready, authenticated, user, getAccessToken, logout } = usePrivy();
  const { addSessionSigners, removeSessionSigners } = useSessionSigners();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"authorize" | "revoke" | null>(null);

  const loadPortfolio = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/users/portfolio", {
      headers: { authorization: `Bearer ${token ?? ""}` }
    });
    if (!res.ok) throw new Error(`portfolio failed: ${res.status}`);
    return (await res.json()) as Portfolio;
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace("/signup");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await loadPortfolio();
        if (!cancelled) setPortfolio(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, loadPortfolio, router]);

  const handleAuthorize = useCallback(async () => {
    const eoa = user?.wallet?.address;
    if (!eoa) {
      setError("No embedded wallet found on Privy account.");
      return;
    }
    setBusy("authorize");
    setError(null);
    try {
      // Client-side: ask Privy to attach the Raven session signer to the
      // user's embedded wallet. In stub mode (no NEXT_PUBLIC_PRIVY_SESSION_SIGNER_ID
      // env var) this is a no-op so the Phase 2 flow still completes end-to-end.
      const result = await authorizeSessionSigner(addSessionSigners, eoa);

      // Backend: persist authorization state on managed_users.
      const token = await getAccessToken();
      const res = await fetch("/api/users/session-signer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token ?? ""}`
        },
        body: JSON.stringify({
          action: "authorize",
          privySessionSignerId: result.privySessionSignerId
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `authorize failed: ${res.status}`);
      }
      const next = (await res.json()) as SessionSignerResponse;
      // Merge authoritative server state into local portfolio without
      // mutating the existing object.
      setPortfolio((prev) => (prev ? { ...prev, ...next } : prev));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }, [user, addSessionSigners, getAccessToken]);

  const handleRevoke = useCallback(async () => {
    const eoa = user?.wallet?.address;
    if (!eoa) {
      setError("No embedded wallet found on Privy account.");
      return;
    }
    setBusy("revoke");
    setError(null);
    try {
      // Client-side: ask Privy to remove the session signer. Stub mode
      // skips the SDK call.
      await revokeSessionSigner(removeSessionSigners, eoa);

      const token = await getAccessToken();
      const res = await fetch("/api/users/session-signer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token ?? ""}`
        },
        body: JSON.stringify({ action: "revoke" })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `revoke failed: ${res.status}`);
      }
      const next = (await res.json()) as SessionSignerResponse;
      setPortfolio((prev) => (prev ? { ...prev, ...next } : prev));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }, [user, removeSessionSigners, getAccessToken]);

  if (!ready || !authenticated) {
    return <EmptyState>Loading…</EmptyState>;
  }

  const aiEnabled = portfolio?.aiAutoTradeEnabled === true;
  const authorizedAt = portfolio?.sessionSignerAuthorizedAt ?? null;
  const revokedAt = portfolio?.sessionSignerRevokedAt ?? null;
  const authorizedAtFmt = authorizedAt
    ? formatAuthorizationTimestamp(authorizedAt)
    : null;
  const revokedAtFmt = revokedAt
    ? formatAuthorizationTimestamp(revokedAt)
    : null;

  return (
    <div>
      <Panel title="Account">
        <DataRow label="Email" value={user?.email?.address ?? "—"} />
        <DataRow label="EOA" value={user?.wallet?.address ?? "—"} />
        <DataRow label="Safe" value={portfolio?.safeAddress ?? "(not deployed)"} />
        <DataRow
          label="Status"
          value={<Badge variant="pending">{portfolio?.status ?? "loading…"}</Badge>}
        />
      </Panel>

      <Panel title="Balance">
        <DataRow label="USDC.e (on Safe)" value={`$${portfolio?.balanceUsdc ?? "0.00"}`} />
        <DataRow label="Open positions" value={portfolio?.positions.length ?? 0} />
      </Panel>

      <Panel>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12
          }}
        >
          <h2 style={{ margin: 0 }}>AI auto-trading</h2>
          {aiEnabled ? (
            <Badge variant="active">Authorized</Badge>
          ) : authorizedAt ? (
            <Badge variant="disabled">Revoked</Badge>
          ) : (
            <Badge variant="disabled">Not enabled</Badge>
          )}
        </div>

        {!authorizedAt && (
          <p style={{ color: "var(--text-soft)" }}>
            Enabling grants Raven a trade-only session key on your embedded
            wallet — it can place Polymarket orders on your Safe&apos;s behalf
            but cannot withdraw funds. Revocable any time from this panel.
          </p>
        )}

        {aiEnabled && authorizedAtFmt && (
          <p style={{ color: "var(--text-soft)" }}>
            Authorized {authorizedAtFmt.relative} ({authorizedAtFmt.absolute}).
          </p>
        )}

        {!aiEnabled && authorizedAtFmt && revokedAtFmt && (
          <p style={{ color: "var(--text-soft)" }}>
            Last authorized {authorizedAtFmt.absolute}, revoked{" "}
            {revokedAtFmt.relative} ({revokedAtFmt.absolute}).
          </p>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {aiEnabled ? (
            <Button variant="ghost" onClick={handleRevoke} disabled={busy !== null}>
              {busy === "revoke" ? "Disabling…" : "Disable AI trading"}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleAuthorize}
              disabled={busy !== null || !portfolio}
            >
              {busy === "authorize" ? "Authorizing…" : "Enable AI trading"}
            </Button>
          )}
          <Button variant="ghost" onClick={() => logout()}>
            Sign out
          </Button>
        </div>
      </Panel>

      {error && (
        <AlertPanel>
          <strong>Error:</strong> {error}
        </AlertPanel>
      )}
    </div>
  );
}
