// Derived conclusions for the /live-predict-raven review page.
//
// Every bullet under "结论与建议" used to be prose written by hand on a given
// review date, which went stale the moment the book moved (an August 5 note
// describing a −20% book was still on the page when the book was +5%). These
// rules recompute the same judgements from the current snapshot, so the
// section always describes the book being displayed. Each finding carries the
// numbers that triggered it — a reader can check the claim against the tables
// on the same page.
//
// Rules only DESCRIBE. Anything that would change agent behaviour (stop-loss
// rules, exposure caps, cooldowns) is emitted as a `proposal`, which the page
// renders as "needs the owner's sign-off" — risk parameters are never changed
// from here.

import type { DecisionEpisode, PaperSnapshot } from "./snapshot";
import { deriveEquityStats, deriveTradeStats } from "./stats";

export type FindingKind = "headline" | "strength" | "risk" | "proposal";

export interface Finding {
  /** Stable id so a finding can be linked to / suppressed without matching prose. */
  id: string;
  kind: FindingKind;
  title: string;
  body: string;
  /** The numbers behind the claim, shown as chips under the text. */
  metrics: ReadonlyArray<{ label: string; value: string }>;
}

const usd = (n: number): string =>
  `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const signedUsd = (n: number): string => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const pct1 = (n: number): string => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;

// Themes group markets that move together for the same real-world reason. The
// agent's own exposure cap works on Gamma event slugs, which is strictly
// narrower — "Hormuz reopening" and "US blockade ends" are different events but
// one bet on how the Iran confrontation resolves.
const THEMES: ReadonlyArray<{ id: string; label: string; test: RegExp }> = [
  { id: "iran", label: "伊朗 / 中东对抗", test: /iran|hormuz|blockade|ceasefire|nuclear|khamenei|tehran|offensive/i },
  { id: "israel", label: "以巴 / 加沙", test: /israel|hamas|gaza|disarm/i },
  { id: "russia", label: "俄乌 / 北约", test: /russia|putin|ukraine|nato|crimea/i },
  { id: "china", label: "台海 / 南海", test: /china|taiwan|philippines/i },
  { id: "macro", label: "市场 / 宏观", test: /nvidia|fed|rate|oil|wti|crude|market cap|company|stock/i }
];

function themeOf(text: string): { id: string; label: string } {
  for (const t of THEMES) {
    if (t.test.test(text)) return { id: t.id, label: t.label };
  }
  return { id: "other", label: "其他" };
}

interface Concentration {
  label: string;
  costUsd: number;
  sharePct: number;
  count: number;
}

function topTheme(snapshot: PaperSnapshot): Concentration | null {
  const totalCost = snapshot.openPositions.reduce((s, p) => s + p.shares * p.entryPrice, 0);
  if (totalCost <= 0) return null;
  const byTheme = new Map<string, { label: string; costUsd: number; count: number }>();
  for (const p of snapshot.openPositions) {
    const theme = themeOf(`${p.slug} ${p.question}`);
    const prev = byTheme.get(theme.id) ?? { label: theme.label, costUsd: 0, count: 0 };
    byTheme.set(theme.id, { label: theme.label, costUsd: prev.costUsd + p.shares * p.entryPrice, count: prev.count + 1 });
  }
  const top = [...byTheme.values()].sort((a, b) => b.costUsd - a.costUsd)[0];
  if (!top) return null;
  return { label: top.label, costUsd: top.costUsd, sharePct: (top.costUsd / totalCost) * 100, count: top.count };
}

/** Positions re-opened on a market that had already stopped us out. */
interface Reentry {
  slug: string;
  question: string;
  repeats: number;
  pnlUsd: number;
}

function stopLossReentries(episodes: readonly DecisionEpisode[]): Reentry[] {
  const bySlug = new Map<string, DecisionEpisode[]>();
  for (const e of episodes) {
    bySlug.set(e.slug, [...(bySlug.get(e.slug) ?? []), e]);
  }
  const out: Reentry[] = [];
  for (const [slug, all] of bySlug) {
    const ordered = [...all].sort((a, b) => (a.openedUtc < b.openedUtc ? -1 : 1));
    let stopped = false;
    let repeats = 0;
    let pnl = 0;
    for (const e of ordered) {
      if (stopped) {
        repeats += 1;
        pnl += e.pnlUsd ?? 0;
      }
      if (e.exitReason === "stop_loss") stopped = true;
    }
    if (repeats > 0) {
      out.push({ slug, question: ordered[0]?.question ?? slug, repeats, pnlUsd: pnl });
    }
  }
  return out.sort((a, b) => a.pnlUsd - b.pnlUsd);
}

/** Stop-losses that fired on a cheap contract which then recovered above the exit. */
function stopLossWhipsaws(episodes: readonly DecisionEpisode[], maxEntryPrice: number): DecisionEpisode[] {
  return episodes.filter(
    (e) =>
      e.exitReason === "stop_loss" &&
      e.entryPrice <= maxEntryPrice &&
      e.benchmarkPrice !== null &&
      e.exitPrice !== null &&
      e.benchmarkPrice > e.exitPrice
  );
}

export function deriveFindings(snapshot: PaperSnapshot): Finding[] {
  const findings: Finding[] = [];
  const trade = deriveTradeStats(snapshot.closedTrades);
  const equity = deriveEquityStats(snapshot.equityCurve, snapshot.bankrollUsd);
  const dq = snapshot.decisionQuality;
  const episodes = dq?.episodes ?? [];
  const unrealized = snapshot.openPositions.reduce((s, p) => s + p.unrealizedUsd, 0);

  // ---- 1. Where the current number comes from ----------------------------
  findings.push({
    id: "pnl-composition",
    kind: "headline",
    title: `本金 ${usd(snapshot.bankrollUsd)} → 权益 ${usd(snapshot.equityUsd)}（${pct1(equity.returnPct)}）`,
    body: dq
      ? `已实现 ${signedUsd(snapshot.realizedPnlUsd)}（${trade.closedCount} 个已平仓回合，${trade.wins} 胜 ${trade.losses} 负），未实现 ${signedUsd(unrealized)}（${snapshot.openPositions.length} 个在持仓）。` +
        `按决策拆分：建仓贡献 ${signedUsd(dq.entry.totalUsd)}，退出贡献 ${signedUsd(dq.exit.totalUsd)}——` +
        (dq.entry.totalUsd > 0 && dq.exit.totalUsd < 0
          ? "选标的赚的钱，被提前退出还回去一部分。"
          : dq.entry.totalUsd < 0 && dq.exit.totalUsd > 0
            ? "建仓整体亏钱，靠退出（主要是止损）救回一部分。"
            : "两个环节同向。")
      : `已实现 ${signedUsd(snapshot.realizedPnlUsd)}，未实现 ${signedUsd(unrealized)}。`,
    metrics: [
      { label: "最大回撤", value: pct1(equity.maxDrawdownPct) },
      { label: "峰值", value: `${usd(equity.peakUsd)}（${equity.peakDate}）` },
      { label: "胜率", value: `${trade.winRatePct.toFixed(0)}%` },
      { label: "累计费用", value: usd(snapshot.feesUsd) }
    ]
  });

  // ---- 2. Which of the two decisions is working --------------------------
  if (dq) {
    const entryStrong = dq.entry.totalUsd > 0;
    const worstExits = [...episodes]
      .filter((e) => e.exitAlphaUsd !== null && e.exitAlphaUsd < 0)
      .sort((a, b) => (a.exitAlphaUsd ?? 0) - (b.exitAlphaUsd ?? 0))
      .slice(0, 2);
    const bestEntries = [...episodes]
      .filter((e) => e.entryAlphaUsd !== null)
      .sort((a, b) => (b.entryAlphaUsd ?? 0) - (a.entryAlphaUsd ?? 0))
      .slice(0, 2);
    findings.push({
      id: "entry-quality",
      kind: entryStrong ? "strength" : "risk",
      title: `建仓质量：${signedUsd(dq.entry.totalUsd)}`,
      body:
        `把每个仓位假设「买了就一直持有到结算/现在」，累计 ${signedUsd(dq.entry.totalUsd)}` +
        `（在持部分 ${signedUsd(dq.entry.openUsd)}，已平部分 ${signedUsd(dq.entry.closedUsd)}）。` +
        (bestEntries.length > 0
          ? `最好的两笔建仓：${bestEntries
              .map((e) => `${e.question}（${signedUsd(e.entryAlphaUsd ?? 0)}）`)
              .join("、")}。`
          : ""),
      metrics: [
        { label: "在持贡献", value: signedUsd(dq.entry.openUsd) },
        { label: "已平贡献", value: signedUsd(dq.entry.closedUsd) },
        { label: "计入仓位", value: `${dq.entry.scored} 个` }
      ]
    });
    findings.push({
      id: "exit-quality",
      kind: dq.exit.totalUsd >= 0 ? "strength" : "risk",
      title: `退出质量：${signedUsd(dq.exit.totalUsd)}`,
      body:
        `退出决定相对「不卖」的净增减。${dq.exit.totalUsd >= 0 ? "整体加分。" : "整体减分。"}` +
        (worstExits.length > 0
          ? `代价最大的两次提前退出：${worstExits
              .map((e) => `${e.question}（${signedUsd(e.exitAlphaUsd ?? 0)}，${e.exitReason === "stop_loss" ? "止损" : "负边际"}）`)
              .join("、")}。`
          : ""),
      metrics: [
        { label: "可评分退出", value: `${dq.exit.scored} 次` },
        ...(dq.exit.unscored > 0 ? [{ label: "无基准价", value: `${dq.exit.unscored} 次` }] : []),
        {
          label: "账目校验",
          value:
            Math.abs(dq.reconciliation.deltaUsd) < 1
              ? "已平仓合计与账本一致"
              : `与账本差 ${signedUsd(dq.reconciliation.deltaUsd)}`
        }
      ]
    });
  }

  // ---- 3. Calibration, read honestly -------------------------------------
  const horizon = snapshot.brier.horizon;
  const clusters = snapshot.brier.clusters;
  const pendingCount = snapshot.brier.pending.length;
  if (snapshot.brier.n > 0) {
    const beatsAnywhere = horizon?.buckets.filter((b) => (b.skill ?? -1) > 0) ?? [];
    findings.push({
      id: "calibration",
      kind: (snapshot.brier.skillScore ?? 0) >= 0 ? "strength" : "risk",
      title: `校准：技巧分 ${snapshot.brier.skillScore.toFixed(2)}（n=${snapshot.brier.n}${
        clusters ? `，独立事件 ${clusters.effectiveN} 个` : ""
      }）`,
      body:
        `agent Brier ${snapshot.brier.agentScore.toFixed(3)} vs 市场 ${snapshot.brier.marketScore.toFixed(3)}，` +
        `>0 才算跑赢市场。这个数字只覆盖已结算市场——${pendingCount} 个已评估但未结算的市场（含目前浮盈最大的几个仓位）完全不在里面，` +
        `它们的表现体现在上面的建仓质量里。` +
        (horizon?.atEntry && horizon.atLast
          ? `按「什么时候做的判断」分开看：首次判断（中位 ${(horizon.atEntry.medianHorizonDays ?? 0).toFixed(0)} 天前）技巧分 ${(horizon.atEntry.skill ?? 0).toFixed(2)}，临近结算的最后一次 ${(horizon.atLast.skill ?? 0).toFixed(2)}。`
          : "") +
        (beatsAnywhere.length > 0
          ? `在 ${beatsAnywhere.map((b) => b.label).join(" / ")} 这个跨度上是跑赢市场的（技巧分 ${beatsAnywhere
              .map((b) => (b.skill ?? 0).toFixed(2))
              .join(" / ")}）。`
          : ""),
      metrics: [
        ...(horizon?.weighted?.skill !== undefined && horizon?.weighted?.skill !== null
          ? [{ label: `按天数^${horizon.weighted.exponent} 加权`, value: horizon.weighted.skill.toFixed(2) }]
          : []),
        { label: "未结算市场", value: `${pendingCount} 个` },
        ...(clusters ? [{ label: "有效样本", value: `${clusters.effectiveN} 个独立事件 / ${snapshot.brier.n} 条` }] : [])
      ]
    });
  }

  // ---- 4. Concentration ---------------------------------------------------
  const concentration = topTheme(snapshot);
  if (concentration && concentration.sharePct >= 40) {
    const sides = new Set(snapshot.openPositions.map((p) => p.side));
    findings.push({
      id: "theme-concentration",
      kind: "risk",
      title: `题材集中：${concentration.label}占在持成本 ${concentration.sharePct.toFixed(0)}%`,
      body:
        `${concentration.count} 个在持仓共享同一个宏观驱动，成本 ${usd(concentration.costUsd)}。` +
        (sides.size === 1 ? `而且全部 ${snapshot.openPositions.length} 个仓位方向一致（都是 ${[...sides][0]}）。` : "") +
        `事件级上限（maxPerEvent=${snapshot.config.maxPerEvent}）按 Gamma 事件切分，挡不住「同一个故事、不同市场」的叠加暴露。`,
      metrics: [
        { label: "同题材仓位", value: `${concentration.count} / ${snapshot.openPositions.length}` },
        { label: "同题材成本", value: usd(concentration.costUsd) },
        { label: "仓位占用", value: `${snapshot.openPositions.length} / ${snapshot.config.maxPositions}` }
      ]
    });
    findings.push({
      id: "proposal-theme-cap",
      kind: "proposal",
      title: "建议：加一层题材级敞口上限",
      body: `在事件级 maxPerEvent 之上，按题材（而非 Gamma 事件）限制总成本占比。这是风控参数改动，需你确认后才写入 env。`,
      metrics: [{ label: "当前最高题材占比", value: `${concentration.sharePct.toFixed(0)}%` }]
    });
  }

  // ---- 5. Stop-loss behaviour --------------------------------------------
  const reentries = stopLossReentries(episodes);
  if (reentries.length > 0) {
    const totalRepeat = reentries.reduce((s, r) => s + r.pnlUsd, 0);
    findings.push({
      id: "stop-loss-reentry",
      kind: totalRepeat < 0 ? "risk" : "strength",
      title: `止损后重进同一市场：${reentries.length} 个市场，合计 ${signedUsd(totalRepeat)}`,
      body:
        `止损平掉后又在同一个 slug 上重新建仓，累计 ${reentries.reduce((s, r) => s + r.repeats, 0)} 次。` +
        `最贵的是 ${reentries[0]?.question}（${signedUsd(reentries[0]?.pnlUsd ?? 0)}）。` +
        (totalRepeat < 0
          ? "没有冷却期，同一个判断错误会被重复下注。"
          : "重进整体是赚的——冷却期若一刀切会误伤这类修正。"),
      metrics: reentries.slice(0, 3).map((r) => ({ label: r.question, value: signedUsd(r.pnlUsd) }))
    });
    if (totalRepeat < 0) {
      findings.push({
        id: "proposal-cooldown",
        kind: "proposal",
        title: "建议：止损后对同市场设冷却期",
        body: "止损平仓后，同一 slug（或同一事件）在 N 小时内不得重新建仓。属于风控参数，需你确认。",
        metrics: [{ label: "当前代价", value: signedUsd(totalRepeat) }]
      });
    }
  }

  const whipsaws = stopLossWhipsaws(episodes, 0.35);
  if (whipsaws.length > 0) {
    const cost = whipsaws.reduce((s, e) => s + (e.exitAlphaUsd ?? 0), 0);
    findings.push({
      id: "stop-loss-lowprice",
      kind: "risk",
      title: `低价合约止损被打脸：${whipsaws.length} 笔，退出贡献 ${signedUsd(cost)}`,
      body:
        `入场价 ≤ $0.35 的仓位触发 ${(snapshot.config.stopLossPct * 100).toFixed(0)}% 价格止损后，该合约价格又回到了卖出价之上。` +
        `低价合约本身波动就大，固定百分比回撤对它过于敏感。典型例子：${whipsaws[0]?.question}（入场 $${whipsaws[0]?.entryPrice.toFixed(2)}，卖在 $${(whipsaws[0]?.exitPrice ?? 0).toFixed(2)}，现值 $${(whipsaws[0]?.benchmarkPrice ?? 0).toFixed(2)}）。`,
      metrics: whipsaws.slice(0, 3).map((e) => ({ label: e.question, value: signedUsd(e.exitAlphaUsd ?? 0) }))
    });
    findings.push({
      id: "proposal-stop-loss-sizing",
      kind: "proposal",
      title: "建议：止损规则按合约价位分档，或对低价单缩仓而非收紧止损",
      body: "把纯价格回撤止损改为「剩余净 edge 转负才退出」，或对 $0.35 以下的合约降低单笔金额。风控参数改动，需你确认。",
      metrics: [{ label: "受影响笔数", value: `${whipsaws.length} 笔` }]
    });
  }

  // ---- 6. Engine health ---------------------------------------------------
  const q = snapshot.engineQuality;
  if (q.evaluations > 0) {
    const satPct = (q.saturated / q.evaluations) * 100;
    if (satPct >= 40) {
      findings.push({
        id: "engine-saturation",
        kind: "risk",
        title: `引擎饱和率 ${satPct.toFixed(0)}%`,
        body:
          `${q.saturated} / ${q.evaluations} 次评估的概率打到 1% / 99% 钳位。钳位状态下算出的 edge 只是下限，` +
          `临近结算时市场能给出 0.995 这类精细报价，而 agent 最多说 0.99——这正是短跨度技巧分被拖累的机制原因，不完全是判断错。` +
          `${snapshot.saturatedHolds} 次因此触发「饱和持有」保护，避免把接近满值的赢家提前卖掉。`,
        metrics: [
          { label: "饱和", value: `${q.saturated} 次` },
          { label: "市场价污染", value: `${q.contaminated} 次` },
          { label: "评估失败", value: `${q.evalErrors} 次（安全默认持有）` }
        ]
      });
    }
  }

  return findings;
}
