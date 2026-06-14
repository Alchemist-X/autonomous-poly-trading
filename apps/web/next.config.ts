import type { NextConfig } from "next";
import path from "node:path";

const workspaceRoot = path.join(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot
  }
  // NOTE: locale URL mapping (trailing-suffix → internal /[locale]/…) lives in
  // vercel.json `routes`, NOT here. This repo deploys via a custom vercel.json
  // catch-all that prefixes every path with /apps/web/ and runs BEFORE Next's
  // own rewrites, so next.config rewrites would never match. See vercel.json.
};

export default nextConfig;
