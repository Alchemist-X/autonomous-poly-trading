import path from "node:path";
import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/base-path";

const workspaceRoot = path.join(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  // Monorepo: trace files from the workspace root so lockfile detection and
  // output tracing behave (same pattern as apps/raven-delta).
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot
  }
};

export default nextConfig;
