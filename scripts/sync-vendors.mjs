import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, "vendor", "manifest.json");
const reposDir = path.join(repoRoot, "vendor", "repos");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
fs.mkdirSync(reposDir, { recursive: true });

for (const entry of manifest.repositories) {
  const target = path.join(reposDir, entry.name);

  if (!fs.existsSync(target)) {
    const clone = spawnSync("git", ["clone", entry.url, target], { stdio: "inherit" });
    if (clone.status !== 0) {
      process.exit(clone.status ?? 1);
    }
  }

  const fetch = spawnSync("git", ["-C", target, "fetch", "--all", "--tags"], {
    stdio: "inherit",
  });
  if (fetch.status !== 0) {
    process.exit(fetch.status ?? 1);
  }

  const checkout = spawnSync("git", ["-C", target, "checkout", entry.commit], {
    stdio: "inherit",
  });
  if (checkout.status !== 0) {
    process.exit(checkout.status ?? 1);
  }
}

