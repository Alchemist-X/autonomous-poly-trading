import type { NextConfig } from "next";
import path from "node:path";

const workspaceRoot = path.join(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot
  }
};

export default nextConfig;
