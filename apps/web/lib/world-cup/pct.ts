// Round three probabilities (win / draw / loss) to integer percents that sum to
// exactly 100 using the largest-remainder method, so a displayed split never
// reads 99% or 101%. Pure + immutable: inputs are untouched, a fresh tuple is
// returned. Shared by the knockout card and its per-match detail page.

export function pct3(a: number, draw: number, b: number): readonly [number, number, number] {
  const raw = [a * 100, draw * 100, b * 100] as const;
  const floored: [number, number, number] = [Math.floor(raw[0]), Math.floor(raw[1]), Math.floor(raw[2])];
  let remainder = Math.max(0, Math.min(3, 100 - floored[0] - floored[1] - floored[2]));
  // Award each remaining point to the largest fractional part, highest first.
  const fracs: ReadonlyArray<readonly [number, number]> = [
    [0, raw[0] - floored[0]],
    [1, raw[1] - floored[1]],
    [2, raw[2] - floored[2]]
  ];
  const ordered = [...fracs].sort((x, y) => y[1] - x[1]);
  const out: [number, number, number] = [floored[0], floored[1], floored[2]];
  for (const [idx] of ordered) {
    if (remainder <= 0) break;
    if (idx === 0) out[0] += 1;
    else if (idx === 1) out[1] += 1;
    else out[2] += 1;
    remainder -= 1;
  }
  return out;
}
