export function asNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  if (value == null) {
    return 0;
  }
  return Number(value);
}

