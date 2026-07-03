import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  authorizeInviteUse,
  createInvite,
  ensureSeeded,
  inviteState,
  inviteTable,
  invitesFile,
  revokeInvite
} from "./invites";

let root: string;
let prevEnv: string | undefined;

beforeAll(() => {
  prevEnv = process.env.ARTIFACT_STORAGE_ROOT;
});

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "fapi-invites-"));
  process.env.ARTIFACT_STORAGE_ROOT = root;
});

afterAll(() => {
  if (prevEnv === undefined) delete process.env.ARTIFACT_STORAGE_ROOT;
  else process.env.ARTIFACT_STORAGE_ROOT = prevEnv;
  rmSync(root, { recursive: true, force: true });
});

describe("invite store", () => {
  it("create → ok, meters uses, exhausts at max-uses", () => {
    createInvite({ code: "raven-test", label: "t", maxUses: 2 });
    expect(inviteState("raven-test")).toBe("ok");
    expect(authorizeInviteUse("raven-test", "forecast-api", "ev1")).toBe(true);
    expect(authorizeInviteUse("raven-test", "raven-web", "ev2")).toBe(true);
    expect(inviteState("raven-test")).toBe("exhausted");
    expect(authorizeInviteUse("raven-test", "forecast-api")).toBe(false);
    expect(inviteTable().get("raven-test")?.uses).toBe(2);
  });

  it("unlimited codes never exhaust; unknown codes never authorize", () => {
    createInvite({ code: "raven-unlimited" });
    for (let i = 0; i < 5; i++) expect(authorizeInviteUse("raven-unlimited", "s")).toBe(true);
    expect(inviteState("raven-unlimited")).toBe("ok");
    expect(inviteState("nope")).toBe("unknown");
    expect(authorizeInviteUse("nope", "s")).toBe(false);
  });

  it("revoke and expiry gate authorization", () => {
    createInvite({ code: "raven-rev" });
    expect(revokeInvite("raven-rev")).toBe(true);
    expect(inviteState("raven-rev")).toBe("revoked");
    expect(authorizeInviteUse("raven-rev", "s")).toBe(false);

    createInvite({ code: "raven-old", expiresAt: "2020-01-01" });
    expect(inviteState("raven-old")).toBe("expired");
    // date-only expiry is inclusive of the whole UTC day
    createInvite({ code: "raven-future", expiresAt: "2999-01-01" });
    expect(inviteState("raven-future")).toBe("ok");
    expect(revokeInvite("ghost")).toBe(false);
  });

  it("seeding is idempotent and duplicate creates keep the first record", () => {
    ensureSeeded("raven-labs");
    ensureSeeded("raven-labs");
    expect(inviteTable().get("raven-labs")?.label).toBe("seeded-from-env");
    expect(() => createInvite({ code: "raven-labs" })).toThrow(/exists/);
    ensureSeeded("");
    ensureSeeded(null);
    expect(inviteTable().size).toBe(1);
  });

  it("tolerates a torn line in the event log", () => {
    createInvite({ code: "raven-a", maxUses: 5 });
    appendFileSync(invitesFile(), '{"t":"use","code":"raven-a"', "utf8"); // torn write, no newline
    appendFileSync(invitesFile(), "\n", "utf8");
    expect(authorizeInviteUse("raven-a", "s")).toBe(true);
    expect(inviteTable().get("raven-a")?.uses).toBe(1);
  });

  it("generates raven-prefixed codes when none given", () => {
    const rec = createInvite({ label: "gen" });
    expect(rec.code).toMatch(/^raven-[0-9a-f]{6}$/);
    expect(inviteState(rec.code)).toBe("ok");
  });
});
