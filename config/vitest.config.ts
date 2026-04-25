import path from "node:path";
import { defineConfig } from "vitest/config";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

export default defineConfig({
  root: REPO_ROOT,
  resolve: {
    alias: {
      "@autopoly/contracts": path.resolve(REPO_ROOT, "packages/contracts/src/index.ts"),
      "@autopoly/db": path.resolve(REPO_ROOT, "packages/db/src/index.ts"),
      "@autopoly/terminal-ui": path.resolve(REPO_ROOT, "packages/terminal-ui/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: [
      "scripts/**/*.test.ts",
      "packages/**/*.test.ts",
      "services/**/*.test.ts"
    ]
  }
});
