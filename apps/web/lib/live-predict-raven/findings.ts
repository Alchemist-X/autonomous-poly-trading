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
//
// Every sentence is emitted in the requested language (zh is the source of
// truth and stays byte-identical to the original Chinese-only page).

import type { Lang } from "./i18n";
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

const usd = (n: number): string => `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const signedUsd = (n: number): string => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const pct1 = (n: number): string => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;

// Themes group markets that move together for the same real-world reason. The
// agent's own exposure cap works on Gamma event slugs, which is strictly
// narrower — "Hormuz reopening" and "US blockade ends" are different events but
// one bet on how the Iran confrontation resolves.
const THEMES: ReadonlyArray<{ id: string; label: { zh: string; en: string }; test: RegExp }> = [
  {
    id: "iran",
    label: { zh: "伊朗 / 中东对抗", en: "Iran / Mideast standoff" },
    test: /iran|hormuz|blockade|ceasefire|nuclear|khamenei|tehran|offensive/i
  },
  { id: "israel", label: { zh: "以巴 / 加沙", en: "Israel–Gaza" }, test: /israel|hamas|gaza|disarm/i },
  {
    id: "russia",
    label: { zh: "俄乌 / 北约", en: "Russia–Ukraine / NATO" },
    test: /russia|putin|ukraine|nato|crimea/i
  },
  { id: "china", label: { zh: "台海 / 南海", en: "Taiwan / South China Sea" }, test: /china|taiwan|philippines/i },
  {
    id: "macro",
    label: { zh: "市场 / 宏观", en: "Markets / macro" },
    test: /nvidia|fed|rate|oil|wti|crude|market cap|company|stock/i
  }
];

function themeOf(text: string, lang: Lang): { id: string; label: string } {
  for (const t of THEMES) {
    if (t.test.test(text)) return { id: t.id, label: t.label[lang] };
  }
  return { id: "other", label: lang === "zh" ? "其他" : "Other" };
}

interface Concentration {
  label: string;
  costUsd: number;
  sharePct: number;
  count: number;
}

function topTheme(snapshot: PaperSnapshot, lang: Lang): Concentration | null {
  const totalCost = snapshot.openPositions.reduce((s, p) => s + p.shares * p.entryPrice, 0);
  if (totalCost <= 0) return null;
  const byTheme = new Map<string, { label: string; costUsd: number; count: number }>();
  for (const p of snapshot.openPositions) {
    const theme = themeOf(`${p.slug} ${p.question}`, lang);
    const prev = byTheme.get(theme.id) ?? { label: theme.label, costUsd: 0, count: 0 };
    byTheme.set(theme.id, {
      label: theme.label,
      costUsd: prev.costUsd + p.shares * p.entryPrice,
      count: prev.count + 1
    });
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

export function deriveFindings(snapshot: PaperSnapshot, lang: Lang = "zh"): Finding[] {
  const zh = lang === "zh";
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
    title: zh
      ? `本金 ${usd(snapshot.bankrollUsd)} → 权益 ${usd(snapshot.equityUsd)}（${pct1(equity.returnPct)}）`
      : `Bankroll ${usd(snapshot.bankrollUsd)} → equity ${usd(snapshot.equityUsd)} (${pct1(equity.returnPct)})`,
    body: dq
      ? zh
        ? `已实现 ${signedUsd(snapshot.realizedPnlUsd)}（${trade.closedCount} 个已平仓回合，${trade.wins} 胜 ${trade.losses} 负），未实现 ${signedUsd(unrealized)}（${snapshot.openPositions.length} 个在持仓）。` +
          `按决策拆分：建仓贡献 ${signedUsd(dq.entry.totalUsd)}，退出贡献 ${signedUsd(dq.exit.totalUsd)}——` +
          (dq.entry.totalUsd > 0 && dq.exit.totalUsd < 0
            ? "选标的赚的钱，被提前退出还回去一部分。"
            : dq.entry.totalUsd < 0 && dq.exit.totalUsd > 0
              ? "建仓整体亏钱，靠退出（主要是止损）救回一部分。"
              : "两个环节同向。")
        : `Realized ${signedUsd(snapshot.realizedPnlUsd)} (${trade.closedCount} closed round trips, ${trade.wins}W ${trade.losses}L), unrealized ${signedUsd(unrealized)} (${snapshot.openPositions.length} open positions). ` +
          `Split by decision: entries contributed ${signedUsd(dq.entry.totalUsd)}, exits ${signedUsd(dq.exit.totalUsd)} — ` +
          (dq.entry.totalUsd > 0 && dq.exit.totalUsd < 0
            ? "market picking makes money; early exits hand part of it back."
            : dq.entry.totalUsd < 0 && dq.exit.totalUsd > 0
              ? "entries lose money overall; exits (mostly stops) claw some back."
              : "both legs point the same way.")
      : zh
        ? `已实现 ${signedUsd(snapshot.realizedPnlUsd)}，未实现 ${signedUsd(unrealized)}。`
        : `Realized ${signedUsd(snapshot.realizedPnlUsd)}, unrealized ${signedUsd(unrealized)}.`,
    metrics: [
      { label: zh ? "最大回撤" : "Max drawdown", value: pct1(equity.maxDrawdownPct) },
      {
        label: zh ? "峰值" : "Peak",
        value: zh ? `${usd(equity.peakUsd)}（${equity.peakDate}）` : `${usd(equity.peakUsd)} (${equity.peakDate})`
      },
      { label: zh ? "胜率" : "Win rate", value: `${trade.winRatePct.toFixed(0)}%` },
      { label: zh ? "累计费用" : "Total fees", value: usd(snapshot.feesUsd) }
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
      title: zh ? `建仓质量：${signedUsd(dq.entry.totalUsd)}` : `Entry quality: ${signedUsd(dq.entry.totalUsd)}`,
      body: zh
        ? `把每个仓位假设「买了就一直持有到结算/现在」，累计 ${signedUsd(dq.entry.totalUsd)}` +
          `（在持部分 ${signedUsd(dq.entry.openUsd)}，已平部分 ${signedUsd(dq.entry.closedUsd)}）。` +
          (bestEntries.length > 0
            ? `最好的两笔建仓：${bestEntries
                .map((e) => `${e.question}（${signedUsd(e.entryAlphaUsd ?? 0)}）`)
                .join("、")}。`
            : "")
        : `Treat every position as bought and held to settlement/now: ${signedUsd(dq.entry.totalUsd)} cumulative ` +
          `(open leg ${signedUsd(dq.entry.openUsd)}, closed leg ${signedUsd(dq.entry.closedUsd)}). ` +
          (bestEntries.length > 0
            ? `Best two entries: ${bestEntries
                .map((e) => `${e.question} (${signedUsd(e.entryAlphaUsd ?? 0)})`)
                .join(", ")}.`
            : ""),
      metrics: [
        { label: zh ? "在持贡献" : "Open leg", value: signedUsd(dq.entry.openUsd) },
        { label: zh ? "已平贡献" : "Closed leg", value: signedUsd(dq.entry.closedUsd) },
        { label: zh ? "计入仓位" : "Positions scored", value: zh ? `${dq.entry.scored} 个` : `${dq.entry.scored}` }
      ]
    });
    findings.push({
      id: "exit-quality",
      kind: dq.exit.totalUsd >= 0 ? "strength" : "risk",
      title: zh ? `退出质量：${signedUsd(dq.exit.totalUsd)}` : `Exit quality: ${signedUsd(dq.exit.totalUsd)}`,
      body: zh
        ? `退出决定相对「不卖」的净增减。${dq.exit.totalUsd >= 0 ? "整体加分。" : "整体减分。"}` +
          (worstExits.length > 0
            ? `代价最大的两次提前退出：${worstExits
                .map(
                  (e) =>
                    `${e.question}（${signedUsd(e.exitAlphaUsd ?? 0)}，${e.exitReason === "stop_loss" ? "止损" : "负边际"}）`
                )
                .join("、")}。`
            : "")
        : `Net effect of exit calls vs. never selling. ${dq.exit.totalUsd >= 0 ? "Net positive." : "Net negative."} ` +
          (worstExits.length > 0
            ? `Costliest two early exits: ${worstExits
                .map(
                  (e) =>
                    `${e.question} (${signedUsd(e.exitAlphaUsd ?? 0)}, ${e.exitReason === "stop_loss" ? "stop-loss" : "negative edge"})`
                )
                .join(", ")}.`
            : ""),
      metrics: [
        { label: zh ? "可评分退出" : "Scored exits", value: zh ? `${dq.exit.scored} 次` : `${dq.exit.scored}` },
        ...(dq.exit.unscored > 0
          ? [{ label: zh ? "无基准价" : "No benchmark", value: zh ? `${dq.exit.unscored} 次` : `${dq.exit.unscored}` }]
          : []),
        {
          label: zh ? "账目校验" : "Reconciliation",
          value:
            Math.abs(dq.reconciliation.deltaUsd) < 1
              ? zh
                ? "已平仓合计与账本一致"
                : "closed total matches the ledger"
              : zh
                ? `与账本差 ${signedUsd(dq.reconciliation.deltaUsd)}`
                : `${signedUsd(dq.reconciliation.deltaUsd)} off the ledger`
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
      title: zh
        ? `校准：技巧分 ${snapshot.brier.skillScore.toFixed(2)}（n=${snapshot.brier.n}${
            clusters ? `，独立事件 ${clusters.effectiveN} 个` : ""
          }）`
        : `Calibration: skill ${snapshot.brier.skillScore.toFixed(2)} (n=${snapshot.brier.n}${
            clusters ? `, ${clusters.effectiveN} independent events` : ""
          })`,
      body: zh
        ? `agent Brier ${snapshot.brier.agentScore.toFixed(3)} vs 市场 ${snapshot.brier.marketScore.toFixed(3)}，` +
          `>0 才算跑赢市场。这个数字只覆盖已结算市场——${pendingCount} 个已评估但未结算的市场（含目前浮盈最大的几个仓位）完全不在里面，` +
          `它们的表现体现在上面的建仓质量里。` +
          (horizon?.atEntry && horizon.atLast
            ? `按「什么时候做的判断」分开看：首次判断（中位 ${(horizon.atEntry.medianHorizonDays ?? 0).toFixed(0)} 天前）技巧分 ${(horizon.atEntry.skill ?? 0).toFixed(2)}，临近结算的最后一次 ${(horizon.atLast.skill ?? 0).toFixed(2)}。`
            : "") +
          (beatsAnywhere.length > 0
            ? `在 ${beatsAnywhere.map((b) => b.label).join(" / ")} 这个跨度上是跑赢市场的（技巧分 ${beatsAnywhere
                .map((b) => (b.skill ?? 0).toFixed(2))
                .join(" / ")}）。`
            : "")
        : `Agent Brier ${snapshot.brier.agentScore.toFixed(3)} vs market ${snapshot.brier.marketScore.toFixed(3)}; ` +
          `only >0 beats the market. Settled markets only — ${pendingCount} evaluated-but-unsettled markets (including the biggest unrealized winners) are entirely absent; ` +
          `their performance shows up in entry quality above. ` +
          (horizon?.atEntry && horizon.atLast
            ? `Split by when the call was made: first call (median ${(horizon.atEntry.medianHorizonDays ?? 0).toFixed(0)} days out) skill ${(horizon.atEntry.skill ?? 0).toFixed(2)}, final pre-settlement call ${(horizon.atLast.skill ?? 0).toFixed(2)}. `
            : "") +
          (beatsAnywhere.length > 0
            ? `Beats the market at ${beatsAnywhere.map((b) => b.label).join(" / ")} (skill ${beatsAnywhere
                .map((b) => (b.skill ?? 0).toFixed(2))
                .join(" / ")}).`
            : ""),
      metrics: [
        ...(horizon?.weighted?.skill !== undefined && horizon?.weighted?.skill !== null
          ? [
              {
                label: zh ? `按天数^${horizon.weighted.exponent} 加权` : `days^${horizon.weighted.exponent}-weighted`,
                value: horizon.weighted.skill.toFixed(2)
              }
            ]
          : []),
        { label: zh ? "未结算市场" : "Unsettled markets", value: zh ? `${pendingCount} 个` : `${pendingCount}` },
        ...(clusters
          ? [
              {
                label: zh ? "有效样本" : "Effective sample",
                value: zh
                  ? `${clusters.effectiveN} 个独立事件 / ${snapshot.brier.n} 条`
                  : `${clusters.effectiveN} events / ${snapshot.brier.n} rows`
              }
            ]
          : [])
      ]
    });
  }

  // ---- 4. Concentration ---------------------------------------------------
  const concentration = topTheme(snapshot, lang);
  if (concentration && concentration.sharePct >= 40) {
    const sides = new Set(snapshot.openPositions.map((p) => p.side));
    findings.push({
      id: "theme-concentration",
      kind: "risk",
      title: zh
        ? `题材集中：${concentration.label}占在持成本 ${concentration.sharePct.toFixed(0)}%`
        : `Theme concentration: ${concentration.label} is ${concentration.sharePct.toFixed(0)}% of open cost`,
      body: zh
        ? `${concentration.count} 个在持仓共享同一个宏观驱动，成本 ${usd(concentration.costUsd)}。` +
          (sides.size === 1
            ? `而且全部 ${snapshot.openPositions.length} 个仓位方向一致（都是 ${[...sides][0]}）。`
            : "") +
          `事件级上限（maxPerEvent=${snapshot.config.maxPerEvent}）按 Gamma 事件切分，挡不住「同一个故事、不同市场」的叠加暴露。`
        : `${concentration.count} open positions share one macro driver, ${usd(concentration.costUsd)} of cost. ` +
          (sides.size === 1
            ? `All ${snapshot.openPositions.length} positions point the same way (${[...sides][0]}). `
            : "") +
          `The event-level cap (maxPerEvent=${snapshot.config.maxPerEvent}) cuts along Gamma events and cannot stop "same story, different market" stacking.`,
      metrics: [
        {
          label: zh ? "同题材仓位" : "Same-theme positions",
          value: `${concentration.count} / ${snapshot.openPositions.length}`
        },
        { label: zh ? "同题材成本" : "Same-theme cost", value: usd(concentration.costUsd) },
        {
          label: zh ? "仓位占用" : "Slots used",
          value: `${snapshot.openPositions.length} / ${snapshot.config.maxPositions}`
        }
      ]
    });
    findings.push({
      id: "proposal-theme-cap",
      kind: "proposal",
      title: zh ? "建议：加一层题材级敞口上限" : "Proposal: add a theme-level exposure cap",
      body: zh
        ? `在事件级 maxPerEvent 之上，按题材（而非 Gamma 事件）限制总成本占比。这是风控参数改动，需你确认后才写入 env。`
        : `On top of the event-level maxPerEvent, cap total cost share by theme rather than Gamma event. Risk-parameter change — written to env only after you confirm.`,
      metrics: [
        {
          label: zh ? "当前最高题材占比" : "Top theme share",
          value: `${concentration.sharePct.toFixed(0)}%`
        }
      ]
    });
  }

  // ---- 5. Stop-loss behaviour --------------------------------------------
  const reentries = stopLossReentries(episodes);
  if (reentries.length > 0) {
    const totalRepeat = reentries.reduce((s, r) => s + r.pnlUsd, 0);
    findings.push({
      id: "stop-loss-reentry",
      kind: totalRepeat < 0 ? "risk" : "strength",
      title: zh
        ? `止损后重进同一市场：${reentries.length} 个市场，合计 ${signedUsd(totalRepeat)}`
        : `Re-entries after a stop: ${reentries.length} markets, ${signedUsd(totalRepeat)} combined`,
      body: zh
        ? `止损平掉后又在同一个 slug 上重新建仓，累计 ${reentries.reduce((s, r) => s + r.repeats, 0)} 次。` +
          `最贵的是 ${reentries[0]?.question}（${signedUsd(reentries[0]?.pnlUsd ?? 0)}）。` +
          (totalRepeat < 0
            ? "没有冷却期，同一个判断错误会被重复下注。"
            : "重进整体是赚的——冷却期若一刀切会误伤这类修正。")
        : `After a stop-loss close the same slug was re-entered ${reentries.reduce((s, r) => s + r.repeats, 0)} times in total. ` +
          `Costliest: ${reentries[0]?.question} (${signedUsd(reentries[0]?.pnlUsd ?? 0)}). ` +
          (totalRepeat < 0
            ? "No cooldown — the same wrong call gets bet again."
            : "Re-entries are net profitable — a blanket cooldown would kill these corrections too."),
      metrics: reentries.slice(0, 3).map((r) => ({ label: r.question, value: signedUsd(r.pnlUsd) }))
    });
    if (totalRepeat < 0) {
      findings.push({
        id: "proposal-cooldown",
        kind: "proposal",
        title: zh ? "建议：止损后对同市场设冷却期" : "Proposal: cooldown on a market after a stop-loss",
        body: zh
          ? "止损平仓后，同一 slug（或同一事件）在 N 小时内不得重新建仓。属于风控参数，需你确认。"
          : "After a stop-loss exit, block re-entry on the same slug (or event) for N hours. Risk parameter — needs your confirmation.",
        metrics: [{ label: zh ? "当前代价" : "Current cost", value: signedUsd(totalRepeat) }]
      });
    }
  }

  const whipsaws = stopLossWhipsaws(episodes, 0.35);
  if (whipsaws.length > 0) {
    const cost = whipsaws.reduce((s, e) => s + (e.exitAlphaUsd ?? 0), 0);
    findings.push({
      id: "stop-loss-lowprice",
      kind: "risk",
      title: zh
        ? `低价合约止损被打脸：${whipsaws.length} 笔，退出贡献 ${signedUsd(cost)}`
        : `Whipsawed stops on cheap contracts: ${whipsaws.length} trades, ${signedUsd(cost)} exit contribution`,
      body: zh
        ? `入场价 ≤ $0.35 的仓位触发 ${(snapshot.config.stopLossPct * 100).toFixed(0)}% 价格止损后，该合约价格又回到了卖出价之上。` +
          `低价合约本身波动就大，固定百分比回撤对它过于敏感。典型例子：${whipsaws[0]?.question}（入场 $${whipsaws[0]?.entryPrice.toFixed(2)}，卖在 $${(whipsaws[0]?.exitPrice ?? 0).toFixed(2)}，现值 $${(whipsaws[0]?.benchmarkPrice ?? 0).toFixed(2)}）。`
        : `Positions entered at ≤ $0.35 hit the ${(snapshot.config.stopLossPct * 100).toFixed(0)}% price stop, then the contract recovered above the exit. ` +
          `Cheap contracts are volatile by nature; a fixed-percentage drawdown is too twitchy for them. Typical: ${whipsaws[0]?.question} (entered $${whipsaws[0]?.entryPrice.toFixed(2)}, sold $${(whipsaws[0]?.exitPrice ?? 0).toFixed(2)}, now $${(whipsaws[0]?.benchmarkPrice ?? 0).toFixed(2)}).`,
      metrics: whipsaws.slice(0, 3).map((e) => ({ label: e.question, value: signedUsd(e.exitAlphaUsd ?? 0) }))
    });
    findings.push({
      id: "proposal-stop-loss-sizing",
      kind: "proposal",
      title: zh
        ? "建议：止损规则按合约价位分档，或对低价单缩仓而非收紧止损"
        : "Proposal: tier the stop rule by contract price, or downsize cheap entries instead of tightening stops",
      body: zh
        ? "把纯价格回撤止损改为「剩余净 edge 转负才退出」，或对 $0.35 以下的合约降低单笔金额。风控参数改动，需你确认。"
        : "Replace the pure price-drawdown stop with 'exit only when remaining net edge turns negative', or cut position size below $0.35. Risk-parameter change — needs your confirmation.",
      metrics: [
        { label: zh ? "受影响笔数" : "Trades affected", value: zh ? `${whipsaws.length} 笔` : `${whipsaws.length}` }
      ]
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
        title: zh ? `引擎饱和率 ${satPct.toFixed(0)}%` : `Engine saturation ${satPct.toFixed(0)}%`,
        body: zh
          ? `${q.saturated} / ${q.evaluations} 次评估的概率打到 1% / 99% 钳位。钳位状态下算出的 edge 只是下限，` +
            `临近结算时市场能给出 0.995 这类精细报价，而 agent 最多说 0.99——这正是短跨度技巧分被拖累的机制原因，不完全是判断错。` +
            `${snapshot.saturatedHolds} 次因此触发「饱和持有」保护，避免把接近满值的赢家提前卖掉。`
          : `${q.saturated} of ${q.evaluations} evaluations pinned at the 1% / 99% clamp. A clamped edge is only a floor; ` +
            `near settlement the market quotes 0.995-grade precision while the agent tops out at 0.99 — that mechanism, not pure misjudgment, is what drags the short-horizon skill score. ` +
            `It also fired the saturated-hold guard ${snapshot.saturatedHolds} times, keeping near-full-value winners from being sold early.`,
        metrics: [
          { label: zh ? "饱和" : "Saturated", value: zh ? `${q.saturated} 次` : `${q.saturated}` },
          {
            label: zh ? "市场价污染" : "Price contamination",
            value: zh ? `${q.contaminated} 次` : `${q.contaminated}`
          },
          {
            label: zh ? "评估失败" : "Eval errors",
            value: zh ? `${q.evalErrors} 次（安全默认持有）` : `${q.evalErrors} (fail-safe hold)`
          }
        ]
      });
    }
  }

  return findings;
}
