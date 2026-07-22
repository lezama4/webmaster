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

/**
 * Derives an obviously synthetic, per-payment receipt reference. Deriving it
 * from the payment id (instead of a per-instance counter) keeps it unique and
 * traceable across gateway instances — two fresh gateways must never both
 * claim `sim_1`. Characters outside the synthetic-reference charset are
 * replaced so the result always stays recognizable as a simulation.
 */
function syntheticReference(paymentId: string): string {
  return `sim_${paymentId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
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
