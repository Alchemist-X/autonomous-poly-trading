import { describe, expect, it } from "vitest";
// The engine's own implementation — the parity oracle. If either side drifts,
// the API would poll a different event dir than the CLI writes to.
import { makeEventId as engineMakeEventId } from "../../../scripts/forecast/store";
import { isSafeEventId, makeEventId, readEnvFile } from "./repo";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

describe("makeEventId", () => {
  const samples = [
    "Will SpaceX land Starship on the Moon before 2030?",
    "特斯拉 2026 年会发布 Robotaxi 吗？",
    "   spaced   out   question with   many words beyond six   ",
    "!!!",
    "Will the Fed cut rates before September 2026? (per FOMC statement)"
  ];

  it("stays byte-identical to scripts/forecast/store.ts", () => {
    for (const q of samples) {
      expect(makeEventId(q)).toBe(engineMakeEventId(q));
    }
  });

  it("always produces a safe event id", () => {
    for (const q of samples) {
      expect(isSafeEventId(makeEventId(q))).toBe(true);
    }
  });
});

describe("isSafeEventId", () => {
  it("rejects path traversal and uppercase", () => {
    expect(isSafeEventId("../../etc/passwd")).toBe(false);
    expect(isSafeEventId("foo/bar")).toBe(false);
    expect(isSafeEventId("Foo-bar")).toBe(false);
    expect(isSafeEventId("")).toBe(false);
    expect(isSafeEventId("will-spacex-land-abc12345")).toBe(true);
  });
});

describe("readEnvFile", () => {
  it("parses KEY=VALUE lines, strips quotes, skips comments", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fapi-env-"));
    const file = path.join(dir, ".env.test");
    writeFileSync(file, '# comment\nFOO=bar\nQUOTED="hello"\n\nBAD LINE\n', "utf8");
    expect(readEnvFile(file)).toEqual({ FOO: "bar", QUOTED: "hello" });
    expect(readEnvFile(path.join(dir, "missing"))).toEqual({});
  });
});
