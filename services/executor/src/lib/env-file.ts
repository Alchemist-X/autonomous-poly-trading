import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export function loadEnvFile(): string | null {
  const candidates = new Set<string>();
  let currentDir = process.cwd();

  while (true) {
    candidates.add(path.join(currentDir, ".env"));
    candidates.add(path.join(currentDir, ".env.local"));
    candidates.add(path.join(currentDir, ".env.aizen"));
    candidates.add(path.join(currentDir, "pm-PlaceOrder", ".env.aizen"));
    candidates.add(path.join(currentDir, "..", "pm-PlaceOrder", ".env.aizen"));

    const parent = path.dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }

  if (process.env.ENV_FILE) {
    candidates.add(process.env.ENV_FILE);
  }

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    dotenv.config({ path: candidate, override: false });
    return candidate;
  }

  return null;
}
