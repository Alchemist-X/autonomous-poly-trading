"use client";

// Non-feed states of the Research screen: the coach hint bar, the framing
// skeleton, the completion CTA, terminal notice cards (aborted / vague /
// not found) and the initial loading shimmer.

import Link from "next/link";
import { ShimmerBar } from "./shimmer";

export function CoachBar({ nextRound }: { nextRound: number }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "12px 15px",
        border: "1px dashed var(--line2)",
        borderRadius: 11,
        background: "color-mix(in srgb,var(--accent) 5%,transparent)"
      }}
    >
      <svg viewBox="0 0 40 26" style={{ width: 34, height: 22, flex: "none", overflow: "visible" }} aria-hidden="true">
        <ellipse
          cx="20"
          cy="13"
          rx="17"
          ry="9.5"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          transform="rotate(-4 20 13)"
          strokeLinecap="round"
        />
      </svg>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>
        You can push back mid-run: <b style={{ color: "var(--text)" }}>circle what holds up, strike what you doubt</b>,
        or queue your own hypothesis. Raven folds analyst pushback into iteration {nextRound}.
      </p>
    </div>
  );
}

// Shown while the engine is still framing (job running, dossier not yet
// written): a full-width shimmer skeleton in place of the iteration feed.
export function FramingBlock() {
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
          Now: <b style={{ color: "var(--text)" }}>framing</b> — normalizing the question, pinning resolution
          criteria, setting a base-rate prior
        </div>
        <ShimmerBar style={{ marginTop: 12 }} />
        <ShimmerBar style={{ marginTop: 6, width: "84%" }} />
        <ShimmerBar style={{ marginTop: 6, width: "62%" }} />
      </div>
    </div>
  );
}

export function CompleteCta({ id }: { id: string }) {
  return (
    <Link
      href={`/forecast/${id}`}
      className="cta"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 26,
        background: "var(--accent)",
        color: "var(--accent-ink)",
        borderRadius: 13,
        padding: "18px 20px",
        textDecoration: "none"
      }}
    >
      <span
        style={{
          fontFamily: "var(--fm)",
          fontWeight: 600,
          fontSize: 11.5,
          letterSpacing: ".1em",
          textTransform: "uppercase"
        }}
      >
        Read the dossier
      </span>
      <span aria-hidden="true" style={{ fontFamily: "var(--fm)", fontWeight: 600, fontSize: 15, lineHeight: 1 }}>
        →
      </span>
    </Link>
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
          ← Back to Ask
        </Link>
      )}
    </div>
  );
}

export function LoadingBlock() {
  return (
    <div style={{ maxWidth: 640, margin: "48px auto 0" }} role="status" aria-label="Loading the run">
      <div style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        Loading the run…
      </div>
      <ShimmerBar />
      <ShimmerBar style={{ marginTop: 6, width: "78%" }} />
      <ShimmerBar style={{ marginTop: 6, width: "56%" }} />
    </div>
  );
}
