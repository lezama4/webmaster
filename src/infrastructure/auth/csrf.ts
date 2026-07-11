/**
 * Canonical-origin CSRF policy (M5, ADR D7). Compares the request's
 * normalized `Origin` (falling back to `Referer`) against ONE canonical,
 * allowlisted public URL read from server configuration — NEVER against
 * the request's own `Host` header, which is spoofable/relayable without a
 * verified trusted-proxy setup. Absent, malformed, or mismatched values are
 * REJECTED — fail closed. Wiring this into route handlers (incl.
 * `POST /api/auth/login`) is Phase 5 (task 5.13); this module only provides
 * the pure decision.
 */

export interface CsrfCheckInput {
  /** HTTP method of the incoming request. */
  readonly method: string;
  /** Raw `Origin` header value, or `null`/`undefined` if absent. */
  readonly origin?: string | null;
  /** Raw `Referer` header value, used only when `Origin` is absent. */
  readonly referer?: string | null;
}

/** Methods that never carry a CSRF-relevant mutation — GET/HEAD must never perform a mutation regardless of the caller's CSRF headers (design's "no mutation via GET" rule is enforced by route wiring, not here; this only reports whether the ORIGIN check would pass). */
const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Extracts the scheme+host+port "origin" of a URL string. Returns `null`
 * for anything that fails to parse — a malformed header is a REJECTION,
 * never treated as "no CSRF risk" (fail closed).
 */
function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * `true` only when the request's own declared origin (Origin, or Referer
 * as fallback) exactly matches the canonical, server-configured public URL.
 * Safe methods (GET/HEAD/OPTIONS) always pass — they carry no mutation to
 * protect, and this check is not a general request filter.
 */
export function isCsrfSafe(
  input: CsrfCheckInput,
  canonicalOrigin: string,
): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true;

  const canonical = normalizeOrigin(canonicalOrigin);
  if (!canonical) {
    // A misconfigured canonical origin must never silently allow everything.
    return false;
  }

  const candidate = normalizeOrigin(input.origin) ?? normalizeOrigin(input.referer);
  if (!candidate) return false; // Absent/malformed — fail closed.

  return candidate === canonical;
}

/** Thrown by route handlers (Phase 5 wiring) when `isCsrfSafe` denies a request. Defined here so the decision and its error type travel together. */
export class CsrfRejectedError extends Error {
  constructor(message = "CSRF check failed: origin not allowlisted") {
    super(message);
    this.name = "CsrfRejectedError";
  }
}

/** Throws `CsrfRejectedError` when `isCsrfSafe` would deny the request. */
export function assertCsrfSafe(
  input: CsrfCheckInput,
  canonicalOrigin: string,
): void {
  if (!isCsrfSafe(input, canonicalOrigin)) {
    throw new CsrfRejectedError();
  }
}
