"use client";

import { useT } from "../../../lib/i18n";
import { V } from "../../../lib/i18n/verdict";
import type { DossierVM } from "../../../lib/vm/types";

const SECTION_STYLE: React.CSSProperties = {
  borderTop: "1px solid var(--line)",
  padding: "30px clamp(18px,4vw,46px)"
};

const KICKER_STYLE: React.CSSProperties = {
  fontFamily: "var(--fm)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".15em",
  textTransform: "uppercase",
  color: "var(--accent)",
  marginBottom: 14
};

export function DecisionSections({ dossier }: { dossier: DossierVM }) {
  const t = useT();
  const direction = {
    raises: t(V.directionRaises),
    lowers: t(V.directionLowers),
    mixed: t(V.directionMixed)
  } as const;

  return (
    <>
      {dossier.probabilityModelExplanation ? (
        <section style={SECTION_STYLE}>
          <div style={KICKER_STYLE}>{t(V.adoptedModel)}</div>
          <p style={{ margin: 0, maxWidth: 900, fontFamily: "var(--fd)", fontSize: 17, lineHeight: 1.65 }}>
            {dossier.probabilityModelExplanation}
          </p>
        </section>
      ) : null}

      {dossier.scenarios?.length ? (
        <section style={SECTION_STYLE}>
          <div style={KICKER_STYLE}>{t(V.scenarios)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {dossier.scenarios.map((scenario) => (
              <article
                key={`${scenario.name}-${scenario.description}`}
                style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 16, background: "var(--surface)" }}
              >
                <h3 style={{ margin: 0, fontFamily: "var(--fd)", fontSize: 16 }}>{scenario.name}</h3>
                <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
                  {scenario.description}
                </p>
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: "1px solid var(--line)",
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    color: "var(--muted)"
                  }}
                >
                  <b style={{ color: "var(--text)" }}>{t(V.implication)}:</b> {scenario.implication}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {dossier.monitoringSignals?.length ? (
        <section style={SECTION_STYLE}>
          <div style={KICKER_STYLE}>{t(V.monitoringSignals)}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {dossier.monitoringSignals.map((signal) => (
              <div
                key={`${signal.signal}-${signal.component}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px minmax(0,1fr)",
                  gap: 12,
                  padding: "12px 14px",
                  border: "1px solid var(--line)",
                  borderRadius: 10
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--fm)",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: ".08em",
                    color:
                      signal.direction === "raises"
                        ? "var(--verified)"
                        : signal.direction === "lowers"
                          ? "var(--neg)"
                          : "var(--accent)"
                  }}
                >
                  {direction[signal.direction]}
                </span>
                <div>
                  <div style={{ fontSize: 13, lineHeight: 1.45 }}>{signal.signal}</div>
                  <div style={{ marginTop: 4, fontFamily: "var(--fm)", fontSize: 9.5, color: "var(--faint)" }}>
                    {t(V.affectedComponent)}: {signal.component}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {dossier.informationGaps?.length ? (
        <section style={SECTION_STYLE}>
          <div style={KICKER_STYLE}>{t(V.informationGaps)}</div>
          <div style={{ display: "grid", gap: 10 }}>
            {dossier.informationGaps.map((gap) => (
              <article key={gap.gap} style={{ borderLeft: "3px solid var(--accent)", padding: "4px 0 4px 14px" }}>
                <div style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 14 }}>{gap.gap}</div>
                <p style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}>
                  {gap.importance}
                </p>
                <p
                  style={{
                    margin: "5px 0 0",
                    fontFamily: "var(--fm)",
                    fontSize: 9.5,
                    lineHeight: 1.45,
                    color: "var(--faint)"
                  }}
                >
                  {t(V.retrievalPath)}: {gap.retrievalPath}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
