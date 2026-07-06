import { defineConfig } from "vitest/config";

// Minimal config for @autopoly/raven-delta: pure node-environment unit tests.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"]
  }
});
