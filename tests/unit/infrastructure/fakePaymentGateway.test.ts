import { describe, expect, it } from "vitest";

import { MAX_SUPPORT_PAYMENT_ID_LENGTH } from "@domain/support-payment/SupportPayment";
import { FakePaymentGateway } from "@infrastructure/payment/FakePaymentGateway";

const request = {
  paymentId: "support-payment-1",
  campaignReference: "campaign-music-ward" as const,
  amountCents: 5000,
  currency: "EUR" as const,
  simulated: true as const,
  payerKind: "individual" as const,
  method: "bizum" as const,
};

describe("FakePaymentGateway", () => {
  it("returns an explicit synthetic success receipt", async () => {
    const gateway = new FakePaymentGateway({ outcome: "succeeded" });

    const result = await gateway.simulate(request);

    expect(result).toEqual({
      outcome: "succeeded",
      receiptReference: "sim_support-payment-1",
      simulated: true,
    });
  });

  it("returns a configured decline without any real payment side effect", async () => {
    const gateway = new FakePaymentGateway({ outcome: "declined" });

    const result = await gateway.simulate(request);

    expect(result.outcome).toBe("declined");
    expect(result.receiptReference).toMatch(/^sim_/);
    expect(result.simulated).toBe(true);
  });

  it("does not allow request data to override the fake adapter outcome", async () => {
    const gateway = new FakePaymentGateway({ outcome: "declined" });

    const result = await gateway.simulate({
      ...request,
      method: "card",
    });

    expect(result.outcome).toBe("declined");
  });

  it("captures the outcome at construction so later option mutation cannot flip it", async () => {
    const options: { outcome: "succeeded" | "declined" } = {
      outcome: "succeeded",
    };
    const gateway = new FakePaymentGateway(options);

    options.outcome = "declined";

    expect((await gateway.simulate(request)).outcome).toBe("succeeded");
  });

  it.each(["captured", "SUCCEEDED", "", undefined, null])(
    "rejects an outcome outside the simulated union at construction: %p",
    (outcome) => {
      expect(() => new FakePaymentGateway({ outcome } as never)).toThrow(Error);
    },
  );

  it("derives a unique receipt reference from the payment id across instances", async () => {
    const first = await new FakePaymentGateway({ outcome: "succeeded" }).simulate(
      request,
    );
    const second = await new FakePaymentGateway({
      outcome: "succeeded",
    }).simulate({ ...request, paymentId: "support-payment-2" });

    expect(first.receiptReference).toBe("sim_support-payment-1");
    expect(second.receiptReference).toBe("sim_support-payment-2");
    expect(first.receiptReference).not.toBe(second.receiptReference);
  });

  it("maps distinct payment ids to distinct receipt references", async () => {
    const gateway = new FakePaymentGateway({ outcome: "succeeded" });
    const paymentIds = [
      "pay-1",
      "pay_1",
      "PAY-1",
      "pay1",
      "pay-1-",
      "-pay-1",
      "p-ay-1",
      "a",
      "A",
      "a-",
      "a_",
    ];

    const references = await Promise.all(
      paymentIds.map(async (paymentId) =>
        (await gateway.simulate({ ...request, paymentId })).receiptReference),
    );

    expect(new Set(references).size).toBe(paymentIds.length);
    for (const reference of references) {
      expect(reference).toMatch(/^sim_[A-Za-z0-9_-]+$/);
    }
  });

  it.each([
    "a b/c",
    "pay 1",
    "pay.1",
    "pay/1",
    "pay+1",
    "",
    "   ",
    "ES91 2100 0418 4502 0005 1332",
  ])(
    "refuses to derive a reference from a non-opaque payment id: %j",
    async (paymentId) => {
      const gateway = new FakePaymentGateway({ outcome: "succeeded" });

      await expect(gateway.simulate({ ...request, paymentId })).rejects.toThrow(
        Error,
      );
    },
  );

  /**
   * The adapter enforces the charset itself rather than trusting upstream
   * validation, so it must enforce the bound itself too: an in-charset id of
   * unbounded length is accepted by the pattern and yields an equally
   * unbounded receipt reference.
   */
  it("refuses to derive a reference from an in-charset but unbounded payment id", async () => {
    const gateway = new FakePaymentGateway({ outcome: "succeeded" });

    await expect(
      gateway.simulate({
        ...request,
        paymentId: "a".repeat(MAX_SUPPORT_PAYMENT_ID_LENGTH + 1),
      }),
    ).rejects.toThrow(Error);
  });

  it("still accepts a payment id at the bound", async () => {
    const gateway = new FakePaymentGateway({ outcome: "succeeded" });
    const paymentId = "a".repeat(MAX_SUPPORT_PAYMENT_ID_LENGTH);

    expect((await gateway.simulate({ ...request, paymentId })).receiptReference).toBe(
      `sim_${paymentId}`,
    );
  });
});
