# Design — simulated support payments

## Architecture

The feature is a small bounded context with one pure aggregate and one outbound
port:

```text
simulateSupportPayment use case
  -> SupportPayment factory (domain)
  -> PaymentGateway.simulate (application port)
  -> FakePaymentGateway (infrastructure adapter, no network)
  -> domain settlement transition + simulated receipt
```

`SupportPayment` is not a ledger entry, payment instrument, payout, or
donation certificate. It is an explicit simulation record returned to the
caller. The feature has no repository and no migration because persistence
would falsely imply financial durability before a real financial design exists.

Because there is no persistence, one invariant a reader might expect is
deliberately absent: **terminal-outcome immutability across a store-and-reload
cycle**. `rehydrateSupportPayment` rejects `pending`, so a stored terminal
record cannot be reconstructed as an unsettled one; it does not constrain which
terminal status is presented, and cannot, because a pure function has no prior
state to compare against. This is assigned to the future persistence layer: the
repository that stores these records must enforce a status that leaves
`pending` exactly once and is never rewritten afterwards, via a conditional
update guarded on the current status or an append-only event log.

## Domain model

```text
pending -> succeeded | declined | cancelled
```

Fields:

- `id`, `campaignReference`, `amountCents`, `currency` (`EUR` only for this
  simulation), `payerKind`, `method`, and `status`.
- `payerKind`: `individual`, `private_patron`, `institution`,
  `corporate_sponsor`.
- `method`: `card`, `bizum`, `bank_transfer`; every one is represented as a
  simulation label, never as an integration.

The creation factory forces `pending`. Settlement is pure and terminal. Money
uses bounded integer cents. The aggregate deliberately has no personally
identifying or financial-instrument field.

## Port contract

`PaymentGateway.simulate` receives the safe pending-payment fields and returns
only one trusted simulated outcome plus a synthetic reference. The port does
not expose a generic `charge`, `transfer`, `refund`, or webhook API.

The fake adapter is constructed with a predetermined outcome. It MUST ignore
any attempt to influence that outcome through use-case input, and it MUST NOT
import `fetch`, Node networking APIs, or a provider SDK.

## Security decisions

- The receipt contains `simulated: true` and a `sim_` reference prefix.
- A misbehaving adapter raises `AdapterContractError` from the application
  error taxonomy, never a `DomainError`: a gateway response is not domain
  input, and an adapter defect is not a rejected caller operation.
- `AdapterContractError` never reaches `toErrorResponse` from
  `simulateSupportPayment`. It is only ever constructed inside that use case's
  guarded region, whose `catch` unconditionally rethrows a
  `FailedSimulationError`, so it surfaces only as `FailedSimulationError.cause`
  and its "falls through to 500" mapping is unreachable from there.
- Because of that type erasure, a future handler MUST branch on
  `FailedSimulationError.causedByAdapterDefect` before choosing a status.
  Mapping the class wholesale to a business status — on the reasoning that a
  cancelled simulation is an ordinary business outcome — would report adapter
  DEFECTS to clients as ordinary business outcomes, which is precisely what
  splitting `AdapterContractError` out of the taxonomy exists to prevent.
- Per-payment uniqueness of `receiptReference` is an adapter obligation stated
  in the port contract, not something the use case verifies. Checking it would
  couple the application layer to an adapter's naming scheme.
- Denials of enumerated values report the field name and the allowed set,
  never the rejected value. Echoing it would copy a financial identifier into
  logs — the very channel the enumeration exists to remove — and interpolating
  an untrusted value can itself throw.
- Client input never includes an outcome, gateway token, payment URL, or
  provider identifier.
- No amount is represented by `number` with a fractional semantic; the domain
  accepts only safe integer cents and a bounded maximum.
- No public endpoint is introduced by this change. Any future endpoint must
  apply authentication/rate limiting/CSRF as appropriate and retain the
  simulation-only wording.
- A later real provider requires a separate SDD change, legal/financial review,
  provider-hosted checkout, signed idempotent webhooks, reconciliation, refund
  policy, and a new threat model. It MUST NOT reuse this fake as production
  payment code.

## Testing

Use test-first development:

1. Domain tests for all validation and terminal transitions.
2. Application tests for method/payer forwarding and gateway-owned outcome.
3. Infrastructure fake tests proving synthetic reference and explicit simulation
   marker.
4. Run unit tests, typecheck, and lint. Integration/E2E are intentionally not
   required because the fake owns no persistence or network boundary.
