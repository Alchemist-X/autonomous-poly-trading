import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@autopoly/contracts",
        replacement: path.resolve(import.meta.dirname, "../../packages/contracts/src/index.ts")
      },
      {
        find: "@autopoly/db",
        replacement: path.resolve(import.meta.dirname, "../../packages/db/src/index.ts")
      },
      {
        find: "@autopoly/executor/risk",
        replacement: path.resolve(import.meta.dirname, "../../services/executor/src/risk.ts")
      },
      {
        find: "@autopoly/orchestrator/risk",
        replacement: path.resolve(import.meta.dirname, "../../services/orchestrator/src/risk.ts")
      }
    ]
  },
  test: {
    environment: "node",
    testTimeout: 180000
  }
});
