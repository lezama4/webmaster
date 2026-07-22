import { describe, expect, it } from "vitest";

import { DomainValidationError } from "@domain/errors";
import type {
  PaymentGateway,
  SimulatedGatewayRequest,
} from "@application/ports/PaymentGateway";
import {
  FailedSimulationError,
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
    campaignReference: "campaign-music-ward" as const,
    amountCents: 5000,
    payerKind: "corporate_sponsor" as const,
    method: "bank_transfer" as const,
  };
}

function run(paymentGateway: PaymentGateway, idPrefix = "support-payment") {
  return simulateSupportPayment(input(), {
    idGenerator: new SequentialIdGenerator(idPrefix),
    paymentGateway,
  });
}

function caught(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe("simulateSupportPayment", () => {
  it("settles with a gateway-owned successful simulated outcome", async () => {
    const paymentGateway = new ControlledPaymentGateway("succeeded");

    const result = await run(paymentGateway);

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

    const result = await run(paymentGateway);

    expect(result.payment.status).toBe("declined");
    expect(result.receipt.simulated).toBe(true);
  });

  it("never sends a caller-controlled outcome or financial identifier to the gateway", async () => {
    const paymentGateway = new ControlledPaymentGateway("succeeded");

    await run(paymentGateway);

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

    await run(paymentGateway);

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

    const error = await caught(run(paymentGateway));

    expect(error).toBeInstanceOf(FailedSimulationError);
    expect((error as FailedSimulationError).cause).toBeInstanceOf(
      DomainValidationError,
    );
  });

  it("cancels the pending payment and wraps the gateway rejection", async () => {
    const failure = new Error("gateway unavailable");
    const paymentGateway: PaymentGateway = {
      async simulate() {
        throw failure;
      },
    };

    const error = await caught(run(paymentGateway));

    expect(error).toBeInstanceOf(FailedSimulationError);
    expect(isFailedSimulationError(error)).toBe(true);
    expect((error as FailedSimulationError).cause).toBe(failure);
    expect((error as FailedSimulationError).message).toContain(
      "gateway unavailable",
    );
    expect((error as FailedSimulationError).cancelledPayment).toMatchObject({
      id: "support-payment-1",
      status: "cancelled",
    });
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

    const error = await caught(run(paymentGateway));

    expect(error).toBeInstanceOf(FailedSimulationError);
    expect((error as FailedSimulationError).cause).toBeInstanceOf(
      DomainValidationError,
    );
    expect((error as FailedSimulationError).cancelledPayment.status).toBe(
      "cancelled",
    );
  });

  it("cancels the pending payment when the gateway returns an outcome outside the union", async () => {
    const paymentGateway: PaymentGateway = {
      async simulate() {
        return {
          outcome: "refunded",
          receiptReference: "sim_controlled_1",
          simulated: true,
        } as never;
      },
    };

    const error = await caught(run(paymentGateway));

    expect(error).toBeInstanceOf(FailedSimulationError);
    expect((error as FailedSimulationError).cause).toBeInstanceOf(
      DomainValidationError,
    );
    expect((error as FailedSimulationError).cancelledPayment.status).toBe(
      "cancelled",
    );
  });

  it("never mutates a shared error constant thrown by the adapter", async () => {
    const sharedFailure = new Error("shared adapter failure");
    const paymentGateway: PaymentGateway = {
      async simulate() {
        throw sharedFailure;
      },
    };

    const first = (await caught(
      run(paymentGateway, "first-payment"),
    )) as FailedSimulationError;
    const second = (await caught(
      run(paymentGateway, "second-payment"),
    )) as FailedSimulationError;

    expect(first).not.toBe(second);
    expect(first.cancelledPayment.id).toBe("first-payment-1");
    expect(second.cancelledPayment.id).toBe("second-payment-1");
    expect(sharedFailure).not.toHaveProperty("cancelledPayment");
  });

  it("still cancels the payment when the adapter throws a frozen error", async () => {
    const frozenFailure = Object.freeze(new Error("frozen adapter failure"));
    const paymentGateway: PaymentGateway = {
      async simulate() {
        throw frozenFailure;
      },
    };

    const error = (await caught(run(paymentGateway))) as FailedSimulationError;

    expect(error).toBeInstanceOf(FailedSimulationError);
    expect(error.cause).toBe(frozenFailure);
    expect(error.cancelledPayment.status).toBe("cancelled");
  });

  it("preserves a non-Error rejection as the cause instead of stringifying it away", async () => {
    const nonError = { code: "GATEWAY_DOWN" };
    const paymentGateway: PaymentGateway = {
      async simulate() {
        throw nonError;
      },
    };

    const error = (await caught(run(paymentGateway))) as FailedSimulationError;

    expect(error).toBeInstanceOf(FailedSimulationError);
    expect(error.cause).toBe(nonError);
    expect(error.message).not.toContain("[object Object]");
  });

  it("keeps cancelledPayment non-enumerable and non-writable", async () => {
    const paymentGateway: PaymentGateway = {
      async simulate() {
        throw new Error("gateway unavailable");
      },
    };

    const error = (await caught(run(paymentGateway))) as FailedSimulationError;

    expect(Object.keys(error)).not.toContain("cancelledPayment");
    expect(JSON.stringify(error)).not.toContain("cancelledPayment");
    expect(
      Object.getOwnPropertyDescriptor(error, "cancelledPayment"),
    ).toMatchObject({ enumerable: false, writable: false });
  });

  it("does not treat an unrelated error carrying a cancelledPayment key as a failed simulation", () => {
    const impostor = Object.assign(new Error("unrelated"), {
      cancelledPayment: { status: "cancelled" },
    });

    expect(isFailedSimulationError(impostor)).toBe(false);
  });
});
