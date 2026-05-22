import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export function loadEnvFile(): string | null {
  const explicitEnvFile = process.env.ENV_FILE?.trim();
  if (explicitEnvFile) {
    const explicitCandidates = path.isAbsolute(explicitEnvFile)
      ? [explicitEnvFile]
      : (() => {
          const candidates: string[] = [];
          let currentDir = process.cwd();
          while (true) {
            candidates.push(path.resolve(currentDir, explicitEnvFile));
            const parent = path.dirname(currentDir);
            if (parent === currentDir) {
              break;
            }
            currentDir = parent;
          }
          return candidates;
        })();

    for (const candidate of explicitCandidates) {
      if (!fs.existsSync(candidate)) {
        continue;
      }
      dotenv.config({ path: candidate, override: true });
      return candidate;
    }
    return null;
  }

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

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    dotenv.config({ path: candidate, override: false });
    return candidate;
  }

  return null;
}
