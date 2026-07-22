import { describe, expect, it } from "vitest";

import { FakePaymentGateway } from "@infrastructure/payment/FakePaymentGateway";

const request = {
  paymentId: "support-payment-1",
  campaignReference: "campaign-music-ward",
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

  it("keeps the synthetic reference well-formed for an unusual payment id", async () => {
    const gateway = new FakePaymentGateway({ outcome: "succeeded" });

    const result = await gateway.simulate({ ...request, paymentId: "a b/c" });

    expect(result.receiptReference).toBe("sim_a-b-c");
    expect(result.receiptReference).toMatch(/^sim_[A-Za-z0-9_-]+$/);
  });
});
