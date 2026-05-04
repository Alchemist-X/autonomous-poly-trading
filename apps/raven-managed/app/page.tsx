import {
  ShieldCheck,
  BrainCircuit,
  Scale,
  Receipt,
  Eye,
  LogOut
} from "lucide-react";
import {
  AlertPanel,
  FeatureCard,
  FeatureGrid,
  Hero,
  LinkButton,
  Section,
  StepCard,
  StepsContainer
} from "../components/ui";

const ICON_PROPS = { size: 20, strokeWidth: 1.75 } as const;

export default function LandingPage() {
  return (
    <>
      <Hero
        title={
          <>
            AI-managed trading on <span className="accent">Polymarket</span>
          </>
        }
        subtitle="Deposit USDC into a Polymarket Safe you control. Raven's AI scans every market daily and trades through a session key — trade-only, revocable, no withdrawal access."
        actions={
          <>
            <LinkButton href="/signup" variant="primary">
              Get started
            </LinkButton>
            <LinkButton href="/track-record">See live track record</LinkButton>
          </>
        }
      />

      <Section
        title="How it works"
        lead="Four steps from sign-up to fully passive AI-managed positions on Polymarket."
      >
        <StepsContainer>
          <StepCard title="Sign in with email">
            Privy provisions a non-custodial wallet — no seed phrase, no MetaMask required.
          </StepCard>
          <StepCard title="Fund your Safe">
            Send USDC.e on Polygon to the Polymarket Safe deployed for you. You always control it.
          </StepCard>
          <StepCard title="Authorize AI trading">
            One-time signature gives Raven a trade-only session key. No withdrawal access. Revocable
            anytime.
          </StepCard>
          <StepCard title="Sit back">
            Raven&apos;s daily-pulse AI scans every Polymarket market and trades on your behalf.
          </StepCard>
        </StepsContainer>
      </Section>

      <Section title="Why Raven">
        <FeatureGrid>
          <FeatureCard icon={<ShieldCheck {...ICON_PROPS} />} title="Non-custodial by design">
            Your funds live in a Polymarket Safe wallet that only you control. Raven&apos;s session
            key is restricted to trade calls — it cannot withdraw, transfer, or approve new tokens.
          </FeatureCard>
          <FeatureCard icon={<BrainCircuit {...ICON_PROPS} />} title="Real money since 2026-03-16">
            Raven&apos;s daily-pulse engine has been trading real money on Polymarket since
            2026-03-16. Every position, fill, and reasoning report is in the public track record.
          </FeatureCard>
          <FeatureCard icon={<Scale {...ICON_PROPS} />} title="Hard risk caps">
            Per-position size cap, total-exposure cap, max concurrent positions, minimum trade size
            — every guardrail Raven enforces on its own book applies to yours.
          </FeatureCard>
          <FeatureCard icon={<Receipt {...ICON_PROPS} />} title="Just builder rewards during MVP">
            No management fee, no performance fee while we&apos;re ramping. Raven earns a share of
            Polymarket&apos;s builder rewards on each trade — that&apos;s paid by Polymarket out of
            trading volume, never deducted from your balance.
          </FeatureCard>
          <FeatureCard icon={<Eye {...ICON_PROPS} />} title="Full transparency">
            Every position, every fill, every reasoning report is visible in your dashboard.
            Cross-check against the on-chain Safe balance any time.
          </FeatureCard>
          <FeatureCard icon={<LogOut {...ICON_PROPS} />} title="Withdraw whenever">
            Revoke Raven&apos;s session key in one click. Funds remain in your Safe — you can
            withdraw them via the Polymarket UI directly. No lock-ups.
          </FeatureCard>
        </FeatureGrid>

        <AlertPanel>
          <strong>Real money, real risk.</strong> Polymarket trades are non-recoverable. Raven&apos;s
          past performance does not guarantee future results. By signing up you acknowledge this is a
          high-risk discretionary trading product, you are not a resident of a restricted
          jurisdiction, and you have read the Terms of Service.
        </AlertPanel>
      </Section>
    </>
  );
}
