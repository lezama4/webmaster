# Verification Report — add-simulated-support-payments (Block 3)

**Method:** This change was verified by **Judgment Day** (blind dual adversarial
review), not by the single-pass `sdd-verify` phase the other changes used. This
file records that verification so the SDD trail is complete and uniform; the
authoritative security sign-off is `docs/simulated-payment-security-review.md`.

**Final verdict:** `APPROVED` (0 CRITICAL) after **8 rounds** of two-judge blind
review and 5 fix passes.

## Scope reminder

Block 3 is a **simulation seam**, by design: a `SupportPayment` domain aggregate,
a `PaymentGateway` port, a `simulateSupportPayment` use case, and a
`FakePaymentGateway` adapter. There is deliberately **no persistence, no route
handler, no UI, and no migration** — the point of stopping here is to demonstrate
a closed boundary, not to move money. The absence of those layers is intended,
not a gap.

## Trajectory

| Round | CRITICAL | Outcome |
|------:|:--------:|---------|
| 1 | 2 | `campaignReference` was free text accepting an IBAN/PAN verbatim; transitions spread arbitrary properties (`pan`/`cvv` laundered into a frozen "succeeded" payment). |
| 3 | 1 | `rehydrateSupportPayment` could still flip a terminal outcome one-step. |
| 5 | 0 | — |
| 6 | 0 | — |
| 7 | ESCALATED | Judges disagreed on a getter re-read of validated values. |
| 8 | 0 | Getter/Proxy smuggling closed (read-once), stale doc counts replaced by structural statements. **APPROVED.** |

## What the reviews forced (in order of value)

- **The free-text financial-data channel.** `campaignReference` accepted any
  string and forwarded it to the gateway; a charset filter could not close it
  (an IBAN begins with letters by construction). It became a **closed, enumerated
  set of system-issued identifiers** — the channel is gone by construction, not
  filtered.
- **Property laundering.** Transitions did `{ ...payment, status }`, copying
  arbitrary keys. Every field is now rebuilt from a single validated read; a
  getter/Proxy whose second read differs cannot smuggle a value past validation.
- **Terminal-outcome immutability is a persistence-layer invariant**, and this
  seam has no persistence — so instead of pretending to enforce it, the docs
  state it is delegated to a future repository. The recurring failure mode across
  all eight rounds was **documentation asserting more than the code delivered**;
  the final finding was a false test-count that a *fix* commit introduced.

## Guarantees confirmed (empirically, not by reading)

- Every serialisable payment, gateway request and receipt carries `simulated: true`.
- State machine `pending -> succeeded | declined | cancelled`; no exit from a terminal state.
- The request contract has no field for a PAN, CVV, IBAN, phone, account number or provider token.
- The fake adapter imports no provider SDK, no networking API, no persistence.
- A declined outcome settles and resolves normally; `FailedSimulationError` represents only failures, in the project error taxonomy.

## Transferable lesson recorded

Numeric/enumerated claims in prose (site counts, "four construction sites") are a
liability — they go stale at the next commit. Structural properties ("no
construction site on the request path outside the guarded region") do not. AI-
assisted hardening produces confident-sounding documentation faster than it
produces correct code, and only adversarial verification catches the gap.
