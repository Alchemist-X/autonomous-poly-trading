import * as React from "react";
import { ravenLogoDataUri } from "../assets/logo";

export interface RavenHeaderProps {
  /** Logo image (data URI or URL). Defaults to the embedded Predict Raven raven mark. */
  logoSrc?: string;
  /** Current theme, drives the toggle label. */
  theme?: "dark" | "light";
  /** Show the "+ NEW QUESTION" action (hidden on the input/landing screen). */
  showNewQuestion?: boolean;
  onNewQuestion?(): void;
  onToggleTheme?(): void;
}

const ghostBtn: React.CSSProperties = {
  fontFamily: "var(--rv-font-mono)",
  fontSize: 11,
  letterSpacing: 1,
  color: "var(--rv-ink2)",
  background: "transparent",
  border: "1px solid var(--rv-line)",
  borderRadius: 8,
  padding: "9px 14px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/**
 * The Predict Raven top bar: the raven mark + "PredictRaven" wordmark + optional
 * actions (new question, theme toggle).
 */
export const RavenHeader: React.FC<RavenHeaderProps> = ({
  logoSrc = ravenLogoDataUri,
  theme = "dark",
  showNewQuestion = false,
  onNewQuestion,
  onToggleTheme,
}) => (
  <header
    style={{
      position: "relative",
      zIndex: 5,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "20px clamp(20px,4vw,44px)",
      maxWidth: 1320,
      margin: "0 auto",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 11,
          background: "#100F13",
          border: "1px solid rgba(224,112,60,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 22px var(--rv-glow)",
          overflow: "hidden",
        }}
      >
        <img src={logoSrc} alt="Predict Raven" style={{ width: 34, height: 34, objectFit: "contain" }} />
      </div>
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: 0.5 }}>
          Predict<span style={{ color: "var(--rv-orange)" }}>Raven</span>
        </div>
        <div
          style={{
            fontFamily: "var(--rv-font-mono)",
            fontSize: 9.5,
            letterSpacing: 2.5,
            color: "var(--rv-ink3)",
            marginTop: 4,
          }}
        >
          BY RAVEN·LABS
        </div>
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {showNewQuestion && (
        <button type="button" onClick={onNewQuestion} style={ghostBtn}>
          + NEW QUESTION
        </button>
      )}
      <button
        type="button"
        onClick={onToggleTheme}
        style={{ ...ghostBtn, background: "var(--rv-bg2)" }}
      >
        {theme === "light" ? "◐ DARK" : "◑ LIGHT"}
      </button>
    </div>
  </header>
);
