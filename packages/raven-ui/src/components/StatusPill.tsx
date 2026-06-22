import * as React from "react";

export interface StatusPillProps {
  /** The agent's current action, e.g. "Researching · iteration 2". */
  label: string;
  /**
   * "running" shows a spinning ring + animated trailing dots;
   * "done" shows a green ✓ and no dots.
   */
  state?: "running" | "done";
}

/**
 * The agent status pill from the reasoning phase: a rounded mono-font chip that
 * announces what the forecaster is doing. While "running" it spins a ring and
 * trails three pulsing dots; when "done" it swaps in a green ✓ and drops the dots.
 */
export const StatusPill: React.FC<StatusPillProps> = ({ label, state = "running" }) => {
  const done = state === "done";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--rv-font-mono)",
        fontSize: 12,
        letterSpacing: 1.5,
        color: "var(--rv-orange)",
        background: "var(--rv-bg2)",
        border: "1px solid rgba(224,112,60,0.28)",
        borderRadius: 100,
        padding: "8px 16px",
      }}
    >
      {done ? (
        <span style={{ color: "var(--rv-yes)" }}>✓</span>
      ) : (
        <span
          style={{
            width: 13,
            height: 13,
            borderRadius: "50%",
            border: "2px solid var(--rv-orange)",
            borderTopColor: "transparent",
            display: "inline-block",
            animation: "rv-spin 0.8s linear infinite",
          }}
        />
      )}
      <span>{label}</span>
      {!done && (
        <span style={{ letterSpacing: 2 }}>
          <span style={{ animation: "rv-dots 1.2s infinite" }}>.</span>
          <span style={{ animation: "rv-dots 1.2s infinite 0.2s" }}>.</span>
          <span style={{ animation: "rv-dots 1.2s infinite 0.4s" }}>.</span>
        </span>
      )}
    </div>
  );
};
