import type {
  SimulatedPaymentMethod,
  SupportCampaignReference,
  SupportPayerKind,
} from "@domain/support-payment/SupportPayment";

/**
 * Safe, simulation-only request shape. It intentionally has no financial
 * identifier and no free-text field: `paymentId` is an opaque identifier and
 * `campaignReference` is one of the system-issued campaign identifiers.
 */
export interface SimulatedGatewayRequest {
  readonly paymentId: string;
  readonly campaignReference: SupportCampaignReference;
  readonly amountCents: number;
  readonly currency: "EUR";
  /**
   * Carried on the request, not only on the response: this is the one object
   * handed to a foreign adapter, so it must never be byte-for-byte
   * indistinguishable from a real charge request.
   */
  readonly simulated: true;
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
