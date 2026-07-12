import { describe, expect, it } from "vitest";

import { DomainValidationError, InvalidTransitionError } from "@domain/errors";
import {
  MAX_SIMULATED_SUPPORT_AMOUNT_CENTS,
  cancelSupportPayment,
  createSupportPayment,
  settleSupportPayment,
} from "@domain/support-payment/SupportPayment";

function pendingPayment() {
  return createSupportPayment({
    id: "support-payment-1",
    campaignReference: "campaign-music-ward",
    amountCents: 5000,
    payerKind: "institution",
    method: "bizum",
  });
}

describe("SupportPayment (simulation-only domain)", () => {
  it("creates a pending EUR payment using only categorical payer and method data", () => {
    const payment = pendingPayment();

    expect(payment).toEqual({
      id: "support-payment-1",
      campaignReference: "campaign-music-ward",
      amountCents: 5000,
      currency: "EUR",
      simulated: true,
      payerKind: "institution",
      method: "bizum",
      status: "pending",
    });
    expect(Object.keys(payment).sort()).toEqual(
      [
        "amountCents",
        "campaignReference",
        "currency",
        "id",
        "method",
        "payerKind",
        "simulated",
        "status",
      ].sort(),
    );
  });

  it.each([
    0,
    -1,
    12.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    MAX_SIMULATED_SUPPORT_AMOUNT_CENTS + 1,
  ])("denies an invalid simulated amount: %p cents", (amountCents) => {
    expect(() =>
      createSupportPayment({
        id: "payment-invalid",
        campaignReference: "campaign-1",
        amountCents,
        payerKind: "individual",
        method: "card",
      }),
    ).toThrow(DomainValidationError);
  });

  it("denies blank or oversized campaign references", () => {
    expect(() =>
      createSupportPayment({
        id: "payment-blank-campaign",
        campaignReference: "  ",
        amountCents: 100,
        payerKind: "private_patron",
        method: "bank_transfer",
      }),
    ).toThrow(DomainValidationError);

    expect(() =>
      createSupportPayment({
        id: "payment-long-campaign",
        campaignReference: "x".repeat(129),
        amountCents: 100,
        payerKind: "private_patron",
        method: "bank_transfer",
      }),
    ).toThrow(DomainValidationError);
  });

  it("denies invalid payer or method values from untrusted runtime input", () => {
    expect(() =>
      createSupportPayment({
        id: "payment-invalid-payer",
        campaignReference: "campaign-1",
        amountCents: 100,
        payerKind: "unknown" as never,
        method: "card",
      }),
    ).toThrow(DomainValidationError);

    expect(() =>
      createSupportPayment({
        id: "payment-invalid-method",
        campaignReference: "campaign-1",
        amountCents: 100,
        payerKind: "individual",
        method: "crypto" as never,
      }),
    ).toThrow(DomainValidationError);
  });

  it.each(["succeeded", "declined"] as const)(
    "settles a pending simulated payment as %s",
    (outcome) => {
      const settled = settleSupportPayment(pendingPayment(), outcome);

      expect(settled.status).toBe(outcome);
    },
  );

  it("cancels a pending payment", () => {
    expect(cancelSupportPayment(pendingPayment()).status).toBe("cancelled");
  });

  it("denies settlement or cancellation after a terminal state", () => {
    const succeeded = settleSupportPayment(pendingPayment(), "succeeded");

    expect(() => settleSupportPayment(succeeded, "declined")).toThrow(
      InvalidTransitionError,
    );
    expect(() => cancelSupportPayment(succeeded)).toThrow(InvalidTransitionError);
  });
});
