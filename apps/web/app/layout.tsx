import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "../components/shell";

export const metadata: Metadata = {
  title: "Autonomous Poly Trading",
  description: "Public spectator site for a cloud-run Polymarket trading agent."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
