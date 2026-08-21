import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { acquireBookLock, appendLedger, paths, readJson, readLedger, releaseBookLock, writeJsonAtomic } from "./store.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "delta-pm-store-"));
  process.env.ARTIFACT_STORAGE_ROOT = dir;
});

afterEach(() => {
  delete process.env.ARTIFACT_STORAGE_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

describe("store", () => {
  it("writeJsonAtomic/readJson round-trip", () => {
    const file = path.join(dir, "delta-pm", "x.json");
    writeJsonAtomic(file, { a: 1 });
    expect(readJson<{ a: number }>(file)).toEqual({ a: 1 });
  });

  it("readJson returns null for missing or corrupt files", () => {
    const file = path.join(dir, "nope.json");
    expect(readJson(file)).toBeNull();
    writeJsonAtomic(file, { ok: true });
    appendFileSync(file, "garbage");
    expect(readJson(file)).toBeNull();
  });

  it("ledger appends with timestamps and tolerates a torn tail line", () => {
    appendLedger({ type: "service_start" });
    appendLedger({ type: "news_seen", newsId: "n1" });
    appendFileSync(paths.ledger(), '{"type":"torn'); // simulated crash mid-write
    const events = readLedger();
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("service_start");
    expect(typeof events[0].ts).toBe("string");
  });

  it("book lock is exclusive and releasable", () => {
    expect(acquireBookLock()).toBe(true);
    expect(acquireBookLock()).toBe(false); // held
    releaseBookLock();
    expect(acquireBookLock()).toBe(true);
    releaseBookLock();
  });
});
