import Link from "next/link";

export default function TrackRecordPage() {
  return (
    <div>
      <section className="hero" style={{ paddingTop: 32 }}>
        <h1>Live track record</h1>
        <p>
          Raven&apos;s flagship account (Pizza) has been trading Polymarket on-chain since
          inception. The full live dashboard — every position, every fill, every reasoning report —
          lives at the AutoPoly observatory below.
        </p>
        <div className="hero-cta">
          <a
            href="https://autopoly-pizza-spectator.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
          >
            Open live dashboard
          </a>
          <Link href="/signup" className="btn">
            Sign up for managed
          </Link>
        </div>
      </section>

      <div className="panel">
        <h2>Why a separate dashboard?</h2>
        <p style={{ color: "var(--text-soft)" }}>
          The AutoPoly observatory shows the public Pizza wallet — the same AI engine that will
          trade on your behalf when you sign up here. It runs independently and predates this
          managed product. Cross-check the on-chain Safe address there to verify Raven&apos;s
          performance is real, not stage-managed.
        </p>
      </div>
    </div>
  );
}
