"use client";

// 持仓表 — desktop table (scrolls in its own container) + mobile cards.

import type { PositionRow } from "../lib/types";
import { fmtPct, fmtPx, fmtShortDateTime, fmtUsd } from "../lib/format";
import { t, type Lang } from "../lib/i18n";

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

function DirChip({ direction, lang }: { direction: "long" | "short"; lang: Lang }) {
  const tt = t(lang);
  return (
    <span className={`chip ${direction === "long" ? "dir-long" : "dir-short"}`}>
      {direction === "long" ? tt("dirLong") : tt("dirShort")}
    </span>
  );
}

export function PositionsSection({ positions, lang }: { positions: PositionRow[]; lang: Lang }) {
  const tt = t(lang);
  return (
    <section className="dpc-sec">
      <h2 className="dpc-sec-title">
        {tt("positionsTitle")} <span className="cnt">{positions.length}</span>
      </h2>
      {positions.length === 0 ? (
        <div className="empty">{tt("positionsEmpty")}</div>
      ) : (
        <>
          <div className="only-desktop table-wrap">
            <table className="pos-table">
              <thead>
                <tr>
                  <th>{tt("thTicker")}</th>
                  <th>{tt("thSide")}</th>
                  <th>{tt("thQty")}</th>
                  <th>{tt("thEntry")}</th>
                  <th>{tt("thMark")}</th>
                  <th>{tt("unrealizedLbl")}</th>
                  <th>{tt("thStop")}</th>
                  <th>{tt("thHardFloor")}</th>
                  <th>{tt("thHorizon")}</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={`${p.ticker}-${p.thesisId}`}>
                    <td className="tk">{p.ticker}</td>
                    <td>
                      <DirChip direction={p.direction} lang={lang} />
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
                  <DirChip direction={p.direction} lang={lang} />
                  <span className={`pnl ${pnlClass(p.unrealizedPnlUsd)}`}>{pnlText(p)}</span>
                </div>
                <div className="pos-card-grid">
                  <div className="cell">
                    <div className="k">{tt("thQty")}</div>
                    <div className="v">{p.qty}</div>
                  </div>
                  <div className="cell">
                    <div className="k">{tt("thEntry")}</div>
                    <div className="v">{fmtPx(p.entryPx)}</div>
                  </div>
                  <div className="cell">
                    <div className="k">{tt("thMark")}</div>
                    <div className="v">{fmtPx(p.markPx)}</div>
                  </div>
                  <div className="cell">
                    <div className="k">{tt("thStop")}</div>
                    <div className="v">{fmtPx(p.stopPx)}</div>
                  </div>
                  <div className="cell">
                    <div className="k">{tt("hardFloorShort")}</div>
                    <div className="v">{fmtPx(p.hardFloorPx)}</div>
                  </div>
                  <div className="cell">
                    <div className="k">{tt("thHorizon")}</div>
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
