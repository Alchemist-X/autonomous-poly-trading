// Mini-markup renderer for Raven's summary + counter-signal resolution text.
// Supports **bold**, __underline__, *italic*, [hs:NN]…[/] (supporting
// highlight), [hc:NN]…[/] (counter highlight) and bare [NN] index tokens from
// live runs. Builds React nodes — never dangerouslySetInnerHTML.

import { Fragment, type ReactNode } from "react";
import type { DecoratedEvidence } from "./decorate";

const TOKEN_SOURCE =
  "\\*\\*(.+?)\\*\\*|__(.+?)__|\\*(.+?)\\*|\\[hs:(\\d{1,3})\\]([\\s\\S]*?)\\[\\/\\]|\\[hc:(\\d{1,3})\\]([\\s\\S]*?)\\[\\/\\]|\\[(\\d{1,3})\\]";

const pad2 = (raw: string): string => raw.padStart(2, "0");

export function renderRich(text: string, byIdx: Map<string, DecoratedEvidence>): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = new RegExp(TOKEN_SOURCE, "g");
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(<b key={key++}>{m[1]}</b>);
    } else if (m[2] !== undefined) {
      nodes.push(<u key={key++}>{m[2]}</u>);
    } else if (m[3] !== undefined) {
      nodes.push(<i key={key++}>{m[3]}</i>);
    } else if (m[4] !== undefined && m[5] !== undefined) {
      nodes.push(
        <a key={key++} className="hs" href={`#ev-${pad2(m[4])}`}>
          {m[5]}
        </a>
      );
    } else if (m[6] !== undefined && m[7] !== undefined) {
      nodes.push(
        <a key={key++} className="hc" href={`#ev-${pad2(m[6])}`}>
          {m[7]}
        </a>
      );
    } else if (m[8] !== undefined) {
      const idx = pad2(m[8]);
      const side = byIdx.get(idx)?.side;
      const cls = side === "support" ? "hs" : side === "counter" ? "hc" : "lnk";
      nodes.push(
        <a
          key={key++}
          className={cls}
          href={`#ev-${idx}`}
          style={cls === "lnk" ? { color: "var(--faint)" } : undefined}
        >
          [{idx}]
        </a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// "(06)"-style parenthetical references → accent anchor links into the book
// (used by the strongest counter-signal callout, per the design's inline .lnk).
export function renderIdxRefs(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\((\d{2})\)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <Fragment key={key++}>
        (
        <a className="lnk" href={`#ev-${m[1]}`} style={{ color: "var(--accent)" }}>
          {m[1]}
        </a>
        )
      </Fragment>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
