import { afterEach, describe, expect, it } from "vitest";
import { emailDomain, isAdminEmail, normalizeEmail, shouldAutoActivate } from "./prediction-access-rules";

const ENV_KEYS = [
  "PREDICTION_ADMIN_EMAILS",
  "PREDICTION_INVITE_REQUIRED",
  "PREDICTION_AUTO_ACTIVATE_EMAIL_DOMAINS"
];

describe("prediction-access rules", () => {
  afterEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });

  describe("normalizeEmail", () => {
    it("trims + lowercases, mapping blank to null", () => {
      expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
      expect(normalizeEmail("")).toBeNull();
      expect(normalizeEmail("   ")).toBeNull();
      expect(normalizeEmail(null)).toBeNull();
      expect(normalizeEmail(undefined)).toBeNull();
    });
  });

  describe("emailDomain", () => {
    it("returns the lowercased domain after the last @", () => {
      expect(emailDomain("foo@bar.com")).toBe("bar.com");
      expect(emailDomain("weird@a@c.com")).toBe("c.com");
    });
    it("returns null when there is no @ or no input", () => {
      expect(emailDomain("nodomain")).toBeNull();
      expect(emailDomain(null)).toBeNull();
    });
  });

  describe("isAdminEmail (PREDICTION_ADMIN_EMAILS allowlist)", () => {
    it("matches an email in the allowlist (env values lowercased)", () => {
      process.env.PREDICTION_ADMIN_EMAILS = "admin@x.com, Boss@Y.com";
      expect(isAdminEmail("admin@x.com")).toBe(true);
      expect(isAdminEmail("boss@y.com")).toBe(true);
      expect(isAdminEmail("nobody@z.com")).toBe(false);
      expect(isAdminEmail(null)).toBe(false);
    });
    it("is false when the allowlist is unset", () => {
      expect(isAdminEmail("admin@x.com")).toBe(false);
    });
  });

  describe("shouldAutoActivate (gating: who skips the invite)", () => {
    it("auto-activates everyone when invites are NOT required", () => {
      process.env.PREDICTION_INVITE_REQUIRED = "false";
      expect(shouldAutoActivate("anyone@anywhere.com")).toBe(true);
      expect(shouldAutoActivate(null)).toBe(true);
    });
    it("when invites ARE required, only auto-activates allowlisted email domains", () => {
      // default for PREDICTION_INVITE_REQUIRED is true (unset)
      process.env.PREDICTION_AUTO_ACTIVATE_EMAIL_DOMAINS = "team.com, x.com";
      expect(shouldAutoActivate("a@team.com")).toBe(true);
      expect(shouldAutoActivate("a@x.com")).toBe(true);
      expect(shouldAutoActivate("a@outsider.com")).toBe(false);
      expect(shouldAutoActivate(null)).toBe(false);
    });
    it("requires an invite (no auto-activate) when no allowlist domains are set", () => {
      expect(shouldAutoActivate("a@team.com")).toBe(false);
    });
  });
});
