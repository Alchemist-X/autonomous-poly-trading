/**
 * Build the canonical World Cup prediction question list from the cached
 * Polymarket snapshot (runtime-artifacts/world-cup/polymarket/snapshot.json).
 *
 * Scope (per 2026-06-11 publishing plan):
 *   1. 72 group-stage matches      — three-way 1X2, one question per match
 *   2. 12 group winners            — one question per group, 4 mutually-exclusive legs
 *   3. quarterfinalists (last 8)   — one question, 48 per-team binary legs (sum ≈ 8)
 *   4. semifinalists  (last 4)     — one question, 48 per-team binary legs (sum ≈ 4)
 *   5. champion                    — one question, 48 mutually-exclusive legs (sum ≈ 1)
 *
 * Outputs (runtime-artifacts/world-cup/event-list/):
 *   questions.json — machine-readable feed for the prediction harness
 *   event-list.md / event-list.en.md — human-readable CN/EN lists with definitions
 *
 * Run: pnpm tsx scripts/world-cup/build-event-list.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SNAPSHOT = path.join(REPO_ROOT, "runtime-artifacts/world-cup/polymarket/snapshot.json");
const OUT_DIR = path.join(REPO_ROOT, "runtime-artifacts/world-cup/event-list");
const GROUP_STAGE_LAST_DAY = "2026-06-27";

interface Market {
  question: string;
  marketSlug: string;
  eventSlug: string;
  eventTitle: string;
  subtype: string;
  groupItem: string;
  conditionId: string;
  outcomePrices: number[];
  liquidity: number;
  endDate: string;
  url: string;
}

interface Leg {
  label: string;
  marketSlug: string;
  conditionId: string;
  cachedYesPrice: number | null;
  liquidity: number;
}

interface Question {
  id: string;
  family: "group_match" | "group_winner" | "reach_quarterfinal" | "reach_semifinal" | "champion";
  questionCn: string;
  questionEn: string;
  eventSlug: string;
  kickoffUtcHint: string | null;
  group: string | null;
  legs: Leg[];
}

const toLeg = (m: Market): Leg => ({
  label: m.groupItem || m.question,
  marketSlug: m.marketSlug,
  conditionId: m.conditionId,
  cachedYesPrice: m.outcomePrices?.[0] ?? null,
  liquidity: m.liquidity ?? 0
});

function buildTeamGroupMap(groupWinnerMarkets: Market[]): Map<string, string> {
  return groupWinnerMarkets.reduce((map, m) => {
    const match = m.question.match(/win Group ([A-L])/i);
    if (match && m.groupItem) map.set(m.groupItem, match[1].toUpperCase());
    return map;
  }, new Map<string, string>());
}

function buildMatchQuestions(markets: Market[], teamGroup: Map<string, string>): Question[] {
  // Strict slug shape `fifwc-<a>-<b>-YYYY-MM-DD` (nothing after the date):
  // near kickoff Polymarket adds per-match prop events (first-to-score, player-props,
  // second-half-result, ...) that the categorizer can mislabel as moneyline_1x2.
  const matchSlug = /^fifwc-[a-z]+-[a-z]+-(\d{4}-\d{2}-\d{2})$/;
  const matchMarkets = markets.filter((m) => {
    const slugMatch = m.eventSlug.match(matchSlug);
    return m.subtype === "moneyline_1x2" && slugMatch !== null && slugMatch[1] <= GROUP_STAGE_LAST_DAY;
  });
  const byEvent = matchMarkets.reduce((acc, m) => {
    const existing = acc.get(m.eventSlug) ?? [];
    return new Map(acc).set(m.eventSlug, [...existing, m]);
  }, new Map<string, Market[]>());

  return [...byEvent.entries()]
    .map(([eventSlug, legsRaw]) => {
      const [teamA, teamB] = (legsRaw[0].eventTitle ?? "").split(/\s+vs\.?\s+/i);
      const date = eventSlug.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
      const group = teamGroup.get(teamA) ?? teamGroup.get(teamB) ?? null;
      const order = (m: Market): number =>
        m.marketSlug.endsWith("-draw") ? 1 : m.groupItem === teamA ? 0 : 2;
      const legs = [...legsRaw].sort((a, b) => order(a) - order(b)).map(toLeg);
      if (legs.length !== 3) {
        console.warn(`WARN: ${eventSlug} has ${legs.length} moneyline legs (expected 3)`);
      }
      return {
        id: `match:${eventSlug}`,
        family: "group_match" as const,
        questionCn: `小组赛 ${date}（${group ? `${group} 组` : "组别待定"}）：${teamA} vs ${teamB} 的 90 分钟赛果？`,
        questionEn: `Group stage ${date}${group ? ` (Group ${group})` : ""}: ${teamA} vs ${teamB} — 90-minute result?`,
        eventSlug,
        kickoffUtcHint: legsRaw[0].endDate ?? null,
        group,
        legs
      };
    })
    .sort((a, b) => a.eventSlug.localeCompare(b.eventSlug))
    .sort((a, b) => (a.kickoffUtcHint ?? "").localeCompare(b.kickoffUtcHint ?? ""));
}

function buildGroupWinnerQuestions(groupWinnerMarkets: Market[]): Question[] {
  const byGroup = groupWinnerMarkets.reduce((acc, m) => {
    const group = m.question.match(/win Group ([A-L])/i)?.[1]?.toUpperCase();
    if (!group) return acc;
    const existing = acc.get(group) ?? [];
    return new Map(acc).set(group, [...existing, m]);
  }, new Map<string, Market[]>());

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, legsRaw]) => ({
      id: `group-winner:${group.toLowerCase()}`,
      family: "group_winner" as const,
      questionCn: `${group} 组头名（小组第一出线）是哪支球队？`,
      questionEn: `Which team finishes first in Group ${group}?`,
      eventSlug: legsRaw[0].eventSlug,
      kickoffUtcHint: legsRaw[0].endDate ?? null,
      group,
      legs: [...legsRaw].sort((a, b) => (b.outcomePrices?.[0] ?? 0) - (a.outcomePrices?.[0] ?? 0)).map(toLeg)
    }));
}

function buildPerTeamPool(
  markets: Market[],
  eventSlug: string,
  id: string,
  family: Question["family"],
  questionCn: string,
  questionEn: string
): Question {
  const legsRaw = markets.filter((m) => m.eventSlug === eventSlug);
  return {
    id,
    family,
    questionCn,
    questionEn,
    eventSlug,
    kickoffUtcHint: legsRaw[0]?.endDate ?? null,
    group: null,
    legs: [...legsRaw].sort((a, b) => (b.outcomePrices?.[0] ?? 0) - (a.outcomePrices?.[0] ?? 0)).map(toLeg)
  };
}

function renderMarkdown(questions: Question[], lang: "cn" | "en", generatedAt: string): string {
  const t = (cn: string, en: string): string => (lang === "cn" ? cn : en);
  const matches = questions.filter((q) => q.family === "group_match");
  const groups = questions.filter((q) => q.family === "group_winner");
  const qf = questions.find((q) => q.family === "reach_quarterfinal");
  const sf = questions.find((q) => q.family === "reach_semifinal");
  const champ = questions.find((q) => q.family === "champion");
  const pct = (p: number | null): string => (p == null ? "—" : `${(p * 100).toFixed(1)}%`);

  const lines: string[] = [];
  lines.push(t("# 2026 世界杯公开预测 — 事件清单与结算定义", "# 2026 World Cup Public Forecasts — Event List & Resolution Definitions"));
  lines.push("");
  lines.push(t(`> 生成时间：${generatedAt} · 数据源：Polymarket Gamma 缓存快照（价格仅供参照，预测发布时刷新）`,
    `> Generated: ${generatedAt} · Source: cached Polymarket Gamma snapshot (prices for reference only; refreshed at publish time)`));
  lines.push("");
  lines.push(t(
    `**范围：** ${matches.length} 场小组赛 + ${groups.length} 个小组头名 + 八强名单 + 四强名单 + 冠军，共 ${questions.length} 个问题、${questions.reduce((n, q) => n + q.legs.length, 0)} 条市场腿。`,
    `**Scope:** ${matches.length} group-stage matches + ${groups.length} group winners + quarterfinalists + semifinalists + champion — ${questions.length} questions, ${questions.reduce((n, q) => n + q.legs.length, 0)} market legs.`));
  lines.push("");
  lines.push(t("## 结算定义（全部问题统一标准）", "## Resolution Definitions (uniform across all questions)"));
  lines.push("");
  lines.push(t(
    [
      "| 家族 | 定义 |",
      "|---|---|",
      "| 小组赛单场 (72) | 90 分钟（含补时）赛果，三个互斥结果：A 胜 / 平 / B 胜。小组赛无加时与点球。按 FIFA 官方赛果结算，对应 Polymarket 同一 negRisk 事件下的 3 个二元市场。 |",
      "| 小组头名 (12) | FIFA 官方最终小组积分榜第 1 名（排名规则：积分 → 净胜球 → 进球数 → 对赛成绩 → 公平竞赛分 → 抽签）。每组 4 队互斥，概率之和 ≈ 1。 |",
      "| 八强名单 (1 题 × 48 队) | 2026 年 48 队赛制：12 个小组前两名 + 8 个最佳第三共 32 队进入淘汰赛。「进入八强」= 赢下 16 强淘汰赛、获得 1/4 决赛参赛资格（最后 8 队）。每队一个二元概率，恰好 8 队实现，48 队概率之和 ≈ 8。 |",
      "| 四强名单 (1 题 × 48 队) | 「进入四强」= 赢下 1/4 决赛、获得半决赛参赛资格（最后 4 队）。每队一个二元概率，概率之和 ≈ 4。 |",
      "| 冠军 (1 题 × 48 队) | 赢得 2026-07-19 决赛（含加时与点球）。48 队互斥，概率之和 ≈ 1。 |"
    ].join("\n"),
    [
      "| Family | Definition |",
      "|---|---|",
      "| Group-stage match (72) | 90-minute result incl. stoppage time, three mutually exclusive outcomes: A win / draw / B win. No extra time or penalties in the group stage. Settled on the official FIFA result, mapping to the 3 binary markets under one Polymarket negRisk event. |",
      "| Group winner (12) | First place in the official final FIFA group standings (points → goal difference → goals scored → head-to-head → fair play → drawing of lots). 4 mutually exclusive teams per group, probabilities sum ≈ 1. |",
      "| Quarterfinalists (1 question × 48 teams) | 2026 48-team format: top two per group + 8 best third-placed teams (32) enter the knockouts. \"Reach the quarterfinals\" = win the round-of-16 tie and qualify for the last 8. One binary probability per team; exactly 8 resolve Yes, so probabilities sum ≈ 8. |",
      "| Semifinalists (1 question × 48 teams) | \"Reach the semifinals\" = win the quarterfinal and qualify for the last 4. One binary probability per team; probabilities sum ≈ 4. |",
      "| Champion (1 question × 48 teams) | Win the final on 2026-07-19 (extra time and penalties included). 48 mutually exclusive teams, probabilities sum ≈ 1. |"
    ].join("\n")));
  lines.push("");
  lines.push(t(
    "> 注：单场问题中「A 队」按 Polymarket 赛程列序的第一队，仅作标识，不代表真实主客场。",
    "> Note: \"Team A\" in match questions follows Polymarket's fixture ordering and does not imply home advantage."));
  lines.push("");

  lines.push(t(`## 1. 小组赛 ${matches.length} 场`, `## 1. Group-Stage Matches (${matches.length})`));
  lines.push("");
  lines.push(t("| # | 日期 | 组 | 对阵 | 缓存价 A/平/B | event_slug |", "| # | Date | Grp | Fixture | Cached A/D/B | event_slug |"));
  lines.push("|---|---|---|---|---|---|");
  matches.forEach((q, i) => {
    const date = q.eventSlug.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
    const fixture = q.questionEn.split(": ")[1]?.split(" — ")[0] ?? q.eventSlug;
    const prices = q.legs.map((l) => pct(l.cachedYesPrice)).join(" / ");
    lines.push(`| ${i + 1} | ${date} | ${q.group ?? "?"} | ${fixture} | ${prices} | \`${q.eventSlug}\` |`);
  });
  lines.push("");

  lines.push(t("## 2. 小组头名（12 组）", "## 2. Group Winners (12 groups)"));
  lines.push("");
  groups.forEach((q) => {
    const teams = q.legs.map((l) => `${l.label} ${pct(l.cachedYesPrice)}`).join(" · ");
    lines.push(`- **${t(`${q.group} 组`, `Group ${q.group}`)}**: ${teams}`);
  });
  lines.push("");

  const poolSection = (q: Question | undefined, titleCn: string, titleEn: string): void => {
    if (!q) return;
    lines.push(t(titleCn, titleEn));
    lines.push("");
    lines.push(t("| # | 球队 | 缓存价 | market_slug |", "| # | Team | Cached | market_slug |"));
    lines.push("|---|---|---|---|");
    q.legs.forEach((l, i) => lines.push(`| ${i + 1} | ${l.label} | ${pct(l.cachedYesPrice)} | \`${l.marketSlug}\` |`));
    lines.push("");
  };
  poolSection(qf, "## 3. 八强名单（48 队，按缓存价排序）", "## 3. Quarterfinalists (48 teams, sorted by cached price)");
  poolSection(sf, "## 4. 四强名单（48 队）", "## 4. Semifinalists (48 teams)");
  poolSection(champ, "## 5. 冠军（48 队）", "## 5. Champion (48 teams)");

  lines.push(t(
    "---\n\n本清单提供基于公开数据的概率研究范围定义，不构成任何金融、投资或投注建议。",
    "---\n\nThis list defines the scope of a probability-research effort based on public data. It is not financial, investment, or betting advice."));
  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const snapshot = JSON.parse(await readFile(SNAPSHOT, "utf8")) as { markets: Market[] };
  const markets = snapshot.markets;

  const groupWinnerMarkets = markets.filter((m) => m.subtype === "group_winner");
  const teamGroup = buildTeamGroupMap(groupWinnerMarkets);

  const questions: Question[] = [
    ...buildMatchQuestions(markets, teamGroup),
    ...buildGroupWinnerQuestions(groupWinnerMarkets),
    buildPerTeamPool(
      markets.filter((m) => m.subtype === "reach_quarterfinals"),
      "world-cup-nation-to-reach-quarterfinals",
      "reach-qf",
      "reach_quarterfinal",
      "哪些球队进入八强（1/4 决赛，最后 8 队）？",
      "Which teams reach the quarterfinals (last 8)?"
    ),
    buildPerTeamPool(
      markets.filter((m) => m.subtype === "reach_semifinals"),
      "world-cup-nation-to-reach-semifinals",
      "reach-sf",
      "reach_semifinal",
      "哪些球队进入四强（半决赛，最后 4 队）？",
      "Which teams reach the semifinals (last 4)?"
    ),
    buildPerTeamPool(
      markets.filter((m) => m.subtype === "tournament_winner"),
      "world-cup-winner",
      "champion",
      "champion",
      "哪支球队赢得 2026 世界杯冠军？",
      "Which team wins the 2026 FIFA World Cup?"
    )
  ];

  const counts = questions.reduce<Record<string, number>>(
    (acc, q) => ({ ...acc, [q.family]: (acc[q.family] ?? 0) + 1 }),
    {}
  );
  const totalLegs = questions.reduce((n, q) => n + q.legs.length, 0);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, "questions.json"),
    JSON.stringify({ generatedAt, source: SNAPSHOT, counts, totalLegs, questions }, null, 2)
  );
  await writeFile(path.join(OUT_DIR, "event-list.md"), renderMarkdown(questions, "cn", generatedAt));
  await writeFile(path.join(OUT_DIR, "event-list.en.md"), renderMarkdown(questions, "en", generatedAt));

  console.log(`OK  ${questions.length} questions / ${totalLegs} legs`);
  console.log(`    by family: ${JSON.stringify(counts)}`);
  console.log(`    teams mapped to groups: ${teamGroup.size}`);
  console.log(`\nWrote:\n  ${path.join(OUT_DIR, "questions.json")}\n  ${path.join(OUT_DIR, "event-list.md")}\n  ${path.join(OUT_DIR, "event-list.en.md")}`);
}

main().catch((err) => {
  console.error("build-event-list failed:", err);
  process.exitCode = 1;
});
