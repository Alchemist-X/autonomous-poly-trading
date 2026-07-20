// Shared display formatters for the paper-trading review page. Signs are
// always written out (+/-) so gain/loss never relies on color alone.

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function fmtUsd(value: number): string {
  return usd2.format(value);
}

export function fmtSignedUsd(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "±";
  return `${sign}${usd2.format(Math.abs(value))}`;
}

export function fmtSignedPct(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "±";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export function fmtPrice(value: number): string {
  return value.toFixed(value < 0.1 ? 4 : 3);
}

export function fmtProb(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
