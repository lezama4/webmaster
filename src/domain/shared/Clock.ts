/**
 * Minimal time source injected into domain operations so time-dependent
 * rules stay deterministic and testable (never `Date.now()` directly).
 * The application layer's `Clock` port satisfies this interface.
 */
export interface Clock {
  now(): Date;
}
