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
 * `simulateSupportPayment`. There are FOUR construction sites. Three of them
 * are reachable from this use case, and each is either inside its guarded
 * region (`validateGatewayResult`, twice) or inside the adapter call that
 * region awaits (`FakePaymentGateway.simulate` -> `syntheticReference`, which
 * runs on the request path, not at wiring time); the region's `catch`
 * unconditionally rethrows a `FailedSimulationError`, so from here the error
 * surfaces ONLY as `FailedSimulationError.cause` and never reaches
 * `toErrorResponse`. The fourth site — `FakePaymentGateway`'s constructor —
 * runs when the adapter is wired, before any call reaches the use case, so it
 * is not covered by that argument and is not reachable from a request either.
 *
 * For `FailedSimulationError` the missing mapping is a KNOWN GAP the first
 * handler to expose the simulation must close. That class is raised for
 * FAILURES ONLY: a gateway `outcome: "declined"` passes validation, settles
 * the payment, and RESOLVES normally, so it never reaches this error at all
 * and there is no business-outcome bucket inside the class. The handler MUST
 * still branch on `causedByAdapterDefect` before choosing a status, because
 * the class mixes an adapter-contract DEFECT (a bug on our side of the
 * boundary) with a gateway or infrastructure REJECTION (an external failure).
 * Mapping the class wholesale to a business status would be wrong for every
 * member of it.
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
 * any case unreachable from `simulateSupportPayment`, which wraps every throw
 * from its guarded region — including throws from the adapter call that region
 * awaits — in a `FailedSimulationError`; there it survives only as `cause`,
 * discriminated by `FailedSimulationError.causedByAdapterDefect`. The one
 * construction site outside that region is `FakePaymentGateway`'s constructor,
 * which runs at wiring time.
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
   * Whether the failure is an adapter-contract DEFECT (`cause` is an
   * `AdapterContractError`) rather than a gateway or infrastructure REJECTION.
   * Both arms are failures. A gateway decline is in NEITHER: a `declined`
   * outcome settles the payment and the use case resolves normally, so it
   * never reaches this class.
   *
   * It exists because `AdapterContractError` cannot escape
   * `simulateSupportPayment` on its own: it is raised inside the guarded
   * region, whose `catch` unconditionally wraps it here, erasing the
   * distinction at the thrown type.
   *
   * It is a PARTIAL classifier, not a total one. `true` means this codebase
   * itself labelled the cause `AdapterContractError`; `false` means only that
   * it did not. An adapter throwing its own error type is a genuine defect
   * that reads as `false`. See "Known non-guarantees" in
   * `docs/simulated-payment-security-review.md`.
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
    // `Error` installs `cause` as writable AND configurable. A handler is told
    // it may branch on the discriminator OR unwrap `cause`; leaving `cause`
    // writable would make those two routes unequally protected, because the
    // value the locked discriminator was derived from could still be swapped
    // underneath it. Re-declared with the same value and the same
    // non-enumerable shape `Error` gives it, only locked.
    Object.defineProperty(this, "cause", {
      value: cause,
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
 * trap and make throw.
 *
 * A cause it cannot classify is reported as NOT a defect. That is the only
 * answer available without throwing, but it is NOT a safe default: `false` is
 * the value a handler is told to read as "not an adapter defect", so an
 * unclassifiable cause is DEMOTED rather than escalated. Read `false` as "not
 * labelled `AdapterContractError` by this codebase", never as "definitely not
 * a defect".
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
