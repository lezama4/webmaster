import { describe, expect, it } from "vitest";

import { DomainValidationError } from "@domain/errors";
import type {
  PaymentGateway,
  SimulatedGatewayRequest,
} from "@application/ports/PaymentGateway";
import {
  isFailedSimulationError,
  simulateSupportPayment,
} from "@application/use-cases/simulateSupportPayment";
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
      simulated: true,
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
        "simulated",
      ].sort(),
    );
  });

  it("marks the outbound gateway request as an explicit simulation", async () => {
    const paymentGateway = new ControlledPaymentGateway("succeeded");

    await simulateSupportPayment(input(), {
      idGenerator: new SequentialIdGenerator("support-payment"),
      paymentGateway,
    });

    expect(paymentGateway.requests[0]!.simulated).toBe(true);
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

  it("cancels the pending payment and rethrows when the gateway rejects", async () => {
    const failure = new Error("gateway unavailable");
    const paymentGateway: PaymentGateway = {
      async simulate() {
        throw failure;
      },
    };

    const error: unknown = await simulateSupportPayment(input(), {
      idGenerator: new SequentialIdGenerator("support-payment"),
      paymentGateway,
    }).catch((caught: unknown) => caught);

    expect(error).toBe(failure);
    expect(isFailedSimulationError(error)).toBe(true);
    expect((error as { cancelledPayment: { status: string } }).cancelledPayment)
      .toMatchObject({ id: "support-payment-1", status: "cancelled" });
  });

  it("cancels the pending payment when the receipt fails the synthetic check", async () => {
    const paymentGateway: PaymentGateway = {
      async simulate() {
        return {
          outcome: "succeeded",
          receiptReference: "real-looking-reference",
          simulated: true,
        } as never;
      },
    };

    const error: unknown = await simulateSupportPayment(input(), {
      idGenerator: new SequentialIdGenerator("support-payment"),
      paymentGateway,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DomainValidationError);
    expect(isFailedSimulationError(error)).toBe(true);
    expect(
      (error as { cancelledPayment: { status: string } }).cancelledPayment.status,
    ).toBe("cancelled");
  });
});
