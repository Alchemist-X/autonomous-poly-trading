"use client";

// Completion digest, Manus-style: a final agent message that leads with the
// conclusion (P(YES) + verdict word + the why), a row of stat chips, and a
// document-attachment card linking to the full dossier (Screen 03).

import Link from "next/link";
import type { DossierVM } from "../../lib/vm/types";
import { arrowFor, dirFor } from "../../lib/vm/format";
import { RavenMessage } from "./plan";

function StatChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "var(--fm)",
        fontSize: 10,
        fontWeight: 600,
        color: "var(--muted)",
        border: "1px solid var(--line2)",
        borderRadius: 20,
        padding: "3px 9px"
      }}
    >
      {children}
    </span>
  );
}

export function VerdictDigest({ id, dossier }: { id: string; dossier: DossierVM }) {
  const m = dossier.meta;
  const deltaPts =
    dossier.currentProb !== null && dossier.priorProb !== null
      ? Math.round((dossier.currentProb - dossier.priorProb) * 100)
      : null;
  const preview = dossier.summaryParagraphs[0] ?? m.why;

  return (
    <div className="rv-reveal">
      <RavenMessage provider={dossier.provider} time={m.duration}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--muted)" }}>
          <b style={{ color: "var(--text)" }}>
            Forecast complete — P(YES) {m.prob}, {m.verdict.toLowerCase()}.
          </b>{" "}
          {m.why}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 11 }}>
          {deltaPts !== null && (
            <StatChip>
              <span className={`mv-${dirFor(deltaPts)}`}>
                {arrowFor(deltaPts)} {Math.abs(deltaPts)}%
              </span>
              vs the {m.prior} prior
            </StatChip>
          )}
          {/* No credibleInterval chip here: per user decision 2026-07-02 the
              engine's interval is an uncalibrated heuristic and must not be
              presented on user-facing surfaces. */}
          <StatChip>{m.sources} sources</StatChip>
          <StatChip>confidence {m.confidence}</StatChip>
        </div>

        <Link
          href={`/forecast/${id}`}
          className="rvd-card"
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 13,
            alignItems: "start",
            marginTop: 14,
            background: "var(--bg2)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "14px 16px",
            textDecoration: "none",
            color: "inherit"
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: "color-mix(in srgb,var(--accent) 13%,transparent)",
              border: "1px solid color-mix(in srgb,var(--accent) 35%,transparent)",
              display: "grid",
              placeItems: "center",
              flex: "none"
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              style={{ stroke: "var(--accent)", fill: "none", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }}
            >
              <path d="M7 3h7l4 4v14H7z" />
              <path d="M14 3v4h4" />
              <path d="M10 12h6M10 15.5h6" />
            </svg>
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: "var(--fd)", fontWeight: 600, fontSize: 15, lineHeight: 1.35 }}>
              Dossier — {m.question}
            </span>
            <span
              style={{
                display: "block",
                marginTop: 3,
                fontFamily: "var(--fm)",
                fontSize: 9.5,
                letterSpacing: ".04em",
                color: "var(--faint)"
              }}
            >
              {m.verdict} · P(YES) {m.prob} · evidence book · resolution criteria
            </span>
            <span
              className="rvd-clamp"
              style={{ marginTop: 7, fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}
            >
              {preview}
            </span>
          </span>
          <span
            aria-hidden="true"
            style={{
              fontFamily: "var(--fm)",
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: ".08em",
              color: "var(--accent)",
              whiteSpace: "nowrap",
              marginTop: 3
            }}
          >
            READ →
          </span>
        </Link>
      </RavenMessage>
    </div>
  );
}
