import { describe, expect, it } from "vitest";

import { DomainValidationError } from "@domain/errors";
import type {
  PaymentGateway,
  SimulatedGatewayRequest,
} from "@application/ports/PaymentGateway";
import { simulateSupportPayment } from "@application/use-cases/simulateSupportPayment";
import { SequentialIdGenerator } from "./support/fakes";

class ControlledPaymentGateway implements PaymentGateway {
  readonly requests: SimulatedGatewayRequest[] = [];

  constructor(private readonly outcome: "succeeded" | "declined") {}

  async simulate(request: SimulatedGatewayRequest) {
    this.requests.push(request);
    return {
      outcome: this.outcome,
      receiptReference: `sim_controlled_${this.requests.length}`,
      simulated: true as const,
    };
  }
}

function input() {
  return {
    campaignReference: "campaign-music-ward",
    amountCents: 5000,
    payerKind: "corporate_sponsor" as const,
    method: "bank_transfer" as const,
  };
}

describe("simulateSupportPayment", () => {
  it("settles with a gateway-owned successful simulated outcome", async () => {
    const paymentGateway = new ControlledPaymentGateway("succeeded");

    const result = await simulateSupportPayment(input(), {
      idGenerator: new SequentialIdGenerator("support-payment"),
      paymentGateway,
    });

    expect(result.payment).toMatchObject({
      id: "support-payment-1",
      status: "succeeded",
      amountCents: 5000,
      currency: "EUR",
      simulated: true,
    });
    expect(result.receipt).toEqual({
      reference: "sim_controlled_1",
      simulated: true,
    });
    expect(paymentGateway.requests).toHaveLength(1);
  });

  it("settles with a gateway-owned declined outcome", async () => {
    const paymentGateway = new ControlledPaymentGateway("declined");

    const result = await simulateSupportPayment(input(), {
      idGenerator: new SequentialIdGenerator("support-payment"),
      paymentGateway,
    });

    expect(result.payment.status).toBe("declined");
    expect(result.receipt.simulated).toBe(true);
  });

  it("never sends a caller-controlled outcome or financial identifier to the gateway", async () => {
    const paymentGateway = new ControlledPaymentGateway("succeeded");

    await simulateSupportPayment(input(), {
      idGenerator: new SequentialIdGenerator("support-payment"),
      paymentGateway,
    });

    expect(paymentGateway.requests[0]).toEqual({
      paymentId: "support-payment-1",
      campaignReference: "campaign-music-ward",
      amountCents: 5000,
      currency: "EUR",
      payerKind: "corporate_sponsor",
      method: "bank_transfer",
    });
    expect(Object.keys(paymentGateway.requests[0]!).sort()).toEqual(
      [
        "amountCents",
        "campaignReference",
        "currency",
        "method",
        "payerKind",
        "paymentId",
      ].sort(),
    );
  });

  it("rejects a gateway result that is not explicitly marked as simulated", async () => {
    const paymentGateway: PaymentGateway = {
      async simulate() {
        return {
          outcome: "succeeded",
          receiptReference: "real-looking-reference",
          simulated: false,
        } as never;
      },
    };

    await expect(
      simulateSupportPayment(input(), {
        idGenerator: new SequentialIdGenerator("support-payment"),
        paymentGateway,
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });
});
