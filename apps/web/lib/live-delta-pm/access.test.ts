import { afterEach, describe, expect, it } from "vitest";
import { expectedAccessToken as lprExpectedAccessToken } from "../live-predict-raven/access";
import { expectedAccessToken, isValidAccessToken, isValidCode } from "./access";

describe("live-delta-pm access gate", () => {
  afterEach(() => {
    delete process.env.LIVE_DELTA_PM_CODE;
  });

  it("accepts the default code, ignoring surrounding whitespace", () => {
    expect(isValidCode("raven-labs")).toBe(true);
    expect(isValidCode("  raven-labs  ")).toBe(true);
  });

  it("rejects wrong, empty, oversized, and non-string codes", () => {
    expect(isValidCode("raven-lab")).toBe(false);
    expect(isValidCode("")).toBe(false);
    expect(isValidCode("x".repeat(200))).toBe(false);
    expect(isValidCode(null)).toBe(false);
    expect(isValidCode(42)).toBe(false);
  });

  it("honors LIVE_DELTA_PM_CODE overriding the default", () => {
    process.env.LIVE_DELTA_PM_CODE = "other-code";
    expect(isValidCode("raven-labs")).toBe(false);
    expect(isValidCode("other-code")).toBe(true);
  });

  it("round-trips the cookie token and rejects malformed ones", () => {
    expect(isValidAccessToken(expectedAccessToken())).toBe(true);
    expect(isValidAccessToken("deadbeef")).toBe(false);
    expect(isValidAccessToken(undefined)).toBe(false);
    expect(isValidAccessToken("g".repeat(64))).toBe(false);
  });

  it("invalidates old cookies when the code changes", () => {
    const oldToken = expectedAccessToken();
    process.env.LIVE_DELTA_PM_CODE = "rotated";
    expect(isValidAccessToken(oldToken)).toBe(false);
  });

  it("does not share cookie tokens with the live-predict-raven gate (different namespace)", () => {
    // Same default code word, but the sha256 namespace differs — a cookie
    // minted for one page must not unlock the other.
    expect(expectedAccessToken()).not.toBe(lprExpectedAccessToken());
    expect(isValidAccessToken(lprExpectedAccessToken())).toBe(false);
  });
});
