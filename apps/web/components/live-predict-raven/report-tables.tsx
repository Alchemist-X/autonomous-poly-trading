import type {
  BrierRow,
  ClosedTrade,
  EquityPoint,
  ExitAlphaRow,
  OpenPosition
} from "../../lib/live-predict-raven/snapshot";
import { fmtPrice, fmtProb, fmtSignedUsd, fmtUsd } from "./format";
import styles from "./report.module.css";

function PnlCell({ value }: { value: number }) {
  const tone = value > 0 ? styles.pos : value < 0 ? styles.neg : undefined;
  return <td className={`${styles.num} ${tone ?? ""}`}>{fmtSignedUsd(value)}</td>;
}

export function ClosedTradesTable({ trades }: { trades: readonly ClosedTrade[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">市场</th>
            <th scope="col">方向</th>
            <th scope="col" className={styles.num}>入场</th>
            <th scope="col" className={styles.num}>出场</th>
            <th scope="col" className={styles.num}>盈亏</th>
            <th scope="col" className={styles.num}>收益率</th>
            <th scope="col">退出原因</th>
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
              <td>{t.exitReason === "stop_loss" ? "止损" : "负 edge 退出"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FLAG_LABEL: Record<NonNullable<OpenPosition["flag"]>, string> = {
  saturated: "⚠ 饱和",
  contaminated: "⛔ 污染"
};

export function OpenPositionsTable({ positions }: { positions: readonly OpenPosition[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">市场</th>
            <th scope="col">方向</th>
            <th scope="col" className={styles.num}>成本价</th>
            <th scope="col" className={styles.num}>现价</th>
            <th scope="col" className={styles.num}>浮动盈亏</th>
            <th scope="col" className={styles.num}>agent P</th>
            <th scope="col">标记</th>
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
              <td>{p.flag ? FLAG_LABEL[p.flag] : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExitAlphaTable({ rows }: { rows: readonly ExitAlphaRow[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">市场</th>
            <th scope="col">卖出时间 (UTC)</th>
            <th scope="col" className={styles.num}>卖价</th>
            <th scope="col" className={styles.num}>现价</th>
            <th scope="col" className={styles.num}>α</th>
            <th scope="col">原因</th>
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

export function BrierTable({ rows }: { rows: readonly BrierRow[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">市场</th>
            <th scope="col" className={styles.num}>agent P</th>
            <th scope="col" className={styles.num}>市场 P</th>
            <th scope="col">结果</th>
            <th scope="col">结算日</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.question}>
              <td>{r.question}</td>
              <td className={styles.num}>{fmtProb(r.agentProb)}</td>
              <td className={styles.num}>{fmtProb(r.marketProb)}</td>
              <td>{r.happened ? "✓ 发生" : "✗ 未发生"}</td>
              <td>{r.resolvedUtc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EquityTable({ curve }: { curve: readonly EquityPoint[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">日期 (UTC)</th>
            <th scope="col" className={styles.num}>总权益</th>
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
