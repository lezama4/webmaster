import { describe, expect, it } from "vitest";

import { FakePaymentGateway } from "@infrastructure/payment/FakePaymentGateway";

const request = {
  paymentId: "support-payment-1",
  campaignReference: "campaign-music-ward",
  amountCents: 5000,
  currency: "EUR" as const,
  payerKind: "individual" as const,
  method: "bizum" as const,
};

describe("FakePaymentGateway", () => {
  it("returns an explicit synthetic success receipt", async () => {
    const gateway = new FakePaymentGateway({ outcome: "succeeded" });

    const result = await gateway.simulate(request);

    expect(result).toEqual({
      outcome: "succeeded",
      receiptReference: "sim_1",
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
});
