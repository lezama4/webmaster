# PR 2a remediation verification recheck

## Scope and method

This is a read-only re-evaluation of the five findings marked partial and the
two `pr2a-verify-*` findings in
[`codex-pr2a-verify.md`](./codex-pr2a-verify.md), against the current
application, infrastructure, and relevant test source on `feat/application`.

No Git, build, install, or test command was run for this recheck. The reported
green CI result is accepted as supplied, but the verdicts below are based on
the current implementation and test code, not on a newly executed local run.

## Verdicts

### recheck-pr2a-M1 — SIGUE-PARCIAL

The application still performs its live role/status check after entering the
Slot lock callback, which is materially better than a pre-lock read. For
example, `submitProposal` enters `withLockedSlot` before invoking
`withLockedProfile`
(`src/application/use-cases/submitProposal.ts:41-45`), and the equivalent
pattern remains in approval, rejection, and closure.

However, this does **not** make the Profile authorization and Slot mutation one
transaction. `PrismaMatchingUnitOfWork` starts transaction **A**, locks and
loads the Slot, then awaits the application callback
(`src/infrastructure/persistence/prisma/MatchingUnitOfWork.ts:54-78`). The
callback invokes `PrismaProfileUnitOfWork`, which starts a distinct root-client
transaction **B**
(`src/infrastructure/persistence/prisma/ProfileUnitOfWork.ts:31-47`).
Transaction B commits/releases its Account lock when the callback returns
(`ProfileUnitOfWork.ts:65-70`), while transaction A only persists the Slot,
Proposal, and Event afterwards (`MatchingUnitOfWork.ts:80-131`).

Consequently, an Admin deactivation can commit after B has authorized the actor
but before A persists its Slot mutation. This is the same unclosed core exposed
as `recheck-pr2a-verify-M2`; the in-code claim that nesting makes it the
"SAME transaction" (`src/application/ports/MatchingUnitOfWork.ts:31-35`) is
not implemented by the Prisma adapters.

### recheck-pr2a-M3 — RESUELTO

The real Postgres test now forces both lock orders. When deactivation locks the
Account first, login is blocked, then denied, and the final session table is
empty (`tests/integration/login-vs-deactivation-race.test.ts:62-112`). When
login locks first, the test forces deactivation to wait, then verifies that the
successful login's session is removed by deactivation's transaction-scoped
revocation (`login-vs-deactivation-race.test.ts:150-208`).

This matches the intended implementation: the Profile UoW supplies a
transaction-scoped session port
(`src/infrastructure/persistence/prisma/ProfileUnitOfWork.ts:51-68`), and
login creates the session inside that UoW
(`src/application/use-cases/login.ts:137-150`).

### recheck-pr2a-M4 — RESUELTO

The fake now enforces absolute and idle expiration in both `resolveValid` and
`touch`; an expired fake session is deleted and `touch` returns `false`
(`tests/unit/application/support/fakes.ts:245-270`). The fake Matching UoW
also snapshots all three stores and restores them if any persist-phase write
fails (`tests/unit/application/support/fakes.ts:318-345`), with a direct
mid-persist rollback test
(`tests/unit/application/fakeContracts.test.ts:81-125`).

The real adapter is additionally covered by PostgreSQL lifecycle tests for
absolute expiry, idle expiry, valid touch, rejected late touch, and the
resolve-before/touch-after-idle-boundary case
(`tests/integration/session-lifecycle.test.ts:36-69, 81-162`).

### recheck-pr2a-M5 — SIGUE-PARCIAL

The application contract remains sound: `RegistrationUnitOfWork` requires an
email lock, atomic Account/Profile persistence, and durable uniqueness errors
to become `ConflictError`
(`src/application/ports/RegistrationUnitOfWork.ts:35-50`). The use case
depends only on that contract
(`src/application/use-cases/registerProfile.ts:58-123`), and the in-memory
fake provides rollback behaviour
(`tests/unit/application/support/fakes.ts:409-445`).

There is still no Prisma implementation of `RegistrationUnitOfWork` under
`src/infrastructure/`, and no PostgreSQL integration test for concurrent
same-email registration or database unique-violation mapping. Therefore the
durable behaviour remains contractual/fake-only; green Slot/session race tests
cannot verify it.

### recheck-pr2a-M6 — RESUELTO

The former queue-fake-only evidence has been replaced by deterministic,
PostgreSQL-backed races. The tests use `afterLock` barriers plus a verified
Postgres lock wait, then assert final database rows rather than only promise
results:

- duplicate same-Artist submission:
  `tests/integration/duplicate-submission.test.ts:36-121`;
- submit versus approve in both lock orders:
  `tests/integration/submit-approve-race.test.ts:43-145`;
- submit versus close in both lock orders:
  `tests/integration/submit-close-race.test.ts:30-117`;
- approve versus reject in both lock orders:
  `tests/integration/approve-reject-race.test.ts:43-123`;
- approve versus close in both lock orders:
  `tests/integration/approve-close-race.test.ts:46-122`.

The matching adapter takes `SELECT ... FOR UPDATE` before the
decision-forming Proposal read and persists the entire returned mutation before
commit (`src/infrastructure/persistence/prisma/MatchingUnitOfWork.ts:54-131`).
This closes the earlier evidence gap for the specified Slot contention matrix.

### recheck-pr2a-verify-M1 — RESUELTO

`SessionPort.touch` now performs one conditional update requiring both
`absoluteExpiresAt > now` and `lastActiveAt > idleThreshold`; zero updated
rows are deleted and reported as unauthenticated
(`src/infrastructure/auth/session.ts:91-120`). The port contract now makes
the boolean result and the caller obligation explicit
(`src/application/ports/SessionPort.ts:21-32`).

The real Postgres suite proves no revival after idle expiry, absolute expiry,
either exact boundary, and the formerly dangerous resolve-then-late-touch
sequence (`tests/integration/session-lifecycle.test.ts:81-162`). The fake
was updated to the same double-validity guard
(`tests/unit/application/support/fakes.ts:253-270`).

### recheck-pr2a-verify-M2 — SIGUE-ABIERTO

The remediation has **not** closed the authorization-to-persistence window.
The current `MatchingUnitOfWork` does not receive a transaction-scoped Profile
reader/locker; it only supplies Slot and Proposal values to `work`
(`src/application/ports/MatchingUnitOfWork.ts:37-55`). Each Slot-mutating use
case therefore obtains actor authorization through the separate
`ProfileUnitOfWork` port, for example
`src/application/use-cases/approveProposal.ts:41-47`.

As a result, the exact harmful interleaving remains possible:

1. transaction A locks the Slot and transaction B reads an active Profile;
2. B commits and releases the Account lock;
3. Admin deactivation commits and revokes sessions;
4. A persists an approval, rejection, closure, or submission after that
   deactivation.

No current integration test forces this interleaving between a Slot mutation
and deactivation. The existing real-Postgres race concerns login and
deactivation only
(`tests/integration/login-vs-deactivation-race.test.ts:39-208`).

## What genuinely remains

1. **Make Slot authorization and Slot persistence one database transaction.**
   The Slot UoW must retain the Account/Profile lock through the final Slot
   write, with one documented global lock order. A real-Postgres barrier test
   must force deactivation after authorization but before the attempted Slot
   commit.
2. **Implement and verify the Prisma registration UoW.** It needs atomic
   same-email coordination, Account/Profile rollback, and durable unique-error
   to `ConflictError` mapping, proven by a real-Postgres
   concurrent-registration test.

No additional remediation is required for the previous session-revival finding
or the Slot-only contention matrix covered by `recheck-pr2a-M4`,
`recheck-pr2a-M6`, and `recheck-pr2a-verify-M1`.

