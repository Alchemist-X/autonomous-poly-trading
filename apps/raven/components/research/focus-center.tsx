"use client";

import { useT } from "../../lib/i18n";
import { RP } from "../../lib/i18n/research-parts";
import type { EvidenceVM, ResearchPlanVM } from "../../lib/vm/types";

const PRIORITY_COLOR = {
  high: "var(--neg)",
  medium: "var(--accent)",
  low: "var(--faint)"
} as const;

export function FocusCenter({ plan, evidence }: { plan: ResearchPlanVM; evidence: readonly EvidenceVM[] }) {
  const t = useT();
  const sorted = [...plan.focusAreas].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return rank[a.priority] - rank[b.priority];
  });

  return (
    <section
      aria-labelledby="focus-center-title"
      style={{
        marginTop: 22,
        border: "1px solid var(--line)",
        borderRadius: 14,
        background: "var(--surface)",
        overflow: "hidden"
      }}
    >
      <div style={{ padding: "16px 17px", borderBottom: "1px solid var(--line)", background: "var(--bg2)" }}>
        <div style={{ display: "flex", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div
              id="focus-center-title"
              style={{
                fontFamily: "var(--fm)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--accent)"
              }}
            >
              {t(RP.focusTitle)}
            </div>
            <p style={{ margin: "6px 0 0", fontFamily: "var(--fd)", fontSize: 15, lineHeight: 1.45 }}>
              {t(RP.focusMotto)}
            </p>
          </div>
          <div
            style={{
              minWidth: 170,
              maxWidth: 260,
              fontFamily: "var(--fm)",
              fontSize: 9.5,
              lineHeight: 1.5,
              color: "var(--muted)"
            }}
          >
            <b style={{ color: "var(--text)" }}>{t(RP.focusModel)}</b>
            <br />
            {plan.modelKind.replaceAll("_", " ")}
          </div>
        </div>
        <p style={{ margin: "11px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
          {t(RP.focusSearchStandard, { n: plan.minimumSearchQueries })}
        </p>
      </div>

      <div style={{ padding: "4px 17px" }}>
        {sorted.map((focus, index) => {
          const claims = evidence.filter((item) => item.focusId === focus.id);
          const checked = claims.some((item) => item.crossCheck === "confirmed" || item.crossCheck === "contested");
          const status = checked ? t(RP.focusChecked) : claims.length ? t(RP.focusCovered) : t(RP.focusOpen);
          return (
            <article
              key={focus.id}
              style={{
                display: "grid",
                gridTemplateColumns: "92px minmax(0,1fr)",
                gap: 12,
                padding: "14px 0",
                borderTop: index ? "1px solid var(--line)" : "none"
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--fm)",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: ".09em",
                    color: PRIORITY_COLOR[focus.priority]
                  }}
                >
                  {focus.priority.toUpperCase()}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: "var(--fm)",
                    fontSize: 9,
                    lineHeight: 1.35,
                    color: checked ? "var(--verified)" : claims.length ? "var(--accent)" : "var(--faint)"
                  }}
                >
                  {status}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>
                  {focus.question}
                </div>
                {focus.whyItMatters ? (
                  <p style={{ margin: "5px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--muted)" }}>
                    {focus.whyItMatters}
                  </p>
                ) : null}
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: "var(--fm)",
                    fontSize: 10,
                    lineHeight: 1.55,
                    color: "var(--faint)"
                  }}
                >
                  <b style={{ color: "var(--muted)" }}>{t(RP.focusPreferred)}:</b> {focus.preferredSources.join(" · ")}
                  <br />
                  <b style={{ color: "var(--muted)" }}>{t(RP.focusCompleteWhen)}:</b> {focus.completionCriteria}
                  {claims.length ? (
                    <>
                      <br />
                      <span style={{ color: "var(--verified)" }}>{t(RP.focusClaims, { n: claims.length })}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {plan.sourcePriorities.length ? (
        <details style={{ borderTop: "1px solid var(--line)", padding: "12px 17px" }}>
          <summary
            style={{
              cursor: "pointer",
              fontFamily: "var(--fm)",
              fontSize: 9.5,
              letterSpacing: ".08em",
              color: "var(--muted)"
            }}
          >
            {t(RP.focusSourceOrder)}
          </summary>
          <ol style={{ margin: "11px 0 2px", paddingLeft: 20 }}>
            {plan.sourcePriorities.map((source) => (
              <li
                key={`${source.rank}-${source.sourceClass}`}
                style={{ marginTop: 7, fontSize: 11.5, lineHeight: 1.5, color: "var(--muted)" }}
              >
                <b style={{ color: "var(--text)" }}>{source.sourceClass}</b>
                <br />
                <span>
                  {t(RP.focusUseWhen)}: {source.useWhen}
                </span>
                {source.rejectWhen ? (
                  <>
                    <br />
                    <span>
                      {t(RP.focusRejectWhen)}: {source.rejectWhen}
                    </span>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
