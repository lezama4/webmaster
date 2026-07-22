import type {
  PaymentGateway,
  SimulatedGatewayRequest,
  SimulatedGatewayResult,
} from "@application/ports/PaymentGateway";

type SimulatedOutcome = SimulatedGatewayResult["outcome"];

export interface FakePaymentGatewayOptions {
  /** Trusted test/server configuration, never caller-controlled request data. */
  readonly outcome: SimulatedOutcome;
}

const SIMULATED_OUTCOMES: readonly SimulatedOutcome[] = ["succeeded", "declined"];

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
 */
function syntheticReference(paymentId: string): string {
  if (!OPAQUE_PAYMENT_ID_PATTERN.test(paymentId)) {
    throw new Error(
      "FakePaymentGateway requires an opaque payment id of letters, digits, hyphens, and underscores to derive a collision-free synthetic reference",
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
    if (!SIMULATED_OUTCOMES.includes(options?.outcome)) {
      throw new Error(
        "FakePaymentGateway must be configured with a 'succeeded' or 'declined' simulated outcome",
      );
    }
    this.outcome = options.outcome;
  }

  async simulate(
    request: SimulatedGatewayRequest,
  ): Promise<SimulatedGatewayResult> {
    // Only the payment id is read, and only to derive the receipt reference.
    // The request never decides success or decline: keeping that outcome in
    // trusted adapter configuration prevents a caller from turning the
    // simulation into a client-controlled "payment success".
    return {
      outcome: this.outcome,
      receiptReference: syntheticReference(request.paymentId),
      simulated: true,
    };
  }
}
