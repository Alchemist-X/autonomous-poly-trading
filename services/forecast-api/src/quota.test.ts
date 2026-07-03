import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { quotaDir, quotaUsed, tryConsumeQuota } from "./quota";

// quota.ts resolves its dir from ARTIFACT_STORAGE_ROOT at call time, so the
// whole suite runs against a throwaway root.
let root: string;
let prevEnv: string | undefined;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "fapi-quota-"));
  prevEnv = process.env.ARTIFACT_STORAGE_ROOT;
  process.env.ARTIFACT_STORAGE_ROOT = root;
});

afterAll(() => {
  if (prevEnv === undefined) delete process.env.ARTIFACT_STORAGE_ROOT;
  else process.env.ARTIFACT_STORAGE_ROOT = prevEnv;
  rmSync(root, { recursive: true, force: true });
});

describe("tryConsumeQuota", () => {
  it("counts up to the limit, then refuses", () => {
    expect(quotaUsed("svc-a", "2026-07-03")).toBe(0);
    expect(tryConsumeQuota("svc-a", 2, "2026-07-03")).toBe(true);
    expect(tryConsumeQuota("svc-a", 2, "2026-07-03")).toBe(true);
    expect(tryConsumeQuota("svc-a", 2, "2026-07-03")).toBe(false);
    expect(quotaUsed("svc-a", "2026-07-03")).toBe(2);
  });

  it("limit 0 refuses immediately (invite-only mode)", () => {
    expect(tryConsumeQuota("svc-zero", 0, "2026-07-03")).toBe(false);
    expect(quotaUsed("svc-zero", "2026-07-03")).toBe(0);
  });

  it("a new day starts a fresh counter and prunes the old one", () => {
    expect(tryConsumeQuota("svc-b", 5, "2026-07-03")).toBe(true);
    expect(tryConsumeQuota("svc-b", 5, "2026-07-04")).toBe(true);
    expect(quotaUsed("svc-b", "2026-07-04")).toBe(1);
    // old-day file pruned, other services untouched
    const files = readdirSync(quotaDir());
    expect(files).toContain("svc-b-2026-07-04.json");
    expect(files).not.toContain("svc-b-2026-07-03.json");
    expect(files).toContain("svc-a-2026-07-03.json");
  });

  it("services count independently", () => {
    expect(tryConsumeQuota("svc-c", 1, "2026-07-03")).toBe(true);
    expect(tryConsumeQuota("svc-d", 1, "2026-07-03")).toBe(true);
    expect(tryConsumeQuota("svc-c", 1, "2026-07-03")).toBe(false);
  });
});
