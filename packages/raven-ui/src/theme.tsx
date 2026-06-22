import * as React from "react";

export interface RavenThemeProps {
  /** Color theme. Dark is the default; light flips to the parchment palette. */
  theme?: "dark" | "light";
  children?: React.ReactNode;
  /** Extra styles merged onto the wrapper (e.g. minHeight, padding). */
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Theme wrapper for the Predict Raven design system. Sets `data-raven-theme` so
 * the `--rv-*` tokens resolve, and establishes the base font and surface colors.
 * Components are also styled without it (tokens default to dark on `:root`), but
 * wrap your screen in `<RavenTheme>` to switch themes and anchor the surface.
 */
export const RavenTheme: React.FC<RavenThemeProps> = ({ theme = "dark", children, style, className }) => (
  <div
    data-raven-theme={theme}
    className={className}
    style={{
      fontFamily: "var(--rv-font-sans)",
      color: "var(--rv-ink)",
      background: "var(--rv-bg)",
      WebkitFontSmoothing: "antialiased",
      ...style,
    }}
  >
    {children}
  </div>
);
