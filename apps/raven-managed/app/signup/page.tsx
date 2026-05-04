"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "../../components/ui";

export default function SignupPage() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();

  useEffect(() => {
    if (ready && authenticated) {
      router.replace("/onboard");
    }
  }, [ready, authenticated, router]);

  return (
    <div style={{ maxWidth: 520, margin: "64px auto" }}>
      <div className="panel">
        <h2>Sign in to Raven</h2>
        <p style={{ color: "var(--text-soft)", marginTop: 0 }}>
          We&apos;ll create a non-custodial wallet for you using your email. No seed phrase, no
          MetaMask. Already have a wallet? You can connect it instead.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <Button
            variant="primary"
            onClick={() => login()}
            disabled={!ready}
            style={{ flex: 1, justifyContent: "center", padding: "12px 18px" }}
          >
            {ready ? "Continue with email or wallet" : "Loading…"}
          </Button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 24 }}>
          By continuing you agree to the Terms of Service and acknowledge that Raven is a high-risk
          discretionary trading product. You confirm you are not a resident of a restricted
          jurisdiction.
        </p>
      </div>
    </div>
  );
}
