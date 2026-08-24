import type { Lang } from "../../lib/live-predict-raven/i18n";
import type {
  BrierRow,
  ClosedTrade,
  EquityPoint,
  ExitAlphaRow,
  OpenPosition,
  PaperParams
} from "../../lib/live-predict-raven/snapshot";
import { fmtPrice, fmtProb, fmtSignedUsd, fmtUsd } from "./format";
import styles from "./report.module.css";

const EXIT_REASON_LABEL: Record<Lang, Record<string, string>> = {
  zh: {
    negative_edge: "负 edge 退出",
    stop_loss: "止损",
    settled_won: "持有到结算 ✓ 赢",
    settled_lost: "持有到结算 ✗ 输",
    settled_voided: "结算作废（退 $0.50）"
  },
  en: {
    negative_edge: "negative-edge exit",
    stop_loss: "stop-loss",
    settled_won: "held to settlement ✓ won",
    settled_lost: "held to settlement ✗ lost",
    settled_voided: "voided (refund $0.50)"
  }
};

function PnlCell({ value }: { value: number }) {
  const tone = value > 0 ? styles.pos : value < 0 ? styles.neg : undefined;
  return <td className={`${styles.num} ${tone ?? ""}`}>{fmtSignedUsd(value)}</td>;
}

export function ClosedTradesTable({ trades, lang }: { trades: readonly ClosedTrade[]; lang: Lang }) {
  const zh = lang === "zh";
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{zh ? "市场" : "Market"}</th>
            <th scope="col">{zh ? "方向" : "Side"}</th>
            <th scope="col" className={styles.num}>
              {zh ? "入场" : "Entry"}
            </th>
            <th scope="col" className={styles.num}>
              {zh ? "出场" : "Exit"}
            </th>
            <th scope="col" className={styles.num}>
              {zh ? "盈亏" : "PnL"}
            </th>
            <th scope="col" className={styles.num}>
              {zh ? "收益率" : "Return"}
            </th>
            <th scope="col">{zh ? "退出原因" : "Exit reason"}</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={`${t.slug}-${t.openedUtc}`}>
              <td>
                {t.question}
                {t.note ? <span className={styles.rowNote}>{t.note}</span> : null}
              </td>
              <td>{t.side}</td>
              <td className={styles.num}>{fmtPrice(t.entryPrice)}</td>
              <td className={styles.num}>{fmtPrice(t.exitPrice)}</td>
              <PnlCell value={t.pnlUsd} />
              <td className={`${styles.num} ${t.pnlUsd > 0 ? styles.pos : styles.neg}`}>
                {`${t.pnlUsd > 0 ? "+" : "-"}${Math.abs((t.pnlUsd / t.costUsd) * 100).toFixed(1)}%`}
              </td>
              <td>{EXIT_REASON_LABEL[lang][t.exitReason] ?? t.exitReason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FLAG_LABEL: Record<Lang, Record<NonNullable<OpenPosition["flag"]>, string>> = {
  zh: {
    saturated: "⚠ 饱和",
    contaminated: "⛔ 污染"
  },
  en: {
    saturated: "⚠ saturated",
    contaminated: "⛔ contaminated"
  }
};

export function OpenPositionsTable({ positions, lang }: { positions: readonly OpenPosition[]; lang: Lang }) {
  const zh = lang === "zh";
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{zh ? "市场" : "Market"}</th>
            <th scope="col">{zh ? "方向" : "Side"}</th>
            <th scope="col" className={styles.num}>
              {zh ? "成本价" : "Entry"}
            </th>
            <th scope="col" className={styles.num}>
              {zh ? "现价" : "Mark"}
            </th>
            <th scope="col" className={styles.num}>
              {zh ? "浮动盈亏" : "Unrealized"}
            </th>
            <th scope="col" className={styles.num}>
              agent P
            </th>
            <th scope="col">{zh ? "标记" : "Flags"}</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.slug}>
              <td>{p.question}</td>
              <td>{p.side}</td>
              <td className={styles.num}>{fmtPrice(p.entryPrice)}</td>
              <td className={styles.num}>{fmtPrice(p.markPrice)}</td>
              <PnlCell value={p.unrealizedUsd} />
              <td className={styles.num}>{fmtProb(p.agentProb)}</td>
              <td>
                {p.flag ? FLAG_LABEL[lang][p.flag] : "—"}
                {p.saturatedHold ? (
                  <span className={styles.rowNote}>
                    {zh ? "持有到期中（钳位卖出已拦截）" : "holding to settlement (clamp exit vetoed)"}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExitAlphaTable({ rows, lang }: { rows: readonly ExitAlphaRow[]; lang: Lang }) {
  const zh = lang === "zh";
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{zh ? "市场" : "Market"}</th>
            <th scope="col">{zh ? "卖出时间 (UTC)" : "Sold (UTC)"}</th>
            <th scope="col" className={styles.num}>
              {zh ? "卖价" : "Exit px"}
            </th>
            <th scope="col" className={styles.num}>
              {zh ? "现价" : "Now"}
            </th>
            <th scope="col" className={styles.num}>
              α
            </th>
            <th scope="col">{zh ? "原因" : "Reason"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.question}-${r.soldUtc}`}>
              <td>{r.question}</td>
              <td>{r.soldUtc}</td>
              <td className={styles.num}>{fmtPrice(r.avgExitPrice)}</td>
              <td className={styles.num}>{fmtPrice(r.priceNow)}</td>
              <PnlCell value={r.alphaUsd} />
              <td>{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BrierTable({ rows, lang }: { rows: readonly BrierRow[]; lang: Lang }) {
  const zh = lang === "zh";
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{zh ? "市场" : "Market"}</th>
            <th scope="col" className={styles.num}>
              agent P
            </th>
            <th scope="col" className={styles.num}>
              {zh ? "市场 P" : "market P"}
            </th>
            <th scope="col">{zh ? "结果" : "Outcome"}</th>
            <th scope="col">{zh ? "结算日" : "Resolved"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            // The same market can appear more than once (one row per resolved
            // position episode), so the question alone is not a unique key.
            <tr key={`${r.question}-${r.resolvedUtc}-${i}`}>
              <td>{r.question}</td>
              <td className={styles.num}>{fmtProb(r.agentProb)}</td>
              <td className={styles.num}>{fmtProb(r.marketProb)}</td>
              <td>{r.happened ? (zh ? "✓ 发生" : "✓ happened") : zh ? "✗ 未发生" : "✗ did not"}</td>
              <td>{r.resolvedUtc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ParamsTable({ config: c, lang }: { config: PaperParams; lang: Lang }) {
  const zh = lang === "zh";
  const rows: Array<[string, string, string]> = zh
    ? [
        ["本金", `$${c.bankrollUsd.toLocaleString("en-US")}`, "PAPER_BANKROLL_USD"],
        ["评估时间表", `每日 UTC ${c.evalTimesUtc.join(" / ")}（${c.evalTimesUtc.length} 轮）`, "PAPER_EVAL_TIMES_UTC"],
        ["单仓名义", `$${c.entryNotionalUsd}`, "PAPER_ENTRY_NOTIONAL_USD"],
        ["入场 edge 阈值", `≥ ${c.entryEdgePp}pp（扣费后）`, "PAPER_ENTRY_EDGE_PP"],
        ["退出 edge 阈值", `< ${c.exitEdgePp}pp 即卖（饱和持有可豁免）`, "PAPER_EXIT_EDGE_PP"],
        [
          "止损",
          `入场价 −${(c.stopLossPct * 100).toFixed(0)}%（压过模型；每 ${c.fillCheckMinutes} 分钟无模型扫描）`,
          "PAPER_STOP_LOSS_PCT"
        ],
        ["最大仓位数", `${c.maxPositions}`, "PAPER_MAX_POSITIONS"],
        ["单事件仓位上限", `${c.maxPerEvent}`, "PAPER_MAX_PER_EVENT"],
        ["每周期评估上限", `${c.maxEvalsPerCycle}（持仓复审优先，剩余给新候选）`, "PAPER_MAX_EVALS_PER_CYCLE"],
        ["每次评估引擎轮次", `${c.evalMaxRounds}（新档案最少 2 轮）`, "PAPER_EVAL_MAX_ROUNDS"],
        ["评估模型", `${c.evalProvider}（联网搜索、市场盲测）`, "PAPER_EVAL_PROVIDER"],
        ["扫描类别", c.categories.join(" / ") || "—", "PAPER_CATEGORIES"],
        [
          "扫描门槛",
          `流动性 ≥$${c.scanMinLiquidityUsd.toLocaleString("en-US")} · 24h 量 ≥$${c.scanMinVolume24hUsd.toLocaleString("en-US")} · 每类 ${c.scanPerCategory} 个`,
          "PAPER_SCAN_*"
        ],
        [
          "混合退出",
          `${(c.hybridMarketRatio * 100).toFixed(0)}% 市价 + ${((1 - c.hybridMarketRatio) * 100).toFixed(0)}% 限价（TTL ${c.limitTtlHours}h 回落市价）`,
          "PAPER_HYBRID_MARKET_RATIO"
        ],
        ["饱和持有", c.saturatedHoldEnabled ? "开启（钳位卖出拦截，持有到结算）" : "已关闭", "PAPER_SATURATED_HOLD"]
      ]
    : [
        ["Bankroll", `$${c.bankrollUsd.toLocaleString("en-US")}`, "PAPER_BANKROLL_USD"],
        [
          "Eval schedule",
          `daily at ${c.evalTimesUtc.join(" / ")} UTC (${c.evalTimesUtc.length} cycles)`,
          "PAPER_EVAL_TIMES_UTC"
        ],
        ["Position notional", `$${c.entryNotionalUsd}`, "PAPER_ENTRY_NOTIONAL_USD"],
        ["Entry edge threshold", `≥ ${c.entryEdgePp}pp (after fees)`, "PAPER_ENTRY_EDGE_PP"],
        ["Exit edge threshold", `sell below ${c.exitEdgePp}pp (saturated hold can exempt)`, "PAPER_EXIT_EDGE_PP"],
        [
          "Stop-loss",
          `entry −${(c.stopLossPct * 100).toFixed(0)}% (overrides the model; model-free scan every ${c.fillCheckMinutes} min)`,
          "PAPER_STOP_LOSS_PCT"
        ],
        ["Max positions", `${c.maxPositions}`, "PAPER_MAX_POSITIONS"],
        ["Max per event", `${c.maxPerEvent}`, "PAPER_MAX_PER_EVENT"],
        [
          "Evals per cycle cap",
          `${c.maxEvalsPerCycle} (held positions reviewed first, remainder to new candidates)`,
          "PAPER_MAX_EVALS_PER_CYCLE"
        ],
        ["Engine rounds per eval", `${c.evalMaxRounds} (new dossiers get at least 2)`, "PAPER_EVAL_MAX_ROUNDS"],
        ["Eval model", `${c.evalProvider} (web search, market-blind)`, "PAPER_EVAL_PROVIDER"],
        ["Scan categories", c.categories.join(" / ") || "—", "PAPER_CATEGORIES"],
        [
          "Scan floors",
          `liquidity ≥$${c.scanMinLiquidityUsd.toLocaleString("en-US")} · 24h volume ≥$${c.scanMinVolume24hUsd.toLocaleString("en-US")} · ${c.scanPerCategory} per category`,
          "PAPER_SCAN_*"
        ],
        [
          "Hybrid exit",
          `${(c.hybridMarketRatio * 100).toFixed(0)}% market + ${((1 - c.hybridMarketRatio) * 100).toFixed(0)}% limit (falls back to market after the ${c.limitTtlHours}h TTL)`,
          "PAPER_HYBRID_MARKET_RATIO"
        ],
        [
          "Saturated hold",
          c.saturatedHoldEnabled ? "on (clamp exits vetoed; held to settlement)" : "off",
          "PAPER_SATURATED_HOLD"
        ]
      ];
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{zh ? "参数" : "Parameter"}</th>
            <th scope="col">{zh ? "当前值" : "Current value"}</th>
            <th scope="col">{zh ? "env 键" : "env key"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value, envKey]) => (
            <tr key={envKey + label}>
              <td>{label}</td>
              <td>{value}</td>
              <td className={styles.rowNote}>{envKey}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EquityTable({ curve, lang }: { curve: readonly EquityPoint[]; lang: Lang }) {
  const zh = lang === "zh";
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{zh ? "日期 (UTC)" : "Date (UTC)"}</th>
            <th scope="col" className={styles.num}>
              {zh ? "总权益" : "Equity"}
            </th>
          </tr>
        </thead>
        <tbody>
          {curve.map((p) => (
            <tr key={p.date}>
              <td>{p.date}</td>
              <td className={styles.num}>{fmtUsd(p.equityUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
