import { describe, expect, it } from "vitest";

import { DomainValidationError, InvalidTransitionError } from "@domain/errors";
import {
  MAX_SIMULATED_SUPPORT_AMOUNT_CENTS,
  MAX_SUPPORT_PAYMENT_ID_LENGTH,
  SUPPORT_CAMPAIGN_REFERENCES,
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

/**
 * The exact payloads an adversarial review proved a charset regex accepts.
 * Every one of them begins with letters, so no "must contain a letter"
 * lookahead can reject them. They are denied here because the campaign
 * reference is an enumerated system identifier, not text a donor can type.
 */
const FINANCIAL_IDENTIFIER_PAYLOADS = [
  "es9121000418450200051332",
  "es91-2100-0418-4502-0005-1332",
  "card-4111111111111111",
  "visa-4111-1111-1111-1111",
  "tel-34600123456",
  "pan4111111111111111-cvv123",
  "ES91 2100 0418 4502 0005 1332 / 4111111111111111 / +34600123456",
  "4111111111111111",
  "+34600123456",
  "campaign\u0000null",
  "campaign\nnewline",
  "campaign\u202Eoverride",
  "<script>alert(1)</script>",
  "campaign-1",
  "2026-summer-ward-7",
  "c",
  "",
  "  ",
];

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

/** Simulates a cast/deserialised object whose KNOWN fields are corrupt. */
function corruptPendingPayment(
  patch: Record<string, unknown>,
): SupportPayment {
  return { ...pendingPayment(), ...patch } as unknown as SupportPayment;
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
        campaignReference: "campaign-music-ward",
        amountCents,
        payerKind: "individual",
        method: "card",
      }),
    ).toThrow(DomainValidationError);
  });

  it.each(FINANCIAL_IDENTIFIER_PAYLOADS)(
    "denies a campaign reference outside the enumerated identifier set: %j",
    (campaignReference) => {
      expect(() =>
        createSupportPayment({
          id: "payment-unsafe-campaign",
          campaignReference: campaignReference as never,
          amountCents: 100,
          payerKind: "individual",
          method: "card",
        }),
      ).toThrow(DomainValidationError);
    },
  );

  it("exposes a frozen, non-empty set of system-issued campaign identifiers", () => {
    expect(Object.isFrozen(SUPPORT_CAMPAIGN_REFERENCES)).toBe(true);
    expect(SUPPORT_CAMPAIGN_REFERENCES.length).toBeGreaterThan(0);
  });

  it.each(SUPPORT_CAMPAIGN_REFERENCES)(
    "accepts the enumerated campaign identifier: %j",
    (campaignReference) => {
      expect(
        createSupportPayment({
          id: "payment-known-campaign",
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
        campaignReference: "campaign-music-ward",
        amountCents: 100,
        payerKind: "individual",
        method: "card",
      }),
    ).toThrow(DomainValidationError);

    expect(() =>
      createSupportPayment({
        id: "x".repeat(MAX_SUPPORT_PAYMENT_ID_LENGTH + 1),
        campaignReference: "campaign-music-ward",
        amountCents: 100,
        payerKind: "individual",
        method: "card",
      }),
    ).toThrow(DomainValidationError);

    expect(
      createSupportPayment({
        id: "  support-payment-1  ",
        campaignReference: "campaign-music-ward",
        amountCents: 100,
        payerKind: "individual",
        method: "card",
      }).id,
    ).toBe("support-payment-1");
  });

  it.each([
    "ES91 2100 0418 4502 0005 1332",
    "4111111111111111 4242424242424242",
    "payment\u0000null",
    "payment\nnewline",
    "payment\u202Eoverride",
    "<script>alert(1)</script>",
    "payment id",
    "payment.id",
    "payment/id",
    "payment+id",
    "pagó-1",
  ])("denies an id outside the opaque identifier charset: %j", (id) => {
    expect(() =>
      createSupportPayment({
        id,
        campaignReference: "campaign-music-ward",
        amountCents: 100,
        payerKind: "individual",
        method: "card",
      }),
    ).toThrow(DomainValidationError);
  });

  it("denies invalid payer or method values from untrusted runtime input", () => {
    expect(() =>
      createSupportPayment({
        id: "payment-invalid-payer",
        campaignReference: "campaign-music-ward",
        amountCents: 100,
        payerKind: "unknown" as never,
        method: "card",
      }),
    ).toThrow(DomainValidationError);

    expect(() =>
      createSupportPayment({
        id: "payment-invalid-method",
        campaignReference: "campaign-music-ward",
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

  describe("transitions revalidate the known fields", () => {
    const CORRUPTIONS: ReadonlyArray<[string, Record<string, unknown>]> = [
      ["negative amount", { amountCents: -999 }],
      ["fractional amount", { amountCents: 12.5 }],
      ["unbounded amount", { amountCents: MAX_SIMULATED_SUPPORT_AMOUNT_CENTS + 1 }],
      ["IBAN campaign reference", { campaignReference: "es9121000418450200051332" }],
      ["unknown campaign reference", { campaignReference: "campaign-1" }],
      ["PAN id", { id: "4111111111111111 4242424242424242" }],
      ["blank id", { id: "   " }],
      ["unknown payer kind", { payerKind: "unknown" }],
      ["unknown method", { method: "crypto" }],
    ];

    it.each(CORRUPTIONS)("denies settling a payment with a %s", (_name, patch) => {
      expect(() =>
        settleSupportPayment(corruptPendingPayment(patch), "succeeded"),
      ).toThrow(DomainValidationError);
    });

    it.each(CORRUPTIONS)(
      "denies cancelling a payment with a %s",
      (_name, patch) => {
        expect(() => cancelSupportPayment(corruptPendingPayment(patch))).toThrow(
          DomainValidationError,
        );
      },
    );
  });

  it("denies an invalid settlement outcome", () => {
    expect(() =>
      settleSupportPayment(pendingPayment(), "refunded" as never),
    ).toThrow(DomainValidationError);
  });
});

describe("rehydrateSupportPayment", () => {
  function persisted() {
    return {
      id: "support-payment-1",
      campaignReference: "campaign-music-ward" as const,
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

  it.each(["succeeded", "declined", "cancelled"] as const)(
    "rebuilds a %s payment",
    (status) => {
      expect(rehydrateSupportPayment({ ...persisted(), status }).status).toBe(
        status,
      );
    },
  );

  it("ignores unknown persisted properties", () => {
    const payment = rehydrateSupportPayment({
      ...persisted(),
      pan: "4111111111111111",
      payoutAccount: "artist-payout-1",
    } as never);

    expect(Object.keys(payment).sort()).toEqual(SUPPORT_PAYMENT_KEYS);
  });

  it("cannot reopen a terminal payment by rehydrating it as pending", () => {
    expect(() =>
      rehydrateSupportPayment({ ...persisted(), status: "pending" } as never),
    ).toThrow(DomainValidationError);
  });

  it.each([
    ["id", { id: "  " }],
    ["id charset", { id: "ES91 2100 0418" }],
    ["id length", { id: "x".repeat(MAX_SUPPORT_PAYMENT_ID_LENGTH + 1) }],
    ["campaignReference set", { campaignReference: "es9121000418450200051332" }],
    ["campaignReference free text", { campaignReference: "campaign-1" }],
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
