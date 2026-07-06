import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acquireBookLock, paperRoot, releaseBookLock } from "./store";

let root: string;
let prev: string | undefined;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "paper-lock-"));
  prev = process.env.ARTIFACT_STORAGE_ROOT;
  process.env.ARTIFACT_STORAGE_ROOT = root;
});
afterEach(() => {
  if (prev === undefined) delete process.env.ARTIFACT_STORAGE_ROOT;
  else process.env.ARTIFACT_STORAGE_ROOT = prev;
  rmSync(root, { recursive: true, force: true });
});

describe("book lock", () => {
  it("second acquire fails while held, succeeds after release", () => {
    expect(acquireBookLock()).toBe(true);
    expect(acquireBookLock()).toBe(false); // cross-process contention
    releaseBookLock();
    expect(acquireBookLock()).toBe(true);
    releaseBookLock();
  });

  it("reclaims a stale lock", () => {
    // Write an old lock by hand, then acquire with a 0ms staleness window.
    mkdirSync(paperRoot(), { recursive: true });
    writeFileSync(path.join(paperRoot(), "book.lock"), JSON.stringify({ pid: 1, at: "2000-01-01T00:00:00Z" }));
    expect(acquireBookLock(0)).toBe(true);
    releaseBookLock();
  });
});
