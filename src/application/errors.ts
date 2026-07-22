import type { SupportPayment } from "@domain/support-payment/SupportPayment";

/**
 * Shared application error taxonomy (N1, pr2-review).
 *
 * Use cases raise from this taxonomy (or propagate domain errors); route
 * handlers map each class to an HTTP status exactly once, at the boundary.
 * Denial tests assert against these classes, never against HTTP concerns.
 *
 * Two members are deliberately unmapped today — `AdapterContractError` and
 * `FailedSimulationError` — because no route reaches them yet. Both fall
 * through to a generic 500 in `toErrorResponse`. That is correct for the
 * former (an adapter defect) and a KNOWN GAP for the latter (a cancelled
 * simulation is an ordinary business outcome), which the first handler to
 * expose the simulation must close.
 */
export abstract class ApplicationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
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

/**
 * An adapter returned a response its port contract forbids. This is an
 * adapter/wiring defect, not caller input and not a domain-invariant
 * violation, so it must not be raised as a `DomainError`: a gateway response
 * is not domain input. It is intentionally left unmapped in
 * `toErrorResponse`, where it falls through to a generic 500 — the correct
 * status for a defect on our side of the boundary.
 */
export class AdapterContractError extends ApplicationError {}

/**
 * A simulated payment that never reached a settlement, carrying the payment it
 * left behind, cancelled. Without it a gateway rejection, a rejected receipt,
 * or a refused settlement would abandon the created payment in `pending`
 * forever, and the documented `pending -> cancelled` arm would have no driver
 * in the application layer.
 *
 * It is a dedicated class rather than a property assigned onto the caught
 * error: adapters commonly throw a module-level error constant, and writing to
 * that shared object would make two concurrent failures overwrite each other's
 * cancelled payment — and would throw outright if the adapter froze it.
 *
 * No HTTP status is mapped for it yet, because this change introduces no
 * route. A handler that later exposes the simulation MUST map it explicitly;
 * until then it falls through to 500 like any unmapped error.
 */
export class FailedSimulationError extends ApplicationError {
  /**
   * Own, non-enumerable, non-writable: `readonly` must hold at runtime, and a
   * structured log of this error must not serialize the whole aggregate.
   */
  declare readonly cancelledPayment: SupportPayment;

  constructor(cancelledPayment: SupportPayment, cause: unknown) {
    super(describeCause(cause), { cause });
    Object.defineProperty(this, "cancelledPayment", {
      value: cancelledPayment,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
}

/**
 * Describes a rejection without ever throwing itself. This runs INSIDE the
 * catch block, after the pending payment has already been cancelled, so a
 * throw here would discard that cancelled payment and lose the original cause
 * entirely — the exact failure this whole error class exists to prevent.
 *
 * Every read of an attacker-influenced value is therefore guarded: `message`
 * is an arbitrary accessor that can throw or return a `Symbol`, `instanceof`
 * can be trapped by a `Proxy`, and `String(value)` raises `TypeError` for a
 * null-prototype object. `typeof` is the only operation here that cannot
 * fail. The original value is never lost: it is always attached as `cause`.
 */
function describeCause(cause: unknown): string {
  try {
    if (typeof cause === "string") {
      return cause;
    }
    if (cause instanceof Error) {
      // Read the accessor exactly once, then check the value it produced.
      const message: unknown = cause.message;
      if (typeof message === "string") {
        return message;
      }
    }
  } catch {
    // Fall through to the safe branch below.
  }
  return `simulation rejected with a value of type '${typeof cause}' carrying no readable string message`;
}
