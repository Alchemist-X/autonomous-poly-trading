import * as React from "react";
import { arrow, chipStyle, signPp } from "../lib/format";

export interface DeltaChipProps {
  /** Signed percentage-point move. Its sign drives the color: green up, red down. */
  deltaPp: number;
  /** Unit suffix shown after the number (no leading space). */
  suffix?: string;
  /** Pill size. "md" matches the iteration-header chip; "sm" the inline source-row chip. */
  size?: "sm" | "md";
}

/**
 * Small rounded pill showing a signed percentage-point move — e.g. "▲ +5.2pp".
 * Color and tinted background come from `chipStyle` (green toward YES, red toward
 * NO). Used in iteration headers and source rows in the forecast viewer.
 */
export const DeltaChip: React.FC<DeltaChipProps> = ({ deltaPp, suffix = "pp", size = "md" }) => {
  const md = size === "md";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--rv-font-sans)",
        fontWeight: 700,
        fontSize: md ? 14 : 12,
        letterSpacing: -0.5,
        lineHeight: 1,
        padding: md ? "3px 9px" : "2px 7px",
        borderRadius: md ? 7 : 6,
        whiteSpace: "nowrap",
        ...chipStyle(deltaPp),
      }}
    >
      <span>{arrow(deltaPp)}</span>
      {signPp(deltaPp)}
      {suffix}
    </span>
  );
};
