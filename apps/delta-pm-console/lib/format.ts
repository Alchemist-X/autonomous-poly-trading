// Display formatting helpers. All Chinese-facing, all crash-proof: invalid
// timestamps render as "—" instead of NaN.

export function parseUtc(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function fmtUsd(v: number, opts: { sign?: boolean; decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 2;
  const sign = opts.sign && v > 0 ? "+" : v < 0 ? "-" : opts.sign ? "±" : "";
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return `${sign === "±" ? "" : sign}$${abs}`;
}

export function fmtPx(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPct(v: number | null, opts: { sign?: boolean } = {}): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const sign = opts.sign && v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

/** "42 秒前" / "6 分钟前" / "3 小时前" / "2 天前"; "—" when unknown. */
export function fmtRelative(iso: string | null | undefined, nowMs: number): string {
  const t = parseUtc(iso);
  if (t === null) return "—";
  const diffS = Math.max(0, Math.round((nowMs - t) / 1000));
  if (diffS < 60) return `${diffS} 秒前`;
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM} 分钟前`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH} 小时前`;
  return `${Math.floor(diffH / 24)} 天前`;
}

/** Live elapsed timer, "mm:ss" (or "h:mm:ss" past an hour). */
export function fmtElapsed(startIso: string | null | undefined, nowMs: number): string {
  const t = parseUtc(startIso);
  if (t === null) return "—";
  const total = Math.max(0, Math.floor((nowMs - t) / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Local wall-clock "HH:MM:SS" for the stale marker. */
export function fmtClock(iso: string | null | undefined): string {
  const t = parseUtc(iso);
  if (t === null) return "—";
  return new Date(t).toLocaleTimeString("zh-CN", { hour12: false });
}

/** Local "MM-DD HH:MM" for horizons. */
export function fmtShortDateTime(iso: string | null | undefined): string {
  const t = parseUtc(iso);
  if (t === null) return "—";
  const d = new Date(t);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
}
