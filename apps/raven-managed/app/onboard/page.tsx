"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { AlertPanel, Badge, Button, DataRow, Panel } from "../../components/ui";

type RegisterResponse = {
  userId: string;
  safeAddress: string | null;
  status: "pending_deploy" | "deployed" | "active";
};

export default function OnboardPage() {
  const router = useRouter();
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [state, setState] = useState<RegisterResponse | null>(null);
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
        const eoa = user?.wallet?.address;
        if (!eoa) {
          setError("No wallet address found on Privy account.");
          return;
        }
        const res = await fetch("/api/users/register", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token ?? ""}`
          },
          body: JSON.stringify({
            privyDid: user.id,
            email: user.email?.address ?? null,
            eoaAddress: eoa
          })
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `register failed: ${res.status}`);
        }
        const data = (await res.json()) as RegisterResponse;
        if (!cancelled) setState(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user, getAccessToken, router]);

  return (
    <div style={{ maxWidth: 720, margin: "32px auto" }}>
      <Panel title="Set up your Raven account">
        <DataRow label="Privy account" value={user?.email?.address ?? user?.id ?? "—"} />
        <DataRow label="Your EOA" value={user?.wallet?.address ?? "—"} />
        <DataRow
          label="Polymarket Safe"
          value={
            state?.safeAddress ? (
              <span className="row-value">{state.safeAddress}</span>
            ) : (
              <Badge variant="pending">Address pending</Badge>
            )
          }
        />
        <DataRow
          label="Safe status"
          value={
            state?.status === "active" ? (
              <Badge variant="active">Active</Badge>
            ) : state?.safeAddress ? (
              <Badge variant="pending">Reserved (deploys on first deposit)</Badge>
            ) : (
              <Badge variant="pending">{state?.status ?? "registering…"}</Badge>
            )
          }
        />

        {error && (
          <AlertPanel style={{ marginTop: 24 }}>
            <strong>Error:</strong> {error}
          </AlertPanel>
        )}
      </Panel>

      <Panel title="Next: fund your Safe">
        <p style={{ color: "var(--text-soft)", marginTop: 0 }}>
          Your Polymarket Safe address is reserved deterministically — Polymarket
          deploys the on-chain proxy automatically the first time you deposit USDC.e.
          The USDC.e bridge guidance flow ships next.
        </p>
        <Button
          variant="primary"
          onClick={() => router.push("/dashboard")}
          disabled={!state}
        >
          Go to dashboard
        </Button>
      </Panel>
    </div>
  );
}
