"use client";

// 持仓表 — desktop table (scrolls in its own container) + mobile cards.

import type { PositionRow } from "../lib/types";
import { fmtPct, fmtPx, fmtShortDateTime, fmtUsd } from "../lib/format";

function pnlClass(v: number | null): string {
  if (v === null) return "pnl-flat";
  if (v > 0) return "pnl-pos";
  if (v < 0) return "pnl-neg";
  return "pnl-flat";
}

function pnlText(p: PositionRow): string {
  if (p.unrealizedPnlUsd === null) return "—";
  const pct = p.unrealizedPnlPct !== null ? ` (${fmtPct(p.unrealizedPnlPct, { sign: true })})` : "";
  return `${fmtUsd(p.unrealizedPnlUsd, { sign: true })}${pct}`;
}

function DirChip({ direction }: { direction: "long" | "short" }) {
  return <span className={`chip ${direction === "long" ? "dir-long" : "dir-short"}`}>{direction === "long" ? "多" : "空"}</span>;
}

export function PositionsSection({ positions }: { positions: PositionRow[] }) {
  return (
    <section className="dpc-sec">
      <h2 className="dpc-sec-title">
        持仓 <span className="cnt">{positions.length}</span>
      </h2>
      {positions.length === 0 ? (
        <div className="empty">当前无持仓</div>
      ) : (
        <>
          <div className="only-desktop table-wrap">
            <table className="pos-table">
              <thead>
                <tr>
                  <th>标的</th>
                  <th>方向</th>
                  <th>数量</th>
                  <th>开仓价</th>
                  <th>现价</th>
                  <th>浮动盈亏</th>
                  <th>止损价</th>
                  <th>硬地板 (−20%)</th>
                  <th>持有至</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={`${p.ticker}-${p.thesisId}`}>
                    <td className="tk">{p.ticker}</td>
                    <td>
                      <DirChip direction={p.direction} />
                    </td>
                    <td>{p.qty}</td>
                    <td>{fmtPx(p.entryPx)}</td>
                    <td>{fmtPx(p.markPx)}</td>
                    <td className={pnlClass(p.unrealizedPnlUsd)}>{pnlText(p)}</td>
                    <td>{fmtPx(p.stopPx)}</td>
                    <td>{fmtPx(p.hardFloorPx)}</td>
                    <td>{fmtShortDateTime(p.horizonUtc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="only-mobile">
            {positions.map((p) => (
              <article className="pos-card" key={`${p.ticker}-${p.thesisId}`}>
                <div className="pos-card-head">
                  <span className="tk">{p.ticker}</span>
                  <DirChip direction={p.direction} />
                  <span className={`pnl ${pnlClass(p.unrealizedPnlUsd)}`}>{pnlText(p)}</span>
                </div>
                <div className="pos-card-grid">
                  <div className="cell">
                    <div className="k">数量</div>
                    <div className="v">{p.qty}</div>
                  </div>
                  <div className="cell">
                    <div className="k">开仓价</div>
                    <div className="v">{fmtPx(p.entryPx)}</div>
                  </div>
                  <div className="cell">
                    <div className="k">现价</div>
                    <div className="v">{fmtPx(p.markPx)}</div>
                  </div>
                  <div className="cell">
                    <div className="k">止损价</div>
                    <div className="v">{fmtPx(p.stopPx)}</div>
                  </div>
                  <div className="cell">
                    <div className="k">硬地板</div>
                    <div className="v">{fmtPx(p.hardFloorPx)}</div>
                  </div>
                  <div className="cell">
                    <div className="k">持有至</div>
                    <div className="v">{fmtShortDateTime(p.horizonUtc)}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
