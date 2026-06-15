// Flat ESLint config (ESLint 9 + typescript-eslint). Intentionally a LENIENT
// baseline: it gives CI a real, checked-in gate (replacing per-developer editor
// hooks) without requiring a large up-front cleanup of the existing ~65k LOC.
// Noisy-but-common rules are set to "warn" so `pnpm lint` passes today; tighten
// them to "error" incrementally. Prettier owns formatting (eslint-config-prettier
// disables conflicting stylistic rules).
//
// ACTIVATION (the deps could not be fetched in the build sandbox — registry
// proxy down — so they are NOT yet in package.json/lockfile). In a networked
// environment, run once:
//   pnpm add -Dw eslint @eslint/js typescript-eslint eslint-config-prettier
// then add the scripts: "lint": "eslint .", "lint:fix": "eslint . --fix".
// Prettier (`pnpm format` / `pnpm format:check`) is already installed and works.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.tsbuildinfo",
      "vendor/**",
      "runtime-artifacts/**",
      "**/*.generated.*",
      "apps/web/lib/world-cup/generated/**",
      "packages/market-intelligence/**", // Python — not ESLint's domain
      "**/*.d.ts"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      // TS already checks undefined identifiers; no-undef is redundant + noisy here.
      "no-undef": "off",
      // Lenient to start — common in the pipeline/CLI code; surfaced, not blocking.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "no-empty": "warn",
      "no-useless-escape": "warn",
      "no-control-regex": "off",
      "prefer-const": "warn"
    }
  }
);
