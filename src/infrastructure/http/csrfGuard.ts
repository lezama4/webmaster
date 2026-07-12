import { isCsrfSafe } from "@infrastructure/auth/csrf";
import { ForbiddenError } from "@application/errors";

/**
 * Canonical-origin env var read at the HTTP boundary (Phase 5, task 5.13).
 * `csrf.ts`'s pure `isCsrfSafe`/`assertCsrfSafe` take the canonical origin
 * as a parameter and do not read any env var themselves — no existing env
 * var was already "the" canonical-origin var, so this introduces the one
 * `design.md` §D7 anticipates (`APP_PUBLIC_URL` in prose; `APP_ORIGIN` here,
 * per this task's explicit instruction). Documented in `.env.example`.
 */
const APP_ORIGIN_ENV_VAR = "APP_ORIGIN";

function canonicalOrigin(): string {
  // A misconfigured (unset) canonical origin must never silently allow
  // every request through (D7, fail closed) — `isCsrfSafe` already treats
  // an origin that fails to parse as "no match", so an empty string here
  // guarantees every non-safe-method request is rejected until this is
  // configured, rather than defaulting to "allow".
  return process.env[APP_ORIGIN_ENV_VAR] ?? "";
}

/**
 * HTTP-boundary CSRF guard (M5, D7, task 5.13). Reads `Origin`/`Referer`
 * off the incoming `Request`, delegates the decision to the existing pure
 * `isCsrfSafe` predicate, and throws the application error taxonomy's
 * `ForbiddenError` (mapped to 403 by `toErrorResponse`) on denial — route
 * handlers only ever catch `ApplicationError` subclasses at the boundary,
 * never `csrf.ts`'s own `CsrfRejectedError`. Fail-closed: absent, malformed,
 * or mismatched Origin/Referer are rejected; GET/HEAD/OPTIONS always pass
 * (no mutation to protect).
 */
export function assertCsrfSafe(request: Request): void {
  const safe = isCsrfSafe(
    {
      method: request.method,
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
    },
    canonicalOrigin(),
  );
  if (!safe) {
    throw new ForbiddenError("CSRF check failed: origin not allowlisted");
  }
}
