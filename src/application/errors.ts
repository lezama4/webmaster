/**
 * Shared application error taxonomy (N1, pr2-review).
 *
 * Use cases raise from this taxonomy (or propagate domain errors); route
 * handlers map each class to an HTTP status exactly once, at the boundary.
 * Denial tests assert against these classes, never against HTTP concerns.
 */
export abstract class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** No, invalid, or expired session/credentials (maps to 401 at the boundary). */
export class UnauthenticatedError extends ApplicationError {}

/** Role, ownership, or live-Profile-status denial (maps to 403). */
export class ForbiddenError extends ApplicationError {}

/** Lock/guard/unique-index race or duplicate-submission denial (maps to 409). */
export class ConflictError extends ApplicationError {}

/** A referenced resource does not exist or does not belong to the target (404). */
export class NotFoundError extends ApplicationError {}
