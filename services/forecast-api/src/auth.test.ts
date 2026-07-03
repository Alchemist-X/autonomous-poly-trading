import { describe, expect, it } from "vitest";
import { isAuthorized, presentedToken, tokenEquals } from "./auth";

const url = (s: string): URL => new URL(s, "http://x");

describe("tokenEquals", () => {
  it("matches equal strings and rejects near-misses", () => {
    expect(tokenEquals("secret", "secret")).toBe(true);
    expect(tokenEquals("secret", "secreT")).toBe(false);
    expect(tokenEquals("secret", "secret2")).toBe(false);
    expect(tokenEquals("", "")).toBe(true);
  });
});

describe("presentedToken", () => {
  it("reads bearer, x-api-key, then query token", () => {
    expect(presentedToken({ headers: { authorization: "Bearer abc" } }, url("/"))).toBe("abc");
    expect(presentedToken({ headers: { "x-api-key": "k" } }, url("/"))).toBe("k");
    expect(presentedToken({ headers: {} }, url("/?token=q"))).toBe("q");
    expect(presentedToken({ headers: {} }, url("/"))).toBe(null);
  });
});

describe("isAuthorized", () => {
  it("open when no token configured, strict otherwise", () => {
    expect(isAuthorized({ headers: {} }, url("/"), null)).toBe(true);
    expect(isAuthorized({ headers: {} }, url("/"), "t")).toBe(false);
    expect(isAuthorized({ headers: { authorization: "Bearer t" } }, url("/"), "t")).toBe(true);
    expect(isAuthorized({ headers: { authorization: "Bearer wrong" } }, url("/"), "t")).toBe(false);
  });
});
