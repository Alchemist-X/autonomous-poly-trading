// Drives the LIVE viewer in a real browser against the running server:
// screenshots the input page (recent runs), the live reasoning phase, and the
// final result. Reuses any in-flight run (consulting the same question returns
// the existing job), so it does not start an extra engine run.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "runtime-artifacts/forecast-viewer/shots/live";
mkdirSync(OUT, { recursive: true });
const Q = process.argv[2] || "Will SpaceX launch Starship to orbit in 2026?";

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const pg = await ctx.newPage();
const errs = [];
pg.on("pageerror", (e) => errs.push(e.message));

await pg.goto("http://127.0.0.1:8123/", { waitUntil: "networkidle" });
await pg.waitForTimeout(1200);
await pg.screenshot({ path: `${OUT}/01-input.png` });
console.log("captured input (recent runs)");

await pg.fill("#qbox", Q);
await pg.click('[data-action="consult"]');
await pg.waitForTimeout(9000);
await pg.screenshot({ path: `${OUT}/02-reasoning-a.png` });
await pg.waitForTimeout(26000);
await pg.screenshot({ path: `${OUT}/02-reasoning-b.png` });
console.log("captured reasoning x2");

let reachedResult = false;
for (let i = 0; i < 50; i++) {
  const isResult = await pg.evaluate(() => document.body.innerText.includes("RAVEN’S ESTIMATE"));
  if (isResult) { reachedResult = true; break; }
  await pg.waitForTimeout(6000);
}
await pg.waitForTimeout(1500);
await pg.screenshot({ path: `${OUT}/03-result.png`, fullPage: true });
console.log("reachedResult:", reachedResult, "| pageerrors:", errs.length, errs.slice(0, 3));
await b.close();
