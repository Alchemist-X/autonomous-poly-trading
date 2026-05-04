"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

export function TopBar() {
  const { authenticated, ready, login, logout, user } = usePrivy();
  const router = useRouter();

  const handleSignIn = () => {
    if (authenticated) {
      router.push("/dashboard");
    } else {
      login();
    }
  };

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-mark">R</span>
        <span>Raven</span>
      </Link>
      <div className="topbar-actions">
        {ready && authenticated ? (
          <>
            <Link href="/dashboard" className="btn btn-ghost">
              Dashboard
            </Link>
            <button
              type="button"
              className="btn"
              onClick={() => logout()}
              title={user?.email?.address ?? user?.wallet?.address ?? "Sign out"}
            >
              Sign out
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={handleSignIn} disabled={!ready}>
            {ready ? "Sign in" : "Loading…"}
          </button>
        )}
      </div>
    </header>
  );
}
