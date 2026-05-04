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
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 64 64" width={18} height={18} fill="#fff">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M14 22 C14 14, 22 10, 30 12 L40 18 L58 26 L42 28 L44 36 L36 36 L32 46 L24 46 L20 38 C16 36, 14 32, 14 28 Z M28 24 a3 3 0 1 0 0.001 0 Z"
            />
          </svg>
        </span>
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
