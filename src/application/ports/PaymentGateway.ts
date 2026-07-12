import type {
  SimulatedPaymentMethod,
  SupportPayerKind,
} from "@domain/support-payment/SupportPayment";

/** Safe, simulation-only request shape. It intentionally has no financial identifier. */
export interface SimulatedGatewayRequest {
  readonly paymentId: string;
  readonly campaignReference: string;
  readonly amountCents: number;
  readonly currency: "EUR";
  readonly payerKind: SupportPayerKind;
  readonly method: SimulatedPaymentMethod;
}

export interface SimulatedGatewayResult {
  readonly outcome: "succeeded" | "declined";
  readonly receiptReference: string;
  readonly simulated: true;
}

/**
 * Port reserved for the simulation. A real provider needs a separate design,
 * threat model, compliance review, and adapter; it MUST NOT be dropped in as
 * an implementation of this contract without those controls.
 */
export interface PaymentGateway {
  simulate(request: SimulatedGatewayRequest): Promise<SimulatedGatewayResult>;
}
