import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(import.meta.dirname, "../..")
  }
};

export default nextConfig;
