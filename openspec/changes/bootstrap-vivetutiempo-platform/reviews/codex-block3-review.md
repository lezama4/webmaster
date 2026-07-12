# Block 3 adversarial review — simulated support payments

## Scope and verification status

Read-only review requested for `src/domain/support-payment/**`,
`src/application/ports/PaymentGateway.ts`,
`src/application/use-cases/simulateSupportPayment.ts`,
`src/infrastructure/payment/**`, their tests,
`openspec/changes/add-simulated-support-payments/**`, and
`docs/simulated-payment-security-review.md`.

None of those paths exists in the supplied workspace. A repository-wide,
case-insensitive search found no `PaymentGateway`, support-payment domain,
simulation use case, payment adapter, Block 3 tests, Block 3 OpenSpec change,
or dedicated security review. The available project documentation instead
states that Block 3 is planned ([`docs/memoria-tfm-borrador.md:71-75`](../../../../docs/memoria-tfm-borrador.md)) and the stable architecture explicitly reserves `PaymentGateway` for a later Block 3 change ([`openspec/changes/bootstrap-vivetutiempo-platform/design.md:93-97`](../design.md)).

`npm test` was executed successfully: 22 files passed, 15 skipped; 261 tests
passed and 33 skipped. This establishes that the current Block 1 suite is
green, but cannot establish a Block 3 regression result because no Block 3
implementation or tests are present.

## BLOCKER

### b3-BLOCKER-01 — The submitted workspace contains no Block 3 implementation to review

**References:** [`docs/memoria-tfm-borrador.md:71-75`](../../../../docs/memoria-tfm-borrador.md), [`openspec/changes/bootstrap-vivetutiempo-platform/design.md:93-97`](../design.md), [`prisma/schema.prisma:1-23`](../../../../prisma/schema.prisma).

The requested artefacts are absent, while the available documentation describes
the feature as planned and the architecture as reserving the payment port for a
future addition. Consequently, none of the required claims can be verified:

- no evidence proves that the flow is simulated, secret-free, and makes no real
  payment call;
- no `PaymentGateway` application port or fake/real adapter boundary is present
  to assess for hexagonal compliance;
- no support-payment aggregate, state transitions, amount validation,
  idempotency semantics, or use-case authorization exists to inspect;
- no Block 3 diff, migration, or tests exists to determine whether shared Block
  1 files or the Prisma schema were changed; and
- no dedicated security review exists to compare against the implementation.

This is a delivery/evidence blocker, not evidence that a payment integration is
unsafe. Review the exact worktree or commit containing the stated separate
change before asserting that Block 3 is ready.

## MAJOR

No b3-MAJOR finding can be responsibly assessed: the implementation, its tests,
and its dedicated security review are absent.

## MINOR

No b3-MINOR finding can be responsibly assessed: the implementation, its tests,
and its dedicated security review are absent.

## OPEN QUESTIONS

### b3-OPEN-01 — Which exact revision/worktree contains the separate Block 3 change?

**References:** [`docs/memoria-tfm-borrador.md:71-75`](../../../../docs/memoria-tfm-borrador.md), [`openspec/changes/bootstrap-vivetutiempo-platform/design.md:95`](../design.md).

Provide the revision or workspace containing the listed source, tests, OpenSpec
change, and security review so the requested adversarial assessment can be
performed.

### b3-OPEN-02 — What are the explicit business semantics for identity, retries, and donation eligibility?

**References:** [`openspec/changes/bootstrap-vivetutiempo-platform/design.md:93-97`](../design.md), [`prisma/schema.prisma:18-23`](../../../../prisma/schema.prisma).

The current role model has `ADMIN`, `HOSPITAL`, `ARTIST`, and `PATIENT`; it has
no patron/donor role. The Block 3 specification must define the authenticated
role(s) allowed to simulate support, whether a request carries an idempotency
key, how duplicate submissions are represented, the accepted amount/currency
constraints, and which fields may be exposed in responses and logs.
