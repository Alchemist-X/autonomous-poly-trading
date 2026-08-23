// Fleet quota / balance waterline monitor.
//
// Watches every credential the 7-book forecast fleet (and the Tokyo book)
// runs on, and alerts BEFORE a book silently stops trading:
//
//   hard waterline  — providers with a real balance API (DeepSeek): snapshot
//                     the balance each run, fit a burn rate over the history,
//                     project days-to-empty, alert on low balance or short
//                     runway.
//   soft waterline  — subscriptions with NO balance API (Claude sub, Codex
//                     sub, Kimi Code, Exa): scan the fleet logs incrementally
//                     for quota/rate-limit error signatures and alert with
//                     the book name + snippet. Exhaustion here is only
//                     observable as failures, so failures must be loud.
//   liveness        — a dead book process cannot hit quota errors at all;
//                     check pidfiles so "silently not running" also alerts.
//
// Alerts go to a Feishu group custom-bot webhook (FEISHU_WEBHOOK_URL) and/or
// Slack incoming webhook (SLACK_WEBHOOK_URL); per-topic cooldown prevents
// spam. State lives under ~/forecast-fleet/monitor/. Read-only besides its
// own state dir; never touches books or orders.
//
// Cron entry (raven-labs): */30 * * * *  via monitor-run.sh (sources secrets).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const C = { reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m" };
const log = {
  info: (m: string) => console.log(`${C.cyan}INFO${C.reset} ${m}`),
  ok: (m: string) => console.log(`${C.green}OK  ${C.reset} ${m}`),
  warn: (m: string) => console.log(`${C.yellow}WARN${C.reset} ${m}`),
  err: (m: string) => console.log(`${C.red}ERR ${C.reset} ${m}`)
};

const FLEET_ROOT = process.env.FLEET_ROOT || path.join(os.homedir(), "forecast-fleet");
const MONITOR_ROOT = path.join(FLEET_ROOT, "monitor");
const BOOKS = (process.env.FLEET_BOOKS || "fable,opus,sonnet,kimi-k3,ds-flash,gpt-sol,gpt-terra").split(",").map((b) => b.trim()).filter(Boolean);

// Thresholds (env-tunable).
const DS_BALANCE_WARN_CNY = Number(process.env.MONITOR_DS_WARN_CNY || 30);
const DS_BALANCE_CRIT_CNY = Number(process.env.MONITOR_DS_CRIT_CNY || 10);
const RUNWAY_WARN_DAYS = Number(process.env.MONITOR_RUNWAY_WARN_DAYS || 5);
const ALERT_COOLDOWN_HOURS = Number(process.env.MONITOR_COOLDOWN_HOURS || 6);
const SUB_USED_WARN_PCT = Number(process.env.MONITOR_SUB_WARN_PCT || 80);
const SUB_USED_CRIT_PCT = Number(process.env.MONITOR_SUB_CRIT_PCT || 92);
const EXA_WARN_USD = Number(process.env.MONITOR_EXA_WARN_USD || 2);
const EXA_CRIT_USD = Number(process.env.MONITOR_EXA_CRIT_USD || 0.5);
const CODEX_SNAPSHOT_STALE_HOURS = 12;
const CODEX_PROBE_MIN_GAP_HOURS = 6;
// Daily rich-card digest fires on the first cron tick at/after this UTC hour
// (default 01:00 UTC = 09:00 UTC+8 morning).
const DIGEST_HOUR_UTC = Number(process.env.MONITOR_DIGEST_HOUR_UTC ?? 1);

export interface BalancePoint { atUtc: string; balance: number }

// Least-squares slope over the history tail → days until zero at the current
// burn rate. null = not enough signal (fewer than 3 points, or not draining).
export function projectDaysToEmpty(history: BalancePoint[], now: Date): number | null {
  const pts = history.slice(-48).map((p) => ({ t: Date.parse(p.atUtc), b: p.balance })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.b));
  if (pts.length < 3) return null;
  const t0 = pts[0]!.t;
  const xs = pts.map((p) => (p.t - t0) / 86_400_000);
  const ys = pts.map((p) => p.b);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i]! - mx) * (ys[i]! - my); den += (xs[i]! - mx) ** 2; }
  if (den === 0) return null;
  const slope = num / den; // balance units per day
  if (slope >= -1e-9) return null; // flat or refilled — no projection
  // Days from the LATEST snapshot until the fitted burn rate reaches zero,
  // minus however long ago that snapshot was taken.
  const latest = pts[pts.length - 1]!;
  const sinceLatestDays = (now.getTime() - latest.t) / 86_400_000;
  return Math.max(0, latest.b / -slope - sinceLatestDays);
}

// Quota/limit error signatures across all four vendors' phrasing. Matched
// case-insensitively against NEW log content only (incremental offsets).
const QUOTA_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "http-429", re: /\b429\b|too many requests/i },
  { id: "rate-limit", re: /rate.?limit(?:ed|s)?\b/i },
  { id: "quota", re: /quota (?:exceeded|reached|exhausted)|insufficient.?quota/i },
  { id: "balance", re: /insufficient (?:balance|funds|credits?)|payment required|\b402\b/i },
  { id: "usage-limit", re: /usage limit|limit reached|out of credits|credit balance/i },
  { id: "overloaded", re: /overloaded_error|capacity constraints/i }
];

export function scanForQuotaErrors(text: string): Array<{ patternId: string; line: string }> {
  const hits: Array<{ patternId: string; line: string }> = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    for (const p of QUOTA_PATTERNS) {
      if (p.re.test(line)) { hits.push({ patternId: p.id, line: line.slice(0, 300) }); break; }
    }
  }
  return hits;
}

export interface AlertState { lastSentUtc: Record<string, string> }

export function shouldAlert(state: AlertState, topic: string, now: Date, cooldownHours = ALERT_COOLDOWN_HOURS): boolean {
  const last = state.lastSentUtc[topic];
  if (!last) return true;
  return now.getTime() - Date.parse(last) >= cooldownHours * 3_600_000;
}

// ---- Codex subscription waterline -----------------------------------------
// Every persisted codex session rollout records rate_limits snapshots:
//   {"rate_limits":{"primary":{"used_percent":1.0,"window_minutes":10080,
//    "resets_at":<unix>},"secondary":...}}
// The fleet's codex books persist sessions (no --ephemeral), so reading the
// newest rollout gives a free waterline; a throttled probe run refreshes it
// when the fleet has been idle too long.

export interface CodexWindow { usedPercent: number; windowMinutes: number | null; resetsAt: number | null }
export interface CodexRateLimits { primary: CodexWindow | null; secondary: CodexWindow | null }

function toWindow(node: unknown): CodexWindow | null {
  if (!node || typeof node !== "object") return null;
  const r = node as Record<string, unknown>;
  const used = Number(r.used_percent);
  if (!Number.isFinite(used)) return null;
  return {
    usedPercent: used,
    windowMinutes: Number.isFinite(Number(r.window_minutes)) ? Number(r.window_minutes) : null,
    resetsAt: Number.isFinite(Number(r.resets_at)) ? Number(r.resets_at) : null
  };
}

function deepFindRateLimits(node: unknown): CodexRateLimits | null {
  if (!node || typeof node !== "object") return null;
  const rec = node as Record<string, unknown>;
  if (rec.rate_limits && typeof rec.rate_limits === "object") {
    const rl = rec.rate_limits as Record<string, unknown>;
    return { primary: toWindow(rl.primary), secondary: toWindow(rl.secondary) };
  }
  for (const v of Object.values(rec)) {
    const found = deepFindRateLimits(v);
    if (found) return found;
  }
  return null;
}

// Last rate_limits snapshot in a session rollout JSONL (later lines win).
export function extractLatestRateLimits(jsonl: string): CodexRateLimits | null {
  let latest: CodexRateLimits | null = null;
  for (const line of jsonl.split("\n")) {
    const t = line.trim();
    if (!t || t[0] !== "{") continue;
    try {
      const found = deepFindRateLimits(JSON.parse(t));
      if (found) latest = found;
    } catch { /* skip */ }
  }
  return latest;
}

// ---- Exa metered balance ---------------------------------------------------
// Exa has no balance API, but each search response reports costDollars, which
// the engine appends to EXA_COST_LEDGER. Anchor the meter once from the
// dashboard: EXA_CREDIT_ANCHOR="12.34@2026-08-23T08:00:00Z" (dollars@ISO).

export function parseCreditAnchor(raw: string | undefined): { usd: number; atMs: number } | null {
  if (!raw) return null;
  const at = raw.indexOf("@");
  if (at === -1) return null;
  const usd = Number(raw.slice(0, at));
  const atMs = Date.parse(raw.slice(at + 1));
  return Number.isFinite(usd) && Number.isFinite(atMs) ? { usd, atMs } : null;
}

export function sumLedgerAfter(jsonl: string, sinceMs: number): { totalUsd: number; last7dUsd: number; entries: number } {
  let totalUsd = 0, last7dUsd = 0, entries = 0;
  const weekAgo = Date.now() - 7 * 86_400_000;
  for (const line of jsonl.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const rec = JSON.parse(t) as { atUtc?: string; costDollars?: number };
      const ts = Date.parse(rec.atUtc ?? "");
      const cost = Number(rec.costDollars);
      if (!Number.isFinite(ts) || !Number.isFinite(cost)) continue;
      if (ts >= sinceMs) { totalUsd += cost; entries += 1; }
      if (ts >= weekAgo) last7dUsd += cost;
    } catch { /* skip */ }
  }
  return { totalUsd, last7dUsd, entries };
}

// ---- Claude subscription usage (OAuth endpoint, shape-defensive) -----------
// api.anthropic.com/api/oauth/usage exists but rate-limits itself hard; when
// it answers, walk the payload for percent-like numeric fields.

export function extractPercentFields(node: unknown, prefix = ""): Array<{ label: string; percent: number }> {
  if (!node || typeof node !== "object") return [];
  const out: Array<{ label: string; percent: number }> = [];
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const label = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "number" && /percent|utilization/i.test(k) && v >= 0 && v <= 100) {
      out.push({ label, percent: v });
    } else if (v && typeof v === "object") {
      out.push(...extractPercentFields(v, label));
    }
  }
  return out;
}

// Structured snapshot the daily digest card is rendered from. Checks fill it
// alongside their terminal lines.
export interface MonitorSummary {
  deepseek?: { balance: number; currency: string; runwayDays: number | null } | { error: string };
  codex?: { windows: Array<{ name: string; usedPercent: number; windowMinutes: number | null; resetsAt: number | null }>; snapshotAgeHours: number } | { status: string };
  claude?: { fields: Array<{ label: string; percent: number }> } | { status: string };
  exa?: { spentUsd: number; entries: number; anchorUsd?: number; remainingUsd?: number; perDayUsd?: number; runwayDays?: number };
  // Local transcript self-accounting: every claude-CLI run on this box logs
  // per-message usage; summed here per vendor bucket (claude-* vs kimi-*).
  claudeBurn?: BurnStats;
  kimiBurn?: BurnStats;
  books: Array<{ name: string; alive: boolean; quotaHits: number }>;
}

export interface BurnStats {
  fiveHourTokens: number;
  fiveHourCalls: number;
  sevenDayTokens: number;
  sevenDayCalls: number;
  // Empirical ceiling: the 5h token sum recorded the last time this vendor
  // actually hit a limit error — turns burn into a percentage waterline.
  ceilingTokens?: number;
  usedPercent?: number;
}

// Unicode progress bar for lark_md (Feishu has no native bar element).
export function bar(pct: number, width = 10): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  return "▓".repeat(filled) + "░".repeat(width - filled);
}

export function digestDue(lastSentDateUtc: string | undefined, now: Date, hourUtc = DIGEST_HOUR_UTC): boolean {
  const today = now.toISOString().slice(0, 10);
  return now.getUTCHours() >= hourUtc && lastSentDateUtc !== today;
}

function fmtReset(resetsAt: number | null): string {
  if (!resetsAt) return "重置时间未知";
  const utc8 = new Date(resetsAt * 1000 + 8 * 3_600_000);
  return `${utc8.getUTCMonth() + 1}/${utc8.getUTCDate()} ${String(utc8.getUTCHours()).padStart(2, "0")}:${String(utc8.getUTCMinutes()).padStart(2, "0")} 重置`;
}

// Build the Feishu interactive card (custom-bot v1 schema: header + elements;
// two-column "fields" approximate a table, bars are unicode in lark_md).
export function buildDailyCard(summary: MonitorSummary, findings: Finding[], now: Date): Record<string, unknown> {
  const worst = findings.some((f) => f.severity === "critical") ? "red" : findings.length ? "orange" : "green";
  const md: string[] = [];

  md.push("**📊 订阅额度**（包月，用完等窗口重置）");
  if (summary.codex && "windows" in summary.codex) {
    for (const w of summary.codex.windows) {
      const days = w.windowMinutes ? `${Math.round(w.windowMinutes / 1440)} 天额度` : "额度";
      md.push(`Codex（GPT-5.6 两本书）\n\`${bar(w.usedPercent)}\` 已用 ${w.usedPercent.toFixed(1)}% · ${days} · ${fmtReset(w.resetsAt)}`);
    }
  } else {
    md.push("Codex（GPT-5.6 两本书）：暂无快照");
  }
  if (summary.claude && "fields" in summary.claude && summary.claude.fields.length) {
    for (const f of summary.claude.fields) {
      md.push(`Claude 订阅（三本书 + 本机其他任务）\n\`${bar(f.percent)}\` ${f.label} 已用 ${f.percent.toFixed(0)}%`);
    }
  } else if (summary.claudeBurn) {
    const cb = summary.claudeBurn;
    if (cb.usedPercent !== undefined) {
      md.push(`Claude 订阅（按本机实测消耗）\n\`${bar(cb.usedPercent)}\` 5 小时窗已用约 ${cb.usedPercent.toFixed(0)}%（对照上次撞限水位）· 近 7 天 ${fmtTokens(cb.sevenDayTokens)} tokens`);
    } else {
      md.push(`Claude 订阅（按本机实测消耗，含 fleet 外任务）\n近 5 小时 ${fmtTokens(cb.fiveHourTokens)} tokens（${cb.fiveHourCalls} 条消息）· 近 7 天 ${fmtTokens(cb.sevenDayTokens)} tokens · 尚未撞过限，暂无百分比基准`);
    }
  } else {
    md.push("Claude 订阅：本机暂无消耗记录");
  }
  if (summary.kimiBurn && (summary.kimiBurn.sevenDayTokens > 0 || summary.kimiBurn.fiveHourTokens > 0)) {
    const kb = summary.kimiBurn;
    md.push(`Kimi Code（kimi-k3 书）\n近 5 小时 ${fmtTokens(kb.fiveHourTokens)} tokens · 近 7 天 ${fmtTokens(kb.sevenDayTokens)} tokens（官方无额度接口，按消耗展示）`);
  }

  md.push("---");
  md.push("**💰 按量付费余额**（花完要充值）");
  if (summary.deepseek && "balance" in summary.deepseek) {
    const d = summary.deepseek;
    const runwayTxt = d.runwayDays === null ? "消耗太少，暂无法预测" : `预计还能用 ~${d.runwayDays.toFixed(0)} 天`;
    const runwayPct = d.runwayDays === null ? 100 : Math.min(100, (d.runwayDays / 30) * 100);
    md.push(`DeepSeek（ds-flash 书）\n\`${bar(runwayPct)}\` 余额 ${d.currency} ${d.balance.toFixed(2)} · ${runwayTxt}`);
  } else {
    md.push("DeepSeek：余额查询失败 ⚠️");
  }
  if (summary.exa) {
    const e = summary.exa;
    if (e.remainingUsd !== undefined && e.anchorUsd !== undefined) {
      const pct = Math.max(0, Math.min(100, (e.remainingUsd / e.anchorUsd) * 100));
      const runwayTxt = e.runwayDays !== undefined ? ` · 预计还能用 ~${e.runwayDays.toFixed(0)} 天` : "";
      md.push(`Exa 搜索\n\`${bar(pct)}\` 约剩 $${e.remainingUsd.toFixed(2)} / $${e.anchorUsd}${runwayTxt}`);
    } else {
      md.push(`Exa 搜索：已记账消耗 $${e.spentUsd.toFixed(3)}（${e.entries} 次调用）· 未设余额锚点，无法算剩余`);
    }
  }

  const bookFields = summary.books.map((b) => ({
    is_short: true,
    text: { tag: "lark_md", content: `${b.alive ? "✅" : "🔴"} ${b.name}${b.quotaHits ? ` · ${b.quotaHits} 次配额报错` : ""}` }
  }));

  const alertLines = findings.length
    ? findings.map((f) => `${f.severity === "critical" ? "🔴" : "🟡"} ${f.message}`).join("\n")
    : "今日无异常，所有水位安全 ✅";

  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: worst,
        title: { tag: "plain_text", content: "Raven API 服务水位监控 · 每日一报" }
      },
      elements: [
        { tag: "div", text: { tag: "lark_md", content: md.join("\n") } },
        { tag: "hr" },
        { tag: "div", text: { tag: "lark_md", content: "**🤖 七本模拟盘进程**" } },
        { tag: "div", fields: bookFields },
        { tag: "hr" },
        { tag: "div", text: { tag: "lark_md", content: `**⚠️ 今日提醒**\n${alertLines}` } },
        {
          tag: "note",
          elements: [
            { tag: "plain_text", content: `生成于 ${now.toISOString().slice(0, 16)}Z（Huginn 服务器）· 破线告警另行实时推送 · 每日一报` }
          ]
        }
      ]
    }
  };
}

// One transcript line → usage entry. Claude Code transcript lines carry
// {timestamp, message: {model, usage: {input_tokens, cache_creation_input_tokens,
// cache_read_input_tokens, output_tokens}}}. Cache reads are excluded from the
// burn number (they are the cheap path); input + cache-write + output is what
// tracks subscription pressure.
export interface UsageEntry { tsMs: number; model: string; tokens: number }

export function parseTranscriptLine(line: string): UsageEntry | null {
  const t = line.trim();
  if (!t || t[0] !== "{") return null;
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(t) as Record<string, unknown>; } catch { return null; }
  const msg = obj.message as Record<string, unknown> | undefined;
  const usage = msg?.usage as Record<string, unknown> | undefined;
  if (!usage) return null;
  const tsMs = Date.parse(String(obj.timestamp ?? ""));
  if (!Number.isFinite(tsMs)) return null;
  const n = (k: string): number => (Number.isFinite(Number(usage[k])) ? Number(usage[k]) : 0);
  return {
    tsMs,
    model: String(msg?.model ?? "unknown"),
    tokens: n("input_tokens") + n("cache_creation_input_tokens") + n("output_tokens")
  };
}

export function aggregateBurn(entries: UsageEntry[], nowMs: number, modelMatch: (m: string) => boolean): BurnStats {
  const h5 = nowMs - 5 * 3_600_000;
  const d7 = nowMs - 7 * 86_400_000;
  const out: BurnStats = { fiveHourTokens: 0, fiveHourCalls: 0, sevenDayTokens: 0, sevenDayCalls: 0 };
  for (const e of entries) {
    if (!modelMatch(e.model)) continue;
    if (e.tsMs >= d7) { out.sevenDayTokens += e.tokens; out.sevenDayCalls += 1; }
    if (e.tsMs >= h5) { out.fiveHourTokens += e.tokens; out.fiveHourCalls += 1; }
  }
  return out;
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, "utf8")) as T; } catch { return fallback; }
}

interface Finding { topic: string; severity: "warn" | "critical"; message: string }

async function checkDeepSeekBalance(findings: Finding[], lines: string[], summary: MonitorSummary): Promise<void> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) { lines.push("deepseek     | no key in env — skipped"); return; }
  let body: { is_available?: boolean; balance_infos?: Array<{ currency?: string; total_balance?: string }> };
  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = await res.json();
  } catch (error) {
    findings.push({ topic: "deepseek-balance-api", severity: "warn", message: `DeepSeek balance API failed: ${error instanceof Error ? error.message : error}` });
    lines.push("deepseek     | balance API FAILED");
    summary.deepseek = { error: "balance API failed" };
    return;
  }
  const info = body.balance_infos?.[0];
  const balance = Number(info?.total_balance);
  const currency = info?.currency ?? "?";
  if (!Number.isFinite(balance)) { lines.push("deepseek     | unparseable balance payload"); return; }

  const histFile = path.join(MONITOR_ROOT, "deepseek-balance.jsonl");
  const now = new Date();
  fs.appendFileSync(histFile, JSON.stringify({ atUtc: now.toISOString(), balance }) + "\n");
  const history: BalancePoint[] = fs.readFileSync(histFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const runway = projectDaysToEmpty(history, now);
  const runwayLabel = runway === null ? "runway n/a" : `~${runway.toFixed(1)}d to empty`;
  lines.push(`deepseek     | ${currency} ${balance.toFixed(2)} | ${runwayLabel}`);
  summary.deepseek = { balance, currency, runwayDays: runway };

  if (balance <= DS_BALANCE_CRIT_CNY) findings.push({ topic: "deepseek-balance", severity: "critical", message: `DeepSeek 余额仅剩 ${currency} ${balance.toFixed(2)}（临界线 ${DS_BALANCE_CRIT_CNY}）— ds-flash 书即将停摆，请充值或切换。` });
  else if (balance <= DS_BALANCE_WARN_CNY) findings.push({ topic: "deepseek-balance", severity: "warn", message: `DeepSeek 余额 ${currency} ${balance.toFixed(2)} 低于警戒线 ${DS_BALANCE_WARN_CNY}。` });
  if (runway !== null && runway <= RUNWAY_WARN_DAYS) findings.push({ topic: "deepseek-runway", severity: "warn", message: `按当前烧钱速度 DeepSeek 余额预计 ${runway.toFixed(1)} 天内用光（水位线 ${RUNWAY_WARN_DAYS} 天）。当前 ${currency} ${balance.toFixed(2)}。` });
}

function checkLogsAndLiveness(findings: Finding[], lines: string[], summary: MonitorSummary): void {
  const offsetsFile = path.join(MONITOR_ROOT, "log-offsets.json");
  const offsets = readJson<Record<string, number>>(offsetsFile, {});
  for (const book of BOOKS) {
    const logFile = path.join(FLEET_ROOT, "logs", `${book}.log`);
    const pidFile = path.join(FLEET_ROOT, "logs", `${book}.pid`);
    let alive = false;
    try { process.kill(Number(fs.readFileSync(pidFile, "utf8").trim()), 0); alive = true; } catch { /* dead or no pidfile */ }
    if (!alive) findings.push({ topic: `dead-${book}`, severity: "critical", message: `${book} 书进程不在运行（pidfile 检查失败）— start-all.sh 可拉起。` });

    let hits: Array<{ patternId: string; line: string }> = [];
    let sizeLabel = "no log";
    try {
      const stat = fs.statSync(logFile);
      const prev = Math.min(offsets[book] ?? 0, stat.size); // truncation-safe
      if (stat.size > prev) {
        const fd = fs.openSync(logFile, "r");
        const buf = Buffer.alloc(Math.min(stat.size - prev, 512 * 1024));
        fs.readSync(fd, buf, 0, buf.length, stat.size - buf.length < prev ? prev : stat.size - buf.length);
        fs.closeSync(fd);
        hits = scanForQuotaErrors(buf.toString("utf8"));
      }
      offsets[book] = stat.size;
      sizeLabel = `${(stat.size / 1024).toFixed(0)}kB`;
    } catch { /* keep defaults */ }
    for (const h of hits.slice(0, 3)) {
      findings.push({ topic: `quota-${book}-${h.patternId}`, severity: "critical", message: `${book} 书日志出现配额/限流特征 [${h.patternId}]：${h.line}` });
    }
    lines.push(`${book.padEnd(12)} | ${alive ? "alive" : "DEAD "} | log ${sizeLabel}${hits.length ? ` | ${C.red}${hits.length} quota hit(s)${C.reset}` : ""}`);
    summary.books.push({ name: book, alive, quotaHits: hits.length });
  }
  fs.writeFileSync(offsetsFile, JSON.stringify(offsets, null, 1));
}

function newestSessionFile(sessionsDir: string): { file: string; mtimeMs: number } | null {
  let best: { file: string; mtimeMs: number } | null = null;
  const walk = (dir: string, depth: number): void => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && depth < 4) walk(full, depth + 1);
      else if (e.isFile() && e.name.endsWith(".jsonl")) {
        const m = fs.statSync(full).mtimeMs;
        if (!best || m > best.mtimeMs) best = { file: full, mtimeMs: m };
      }
    }
  };
  walk(sessionsDir, 0);
  return best;
}

async function checkCodexSubscription(findings: Finding[], lines: string[], now: Date, summary: MonitorSummary): Promise<void> {
  const sessionsDir = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "sessions");
  let newest = newestSessionFile(sessionsDir);

  // Fleet idle too long → one throttled probe run to refresh the snapshot.
  const probeState = path.join(MONITOR_ROOT, "codex-probe.json");
  const lastProbe = readJson<{ atUtc?: string }>(probeState, {});
  const staleMs = CODEX_SNAPSHOT_STALE_HOURS * 3_600_000;
  const probeGapOk = !lastProbe.atUtc || now.getTime() - Date.parse(lastProbe.atUtc) >= CODEX_PROBE_MIN_GAP_HOURS * 3_600_000;
  if ((!newest || now.getTime() - newest.mtimeMs > staleMs) && probeGapOk) {
    try {
      const { execFileSync } = await import("node:child_process");
      execFileSync("codex", ["exec", "--skip-git-repo-check", "-s", "read-only", "-m", "gpt-5.6-terra", "Reply with: ok"], { timeout: 120_000, stdio: "ignore" });
      fs.writeFileSync(probeState, JSON.stringify({ atUtc: now.toISOString() }));
      newest = newestSessionFile(sessionsDir);
    } catch { lines.push("codex-sub    | probe run failed"); }
  }
  if (!newest) { lines.push("codex-sub    | no session snapshots yet"); summary.codex = { status: "no snapshots" }; return; }

  const rl = extractLatestRateLimits(fs.readFileSync(newest.file, "utf8"));
  if (!rl?.primary) { lines.push("codex-sub    | no rate_limits in newest session"); summary.codex = { status: "no rate_limits" }; return; }
  const ageH = (now.getTime() - newest.mtimeMs) / 3_600_000;
  const windows: Array<[string, CodexWindow]> = [];
  if (rl.primary) windows.push(["primary", rl.primary]);
  if (rl.secondary) windows.push(["secondary", rl.secondary]);
  lines.push(`codex-sub    | ${windows.map(([n, w]) => `${n} ${w.usedPercent.toFixed(1)}% of ${w.windowMinutes ? Math.round(w.windowMinutes / 1440) + "d" : "?"} window`).join(" · ")} | snapshot ${ageH.toFixed(1)}h old`);
  summary.codex = { windows: windows.map(([name, w]) => ({ name, usedPercent: w.usedPercent, windowMinutes: w.windowMinutes, resetsAt: w.resetsAt })), snapshotAgeHours: ageH };
  for (const [name, w] of windows) {
    const reset = w.resetsAt ? new Date(w.resetsAt * 1000).toISOString().slice(0, 16) + "Z" : "unknown";
    if (w.usedPercent >= SUB_USED_CRIT_PCT) findings.push({ topic: `codex-${name}`, severity: "critical", message: `Codex 订阅 ${name} 窗口已用 ${w.usedPercent.toFixed(1)}%（重置 ${reset}）— gpt-sol/gpt-terra 即将停摆。` });
    else if (w.usedPercent >= SUB_USED_WARN_PCT) findings.push({ topic: `codex-${name}`, severity: "warn", message: `Codex 订阅 ${name} 窗口已用 ${w.usedPercent.toFixed(1)}%（重置 ${reset}）。` });
  }
}

async function checkClaudeSubscription(findings: Finding[], lines: string[], summary: MonitorSummary): Promise<void> {
  const token = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!token) { lines.push("claude-sub   | no oauth token in env — skipped"); summary.claude = { status: "no token" }; return; }
  let body: unknown;
  try {
    const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
      headers: { authorization: `Bearer ${token}`, "anthropic-beta": "oauth-2025-04-20" },
      signal: AbortSignal.timeout(15_000)
    });
    if (res.status === 429) { lines.push("claude-sub   | usage endpoint self-rate-limited (normal) — skipped this tick"); summary.claude = { status: "rate-limited" }; return; }
    if (!res.ok) { lines.push(`claude-sub   | usage endpoint HTTP ${res.status} — skipped`); summary.claude = { status: `HTTP ${res.status}` }; return; }
    body = await res.json();
  } catch (error) {
    lines.push(`claude-sub   | usage fetch failed: ${error instanceof Error ? error.message : error}`);
    summary.claude = { status: "fetch failed" };
    return;
  }
  fs.writeFileSync(path.join(MONITOR_ROOT, "claude-usage-last.json"), JSON.stringify(body, null, 1));
  const pcts = extractPercentFields(body);
  if (!pcts.length) { lines.push("claude-sub   | usage payload had no percent fields (raw saved for inspection)"); summary.claude = { status: "no percent fields" }; return; }
  lines.push(`claude-sub   | ${pcts.map((f) => `${f.label} ${f.percent.toFixed(0)}%`).join(" · ")}`);
  summary.claude = { fields: pcts };
  for (const f of pcts) {
    if (f.percent >= SUB_USED_CRIT_PCT) findings.push({ topic: `claude-${f.label}`, severity: "critical", message: `Claude 订阅 ${f.label} 已用 ${f.percent.toFixed(0)}% — 4 本 claude 书（含东京）受影响。` });
    else if (f.percent >= SUB_USED_WARN_PCT) findings.push({ topic: `claude-${f.label}`, severity: "warn", message: `Claude 订阅 ${f.label} 已用 ${f.percent.toFixed(0)}%。` });
  }
}

// Sum usage from every claude-CLI transcript on this box (fleet books AND any
// other consumer sharing the subscription — e.g. ad-hoc research runs). The
// 5h/7d windows mirror Anthropic's limit windows; Kimi Code rides the same
// CLI with model kimi-*, so it gets metered for free.
function checkTranscriptBurn(findings: Finding[], lines: string[], summary: MonitorSummary, now: Date): void {
  const projectsDir = path.join(os.homedir(), ".claude", "projects");
  const entries: UsageEntry[] = [];
  const cutoffMs = now.getTime() - 7 * 86_400_000;
  let dirs: fs.Dirent[] = [];
  try { dirs = fs.readdirSync(projectsDir, { withFileTypes: true }); } catch { /* no CLI use yet */ }
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    let files: fs.Dirent[] = [];
    try { files = fs.readdirSync(path.join(projectsDir, d.name), { withFileTypes: true }); } catch { continue; }
    for (const f of files) {
      if (!f.isFile() || !f.name.endsWith(".jsonl")) continue;
      const full = path.join(projectsDir, d.name, f.name);
      try {
        if (fs.statSync(full).mtimeMs < cutoffMs) continue;
        for (const line of fs.readFileSync(full, "utf8").split("\n")) {
          const e = parseTranscriptLine(line);
          if (e && e.tsMs >= cutoffMs) entries.push(e);
        }
      } catch { /* unreadable file */ }
    }
  }

  const ceilingFile = path.join(MONITOR_ROOT, "burn-ceilings.json");
  const ceilings = readJson<Record<string, number>>(ceilingFile, {});
  const buckets: Array<{ key: "claudeBurn" | "kimiBurn"; label: string; match: (m: string) => boolean }> = [
    { key: "claudeBurn", label: "claude-burn", match: (m) => m.startsWith("claude") },
    { key: "kimiBurn", label: "kimi-burn", match: (m) => m.toLowerCase().includes("kimi") }
  ];
  for (const b of buckets) {
    const stats = aggregateBurn(entries, now.getTime(), b.match);
    const ceiling = ceilings[b.key];
    if (ceiling && ceiling > 0) {
      stats.ceilingTokens = ceiling;
      stats.usedPercent = Math.min(100, (stats.fiveHourTokens / ceiling) * 100);
    }
    summary[b.key] = stats;
    const pct = stats.usedPercent !== undefined ? ` | ~${stats.usedPercent.toFixed(0)}% of observed 5h ceiling` : "";
    lines.push(`${b.label.padEnd(12)} | 5h ${fmtTokens(stats.fiveHourTokens)} tok / ${stats.fiveHourCalls} msg | 7d ${fmtTokens(stats.sevenDayTokens)} tok${pct}`);
    if (stats.usedPercent !== undefined) {
      if (stats.usedPercent >= SUB_USED_CRIT_PCT) findings.push({ topic: `${b.key}-ceiling`, severity: "critical", message: `${b.label} 5 小时窗消耗已达上次撞限水位的 ${stats.usedPercent.toFixed(0)}%。` });
      else if (stats.usedPercent >= SUB_USED_WARN_PCT) findings.push({ topic: `${b.key}-ceiling`, severity: "warn", message: `${b.label} 5 小时窗消耗达上次撞限水位的 ${stats.usedPercent.toFixed(0)}%。` });
    }
  }

  // Calibration: a quota error on a claude/kimi book stamps the current 5h sum
  // as that vendor's observed ceiling (kept as a running max).
  const claudeBooks = (process.env.FLEET_CLAUDE_BOOKS || "fable,opus,sonnet").split(",").map((x) => x.trim());
  for (const f of findings) {
    const m = f.topic.match(/^quota-([a-z0-9-]+)-/);
    if (!m) continue;
    const book = m[1]!;
    const key = claudeBooks.includes(book) ? "claudeBurn" : book.includes("kimi") ? "kimiBurn" : null;
    if (!key) continue;
    const current = (summary[key as "claudeBurn" | "kimiBurn"])?.fiveHourTokens ?? 0;
    if (current > (ceilings[key] ?? 0)) {
      ceilings[key] = current;
      fs.writeFileSync(ceilingFile, JSON.stringify(ceilings, null, 1));
      log.info(`${key} ceiling calibrated to ${fmtTokens(current)} tokens (limit error observed)`);
    }
  }
}

function checkExaMeter(findings: Finding[], lines: string[], summary: MonitorSummary): void {
  const ledgerFile = process.env.EXA_COST_LEDGER || path.join(MONITOR_ROOT, "exa-cost.jsonl");
  const anchorRaw = process.env.EXA_CREDIT_ANCHOR;
  let ledger = "";
  try { ledger = fs.readFileSync(ledgerFile, "utf8"); } catch { /* no calls metered yet */ }
  const anchorParsed = parseCreditAnchor(anchorRaw);
  const sums = sumLedgerAfter(ledger, anchorParsed?.atMs ?? 0);
  if (!anchorParsed) {
    lines.push(`exa          | metered spend since start: $${sums.totalUsd.toFixed(3)} (${sums.entries} calls) | no EXA_CREDIT_ANCHOR — remaining unknown`);
    summary.exa = { spentUsd: sums.totalUsd, entries: sums.entries };
    return;
  }
  const remaining = anchorParsed.usd - sums.totalUsd;
  const perDay = sums.last7dUsd / 7;
  const runway = perDay > 0 ? remaining / perDay : null;
  lines.push(`exa          | ~$${remaining.toFixed(2)} left of $${anchorParsed.usd} anchor | $${perDay.toFixed(3)}/d${runway !== null ? ` | ~${runway.toFixed(0)}d runway` : ""}`);
  summary.exa = { spentUsd: sums.totalUsd, entries: sums.entries, anchorUsd: anchorParsed.usd, remainingUsd: remaining, perDayUsd: perDay, ...(runway !== null ? { runwayDays: runway } : {}) };
  if (remaining <= EXA_CRIT_USD) findings.push({ topic: "exa-credit", severity: "critical", message: `Exa 额度按记账仅剩 ~$${remaining.toFixed(2)}（临界 $${EXA_CRIT_USD}）— 搜索即将失败，请充值并更新 EXA_CREDIT_ANCHOR。` });
  else if (remaining <= EXA_WARN_USD) findings.push({ topic: "exa-credit", severity: "warn", message: `Exa 额度按记账约剩 $${remaining.toFixed(2)}，低于警戒线 $${EXA_WARN_USD}。` });
  if (runway !== null && runway <= RUNWAY_WARN_DAYS) findings.push({ topic: "exa-runway", severity: "warn", message: `Exa 按近 7 日烧速预计 ${runway.toFixed(1)} 天内用光（约剩 $${remaining.toFixed(2)}）。` });
}

async function sendWebhooks(text: string): Promise<string[]> {
  const sent: string[] = [];
  const feishu = process.env.FEISHU_WEBHOOK_URL;
  const slack = process.env.SLACK_WEBHOOK_URL;
  if (feishu) {
    try {
      const res = await fetch(feishu, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ msg_type: "text", content: { text } }), signal: AbortSignal.timeout(15_000) });
      const body = await res.text();
      if (res.ok && !body.includes('"code":19')) sent.push("feishu");
      else log.err(`feishu webhook rejected: ${body.slice(0, 150)}`);
    } catch (error) { log.err(`feishu webhook failed: ${error instanceof Error ? error.message : error}`); }
  }
  if (slack) {
    try {
      const res = await fetch(slack, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(15_000) });
      if (res.ok) sent.push("slack");
      else log.err(`slack webhook rejected: HTTP ${res.status}`);
    } catch (error) { log.err(`slack webhook failed: ${error instanceof Error ? error.message : error}`); }
  }
  return sent;
}

async function main(): Promise<void> {
  fs.mkdirSync(MONITOR_ROOT, { recursive: true });
  const now = new Date();
  console.log(`${C.bold}fleet quota monitor${C.reset} ${now.toISOString()}  execution_mode=inspect (read-only + own state dir)`);
  const findings: Finding[] = [];
  const lines: string[] = [];
  const summary: MonitorSummary = { books: [] };
  await checkDeepSeekBalance(findings, lines, summary);
  await checkCodexSubscription(findings, lines, now, summary);
  await checkClaudeSubscription(findings, lines, summary);
  checkExaMeter(findings, lines, summary);
  checkLogsAndLiveness(findings, lines, summary);
  checkTranscriptBurn(findings, lines, summary, now);
  console.log(lines.map((l) => `  ${l}`).join("\n"));

  const stateFile = path.join(MONITOR_ROOT, "alert-state.json");
  const state = readJson<AlertState>(stateFile, { lastSentUtc: {} });
  const due = findings.filter((f) => shouldAlert(state, f.topic, now));
  const muted = findings.length - due.length;

  if (findings.length === 0) log.ok("no findings — all waterlines clear");
  else for (const f of findings) (f.severity === "critical" ? log.err : log.warn)(`[${f.topic}] ${f.message}`);
  if (muted > 0) log.info(`${muted} finding(s) inside the ${ALERT_COOLDOWN_HOURS}h cooldown — not re-sent`);

  if (due.length > 0) {
    const header = due.some((f) => f.severity === "critical") ? "🔴 Raven API 服务水位告警" : "🟡 Raven API 服务水位预警";
    const text = `${header}\n${due.map((f) => `• ${f.message}`).join("\n")}\n(${now.toISOString()} · raven-labs quota-monitor)`;
    const sent = await sendWebhooks(text);
    if (sent.length) {
      log.ok(`alert sent via ${sent.join("+")}`);
      for (const f of due) state.lastSentUtc[f.topic] = now.toISOString();
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 1));
    } else if (!process.env.FEISHU_WEBHOOK_URL && !process.env.SLACK_WEBHOOK_URL) {
      log.warn("no webhook configured (FEISHU_WEBHOOK_URL / SLACK_WEBHOOK_URL) — findings printed only");
    }
  }

  // Daily rich-card digest (Feishu interactive card): once per UTC day at/after
  // DIGEST_HOUR_UTC, or forced with --digest-now.
  const digestStateFile = path.join(MONITOR_ROOT, "digest-state.json");
  const digestState = readJson<{ lastSentDateUtc?: string }>(digestStateFile, {});
  if (process.argv.includes("--digest-now") || digestDue(digestState.lastSentDateUtc, now)) {
    const feishu = process.env.FEISHU_WEBHOOK_URL;
    if (!feishu) {
      log.warn("daily digest due but FEISHU_WEBHOOK_URL is not set");
    } else {
      try {
        const res = await fetch(feishu, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildDailyCard(summary, findings, now)),
          signal: AbortSignal.timeout(15_000)
        });
        const body = await res.text();
        if (res.ok && body.includes('"code":0')) {
          fs.writeFileSync(digestStateFile, JSON.stringify({ lastSentDateUtc: now.toISOString().slice(0, 10) }));
          log.ok("daily digest card sent");
        } else {
          log.err(`daily digest rejected: ${body.slice(0, 150)}`);
        }
      } catch (error) {
        log.err(`daily digest failed: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
}

const invokedDirectly = process.argv[1]?.includes("quota-monitor");
if (invokedDirectly) {
  void main().catch((error) => {
    log.err(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  });
}
