// Loading shimmer bar (rv-shimmer keyframes live in globals.css) — used by the
// live "reading…" skeleton and the framing skeleton.

import type { CSSProperties } from "react";

const SHIMMER: CSSProperties = {
  height: 9,
  borderRadius: 5,
  background:
    "linear-gradient(90deg,color-mix(in srgb,var(--text) 5%,transparent) 25%,color-mix(in srgb,var(--text) 11%,transparent) 37%,color-mix(in srgb,var(--text) 5%,transparent) 63%)",
  backgroundSize: "600px 100%",
  animation: "rv-shimmer 1.6s linear infinite"
};

export function ShimmerBar({ style }: { style?: CSSProperties }) {
  return <div aria-hidden="true" style={{ ...SHIMMER, ...style }} />;
}
