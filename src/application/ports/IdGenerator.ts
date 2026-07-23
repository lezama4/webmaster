/** Identifier source (port so domain/application stay deterministic in tests). */
export interface IdGenerator {
  /**
   * IMPLEMENTER OBLIGATION, NOT A VERIFIED GUARANTEE: `next()` MUST NEVER
   * return a value it has returned before, including across process restarts
   * and across separate instances. Nothing in this codebase checks it.
   *
   * `SimulatedGatewayResult.receiptReference` states that a reference must not
   * be reused across calls. `FakePaymentGateway` derives that reference from
   * the payment id, which comes from here, so it can only make the reference
   * as unique as this value is: an implementation that repeats an id makes the
   * port's non-reuse obligation unsatisfiable regardless of adapter behaviour.
   * The test fake `SequentialIdGenerator` restarts its counter per instance
   * and therefore does NOT satisfy this — acceptable only because each test
   * builds its own isolated payments.
   */
  next(): string;
}
