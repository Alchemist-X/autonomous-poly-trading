#!/usr/bin/env node
// Visual QA harness for any Next.js app under apps/* (per CLAUDE.md §9).
//
// Usage:
//   node scripts/visual-qa.mjs --base http://localhost:3100 \
//     --paths /,/signup,/onboard,/dashboard,/track-record \
//     --out runtime-artifacts/screenshots/2026-05-04-1700-task-1 \
//     --viewports desktop,mobile
//
// Outputs:
//   <out>/<viewport>__<slug>.png             screenshot
//   <out>/diag.json                            consolidated console + pageerror dump
//
// Exit non-zero if any pageerror was captured.

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const base = args.base ?? "http://localhost:3100";
const paths = (args.paths ?? "/").split(",").map((p) => p.trim()).filter(Boolean);
const outDir = resolve(args.out ?? `runtime-artifacts/screenshots/${stamp()}`);
const viewportSpec = (args.viewports ?? "desktop,mobile").split(",");

const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 375, height: 812 }
};

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const diag = { base, runs: [] };
let pageErrorTotal = 0;

for (const vp of viewportSpec) {
  const viewport = viewports[vp];
  if (!viewport) {
    console.warn(`unknown viewport "${vp}", skipping`);
    continue;
  }
  for (const path of paths) {
    const url = `${base}${path}`;
    const slug = pathSlug(path);
    const file = `${vp}__${slug}.png`;

    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const consoleMsgs = [];
    const pageErrors = [];
    page.on("console", (msg) => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on("pageerror", (err) => pageErrors.push({ message: err.message, stack: err.stack }));

    let httpStatus = null;
    let goError = null;
    try {
      const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      httpStatus = resp ? resp.status() : null;
      await page.waitForTimeout(1500);
      await page.screenshot({ path: resolve(outDir, file), fullPage: true });
    } catch (err) {
      goError = err.message;
    }

    const visible = goError
      ? null
      : await page.evaluate(() => {
          const body = document.body;
          return {
            bodyChildCount: body?.children.length ?? 0,
            bodyTextSample: (body?.innerText ?? "").slice(0, 240),
            bgColor: getComputedStyle(body).backgroundColor,
            color: getComputedStyle(body).color,
            fontFamily: getComputedStyle(body).fontFamily.split(",")[0]?.trim(),
            docTitle: document.title
          };
        });

    diag.runs.push({
      viewport: vp,
      path,
      url,
      file,
      httpStatus,
      goError,
      visible,
      consoleMsgs,
      pageErrors
    });
    pageErrorTotal += pageErrors.length;
    console.log(`${vp.padEnd(7)} ${path.padEnd(20)} status=${httpStatus ?? "—"} pageerrors=${pageErrors.length} → ${file}`);
    await ctx.close();
  }
}

await browser.close();
writeFileSync(resolve(outDir, "diag.json"), JSON.stringify(diag, null, 2));
console.log(`\nWrote ${diag.runs.length} screenshots + diag.json to ${outDir}`);
console.log(`Total pageerrors: ${pageErrorTotal}`);
if (pageErrorTotal > 0) {
  console.error("\nFAIL: pageerrors captured. Inspect diag.json before claiming task complete.");
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      out[a.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function pathSlug(p) {
  return p.replace(/^\//, "").replace(/\//g, "-").replace(/[^a-z0-9-_]/gi, "_") || "root";
}

function stamp() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}-${z(d.getUTCHours())}${z(d.getUTCMinutes())}-task`;
}
