import { defineConfig } from "tsup";

// Builds the library to dist/ as ESM + CJS with type declarations. React is
// external (peer) so the design-sync bundle shims it to the shared runtime.
// Components style themselves with inline styles referencing --rv-* CSS vars,
// so there is no CSS to bundle here — tokens/styles/fonts ship as .css assets
// (see package.json exports + the design-sync cssEntry).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2020",
  external: ["react", "react-dom", "react/jsx-runtime"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
