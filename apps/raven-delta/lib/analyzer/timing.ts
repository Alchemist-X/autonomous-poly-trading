// Elapsed-time helpers shared by the console UI and the email renderer.
// Freshness is the product's headline metric: "first seen 14 minutes ago"
// changes what a desk does; "first seen 3 days ago" kills the trade.

export type TimingLocale = "en" | "zh";

export function formatElapsed(fromIso: string, toIso: string, locale: TimingLocale): string {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  if (!Number.isFinite(ms)) return locale === "zh" ? "未知" : "unknown";
  if (ms < 0) return locale === "zh" ? "时间戳在未来（不可信）" : "timestamp is in the future (suspect)";

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (locale === "zh") {
    if (minutes < 1) return "不到 1 分钟";
    if (minutes < 60) return `${minutes} 分钟`;
    if (hours < 24) return `${hours} 小时 ${minutes % 60} 分钟`;
    return `${days} 天 ${hours % 24} 小时`;
  }
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${days}d ${hours % 24}h`;
}

export interface FreshnessRead {
  // e.g. "first seen 14 min ago" / "首次出现于 14 分钟前" / honest unknown
  label: string;
  known: boolean;
  staleWarning: boolean; // older than 24h — likely priced in
}

export function freshnessRead(firstSeenUtc: string | null, atIso: string, locale: TimingLocale): FreshnessRead {
  if (!firstSeenUtc) {
    return {
      label:
        locale === "zh"
          ? "全网最早出现时间：无法核实"
          : "First public appearance: could not be verified",
      known: false,
      staleWarning: false
    };
  }
  const elapsed = formatElapsed(firstSeenUtc, atIso, locale);
  const ageMs = Date.parse(atIso) - Date.parse(firstSeenUtc);
  const stale = Number.isFinite(ageMs) && ageMs > 24 * 3600_000;
  return {
    label:
      locale === "zh"
        ? `全网最早出现于 ${elapsed}前`
        : `First seen ${elapsed} ago`,
    known: true,
    staleWarning: stale
  };
}
