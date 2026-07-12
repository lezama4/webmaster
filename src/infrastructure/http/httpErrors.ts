import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
} from "@application/errors";
import { DomainError } from "@domain/errors";

/**
 * HTTP error-mapping boundary (Phase 5 foundation). Maps the application
 * error taxonomy (`@application/errors`) — and any propagated `DomainError`
 * (`registerProfile`/domain entities raise these directly on invariant
 * violations, e.g. `DomainValidationError`) — to an HTTP `Response`.
 *
 * The JSON body is ALWAYS a short, generic `{ error: string }` — never the
 * caught error's own `message` or `stack`. Route handlers call this exactly
 * once, at the boundary; nothing upstream constructs its own error Response.
 */
export function toErrorResponse(error: unknown): Response {
  const [status, message] = statusAndMessage(error);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function statusAndMessage(error: unknown): readonly [number, string] {
  if (error instanceof UnauthenticatedError) {
    return [401, "Unauthenticated"];
  }
  if (error instanceof ForbiddenError) {
    return [403, "Forbidden"];
  }
  if (error instanceof NotFoundError) {
    return [404, "Not found"];
  }
  if (error instanceof ConflictError) {
    return [409, "Conflict"];
  }
  if (error instanceof DomainError) {
    // Every DomainError subclass (DomainValidationError, InvalidTransitionError,
    // NotSlotOwnerError) represents a rejected domain operation, never an
    // internal failure — 422 Unprocessable Entity, generic message, no
    // invariant detail leaked to the caller.
    return [422, "Invalid request"];
  }
  // Anything unmapped (parse errors, adapter/infra failures, programmer
  // errors) — NEVER leak the internal message or stack to the client.
  return [500, "Internal error"];
}
