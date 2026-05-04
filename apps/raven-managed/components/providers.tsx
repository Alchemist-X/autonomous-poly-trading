"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function Providers({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return (
      <div style={{ padding: 32 }}>
        <h1>Configuration error</h1>
        <p>NEXT_PUBLIC_PRIVY_APP_ID is not set. Auth is disabled.</p>
        {children}
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#5b8def",
          logo: undefined
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          requireUserPasswordOnCreate: false
        },
        defaultChain: { id: 137, name: "Polygon" } as never,
        supportedChains: [{ id: 137, name: "Polygon" } as never]
      }}
    >
      {children}
    </PrivyProvider>
  );
}
