// Derives the headline "call" — direction + strength + a directional color —
// from the calibrated Yes probability and (optionally) the edge vs market.
//
// Content-agnostic: works for any binary event the console runs, independent of
// the verdict prose. The UI uses this to give the result a 5-second read: a
// loud, directionally-colored verdict pill at the top of the conclusion.

import { c, type ConsoleStringKey } from "./i18n";
import type { ConsoleLocale } from "./locale";

export type CallDirection = "yes" | "no" | "tossup";

export interface CallVerdict {
  direction: CallDirection;
  // i18n key for the call label ("Likely No", "Toss-up", …).
  labelKey: ConsoleStringKey;
  // Directional palette for this call.
  color: string; // text / accent
  soft: string; // tinted background
  border: string; // tinted border
  shadow: string; // tinted drop shadow for the conclusion card
}

// Thresholds on the Yes probability. Symmetric around 50%; the ±15pp bands are a
// deliberately conservative read so a 60% does not masquerade as a strong call.
// Boundaries are explicit (not derived as `1 - x`) to avoid float drift at the
// exact 0.45 / 0.35 cut points.
const STRONG_YES = 0.65;
const LEAN_YES = 0.55;
const LEAN_NO = 0.45;
const STRONG_NO = 0.35;

// Directional palettes — green = Yes/bullish, red = No/bearish, amber = toss-up.
const PALETTE: Record<CallDirection, { color: string; soft: string; border: string; shadow: string }> = {
  yes: { color: "#15803d", soft: "#e6f5ec", border: "#bfe6cd", shadow: "rgba(21, 128, 61, 0.1)" },
  no: { color: "#c0392b", soft: "#fdecea", border: "#f3c9c4", shadow: "rgba(192, 57, 43, 0.1)" },
  tossup: { color: "#b45309", soft: "#fef3e2", border: "#f5dcb3", shadow: "rgba(180, 83, 9, 0.1)" }
};

export function callFromProbability(yesProbability: number): CallVerdict {
  if (yesProbability >= STRONG_YES) {
    return { direction: "yes", labelKey: "callStrongYes", ...PALETTE.yes };
  }
  if (yesProbability >= LEAN_YES) {
    return { direction: "yes", labelKey: "callLeanYes", ...PALETTE.yes };
  }
  if (yesProbability > LEAN_NO) {
    return { direction: "tossup", labelKey: "callTossup", ...PALETTE.tossup };
  }
  if (yesProbability > STRONG_NO) {
    return { direction: "no", labelKey: "callLeanNo", ...PALETTE.no };
  }
  return { direction: "no", labelKey: "callStrongNo", ...PALETTE.no };
}

export function callLabel(locale: ConsoleLocale, verdict: CallVerdict): string {
  return c(locale, verdict.labelKey);
}
