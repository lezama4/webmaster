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
  /**
   * ENFORCED SHAPE. The reference MUST be the literal prefix `sim_` followed
   * by one or more characters drawn from `[A-Za-z0-9_-]`, and MUST be at most
   * `MAX_SIMULATED_RECEIPT_REFERENCE_LENGTH` (132) characters in total.
   * `simulateSupportPayment` checks all three and raises
   * `AdapterContractError` otherwise, cancelling the payment — so an adapter
   * whose own reference scheme uses a different charset or a longer format is
   * REJECTED at runtime. The three constraints are stated here because an
   * implementer reading only this interface has no other way to learn them.
   *
   * ADAPTER OBLIGATION, NOT A VERIFIED GUARANTEE. Beyond that shape, the
   * reference MUST identify the one payment it was produced for: distinct
   * `paymentId` values MUST yield distinct references, and a reference MUST
   * NOT be reused across calls.
   *
   * `simulateSupportPayment` does NOT check either property. It validates only
   * shape, charset and length, so an adapter returning a constant `sim_x` for
   * every call passes. Verifying it would require the use case to know how the
   * adapter derives the reference, coupling the application layer to an
   * adapter naming scheme — a worse trade than stating the obligation here.
   *
   * `FakePaymentGateway` discharges INJECTIVITY OVER PAYMENT IDS, and only
   * that: it maps `id -> sim_<id>`, so distinct ids yield distinct references.
   * NON-REUSE ACROSS CALLS is strictly stronger and no adapter can discharge
   * it alone — it holds only if `IdGenerator.next()` never repeats a value,
   * which is a PRECONDITION on that port, not a property of this one. The test
   * fake `SequentialIdGenerator` restarts its counter per instance and does
   * not satisfy it.
   */
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
