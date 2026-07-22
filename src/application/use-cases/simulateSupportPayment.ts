import { DomainValidationError } from "@domain/errors";
import {
  cancelSupportPayment,
  createSupportPayment,
  settleSupportPayment,
  type SimulatedPaymentMethod,
  type SupportPayerKind,
  type SupportPayment,
} from "@domain/support-payment/SupportPayment";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type {
  PaymentGateway,
  SimulatedGatewayResult,
} from "@application/ports/PaymentGateway";

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

/**
 * A simulation that never reached a settlement carries the payment it left
 * behind, cancelled. Without it a gateway rejection or a rejected receipt
 * would abandon the created payment in `pending` forever, and the documented
 * `pending -> cancelled` arm would have no driver in the application layer.
 */
export type FailedSimulationError = Error & {
  readonly cancelledPayment: SupportPayment;
};

export function isFailedSimulationError(
  error: unknown,
): error is FailedSimulationError {
  return error instanceof Error && "cancelledPayment" in error;
}

function withCancelledPayment(
  error: unknown,
  cancelledPayment: SupportPayment,
): FailedSimulationError {
  const failure = error instanceof Error ? error : new Error(String(error));
  return Object.assign(failure, { cancelledPayment });
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

  let gatewayResult: SimulatedGatewayResult;
  try {
    gatewayResult = await deps.paymentGateway.simulate({
      paymentId: payment.id,
      campaignReference: payment.campaignReference,
      amountCents: payment.amountCents,
      currency: payment.currency,
      simulated: true,
      payerKind: payment.payerKind,
      method: payment.method,
    });
    assertSyntheticReceipt(
      gatewayResult.receiptReference,
      gatewayResult.simulated,
    );
  } catch (error) {
    // Cancellation is the documented failure path: never leave the payment
    // stranded in `pending` because the adapter or its receipt failed.
    throw withCancelledPayment(error, cancelSupportPayment(payment));
  }

  return {
    payment: settleSupportPayment(payment, gatewayResult.outcome),
    receipt: {
      reference: gatewayResult.receiptReference,
      simulated: true,
    },
  };
}
