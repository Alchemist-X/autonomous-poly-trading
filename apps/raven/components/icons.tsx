import type { SrcType } from "../lib/vm/types";

// Inline SVG symbol defs shared by the Research and Verdict screens — path
// data copied exactly from the design handoff. Render <IconDefs /> once per
// page, then reference via <use href="#ic-…"/>.

export function IconDefs() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
      <symbol id="ic-official" viewBox="0 0 24 24">
        <path d="M12 3l8 3v5c0 5-4 8.5-8 10-4-1.5-8-5-8-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </symbol>
      <symbol id="ic-press" viewBox="0 0 24 24">
        <path d="M5 5h11v14H6a1 1 0 01-1-1z" />
        <path d="M16 9h3v9a1 1 0 01-1 1h-2z" />
        <path d="M8 8h5M8 11h5M8 14h3" />
      </symbol>
      <symbol id="ic-insider" viewBox="0 0 24 24">
        <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
        <circle cx="12" cy="12" r="2.4" />
      </symbol>
      <symbol id="ic-shield" viewBox="0 0 24 24">
        <path d="M12 3l8 3v5c0 5-4 8.5-8 10-4-1.5-8-5-8-10V6z" />
      </symbol>
      <symbol id="ic-arrow" viewBox="0 0 24 24">
        <path d="M7 17L17 7M9 7h8v8" />
      </symbol>
    </svg>
  );
}

export function SrcIcon({ type, className = "srcic" }: { type: SrcType; className?: string }) {
  const symbol =
    type === "official" || type === "data" || type === "academic"
      ? "official"
      : type === "insider"
        ? "insider"
        : "press";
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#ic-${symbol}`} />
    </svg>
  );
}

export function ShieldIcon({ className = "ic10" }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href="#ic-shield" />
    </svg>
  );
}

export function ArrowIcon({ className = "ic10", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} aria-hidden="true">
      <use href="#ic-arrow" />
    </svg>
  );
}
