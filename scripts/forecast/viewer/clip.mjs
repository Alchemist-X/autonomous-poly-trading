// Crisp targeted screenshots at 2x DPI. Usage: node clip.mjs <outDir> <url-path>...
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve(process.argv[2]);
const paths = process.argv.slice(3);
mkdirSync(out, { recursive: true });
const base = "http://127.0.0.1:8123";
const browser = await chromium.launch();
let errs = 0;
for (const p of paths) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const slug = p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  await page.goto(base + p, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(out, slug + ".png"), fullPage: true });
  errs += pageErrors.length;
  console.log(`${p}  pageerrors=${pageErrors.length}`);
  await ctx.close();
}
await browser.close();
console.log("done, total pageerrors:", errs);
