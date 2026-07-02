import * as React from "react";
import type { Preview } from "@storybook/react-vite";
import { RavenTheme } from "../src/theme";
import "../src/styles.css";

// The decorator wraps every story in the Raven theme — this is what design-sync
// bundles as the preview provider (and what cfg.provider mirrors).
const preview: Preview = {
  parameters: { layout: "fullscreen" },
  globalTypes: {
    theme: {
      description: "Raven theme",
      defaultValue: "dark",
      toolbar: { title: "Theme", icon: "circlehollow", items: ["dark", "light"] },
    },
  },
  decorators: [
    (Story, ctx) => (
      <RavenTheme theme={(ctx.globals.theme as "dark" | "light") || "dark"} style={{ padding: 28, minHeight: "100vh" }}>
        <Story />
      </RavenTheme>
    ),
  ],
};

export default preview;
