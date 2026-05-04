import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/providers";
import { TopBar } from "../components/top-bar";

export const metadata: Metadata = {
  title: "Raven — AI-Managed Polymarket Trading",
  description:
    "Deposit, sit back, and let Raven's AI trade prediction markets for you. Non-custodial — your funds stay in your wallet.",
  metadataBase: new URL("https://raven-managed.vercel.app")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="shell">
            <TopBar />
            <main className="main">{children}</main>
            <footer className="footer">
              Raven Capital — Non-custodial AI trading on Polymarket. Real money, real risk.
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
