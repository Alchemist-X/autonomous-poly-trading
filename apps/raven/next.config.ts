import path from "node:path";
import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/base-path";

const workspaceRoot = path.join(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  // Served under forecasting-agent.com/engine/* via the main site's proxy.
  basePath: BASE_PATH,
  // The engine is a source-consumed workspace package (no dist), so Next must
  // compile its .ts entry points out of node_modules.
  transpilePackages: ["@autopoly/forecast-engine"],
  // Monorepo: trace files from the workspace root so workspace deps resolve.
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot
  }
};

export default nextConfig;
