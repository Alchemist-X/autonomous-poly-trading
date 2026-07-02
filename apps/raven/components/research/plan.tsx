"use client";

// Manus-style conversational plan: RavenMessage renders an agent "chat
// message" (identity line: mascot + wordmark + provider chip + timestamp),
// and PlanList renders the live checklist — steps check off as the run
// advances, joined by a dashed connector.

import { useT } from "../../lib/i18n";
import { RS } from "../../lib/i18n/ui";
import type { PlanStepVM } from "./research-vm";

export function RavenMessage({
  provider,
  time,
  children
}: {
  provider: string | null;
  time: string | null;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section style={{ marginTop: 24 }} aria-label={t(RS.messageAria)}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/raven-mascot.png"
          alt=""
          aria-hidden="true"
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            objectFit: "cover",
            border: "1px solid var(--line2)",
            flex: "none"
          }}
        />
        <span style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 14.5 }}>raven</span>
        {provider && (
          <span
            style={{
              fontFamily: "var(--fm)",
              fontSize: 8.5,
              fontWeight: 600,
              letterSpacing: ".09em",
              textTransform: "uppercase",
              color: "var(--accent)",
              border: "1px solid color-mix(in srgb,var(--accent) 40%,transparent)",
              borderRadius: 4,
              padding: "1.5px 6px"
            }}
          >
            {provider}
          </span>
        )}
        {time && (
          <span style={{ marginLeft: "auto", fontFamily: "var(--fm)", fontSize: 10, color: "var(--faint)" }}>
            {time}
          </span>
        )}
      </div>
      <div style={{ marginTop: 10, paddingLeft: 31 }}>{children}</div>
    </section>
  );
}

export function CheckCircle({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" style={{ color: "var(--verified)", flex: "none" }}>
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
      <path d="M5.2 8.3l1.9 1.9 3.8-4.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepMarker({ state }: { state: PlanStepVM["state"] }) {
  if (state === "done") {
    return <CheckCircle />;
  }
  if (state === "active") {
    return (
      <span
        style={{
          width: 9,
          height: 9,
          margin: 3,
          borderRadius: "50%",
          background: "var(--accent)",
          animation: "rv-pulse 1.8s ease-out infinite",
          flex: "none"
        }}
      />
    );
  }
  return (
    <span
      style={{
        width: 9,
        height: 9,
        margin: 3,
        borderRadius: "50%",
        border: "1.4px solid var(--line2)",
        flex: "none"
      }}
    />
  );
}

export function PlanList({ steps, compact = false }: { steps: readonly PlanStepVM[]; compact?: boolean }) {
  const t = useT();
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label={t(RS.planAria)}>
      {steps.map((s, i) => (
        <li key={s.key} className="pl-row" style={{ display: "grid", gridTemplateColumns: "15px 1fr", columnGap: 11 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <StepMarker state={s.state} />
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                style={{ flex: 1, width: 0, borderLeft: "1px dashed var(--line2)", margin: "3px 0", minHeight: 8 }}
              />
            )}
          </div>
          <div style={{ paddingBottom: i < steps.length - 1 ? (compact ? 9 : 13) : 0, minWidth: 0 }}>
            <div
              style={{
                fontSize: compact ? 12.5 : 13.5,
                lineHeight: 1.35,
                fontWeight: s.state === "active" ? 600 : 500,
                color: s.state === "pending" ? "var(--faint)" : "var(--text)"
              }}
            >
              {s.label}
            </div>
            {s.sub && !(compact && s.state === "pending") && (
              <div
                style={{
                  marginTop: 2,
                  fontFamily: "var(--fm)",
                  fontSize: 9.5,
                  letterSpacing: ".02em",
                  color: s.state === "active" ? "var(--accent)" : "var(--faint)"
                }}
              >
                {s.sub}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
