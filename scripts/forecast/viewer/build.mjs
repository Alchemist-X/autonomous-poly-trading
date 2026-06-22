// Injects a chosen forecast state.json into template.html -> index.html.
// The output index.html is fully self-contained (data embedded inline) — open it
// directly via file:// or serve the folder; no fetch / server required.
//
// Usage:
//   node build.mjs                         # default: rich 6-iteration foldable run
//   node build.mjs <path-to-state.json>    # any forecast run
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const DEFAULT = join(repo, "runtime-artifacts/forecasts/will-apple-release-a-foldable-iphone-f450db2a/state.json");

const src = process.argv[2] ? join(process.cwd(), process.argv[2]) : DEFAULT;
const state = JSON.parse(readFileSync(src, "utf8"));
const tpl = readFileSync(join(here, "template.html"), "utf8");

// embed as JSON; neutralize sequences that could break out of the <script> block
const json = JSON.stringify(state)
  .replace(/<\/script/gi, "<\\/script")
  .replace(/<!--/g, "<\\!--");

writeFileSync(join(here, "index.html"), tpl.replace("__RUN_JSON__", json));
console.log("built index.html from", relative(repo, src),
  `| ${state.round} iterations, ${state.evidenceLedger.length} ledger sources, P(YES)=${(state.currentProb * 100).toFixed(1)}%`);
