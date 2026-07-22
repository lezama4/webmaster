import { describe, expect, it } from "vitest";

import {
  AdapterContractError,
  ApplicationError,
  FailedSimulationError,
} from "@application/errors";
import type {
  PaymentGateway,
  SimulatedGatewayRequest,
} from "@application/ports/PaymentGateway";
import { MAX_FAILED_SIMULATION_MESSAGE_LENGTH } from "@application/errors";
import {
  MAX_SIMULATED_RECEIPT_REFERENCE_LENGTH,
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
      AdapterContractError,
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
      AdapterContractError,
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
      AdapterContractError,
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

  it("belongs to the application error taxonomy", async () => {
    const paymentGateway: PaymentGateway = {
      async simulate() {
        throw new Error("gateway unavailable");
      },
    };

    const error = (await caught(run(paymentGateway))) as FailedSimulationError;

    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.name).toBe("FailedSimulationError");
  });

  describe("a hostile rejection cannot discard the cancelled payment", () => {
    /**
     * Describing the failure must never become a second failure. Reading an
     * arbitrary `message` accessor happens INSIDE the catch block, after the
     * payment has already been cancelled — a throw there would discard that
     * cancelled payment and lose the original cause entirely.
     */
    class ThrowingMessageError extends Error {
      override get message(): string {
        throw new Error("message getter exploded");
      }
    }

    const HOSTILE_REJECTIONS: ReadonlyArray<[string, () => unknown]> = [
      ["an Error whose message getter throws", () => new ThrowingMessageError()],
      [
        "an Error whose message is a symbol",
        () =>
          Object.defineProperty(new Error("placeholder"), "message", {
            value: Symbol("hostile"),
          }),
      ],
      [
        "an Error whose message is a null-prototype object",
        () =>
          Object.defineProperty(new Error("placeholder"), "message", {
            value: Object.create(null) as unknown,
          }),
      ],
    ];

    it.each(HOSTILE_REJECTIONS)("still cancels the payment for %s", async (
      _name,
      makeRejection,
    ) => {
      const rejection = makeRejection();
      const paymentGateway: PaymentGateway = {
        async simulate() {
          throw rejection;
        },
      };

      const error = await caught(run(paymentGateway));

      expect(isFailedSimulationError(error)).toBe(true);
      expect((error as FailedSimulationError).cause).toBe(rejection);
      expect((error as FailedSimulationError).cancelledPayment).toMatchObject({
        id: "support-payment-1",
        status: "cancelled",
      });
      expect(typeof (error as FailedSimulationError).message).toBe("string");
    });
  });

  // Scoped deliberately: these three objects plus the payment aggregate and
  // the `FakePaymentGateway` result are the frozen set. The thrown
  // `FailedSimulationError` is NOT in it — it is an extensible `Error`
  // protected per property instead.
  describe("the receipt, the wrapper and the outbound request are frozen", () => {
    it("freezes the receipt so the simulated marker cannot be flipped", async () => {
      const result = await run(new ControlledPaymentGateway("succeeded"));

      expect(Object.isFrozen(result.receipt)).toBe(true);
      expect(() => {
        (result.receipt as { simulated: boolean }).simulated = false;
      }).toThrow(TypeError);
      expect(result.receipt.simulated).toBe(true);
    });

    /**
     * Freezing the aggregate buys nothing at the boundary if the wrapper
     * holding it can have `payment` swapped for an unfrozen look-alike.
     */
    it("freezes the result wrapper so the payment cannot be swapped out", async () => {
      const result = await run(new ControlledPaymentGateway("succeeded"));

      expect(Object.isFrozen(result)).toBe(true);
      expect(() => {
        (result as { payment: unknown }).payment = { status: "succeeded" };
      }).toThrow(TypeError);
      expect(result.payment.status).toBe("succeeded");
    });

    /**
     * The request is the one object handed to a foreign adapter, so an adapter
     * must not be able to `delete request.simulated` before reading it.
     */
    it("freezes the outbound gateway request handed to the adapter", async () => {
      const paymentGateway = new ControlledPaymentGateway("succeeded");

      await run(paymentGateway);

      const request = paymentGateway.requests[0]!;
      expect(Object.isFrozen(request)).toBe(true);
      expect(() => {
        delete (request as { simulated?: unknown }).simulated;
      }).toThrow(TypeError);
      expect(request.simulated).toBe(true);
    });
  });

  describe("the derived failure message is bounded", () => {
    it("bounds an unbounded adapter-supplied message without losing the cause", async () => {
      const hostile = new Error("x".repeat(50_000));
      const paymentGateway: PaymentGateway = {
        async simulate() {
          throw hostile;
        },
      };

      const error = (await caught(run(paymentGateway))) as FailedSimulationError;

      expect(error.message.length).toBeLessThanOrEqual(
        MAX_FAILED_SIMULATION_MESSAGE_LENGTH,
      );
      // The full value is never lost: it survives verbatim on `cause`.
      expect((error.cause as Error).message).toHaveLength(50_000);
    });

    it("leaves a message already within the bound untouched", async () => {
      const paymentGateway: PaymentGateway = {
        async simulate() {
          throw new Error("gateway unavailable");
        },
      };

      const error = (await caught(run(paymentGateway))) as FailedSimulationError;

      expect(error.message).toBe("gateway unavailable");
    });
  });

  /**
   * `AdapterContractError` cannot escape this use case on its own: every
   * construction site is inside the guarded region or inside the adapter call
   * that region awaits, and its `catch` unconditionally rethrows a
   * `FailedSimulationError`.
   *
   * Every member of that class is a FAILURE — a gateway `declined` outcome
   * settles and resolves normally (see "settles with a gateway-owned declined
   * outcome"), so no business outcome arrives here. The discriminator exists to
   * separate an adapter-contract DEFECT from a gateway or infrastructure
   * REJECTION without unwrapping `cause` by hand.
   */
  describe("adapter defects stay distinguishable from external rejections", () => {
    it("flags an adapter-contract violation on the wrapper", async () => {
      const paymentGateway: PaymentGateway = {
        async simulate() {
          return {
            outcome: "succeeded",
            receiptReference: "real-looking-reference",
            simulated: true,
          } as never;
        },
      };

      const error = (await caught(run(paymentGateway))) as FailedSimulationError;

      expect(error.cause).toBeInstanceOf(AdapterContractError);
      expect(error.causedByAdapterDefect).toBe(true);
    });

    it("does not flag an ordinary gateway rejection as an adapter defect", async () => {
      const paymentGateway: PaymentGateway = {
        async simulate() {
          throw new Error("gateway unavailable");
        },
      };

      const error = (await caught(run(paymentGateway))) as FailedSimulationError;

      expect(error.causedByAdapterDefect).toBe(false);
    });

    it("keeps the discriminator non-writable so it cannot be forged", async () => {
      const paymentGateway: PaymentGateway = {
        async simulate() {
          throw new Error("gateway unavailable");
        },
      };

      const error = (await caught(run(paymentGateway))) as FailedSimulationError;

      expect(() => {
        (error as { causedByAdapterDefect: boolean }).causedByAdapterDefect =
          true;
      }).toThrow(TypeError);
      expect(error.causedByAdapterDefect).toBe(false);
    });

    /**
     * Deriving the discriminator must not become a second failure: it runs
     * after the payment has already been cancelled, and `instanceof` is
     * trappable by a `Proxy`.
     */
    it("survives a cause whose prototype lookup throws", async () => {
      const hostile = new Proxy(new Error("hostile"), {
        getPrototypeOf() {
          throw new Error("prototype lookup exploded");
        },
      });
      const paymentGateway: PaymentGateway = {
        async simulate() {
          throw hostile;
        },
      };

      const error = (await caught(run(paymentGateway))) as FailedSimulationError;

      expect(isFailedSimulationError(error)).toBe(true);
      expect(error.causedByAdapterDefect).toBe(false);
      expect(error.cancelledPayment.status).toBe("cancelled");
    });
  });

  /**
   * A result that is absent or not an object must be classified as an adapter
   * defect, not left to produce a bare `TypeError` from the first property
   * dereference. The discriminator only ever reports `true` for defects this
   * codebase itself labels, so an unlabelled defect is silently DEMOTED into
   * the branch a handler is told to treat as non-defect.
   */
  describe("a malformed gateway result is classified, not dereferenced", () => {
    const MALFORMED_RESULTS: ReadonlyArray<[string, unknown]> = [
      ["undefined", undefined],
      ["null", null],
      ["a string", "sim_not_an_object"],
      ["a number", 42],
      ["a boolean", true],
    ];

    it.each(MALFORMED_RESULTS)(
      "raises an adapter-contract violation when the gateway resolves to %s",
      async (_name, malformed) => {
        const paymentGateway: PaymentGateway = {
          async simulate() {
            return malformed as never;
          },
        };

        const error = (await caught(
          run(paymentGateway),
        )) as FailedSimulationError;

        expect(error).toBeInstanceOf(FailedSimulationError);
        expect(error.cause).toBeInstanceOf(AdapterContractError);
        expect(error.causedByAdapterDefect).toBe(true);
        expect(error.cancelledPayment.status).toBe("cancelled");
      },
    );
  });

  /**
   * The documents tell a future handler it may branch on the flag OR unwrap
   * `cause`. `Error` defines `cause` as writable and configurable, so without
   * this the two routes are not equally protected: the flag cannot be forged
   * but the value it was derived from can be swapped underneath it.
   */
  it("keeps cause non-writable so it cannot diverge from the discriminator", async () => {
    const failure = new Error("gateway unavailable");
    const paymentGateway: PaymentGateway = {
      async simulate() {
        throw failure;
      },
    };

    const error = (await caught(run(paymentGateway))) as FailedSimulationError;

    expect(() => {
      (error as { cause: unknown }).cause = new AdapterContractError("forged");
    }).toThrow(TypeError);
    expect(error.cause).toBe(failure);
    expect(
      Object.getOwnPropertyDescriptor(error, "cause"),
    ).toMatchObject({ enumerable: false, writable: false, configurable: false });
  });

  describe("the receipt reference is validated once and used once", () => {
    it("rejects a receipt reference that is not a string", async () => {
      const paymentGateway: PaymentGateway = {
        async simulate() {
          return {
            outcome: "succeeded",
            receiptReference: { toString: () => "sim_ok" },
            simulated: true,
          } as never;
        },
      };

      const error = await caught(run(paymentGateway));

      expect((error as FailedSimulationError).cause).toBeInstanceOf(
        AdapterContractError,
      );
      expect((error as FailedSimulationError).cancelledPayment.status).toBe(
        "cancelled",
      );
    });

    it("rejects an unbounded receipt reference", async () => {
      const paymentGateway: PaymentGateway = {
        async simulate() {
          return {
            outcome: "succeeded",
            receiptReference: `sim_${"a".repeat(
              MAX_SIMULATED_RECEIPT_REFERENCE_LENGTH,
            )}`,
            simulated: true,
          } as never;
        },
      };

      const error = await caught(run(paymentGateway));

      expect((error as FailedSimulationError).cause).toBeInstanceOf(
        AdapterContractError,
      );
    });

    it("returns the value it validated, not a second read of the adapter's getter", async () => {
      let reads = 0;
      const paymentGateway: PaymentGateway = {
        async simulate() {
          return {
            outcome: "succeeded",
            get receiptReference() {
              reads += 1;
              return reads === 1 ? "sim_validated" : "real-looking-reference";
            },
            simulated: true,
          } as never;
        },
      };

      const result = await run(paymentGateway);

      expect(result.receipt.reference).toBe("sim_validated");
    });

    it("settles the outcome it validated, not a second read of the adapter's getter", async () => {
      let reads = 0;
      const paymentGateway: PaymentGateway = {
        async simulate() {
          return {
            get outcome() {
              reads += 1;
              return reads === 1 ? "declined" : "succeeded";
            },
            receiptReference: "sim_validated",
            simulated: true,
          } as never;
        },
      };

      const result = await run(paymentGateway);

      expect(result.payment.status).toBe("declined");
    });
  });
});
