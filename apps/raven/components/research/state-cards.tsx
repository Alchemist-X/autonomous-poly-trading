"use client";

// Non-feed states of the Research screen: the framing skeleton, terminal
// notice cards (aborted / vague / not found) and the initial loading shimmer.
// The coach hint + completion CTA moved into the plan message and the
// progress dock (plan.tsx / progress-dock.tsx).

import Link from "next/link";
import { useT } from "../../lib/i18n";
import { RP } from "../../lib/i18n/research-parts";
import { ShimmerBar } from "./shimmer";

// Shown while the engine is still framing (job running, dossier not yet
// written): a full-width shimmer skeleton in place of the iteration feed.
export function FramingBlock() {
  const t = useT();
  return (
    <div
      style={{
        marginTop: 26,
        border: "1px dashed var(--line2)",
        borderRadius: 12,
        padding: 18,
        display: "flex",
        alignItems: "flex-start",
        gap: 13
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--accent)",
          animation: "rv-blink 1.1s ease infinite",
          flex: "none",
          marginTop: 3
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--muted)" }}>
          {t(RP.framingNow)}
          <b style={{ color: "var(--text)" }}>{t(RP.framingBold)}</b>
          {t(RP.framingRest)}
        </div>
        <ShimmerBar style={{ marginTop: 12 }} />
        <ShimmerBar style={{ marginTop: 6, width: "84%" }} />
        <ShimmerBar style={{ marginTop: 6, width: "62%" }} />
      </div>
    </div>
  );
}

export function NoticeCard({
  tone,
  title,
  log,
  inline = false,
  children
}: {
  tone: "error" | "info";
  title: string;
  log?: readonly string[];
  inline?: boolean; // rendered inside the feed (above iterations) vs centered
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div
      style={{
        maxWidth: inline ? undefined : 640,
        margin: inline ? "26px 0 0" : "40px auto 0",
        border:
          tone === "error" ? "1px solid color-mix(in srgb,var(--neg) 35%,transparent)" : "1px solid var(--line2)",
        background: tone === "error" ? "color-mix(in srgb,var(--neg) 7%,transparent)" : "var(--bg2)",
        borderRadius: 14,
        padding: "22px 24px"
      }}
    >
      <div
        style={{
          fontFamily: "var(--fd)",
          fontWeight: 600,
          fontSize: 19,
          color: tone === "error" ? "var(--neg)" : "var(--text)"
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 9, fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)" }}>{children}</div>
      {log && log.length > 0 && (
        <pre
          style={{
            margin: "14px 0 0",
            padding: "10px 12px",
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: 9,
            fontFamily: "var(--fm)",
            fontSize: 10.5,
            lineHeight: 1.6,
            color: "var(--muted)",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            maxHeight: 180,
            overflow: "auto"
          }}
        >
          {log.join("\n")}
        </pre>
      )}
      {!inline && (
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 16,
            fontFamily: "var(--fm)",
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--accent)",
            textDecoration: "none"
          }}
        >
          {t(RP.backToAsk)}
        </Link>
      )}
    </div>
  );
}

export function LoadingBlock() {
  const t = useT();
  return (
    <div style={{ maxWidth: 640, margin: "48px auto 0" }} role="status" aria-label={t(RP.loadingAria)}>
      <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        {t(RP.loadingText)}
      </div>
      <ShimmerBar />
      <ShimmerBar style={{ marginTop: 6, width: "78%" }} />
      <ShimmerBar style={{ marginTop: 6, width: "56%" }} />
    </div>
  );
}
