import type {
  PaymentGateway,
  SimulatedGatewayRequest,
  SimulatedGatewayResult,
} from "@application/ports/PaymentGateway";

export interface FakePaymentGatewayOptions {
  /** Trusted test/server configuration, never caller-controlled request data. */
  readonly outcome: "succeeded" | "declined";
}

/**
 * Deterministic no-I/O adapter for the TFM demo. It makes no network request,
 * stores no financial data, and returns only an explicitly synthetic receipt.
 */
export class FakePaymentGateway implements PaymentGateway {
  private sequence = 0;

  constructor(private readonly options: FakePaymentGatewayOptions) {}

  async simulate(
    request: SimulatedGatewayRequest,
  ): Promise<SimulatedGatewayResult> {
    // The request is deliberately not used to decide success or decline.
    // Keeping that outcome in trusted adapter configuration prevents a caller
    // from turning the simulation into a client-controlled "payment success".
    void request;
    this.sequence += 1;
    return {
      outcome: this.options.outcome,
      receiptReference: `sim_${this.sequence}`,
      simulated: true,
    };
  }
}
