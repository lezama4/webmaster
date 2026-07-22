import { AdapterContractError } from "@application/errors";
import type {
  PaymentGateway,
  SimulatedGatewayRequest,
  SimulatedGatewayResult,
} from "@application/ports/PaymentGateway";
import { MAX_SUPPORT_PAYMENT_ID_LENGTH } from "@domain/support-payment/SupportPayment";

type SimulatedOutcome = SimulatedGatewayResult["outcome"];

export interface FakePaymentGatewayOptions {
  /** Trusted test/server configuration, never caller-controlled request data. */
  readonly outcome: SimulatedOutcome;
}

/** Frozen, not merely `readonly`: `readonly` is erased at compile time. */
const SIMULATED_OUTCOMES: readonly SimulatedOutcome[] = Object.freeze([
  "succeeded",
  "declined",
] as const);

/** Matches the opaque identifier charset the domain enforces on a payment id. */
const OPAQUE_PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Derives an obviously synthetic, per-payment receipt reference. Deriving it
 * from the payment id (instead of a per-instance counter) keeps it unique and
 * traceable across gateway instances — two fresh gateways must never both
 * claim `sim_1`.
 *
 * The mapping is the identity on the accepted charset, so it is injective:
 * distinct payment ids always produce distinct references. Rewriting
 * out-of-charset characters instead would make `pay 1`, `pay.1`, `pay/1` and
 * `pay+1` all collapse to the same reference, so a rejected request is
 * preferred over a silent collision. The adapter enforces this itself rather
 * than trusting the caller to have validated the id upstream.
 *
 * That self-reliance has to cover the LENGTH as well as the charset: the
 * pattern is unbounded, so an in-charset multi-megabyte id would otherwise
 * produce a multi-megabyte reference. The bound is the domain's own id bound,
 * because a longer id is not one this system issued.
 */
function syntheticReference(paymentId: string): string {
  if (
    typeof paymentId !== "string" ||
    paymentId.length > MAX_SUPPORT_PAYMENT_ID_LENGTH ||
    !OPAQUE_PAYMENT_ID_PATTERN.test(paymentId)
  ) {
    // A port-contract violation, raised from the project taxonomy rather than
    // as a bare `Error`, so a caller (and a test) can assert the class instead
    // of a predicate every exception satisfies.
    throw new AdapterContractError(
      `FakePaymentGateway requires an opaque payment id of letters, digits, hyphens, and underscores, at most ${MAX_SUPPORT_PAYMENT_ID_LENGTH} characters, to derive a collision-free synthetic reference`,
    );
  }
  return `sim_${paymentId}`;
}

/**
 * Deterministic no-I/O adapter for the TFM demo. It makes no network request,
 * stores no financial data, and returns only an explicitly synthetic receipt.
 */
export class FakePaymentGateway implements PaymentGateway {
  /**
   * The outcome is captured as a scalar at construction, never read back off
   * the caller's options object: holding that reference would let a later
   * mutation of the configuration flip an already-wired simulated outcome.
   */
  private readonly outcome: SimulatedOutcome;

  constructor(options: FakePaymentGatewayOptions) {
    // Read the configured outcome EXACTLY ONCE, into a local, then validate
    // and store that same local. `options.outcome` may be a getter, so reading
    // it a second time to store it would let one value pass the check and a
    // different one reach the field — the same read-once contract the use case
    // applies to gateway results.
    const outcome: unknown = options?.outcome;
    if (!SIMULATED_OUTCOMES.includes(outcome as SimulatedOutcome)) {
      throw new AdapterContractError(
        "FakePaymentGateway must be configured with a 'succeeded' or 'declined' simulated outcome",
      );
    }
    this.outcome = outcome as SimulatedOutcome;
  }

  async simulate(
    request: SimulatedGatewayRequest,
  ): Promise<SimulatedGatewayResult> {
    // Only the payment id is read, and only to derive the receipt reference.
    // The request never decides success or decline: keeping that outcome in
    // trusted adapter configuration prevents a caller from turning the
    // simulation into a client-controlled "payment success".
    //
    // Frozen so the `simulated` marker cannot be flipped by whatever receives
    // it; `readonly` on the port type is erased at compile time.
    return Object.freeze({
      outcome: this.outcome,
      receiptReference: syntheticReference(request.paymentId),
      simulated: true as const,
    });
  }
}
