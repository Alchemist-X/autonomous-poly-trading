import {
  ShieldCheck,
  BrainCircuit,
  Scale,
  Receipt,
  Eye,
  LogOut
} from "lucide-react";
import { LinkButton } from "../components/ui";

const ICON_PROPS = { size: 20, strokeWidth: 1.75 } as const;

export default function LandingPage() {
  return (
    <>
      <section className="hero">
        <h1>
          AI-managed trading on{" "}
          <span className="accent">Polymarket</span>
        </h1>
        <p>
          Deposit USDC into a Polymarket Safe you control. Raven&apos;s AI scans every market
          daily and trades through a session key — trade-only, revocable, no withdrawal access.
        </p>
        <div className="hero-cta">
          <LinkButton href="/signup" variant="primary">
            Get started
          </LinkButton>
          <LinkButton href="/track-record">See live track record</LinkButton>
        </div>
      </section>

      <section className="section">
        <h2>How it works</h2>
        <p className="section-lead">
          Four steps from sign-up to fully passive AI-managed positions on Polymarket.
        </p>
        <div className="steps">
          <div className="step">
            <h4>Sign in with email</h4>
            <p>Privy provisions a non-custodial wallet — no seed phrase, no MetaMask required.</p>
          </div>
          <div className="step">
            <h4>Fund your Safe</h4>
            <p>Send USDC.e on Polygon to the Polymarket Safe deployed for you. You always control it.</p>
          </div>
          <div className="step">
            <h4>Authorize AI trading</h4>
            <p>One-time signature gives Raven a trade-only session key. No withdrawal access. Revocable anytime.</p>
          </div>
          <div className="step">
            <h4>Sit back</h4>
            <p>Raven&apos;s daily-pulse AI scans every Polymarket market and trades on your behalf.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Why Raven</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="icon">
              <ShieldCheck {...ICON_PROPS} />
            </div>
            <h3>Non-custodial by design</h3>
            <p>
              Your funds live in a Polymarket Safe wallet that only you control. Raven&apos;s session
              key is restricted to trade calls — it cannot withdraw, transfer, or approve new tokens.
            </p>
          </div>
          <div className="feature-card">
            <div className="icon">
              <BrainCircuit {...ICON_PROPS} />
            </div>
            <h3>Real money since 2026-03-16</h3>
            <p>
              Raven&apos;s daily-pulse engine has been trading real money on Polymarket since
              2026-03-16. Every position, fill, and reasoning report is in the public track record.
            </p>
          </div>
          <div className="feature-card">
            <div className="icon">
              <Scale {...ICON_PROPS} />
            </div>
            <h3>Hard risk caps</h3>
            <p>
              Per-position size cap, total-exposure cap, max concurrent positions, minimum trade
              size — every guardrail Raven enforces on its own book applies to yours.
            </p>
          </div>
          <div className="feature-card">
            <div className="icon">
              <Receipt {...ICON_PROPS} />
            </div>
            <h3>Just builder rewards during MVP</h3>
            <p>
              No management fee, no performance fee while we&apos;re ramping. Raven earns a share
              of Polymarket&apos;s builder rewards on each trade — that&apos;s paid by Polymarket
              out of trading volume, never deducted from your balance.
            </p>
          </div>
          <div className="feature-card">
            <div className="icon">
              <Eye {...ICON_PROPS} />
            </div>
            <h3>Full transparency</h3>
            <p>
              Every position, every fill, every reasoning report is visible in your dashboard.
              Cross-check against the on-chain Safe balance any time.
            </p>
          </div>
          <div className="feature-card">
            <div className="icon">
              <LogOut {...ICON_PROPS} />
            </div>
            <h3>Withdraw whenever</h3>
            <p>
              Revoke Raven&apos;s session key in one click. Funds remain in your Safe — you can
              withdraw them via the Polymarket UI directly. No lock-ups.
            </p>
          </div>
        </div>

        <div className="disclaimer">
          <strong>Real money, real risk.</strong> Polymarket trades are non-recoverable. Raven&apos;s
          past performance does not guarantee future results. By signing up you acknowledge this is a
          high-risk discretionary trading product, you are not a resident of a restricted
          jurisdiction, and you have read the Terms of Service.
        </div>
      </section>
    </>
  );
}
