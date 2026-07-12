import { DomainValidationError, InvalidTransitionError } from "../errors";

export type SupportPayerKind =
  | "individual"
  | "private_patron"
  | "institution"
  | "corporate_sponsor";

/** Labels for a demo only. None represents a live payment integration. */
export type SimulatedPaymentMethod = "card" | "bizum" | "bank_transfer";

export type SupportPaymentStatus =
  | "pending"
  | "succeeded"
  | "declined"
  | "cancelled";

export type SimulatedSettlementOutcome = "succeeded" | "declined";

export const MAX_SIMULATED_SUPPORT_AMOUNT_CENTS = 100_000_000;
export const MAX_CAMPAIGN_REFERENCE_LENGTH = 128;

const PAYER_KINDS: readonly SupportPayerKind[] = [
  "individual",
  "private_patron",
  "institution",
  "corporate_sponsor",
];

const PAYMENT_METHODS: readonly SimulatedPaymentMethod[] = [
  "card",
  "bizum",
  "bank_transfer",
];

const SETTLEMENT_OUTCOMES: readonly SimulatedSettlementOutcome[] = [
  "succeeded",
  "declined",
];

declare const SUPPORT_PAYMENT_BRAND: unique symbol;

/**
 * A demonstration-only support-payment state machine. This aggregate is NOT
 * a ledger entry, donation certificate, charge, bank transfer, or payout.
 * It intentionally contains no card, phone, IBAN, provider, or identity data.
 */
export type SupportPayment = {
  readonly id: string;
  readonly campaignReference: string;
  readonly amountCents: number;
  readonly currency: "EUR";
  /** Every serializable payment value is explicitly demonstration-only. */
  readonly simulated: true;
  readonly payerKind: SupportPayerKind;
  readonly method: SimulatedPaymentMethod;
  readonly status: SupportPaymentStatus;
} & { readonly [SUPPORT_PAYMENT_BRAND]: "SupportPayment" };

export interface CreateSupportPaymentInput {
  readonly id: string;
  readonly campaignReference: string;
  readonly amountCents: number;
  readonly payerKind: SupportPayerKind;
  readonly method: SimulatedPaymentMethod;
}

function assertNonEmpty(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new DomainValidationError(`SupportPayment ${field} must not be empty`);
  }
}

function assertCampaignReference(value: string): void {
  assertNonEmpty("campaignReference", value);
  if (value.trim().length > MAX_CAMPAIGN_REFERENCE_LENGTH) {
    throw new DomainValidationError(
      `SupportPayment campaignReference must not exceed ${MAX_CAMPAIGN_REFERENCE_LENGTH} characters`,
    );
  }
}

function assertAmountCents(amountCents: number): void {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > MAX_SIMULATED_SUPPORT_AMOUNT_CENTS
  ) {
    throw new DomainValidationError(
      `SupportPayment amountCents must be a positive safe integer up to ${MAX_SIMULATED_SUPPORT_AMOUNT_CENTS}`,
    );
  }
}

function assertPayerKind(payerKind: SupportPayerKind): void {
  if (!PAYER_KINDS.includes(payerKind)) {
    throw new DomainValidationError(
      `SupportPayment payerKind '${payerKind}' is invalid`,
    );
  }
}

function assertMethod(method: SimulatedPaymentMethod): void {
  if (!PAYMENT_METHODS.includes(method)) {
    throw new DomainValidationError(
      `SupportPayment method '${method}' is invalid`,
    );
  }
}

function assertPending(payment: SupportPayment, transition: string): void {
  if (payment.status !== "pending") {
    throw new InvalidTransitionError(
      `Cannot ${transition} a SupportPayment in '${payment.status}' state (requires 'pending')`,
    );
  }
}

/** Creates a pending, simulation-only support payment in integer EUR cents. */
export function createSupportPayment(
  input: CreateSupportPaymentInput,
): SupportPayment {
  assertNonEmpty("id", input.id);
  assertCampaignReference(input.campaignReference);
  assertAmountCents(input.amountCents);
  assertPayerKind(input.payerKind);
  assertMethod(input.method);

  return {
    id: input.id,
    campaignReference: input.campaignReference.trim(),
    amountCents: input.amountCents,
    currency: "EUR",
    simulated: true,
    payerKind: input.payerKind,
    method: input.method,
    status: "pending",
  } as SupportPayment;
}

/** Applies a fake gateway's trusted, terminal success/decline outcome. */
export function settleSupportPayment(
  payment: SupportPayment,
  outcome: SimulatedSettlementOutcome,
): SupportPayment {
  assertPending(payment, "settle");
  if (!SETTLEMENT_OUTCOMES.includes(outcome)) {
    throw new DomainValidationError(
      `SupportPayment settlement outcome '${outcome}' is invalid`,
    );
  }
  return { ...payment, status: outcome };
}

/** Cancels a pending simulation before the fake gateway settles it. */
export function cancelSupportPayment(payment: SupportPayment): SupportPayment {
  assertPending(payment, "cancel");
  return { ...payment, status: "cancelled" };
}
