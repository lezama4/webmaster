import {
  MAX_SUPPORT_PAYMENT_ID_LENGTH,
  cancelSupportPayment,
  createSupportPayment,
  settleSupportPayment,
  type SimulatedPaymentMethod,
  type SupportCampaignReference,
  type SupportPayerKind,
  type SupportPayment,
} from "@domain/support-payment/SupportPayment";
import {
  AdapterContractError,
  FailedSimulationError,
} from "@application/errors";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type {
  PaymentGateway,
  SimulatedGatewayRequest,
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

/** Frozen, not merely `readonly`: `readonly` is erased at compile time. */
const SIMULATED_GATEWAY_OUTCOMES: readonly SimulatedGatewayResult["outcome"][] =
  Object.freeze(["succeeded", "declined"] as const);

const SYNTHETIC_RECEIPT_PATTERN = /^sim_[A-Za-z0-9_-]+$/;

/**
 * An INDEPENDENT DEFENSIVE CAP on adapter-supplied text, not a consequence of
 * how the reference is derived. The port deliberately refuses to mandate a
 * derivation, so no assumption about the adapter's naming scheme can justify a
 * bound; the reason to bound at all is that the value is adapter-controlled,
 * reaches the receipt and the logs, and `SYNTHETIC_RECEIPT_PATTERN` is itself
 * unbounded.
 *
 * The number is borrowed from the domain's own id bound only because that is a
 * known-generous size for an opaque reference. It is stated as an obligation
 * on `SimulatedGatewayResult.receiptReference`, so an adapter needing a longer
 * scheme changes this constant deliberately instead of discovering the limit
 * as a runtime rejection.
 */
export const MAX_SIMULATED_RECEIPT_REFERENCE_LENGTH =
  "sim_".length + MAX_SUPPORT_PAYMENT_ID_LENGTH;

export function isFailedSimulationError(
  error: unknown,
): error is FailedSimulationError {
  return error instanceof FailedSimulationError;
}

/** The gateway fields after validation — read from the adapter exactly once. */
interface ValidatedGatewayResult {
  readonly outcome: SimulatedGatewayResult["outcome"];
  readonly receiptReference: string;
}

/**
 * Validates the adapter's response and returns the values it validated.
 *
 * Every field is read off the adapter object EXACTLY ONCE, into a local. An
 * adapter may expose these as getters, so checking `result.receiptReference`
 * and then returning `result.receiptReference` to the caller would let a
 * second read yield a different value than the one that passed the check.
 * The caller must therefore build its receipt and settle its payment from the
 * locals returned here, never from the original result object.
 *
 * `RegExp.test` coerces its argument, so `{ toString: () => "sim_ok" }` would
 * pass the pattern and land in a field typed `string`; the explicit `typeof`
 * check runs first. The length bound is checked here too, because the pattern
 * itself is unbounded.
 *
 * The shape of the result is checked BEFORE any property is read. An adapter
 * whose `simulate` resolves to `undefined` or `null` would otherwise make the
 * first dereference throw a bare `TypeError`, which carries no label this
 * codebase recognises: `FailedSimulationError.causedByAdapterDefect` would
 * then report `false` for what is unambiguously an adapter defect, demoting it
 * into the branch a handler is told to treat as a non-defect.
 *
 * These are adapter-contract violations, not domain-invariant violations: a
 * gateway response is not domain input, so it raises an application-layer
 * error.
 */
function validateGatewayResult(
  result: SimulatedGatewayResult,
): ValidatedGatewayResult {
  if (typeof result !== "object" || result === null) {
    throw new AdapterContractError(
      "PaymentGateway must resolve to a simulated gateway result object",
    );
  }

  const simulated: unknown = result.simulated;
  const receiptReference: unknown = result.receiptReference;
  const outcome: unknown = result.outcome;

  if (
    simulated !== true ||
    typeof receiptReference !== "string" ||
    receiptReference.length > MAX_SIMULATED_RECEIPT_REFERENCE_LENGTH ||
    !SYNTHETIC_RECEIPT_PATTERN.test(receiptReference)
  ) {
    throw new AdapterContractError(
      "PaymentGateway must return an explicit synthetic simulation receipt: a bounded 'sim_'-prefixed string reference with simulated set to true",
    );
  }
  if (
    !SIMULATED_GATEWAY_OUTCOMES.includes(
      outcome as SimulatedGatewayResult["outcome"],
    )
  ) {
    // The rejected value is deliberately not echoed: it is untrusted adapter
    // data, and interpolating it can itself throw.
    throw new AdapterContractError(
      `PaymentGateway returned an outcome outside the simulated union (${SIMULATED_GATEWAY_OUTCOMES.join(", ")})`,
    );
  }

  return {
    outcome: outcome as SimulatedGatewayResult["outcome"],
    receiptReference,
  };
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
    // Frozen before it leaves: this is the one object handed to a foreign
    // adapter, and an adapter must not be able to `delete request.simulated`
    // (or overwrite it) before reading it. The marker is the whole point of
    // carrying it on the request.
    const request: SimulatedGatewayRequest = Object.freeze({
      paymentId: payment.id,
      campaignReference: payment.campaignReference,
      amountCents: payment.amountCents,
      currency: payment.currency,
      simulated: true as const,
      payerKind: payment.payerKind,
      method: payment.method,
    });
    // UNBOUNDED. There is no timeout here, so an adapter whose promise never
    // settles leaves this payment in `pending` forever with the `catch` never
    // running. The cancellation guarantee below therefore covers gateway calls
    // that SETTLE — resolve or reject — and nothing else. A timeout belongs
    // with the first caller that can reach this over the network, together
    // with the cancellation policy for a call that later completes.
    const gatewayResult = await deps.paymentGateway.simulate(request);
    const validated = validateGatewayResult(gatewayResult);

    // Settlement stays inside the guarded region: it is the last step that can
    // still reject, and a rejection outside it would strand the payment in
    // `pending` with no cancellation. Both values come from `validated`, never
    // from a second read of the adapter's own object.
    //
    // Receipt and wrapper are frozen for the same reason the aggregate is:
    // `readonly` is erased at compile time, so `result.receipt.simulated =
    // false` would otherwise succeed silently, and freezing the aggregate buys
    // nothing at the boundary if `result.payment` can be swapped for an
    // unfrozen look-alike.
    return Object.freeze({
      payment: settleSupportPayment(payment, validated.outcome),
      receipt: Object.freeze({
        reference: validated.receiptReference,
        simulated: true as const,
      }),
    });
  } catch (error) {
    // Cancellation is the documented failure path: once the gateway call has
    // settled, no rejection of the adapter, its receipt, its outcome, or the
    // settlement leaves the payment stranded in `pending`. A call that never
    // settles is outside this guarantee — see the note on the `await` above.
    throw new FailedSimulationError(cancelSupportPayment(payment), error);
  }
}
