"use client";

// "The evidence, in order" book — per-iteration headers, globally numbered
// evidence rows (#ev-NN anchors) and the CSS-only hover preview popover.
// Layout and copy verbatim from the design handoff ("Raven Report.dc.html").

import { ArrowIcon, ShieldIcon, SrcIcon } from "../../../components/icons";
import { sourcesLabel, useLocale, useT } from "../../../lib/i18n";
import { SRC_TYPE_LABELS, V } from "../../../lib/i18n/verdict";
import type { DossierMeta } from "../../../lib/vm/types";
import { netArrowFor, type DecoratedEvidence, type DecoratedIteration } from "./decorate";
import { CredPill, DomChip, ValuePill } from "./pills";

export function EvidenceBook({ iterations, meta }: { iterations: DecoratedIteration[]; meta: DossierMeta }) {
  const t = useT();
  const { locale } = useLocale();
  const legend = [
    { n: meta.nSupport, label: V.legendSupporting, color: "var(--pos)" },
    { n: meta.nCounter, label: V.legendCounter, color: "var(--neg)" },
    { n: meta.nNeutral, label: V.legendNeutral, color: "var(--faint)" }
  ];
  return (
    <div className="rp-book" style={{ borderTop: "1px solid var(--line)", background: "var(--bg2)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 4
        }}
      >
        <div
          style={{
            fontFamily: "var(--fm)",
            fontSize: 10,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "var(--faint)"
          }}
        >
          {t(V.evidenceInOrder, { src: sourcesLabel(meta.sources, locale) })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "var(--fm)", fontSize: 10.5 }}>
          {legend.map((l) => (
            <span
              key={l.label.en}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--muted)" }}
            >
              <span style={{ width: 9, height: 3, borderRadius: 2, background: l.color }} />
              {l.n} {t(l.label)}
            </span>
          ))}
        </div>
      </div>

      {iterations.map((it) => (
        <div key={it.n} style={{ marginTop: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              paddingBottom: 9,
              borderBottom: "1px solid var(--line2)"
            }}
          >
            <span
              style={{
                fontFamily: "var(--fm)",
                fontSize: 10,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--faint)"
              }}
            >
              {t(V.iteration)}
            </span>
            <span style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 20, color: "var(--accent)" }}>
              {it.n}
            </span>
            <span style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--muted)" }}>
              {it.from} → <b style={{ color: "var(--text)" }}>{it.to}</b>
            </span>
            <span
              className={`mv-${it.netDir}`}
              style={{ marginLeft: "auto", fontFamily: "var(--fm)", fontSize: 12, fontWeight: 600 }}
            >
              {netArrowFor(it.netDir)} {it.net}
            </span>
          </div>
          <p style={{ margin: "11px 0 6px", fontSize: 13, lineHeight: 1.58, color: "var(--muted)", maxWidth: "78ch" }}>
            {it.note}
          </p>
          {it.evidence.map((e) => (
            <EvidenceRow key={e.id} e={e} />
          ))}
        </div>
      ))}
    </div>
  );
}

function EvidenceRow({ e }: { e: DecoratedEvidence }) {
  const t = useT();
  return (
    <div
      className="ev"
      id={`ev-${e.idx}`}
      tabIndex={0}
      style={{
        position: "relative",
        padding: "14px 14px 14px 0",
        borderTop: "1px solid var(--line)",
        scrollMarginTop: 110
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11, paddingLeft: 2 }}>
        <span
          className={`sd-${e.side}`}
          style={{ width: 3, alignSelf: "stretch", borderRadius: 2, opacity: 0.85 }}
          title={t(e.sideLabel)}
        />
        <span
          style={{
            fontFamily: "var(--fd)",
            fontWeight: 500,
            fontSize: 23,
            lineHeight: 1,
            color: "var(--faint)",
            fontVariantNumeric: "tabular-nums",
            minWidth: "1.7ch"
          }}
        >
          {e.idx}
        </span>
      </div>

      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{e.title}</span>
          {e.revises ? (
            <span
              style={{
                fontFamily: "var(--fm)",
                fontSize: 8.5,
                fontWeight: 600,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--val)",
                border: "1px solid color-mix(in srgb,var(--val) 40%,transparent)",
                borderRadius: 4,
                padding: "1px 5px"
              }}
            >
              {t(V.revisesPrior)}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 7, flexWrap: "wrap" }}>
          <DomChip e={e} />
          {e.verified ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "var(--fm)",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: ".05em",
                textTransform: "uppercase",
                color: "var(--verified)"
              }}
            >
              <SrcIcon type="official" className="ic10" />
              {t(V.verified)}
            </span>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "var(--fm)",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: ".05em",
                textTransform: "uppercase",
                color: "var(--faint)"
              }}
            >
              <ShieldIcon />
              {t(V.unverified)}
            </span>
          )}
          <span style={{ width: 1, height: 11, background: "var(--line2)" }} />
          <CredPill e={e} />
          <ValuePill e={e} />
          {typeof e.qualityScore === "number" ? (
            <span style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--accent)" }}>
              {t(V.claimQuality, { score: e.qualityScore })}
            </span>
          ) : null}
          {e.crossCheck ? (
            <span
              style={{
                fontFamily: "var(--fm)",
                fontSize: 9,
                color:
                  e.crossCheck === "confirmed"
                    ? "var(--verified)"
                    : e.crossCheck === "contested"
                      ? "var(--neg)"
                      : "var(--faint)"
              }}
            >
              {t(
                e.crossCheck === "confirmed"
                  ? V.crossChecked
                  : e.crossCheck === "contested"
                    ? V.contested
                    : e.crossCheck === "single_source"
                      ? V.singleSource
                      : V.unverified
              )}
            </span>
          ) : null}
        </div>
        <p style={{ margin: "9px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--muted)", maxWidth: "70ch" }}>
          {e.analysis}
        </p>
      </div>

      <div className="ev-right">
        <div className={`mv-${e.dir}`} style={{ fontFamily: "var(--fm)", fontWeight: 600, fontSize: 15 }}>
          {e.arrow} {e.deltaAbs}
        </div>
        <div style={{ fontFamily: "var(--fm)", fontSize: 10.5, color: "var(--faint)", marginTop: 3 }}>
          {e.from} → {e.to}
        </div>
      </div>

      <EvidencePopover e={e} />
    </div>
  );
}

function EvidencePopover({ e }: { e: DecoratedEvidence }) {
  const t = useT();
  const openStyle = {
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontFamily: "var(--fm)",
    fontSize: 10.5,
    fontWeight: 600,
    color: "var(--accent)"
  } as const;
  return (
    <div
      className="ev-pop"
      style={{
        position: "absolute",
        top: "calc(100% - 6px)",
        right: 8,
        width: 340,
        zIndex: 30,
        background: "var(--bg)",
        border: "1px solid var(--line2)",
        borderRadius: 13,
        boxShadow: "0 30px 70px -22px var(--shadow)",
        padding: "15px 16px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
        <span
          style={{
            fontFamily: "var(--fm)",
            fontSize: 9,
            letterSpacing: ".15em",
            textTransform: "uppercase",
            color: "var(--accent)"
          }}
        >
          {t(V.preview)}
        </span>
        <CredPill e={e} variant="pop" />
      </div>
      <div style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 15, lineHeight: 1.3, marginBottom: 8 }}>
        {e.title}
      </div>
      <div
        style={{
          fontFamily: "var(--fd)",
          fontWeight: 600,
          fontSize: 12.5,
          lineHeight: 1.5,
          borderLeft: "2px solid var(--accent)",
          paddingLeft: 9,
          marginBottom: 9
        }}
      >
        {e.takeaway}
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.55, color: "var(--muted)" }}>{e.analysis}</p>
      {e.supportingSources && e.supportingSources.length > 1 ? (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontFamily: "var(--fm)",
              fontSize: 8.5,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--faint)",
              marginBottom: 6
            }}
          >
            {t(V.selectedSources)} · {e.supportingSources.length}
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            {e.supportingSources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 10.5, lineHeight: 1.35, color: "var(--accent)", textDecoration: "none" }}
              >
                {source.title}
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 10,
          borderTop: "1px solid var(--line)"
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontFamily: "var(--fm)",
            fontSize: 10,
            color: "var(--faint)"
          }}
        >
          <SrcIcon type={e.srcType} />
          {t(SRC_TYPE_LABELS[e.srcType])}
        </span>
        {e.url ? (
          <a href={e.url} target="_blank" rel="noopener noreferrer" style={openStyle}>
            {t(V.openSource, { dom: e.dom })} <ArrowIcon style={{ width: 10, height: 10 }} />
          </a>
        ) : (
          <span style={openStyle}>
            {t(V.openSource, { dom: e.dom })} <ArrowIcon style={{ width: 10, height: 10 }} />
          </span>
        )}
      </div>
    </div>
  );
}
