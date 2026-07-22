import { describe, expect, it } from "vitest";

import { DomainValidationError, InvalidTransitionError } from "@domain/errors";
import {
  MAX_CAMPAIGN_REFERENCE_LENGTH,
  MAX_SIMULATED_SUPPORT_AMOUNT_CENTS,
  MAX_SUPPORT_PAYMENT_ID_LENGTH,
  cancelSupportPayment,
  createSupportPayment,
  rehydrateSupportPayment,
  settleSupportPayment,
  type SupportPayment,
} from "@domain/support-payment/SupportPayment";

const SUPPORT_PAYMENT_KEYS = [
  "amountCents",
  "campaignReference",
  "currency",
  "id",
  "method",
  "payerKind",
  "simulated",
  "status",
].sort();

function pendingPayment() {
  return createSupportPayment({
    id: "support-payment-1",
    campaignReference: "campaign-music-ward",
    amountCents: 5000,
    payerKind: "institution",
    method: "bizum",
  });
}

/** Simulates a cast/deserialised object smuggling financial fields onto the aggregate. */
function launderedPayment(): SupportPayment {
  return {
    ...pendingPayment(),
    pan: "4111111111111111",
    cvv: "123",
    iban: "ES91 2100 0418 4502 0005 1332",
    payoutAccount: "artist-payout-1",
  } as unknown as SupportPayment;
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
    expect(Object.keys(payment).sort()).toEqual(SUPPORT_PAYMENT_KEYS);
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
        campaignReference: "x".repeat(MAX_CAMPAIGN_REFERENCE_LENGTH + 1),
        amountCents: 100,
        payerKind: "private_patron",
        method: "bank_transfer",
      }),
    ).toThrow(DomainValidationError);
  });

  it.each([
    "ES91 2100 0418 4502 0005 1332 / 4111111111111111 / +34600123456",
    "4111111111111111",
    "+34600123456",
    "campaign\u0000null",
    "campaign\nnewline",
    "campaign\u202Eoverride",
    "<script>alert(1)</script>",
    "Campaign-Music-Ward",
    "campaign music ward",
    "campaign_music_ward",
    "campaign.music",
    "-campaign",
    "campaign-",
    "campaign--ward",
  ])(
    "denies a campaign reference outside the slug charset: %j",
    (campaignReference) => {
      expect(() =>
        createSupportPayment({
          id: "payment-unsafe-campaign",
          campaignReference,
          amountCents: 100,
          payerKind: "individual",
          method: "card",
        }),
      ).toThrow(DomainValidationError);
    },
  );

  it.each(["campaign-1", "campaign-music-ward", "c", "2026-summer-ward-7"])(
    "accepts a slug campaign reference: %j",
    (campaignReference) => {
      expect(
        createSupportPayment({
          id: "payment-slug-campaign",
          campaignReference,
          amountCents: 100,
          payerKind: "individual",
          method: "card",
        }).campaignReference,
      ).toBe(campaignReference);
    },
  );

  it("denies a blank or oversized id and trims the stored value", () => {
    expect(() =>
      createSupportPayment({
        id: "   ",
        campaignReference: "campaign-1",
        amountCents: 100,
        payerKind: "individual",
        method: "card",
      }),
    ).toThrow(DomainValidationError);

    expect(() =>
      createSupportPayment({
        id: "x".repeat(MAX_SUPPORT_PAYMENT_ID_LENGTH + 1),
        campaignReference: "campaign-1",
        amountCents: 100,
        payerKind: "individual",
        method: "card",
      }),
    ).toThrow(DomainValidationError);

    expect(
      createSupportPayment({
        id: "  support-payment-1  ",
        campaignReference: "campaign-1",
        amountCents: 100,
        payerKind: "individual",
        method: "card",
      }).id,
    ).toBe("support-payment-1");
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

  it("freezes every payment so a terminal state cannot be reopened at runtime", () => {
    const pending = pendingPayment();
    expect(Object.isFrozen(pending)).toBe(true);

    const succeeded = settleSupportPayment(pending, "succeeded");
    expect(Object.isFrozen(succeeded)).toBe(true);
    expect(() => {
      (succeeded as unknown as { status: string }).status = "pending";
    }).toThrow(TypeError);
    expect(() => {
      (succeeded as unknown as { simulated: boolean }).simulated = false;
    }).toThrow(TypeError);
    expect(succeeded.status).toBe("succeeded");
    expect(succeeded.simulated).toBe(true);

    expect(Object.isFrozen(cancelSupportPayment(pendingPayment()))).toBe(true);
  });

  it.each([
    ["settle", (p: SupportPayment) => settleSupportPayment(p, "succeeded")],
    ["cancel", (p: SupportPayment) => cancelSupportPayment(p)],
  ])(
    "never launders unknown financial properties through %s",
    (_name, transition) => {
      const result = transition(launderedPayment());

      expect(Object.keys(result).sort()).toEqual(SUPPORT_PAYMENT_KEYS);
      expect(result).not.toHaveProperty("pan");
      expect(result).not.toHaveProperty("cvv");
      expect(result).not.toHaveProperty("iban");
      expect(result).not.toHaveProperty("payoutAccount");
    },
  );
});

describe("rehydrateSupportPayment", () => {
  function persisted() {
    return {
      id: "support-payment-1",
      campaignReference: "campaign-music-ward",
      amountCents: 5000,
      payerKind: "institution" as const,
      method: "bizum" as const,
      status: "succeeded" as const,
    };
  }

  it("rebuilds a persisted payment in a terminal status", () => {
    const payment = rehydrateSupportPayment(persisted());

    expect(payment).toEqual({
      id: "support-payment-1",
      campaignReference: "campaign-music-ward",
      amountCents: 5000,
      currency: "EUR",
      simulated: true,
      payerKind: "institution",
      method: "bizum",
      status: "succeeded",
    });
    expect(Object.isFrozen(payment)).toBe(true);
  });

  it("ignores unknown persisted properties", () => {
    const payment = rehydrateSupportPayment({
      ...persisted(),
      pan: "4111111111111111",
      payoutAccount: "artist-payout-1",
    } as never);

    expect(Object.keys(payment).sort()).toEqual(SUPPORT_PAYMENT_KEYS);
  });

  it.each([
    ["id", { id: "  " }],
    ["id length", { id: "x".repeat(MAX_SUPPORT_PAYMENT_ID_LENGTH + 1) }],
    ["campaignReference charset", { campaignReference: "ES91 2100 0418" }],
    [
      "campaignReference length",
      { campaignReference: "x".repeat(MAX_CAMPAIGN_REFERENCE_LENGTH + 1) },
    ],
    ["amountCents", { amountCents: 0 }],
    ["amountCents bound", { amountCents: MAX_SIMULATED_SUPPORT_AMOUNT_CENTS + 1 }],
    ["payerKind", { payerKind: "unknown" }],
    ["method", { method: "crypto" }],
    ["status", { status: "refunded" }],
  ])("re-runs the %s assertion on corrupt persisted data", (_name, patch) => {
    expect(() =>
      rehydrateSupportPayment({ ...persisted(), ...patch } as never),
    ).toThrow(DomainValidationError);
  });
});
