import { DomainValidationError } from "@domain/errors";
import {
  cancelSupportPayment,
  createSupportPayment,
  settleSupportPayment,
  type SimulatedPaymentMethod,
  type SupportCampaignReference,
  type SupportPayerKind,
  type SupportPayment,
} from "@domain/support-payment/SupportPayment";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type {
  PaymentGateway,
  SimulatedGatewayResult,
} from "@application/ports/PaymentGateway";

export interface SimulateSupportPaymentInput {
  readonly campaignReference: SupportCampaignReference;
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

const SIMULATED_GATEWAY_OUTCOMES: readonly SimulatedGatewayResult["outcome"][] =
  ["succeeded", "declined"];

/**
 * Describes a rejection without ever throwing itself. `String(value)` would
 * yield `"[object Object]"` for a plain object and can throw outright for a
 * `Symbol` or a `toString`-less object, so only `typeof` — which cannot
 * fail — is consulted. The original value is never lost: it is always
 * attached as `cause`.
 */
function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === "string") {
    return cause;
  }
  return `gateway simulation rejected with a non-Error value of type '${typeof cause}'`;
}

/**
 * A simulation that never reached a settlement carries the payment it left
 * behind, cancelled. Without it a gateway rejection, a rejected receipt, or a
 * refused settlement would abandon the created payment in `pending` forever,
 * and the documented `pending -> cancelled` arm would have no driver in the
 * application layer.
 *
 * It is a dedicated class rather than a property assigned onto the caught
 * error: adapters commonly throw a module-level error constant, and writing to
 * that shared object would make two concurrent failures overwrite each other's
 * cancelled payment — and would throw outright if the adapter froze it.
 */
export class FailedSimulationError extends Error {
  /**
   * Own, non-enumerable, non-writable: `readonly` must hold at runtime, and a
   * structured log of this error must not serialize the whole aggregate.
   */
  declare readonly cancelledPayment: SupportPayment;

  constructor(cancelledPayment: SupportPayment, cause: unknown) {
    super(describeCause(cause), { cause });
    this.name = "FailedSimulationError";
    Object.defineProperty(this, "cancelledPayment", {
      value: cancelledPayment,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
}

export function isFailedSimulationError(
  error: unknown,
): error is FailedSimulationError {
  return error instanceof FailedSimulationError;
}

function assertSyntheticReceipt(result: SimulatedGatewayResult): void {
  if (
    !result.simulated ||
    !/^sim_[A-Za-z0-9_-]+$/.test(result.receiptReference)
  ) {
    throw new DomainValidationError(
      "PaymentGateway must return an explicit synthetic simulation receipt",
    );
  }
  if (!SIMULATED_GATEWAY_OUTCOMES.includes(result.outcome)) {
    throw new DomainValidationError(
      `PaymentGateway returned an outcome outside the simulated union: '${String(result.outcome)}'`,
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

  try {
    const gatewayResult = await deps.paymentGateway.simulate({
      paymentId: payment.id,
      campaignReference: payment.campaignReference,
      amountCents: payment.amountCents,
      currency: payment.currency,
      simulated: true,
      payerKind: payment.payerKind,
      method: payment.method,
    });
    assertSyntheticReceipt(gatewayResult);

    // Settlement stays inside the guarded region: it is the last step that can
    // still reject, and a rejection outside it would strand the payment in
    // `pending` with no cancellation.
    return {
      payment: settleSupportPayment(payment, gatewayResult.outcome),
      receipt: {
        reference: gatewayResult.receiptReference,
        simulated: true,
      },
    };
  } catch (error) {
    // Cancellation is the documented failure path: never leave the payment
    // stranded in `pending` because the adapter, its receipt, or the
    // settlement failed.
    throw new FailedSimulationError(cancelSupportPayment(payment), error);
  }
}
