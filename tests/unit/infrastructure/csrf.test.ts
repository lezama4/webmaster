import { describe, expect, it } from "vitest";
import { CsrfRejectedError, assertCsrfSafe, isCsrfSafe } from "@infrastructure/auth/csrf";

/**
 * Task 4.28 (M5 pr2-review): allowed origin passes; a hostile `Host`
 * header does not bypass the check (this module never reads `Host` at
 * all); cross-site `Origin` is rejected; absent headers are rejected
 * (fail closed); the same check covers `POST /api/auth/login` (no method
 * is exempt except the inherently-safe ones).
 */
const CANONICAL_ORIGIN = "https://vivetutiempo.example";

describe("CSRF canonical-origin check (4.28, M5)", () => {
  it("allows a request whose Origin matches the canonical URL", () => {
    expect(
      isCsrfSafe(
        { method: "POST", origin: "https://vivetutiempo.example" },
        CANONICAL_ORIGIN,
      ),
    ).toBe(true);
  });

  it("allows a request whose Origin matches even with a different path in the canonical URL", () => {
    expect(
      isCsrfSafe(
        { method: "POST", origin: "https://vivetutiempo.example" },
        "https://vivetutiempo.example/some/path",
      ),
    ).toBe(true);
  });

  it("rejects a cross-site Origin", () => {
    expect(
      isCsrfSafe(
        { method: "POST", origin: "https://attacker.example" },
        CANONICAL_ORIGIN,
      ),
    ).toBe(false);
  });

  it("rejects an absent Origin and Referer (fail closed)", () => {
    expect(isCsrfSafe({ method: "POST" }, CANONICAL_ORIGIN)).toBe(false);
  });

  it("rejects a malformed Origin header (fail closed)", () => {
    expect(
      isCsrfSafe({ method: "POST", origin: "not-a-url" }, CANONICAL_ORIGIN),
    ).toBe(false);
  });

  it("falls back to Referer only when Origin is absent", () => {
    expect(
      isCsrfSafe(
        { method: "POST", referer: "https://vivetutiempo.example/login" },
        CANONICAL_ORIGIN,
      ),
    ).toBe(true);
  });

  it("never trusts a spoofed Host — this module has no Host parameter at all", () => {
    // There is no `host` field on `CsrfCheckInput` by design (M5): the
    // request's own Host header can never influence this decision.
    expect(
      isCsrfSafe(
        { method: "POST", origin: "https://attacker.example" },
        CANONICAL_ORIGIN,
      ),
    ).toBe(false);
  });

  it("covers POST /api/auth/login the same as any other mutation", () => {
    // The login route is explicitly in scope (M5) — no method/path
    // carve-out exists in this module; the caller must apply it uniformly.
    expect(
      isCsrfSafe({ method: "POST", origin: "https://attacker.example" }, CANONICAL_ORIGIN),
    ).toBe(false);
    expect(
      isCsrfSafe({ method: "POST", origin: CANONICAL_ORIGIN }, CANONICAL_ORIGIN),
    ).toBe(true);
  });

  it("always allows safe methods regardless of Origin", () => {
    expect(isCsrfSafe({ method: "GET" }, CANONICAL_ORIGIN)).toBe(true);
    expect(isCsrfSafe({ method: "HEAD" }, CANONICAL_ORIGIN)).toBe(true);
  });

  it("rejects everything when the canonical origin itself is malformed", () => {
    expect(
      isCsrfSafe({ method: "POST", origin: CANONICAL_ORIGIN }, "not-a-url"),
    ).toBe(false);
  });

  it("assertCsrfSafe throws CsrfRejectedError on denial and is silent on success", () => {
    expect(() =>
      assertCsrfSafe({ method: "POST", origin: "https://attacker.example" }, CANONICAL_ORIGIN),
    ).toThrow(CsrfRejectedError);
    expect(() =>
      assertCsrfSafe({ method: "POST", origin: CANONICAL_ORIGIN }, CANONICAL_ORIGIN),
    ).not.toThrow();
  });
});
