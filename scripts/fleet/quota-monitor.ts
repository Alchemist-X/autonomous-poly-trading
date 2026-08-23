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

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, "utf8")) as T; } catch { return fallback; }
}

interface Finding { topic: string; severity: "warn" | "critical"; message: string }

async function checkDeepSeekBalance(findings: Finding[], lines: string[]): Promise<void> {
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

  if (balance <= DS_BALANCE_CRIT_CNY) findings.push({ topic: "deepseek-balance", severity: "critical", message: `DeepSeek 余额仅剩 ${currency} ${balance.toFixed(2)}（临界线 ${DS_BALANCE_CRIT_CNY}）— ds-flash 书即将停摆，请充值或切换。` });
  else if (balance <= DS_BALANCE_WARN_CNY) findings.push({ topic: "deepseek-balance", severity: "warn", message: `DeepSeek 余额 ${currency} ${balance.toFixed(2)} 低于警戒线 ${DS_BALANCE_WARN_CNY}。` });
  if (runway !== null && runway <= RUNWAY_WARN_DAYS) findings.push({ topic: "deepseek-runway", severity: "warn", message: `按当前烧钱速度 DeepSeek 余额预计 ${runway.toFixed(1)} 天内用光（水位线 ${RUNWAY_WARN_DAYS} 天）。当前 ${currency} ${balance.toFixed(2)}。` });
}

function checkLogsAndLiveness(findings: Finding[], lines: string[]): void {
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
  }
  fs.writeFileSync(offsetsFile, JSON.stringify(offsets, null, 1));
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
  await checkDeepSeekBalance(findings, lines);
  checkLogsAndLiveness(findings, lines);
  console.log(lines.map((l) => `  ${l}`).join("\n"));

  const stateFile = path.join(MONITOR_ROOT, "alert-state.json");
  const state = readJson<AlertState>(stateFile, { lastSentUtc: {} });
  const due = findings.filter((f) => shouldAlert(state, f.topic, now));
  const muted = findings.length - due.length;

  if (findings.length === 0) log.ok("no findings — all waterlines clear");
  else for (const f of findings) (f.severity === "critical" ? log.err : log.warn)(`[${f.topic}] ${f.message}`);
  if (muted > 0) log.info(`${muted} finding(s) inside the ${ALERT_COOLDOWN_HOURS}h cooldown — not re-sent`);

  if (due.length > 0) {
    const header = due.some((f) => f.severity === "critical") ? "🔴 Forecast fleet 配额告警" : "🟡 Forecast fleet 配额预警";
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
}

const invokedDirectly = process.argv[1]?.includes("quota-monitor");
if (invokedDirectly) {
  void main().catch((error) => {
    log.err(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  });
}
