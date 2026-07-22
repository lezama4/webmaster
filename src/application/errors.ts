import type { SupportPayment } from "@domain/support-payment/SupportPayment";

/**
 * Shared application error taxonomy (N1, pr2-review).
 *
 * Use cases raise from this taxonomy (or propagate domain errors); route
 * handlers map each class to an HTTP status exactly once, at the boundary.
 * Denial tests assert against these classes, never against HTTP concerns.
 *
 * Two members are deliberately unmapped today — `AdapterContractError` and
 * `FailedSimulationError` — because no route reaches them yet. Both would fall
 * through to a generic 500 in `toErrorResponse`.
 *
 * For `AdapterContractError` that mapping is unreachable from
 * `simulateSupportPayment`: the error is only ever constructed inside that use
 * case's guarded region, whose `catch` unconditionally rethrows a
 * `FailedSimulationError`, so it surfaces ONLY as `FailedSimulationError.cause`
 * and never reaches `toErrorResponse` from there. (Adapters may also raise it
 * at wiring time — see `FakePaymentGateway` — which is outside any request
 * path.)
 *
 * For `FailedSimulationError` the missing mapping is a KNOWN GAP the first
 * handler to expose the simulation must close. That handler MUST branch on
 * `causedByAdapterDefect` before choosing a status: an adapter defect and a
 * legitimate decline-cancel are otherwise indistinguishable at the thrown
 * type, so mapping the class wholesale to a business status would report
 * adapter defects to clients as ordinary business outcomes.
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
 * A port contract was violated by one of its own participants — an adapter
 * returned a response the port forbids, was handed a request the port forbids,
 * or was wired with configuration the port forbids. This is an adapter/wiring
 * defect, not caller input and not a domain-invariant violation, so it must
 * not be raised as a `DomainError`: a gateway response is not domain input.
 *
 * It is intentionally left unmapped in `toErrorResponse`. That mapping is in
 * any case unreachable from `simulateSupportPayment`, which wraps every
 * throw from its guarded region in a `FailedSimulationError`; there it
 * survives only as `cause`, discriminated by
 * `FailedSimulationError.causedByAdapterDefect`.
 */
export class AdapterContractError extends ApplicationError {}

/**
 * Upper bound on the derived `FailedSimulationError.message`. The message is
 * built from adapter-supplied text, which reaches logs; every other
 * adapter-supplied value in this flow is bounded or withheld, and this one
 * must be too. Nothing is lost: the full value always survives on `cause`.
 */
export const MAX_FAILED_SIMULATION_MESSAGE_LENGTH = 512;

const TRUNCATION_MARKER = "… (truncated)";

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

  /**
   * Whether the failure was an adapter DEFECT (`cause` is an
   * `AdapterContractError`) rather than an ordinary business outcome such as a
   * gateway decline or an infrastructure rejection.
   *
   * It exists because `AdapterContractError` cannot escape
   * `simulateSupportPayment` on its own: it is raised inside the guarded
   * region, whose `catch` unconditionally wraps it here. Without this flag the
   * two cases are indistinguishable at the thrown type, and a handler mapping
   * `FailedSimulationError` to a business status would report adapter defects
   * to clients as ordinary business outcomes — the exact confusion splitting
   * `AdapterContractError` out of the taxonomy was meant to prevent.
   *
   * Own, non-enumerable, non-writable, for the same reason as
   * `cancelledPayment`: a handler must not be able to forge it.
   */
  declare readonly causedByAdapterDefect: boolean;

  constructor(cancelledPayment: SupportPayment, cause: unknown) {
    super(describeCause(cause), { cause });
    Object.defineProperty(this, "cancelledPayment", {
      value: cancelledPayment,
      enumerable: false,
      writable: false,
      configurable: false,
    });
    Object.defineProperty(this, "causedByAdapterDefect", {
      value: isAdapterDefect(cause),
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
}

/**
 * Classifies a rejection without ever throwing itself, for the same reason as
 * `describeCause`: this runs inside the `catch`, after the payment has already
 * been cancelled, and `instanceof` performs a prototype lookup a `Proxy` can
 * trap and make throw. An unclassifiable cause is reported as NOT an adapter
 * defect, which is the conservative answer: it keeps the failure in the
 * business-outcome class rather than silently promoting an unknown value to a
 * defect.
 */
function isAdapterDefect(cause: unknown): boolean {
  try {
    return cause instanceof AdapterContractError;
  } catch {
    return false;
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
 *
 * Adapter-supplied text is additionally BOUNDED before it becomes the message,
 * because that message reaches logs and the adapter controls its length. The
 * `typeof`-only fallback needs no bound: it interpolates nothing but a
 * built-in type name.
 */
function describeCause(cause: unknown): string {
  try {
    if (typeof cause === "string") {
      return bound(cause);
    }
    if (cause instanceof Error) {
      // Read the accessor exactly once, then check the value it produced.
      const message: unknown = cause.message;
      if (typeof message === "string") {
        return bound(message);
      }
    }
  } catch {
    // Fall through to the safe branch below.
  }
  return `simulation rejected with a value of type '${typeof cause}' carrying no readable string message`;
}

/** Truncates to at most `MAX_FAILED_SIMULATION_MESSAGE_LENGTH`, marker included. */
function bound(message: string): string {
  if (message.length <= MAX_FAILED_SIMULATION_MESSAGE_LENGTH) {
    return message;
  }
  return (
    message.slice(
      0,
      MAX_FAILED_SIMULATION_MESSAGE_LENGTH - TRUNCATION_MARKER.length,
    ) + TRUNCATION_MARKER
  );
}
