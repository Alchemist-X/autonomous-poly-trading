"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

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
      <div className="panel">
        <h2>Set up your Raven account</h2>

        <div className="row">
          <span className="row-label">Privy account</span>
          <span className="row-value">{user?.email?.address ?? user?.id ?? "—"}</span>
        </div>
        <div className="row">
          <span className="row-label">Your EOA</span>
          <span className="row-value">{user?.wallet?.address ?? "—"}</span>
        </div>
        <div className="row">
          <span className="row-label">Polymarket Safe</span>
          {state?.safeAddress ? (
            <span className="row-value">{state.safeAddress}</span>
          ) : (
            <span className="badge badge-pending">Not deployed yet</span>
          )}
        </div>
        <div className="row">
          <span className="row-label">Status</span>
          <span className={`badge ${state?.status === "active" ? "badge-active" : "badge-pending"}`}>
            {state?.status ?? "registering…"}
          </span>
        </div>

        {error && (
          <div className="disclaimer" style={{ marginTop: 24 }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Next: deploy your Safe + fund</h2>
        <p style={{ color: "var(--text-soft)", marginTop: 0 }}>
          Phase 1 placeholder. The on-chain Safe deployment via{" "}
          <code>@polymarket/builder-relayer-client</code> and the USDC.e bridge guidance flow ship
          next. For now, the Safe address is reserved for you and stored in our DB.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => router.push("/dashboard")}
          disabled={!state}
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
}
