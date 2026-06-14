// Small formatting helpers shared by the research UI components.

export function pct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) {
    return "N/A";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

// Percentage-point delta, signed (e.g. "+4.5pp" / "-3.2pp").
export function pp(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) {
    return "N/A";
  }
  const points = value * 100;
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(digits)}pp`;
}

// Weight values in the schema are already expressed in percentage points.
export function signedPoints(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}pp`;
}

export function formatDuration(ms: number | undefined): string {
  if (!ms || ms <= 0) {
    return "";
  }
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}
