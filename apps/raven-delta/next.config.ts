import path from "node:path";
import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/base-path";

const workspaceRoot = path.join(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  // Served behind the main site's reverse proxy at forecasting-agent.com/delta/*.
  basePath: BASE_PATH,
  // Monorepo: trace files from the workspace root so workspace deps resolve.
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot
  }
};

export default nextConfig;
