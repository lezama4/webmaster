import { DomainValidationError } from "@domain/errors";
import {
  createSupportPayment,
  settleSupportPayment,
  type SimulatedPaymentMethod,
  type SupportPayerKind,
  type SupportPayment,
} from "@domain/support-payment/SupportPayment";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { PaymentGateway } from "@application/ports/PaymentGateway";

export interface SimulateSupportPaymentInput {
  readonly campaignReference: string;
  readonly amountCents: number;
  readonly payerKind: SupportPayerKind;
  readonly method: SimulatedPaymentMethod;
}

export interface SimulatedPaymentReceipt {
  readonly reference: string;
  readonly simulated: true;
}

export interface SimulateSupportPaymentDeps {
  readonly idGenerator: IdGenerator;
  readonly paymentGateway: PaymentGateway;
}

export interface SimulateSupportPaymentResult {
  readonly payment: SupportPayment;
  readonly receipt: SimulatedPaymentReceipt;
}

function assertSyntheticReceipt(reference: string, simulated: boolean): void {
  if (!simulated || !/^sim_[A-Za-z0-9_-]+$/.test(reference)) {
    throw new DomainValidationError(
      "PaymentGateway must return an explicit synthetic simulation receipt",
    );
  }
}

/**
 * Demonstrates the payment port without processing money. Gateway outcome is
 * adapter-owned: callers cannot request success, decline, or a provider token.
 */
export async function simulateSupportPayment(
  input: SimulateSupportPaymentInput,
  deps: SimulateSupportPaymentDeps,
): Promise<SimulateSupportPaymentResult> {
  const payment = createSupportPayment({
    id: deps.idGenerator.next(),
    campaignReference: input.campaignReference,
    amountCents: input.amountCents,
    payerKind: input.payerKind,
    method: input.method,
  });

  const gatewayResult = await deps.paymentGateway.simulate({
    paymentId: payment.id,
    campaignReference: payment.campaignReference,
    amountCents: payment.amountCents,
    currency: payment.currency,
    payerKind: payment.payerKind,
    method: payment.method,
  });
  assertSyntheticReceipt(gatewayResult.receiptReference, gatewayResult.simulated);

  return {
    payment: settleSupportPayment(payment, gatewayResult.outcome),
    receipt: {
      reference: gatewayResult.receiptReference,
      simulated: true,
    },
  };
}
