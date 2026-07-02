// Shared evidence chips/pills for the Verdict screen — domain, credibility
// (shield) and value (violet diamonds). Styles verbatim from the handoff;
// "core" adds the hero-card letter-spacing, "pop" is the popover-size variant.

import type { CSSProperties } from "react";
import { ShieldIcon, SrcIcon } from "../../../components/icons";
import type { DecoratedEvidence } from "./decorate";

type PillVariant = "core" | "row" | "pop";

const PILL_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontFamily: "var(--fm)",
  fontWeight: 600,
  borderRadius: 20
};

export function DomChip({ e }: { e: DecoratedEvidence }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "var(--fm)",
        fontSize: 10,
        color: "var(--faint)"
      }}
    >
      <SrcIcon type={e.srcType} />
      {e.dom}
    </span>
  );
}

export function CredPill({ e, variant = "row" }: { e: DecoratedEvidence; variant?: PillVariant }) {
  return (
    <span
      className={`cred-${e.cred} bd-${e.cred}`}
      style={{
        ...PILL_BASE,
        fontSize: variant === "pop" ? 9 : 9.5,
        padding: variant === "pop" ? "2px 6px" : "2px 7px",
        border: "1px solid",
        ...(variant === "core" ? { letterSpacing: ".02em" } : {})
      }}
      title="How trustworthy the source is"
    >
      <ShieldIcon />
      {e.credLabel} credibility
    </span>
  );
}

export function ValuePill({ e, variant = "row" }: { e: DecoratedEvidence; variant?: PillVariant }) {
  return (
    <span
      style={{
        ...PILL_BASE,
        fontSize: 9.5,
        padding: "2px 7px",
        color: "var(--val)",
        border: "1px solid color-mix(in srgb,var(--val) 40%,transparent)",
        background: "color-mix(in srgb,var(--val) 11%,transparent)",
        ...(variant === "core" ? { letterSpacing: ".02em" } : {})
      }}
      title="How much this source adds to the forecast"
    >
      <span style={{ letterSpacing: 1 }}>{e.valDiamonds}</span>
      {e.valueLabel} value
    </span>
  );
}
