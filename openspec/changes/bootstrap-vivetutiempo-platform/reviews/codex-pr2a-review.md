# PR 2a adversarial review — application layer

Scope: committed `src/application/**`, `tests/unit/application/**`, domain
references, and OpenSpec artifacts only. No infrastructure/Prisma files or
infrastructure tests were reviewed. No test, build, install, or Git command was
run, as required.

The Slot decision use cases correctly place Slot/Proposal reads and domain
decisions inside `MatchingUnitOfWork.withLockedSlot`. The application imports
reviewed are limited to application and domain modules; no Next.js, Prisma,
infrastructure, or UI import was found.

## BLOCKER

### pr2a-B1 — The public allow-list is a TypeScript promise, not a runtime boundary

**References:** `src/application/use-cases/listPublishedEvents.ts:8-19`;
`src/application/ports/PublicEventProjectionQuery.ts:3-12`;
`tests/unit/application/listPublishedEvents.test.ts:28-68`; `design.md` §D6
(lines 34-37); `specs/public-event-browsing/spec.md` §The Public Projection Is
an Explicit Allow-List (lines 31-58).

`listPublishedEvents` returns the objects supplied by its port unchanged. A
TypeScript interface does not strip extra runtime properties: an adapter can
return an object typed as `PublicEventProjection` that also contains `location`,
`message`, email, or ids, and JSON serialization will expose them. The test
constructs only already-safe objects, then proves those safe fixtures have safe
keys; it never injects forbidden properties through the port.

Make the application use case create a fresh DTO field-by-field from a separate
read-record type, discarding every other property. Add a hostile-adapter unit
test that returns all forbidden fields and asserts that they are structurally
absent from the result. This is required before an anonymous public endpoint is
wired.

### pr2a-B2 — Re-registration mutates an existing account’s Profile without authenticating that account

**References:** `src/application/use-cases/registerProfile.ts:42-74`;
`tests/unit/application/registerProfile.test.ts:119-143`; `design.md` §Profile
transitions (lines 60-62); `specs/profile-onboarding/spec.md` §Rejected Profile
May Re-Register Into the Same Profile (lines 79-95).

For any existing email with a rejected Profile, the use case immediately calls
`reactivateProfile`; it never verifies `input.password`. Anyone who knows a
rejected Hospital/Artist email can reopen its governance review, creating an
auditable-but-forged request and potentially generating admin-queue spam. The
same unverified branch creates a Profile for an existing Account that has none,
and uses the caller-supplied role/type without verifying it matches the stored
Account role.

Require credential verification (or a separately verified account-recovery
flow) before re-registering an existing Account. Reject an existing Account
whose role does not match the requested Profile type. Add negative tests for a
wrong password, a mismatched existing role, and an account with no Profile.

## MAJOR

### pr2a-M1 — Live Profile status is read before, not within, the Slot mutation transaction

**References:** `src/application/use-cases/publishSlot.ts:35-54`;
`src/application/use-cases/submitProposal.ts:31-59`;
`src/application/use-cases/approveProposal.ts:34-40`;
`src/application/use-cases/rejectProposal.ts:31-37`;
`src/application/use-cases/closeSlot.ts:32-38`; `src/application/Actor.ts:7-11`;
`specs/profile-onboarding/spec.md` §Non-Active Profiles Are Blocked From Acting
(lines 72-77).

Each mutating Slot use case reads an active Profile before taking the Slot lock.
An Admin can deactivate/reject that Profile after this read and before the Slot
callback persists the mutation; the request then completes after deactivation
using stale authority. The authorization-matrix tests change the Profile before
the use case starts, so they do not cover this interleaving.

Re-check active status inside the transaction that commits the Slot decision.
This needs a coordinated command unit of work or a transaction-scoped live
Profile read with a documented global lock order (Account/Profile before Slot,
for example) to avoid deadlocks. Add barrier-based tests that force the status
change between the initial read and the Slot lock.

### pr2a-M2 — Login does not satisfy the stated per-account-and-per-client rate-limit or timing-resistance requirements

**References:** `src/application/use-cases/login.ts:40-83`;
`src/application/ports/LoginRateLimiter.ts:1-22`;
`tests/unit/application/login.test.ts:87-127`; `design.md` §D7 (lines 39-46);
`tasks.md` 4.13 (line 104).

`LoginAttemptKey` supports `ipHash`, but `LoginCredentials` has no client key
and `login` always calls the limiter with only `{ email }`; the per-client half
of the agreed control is unreachable. Also, unknown emails return after a
repository lookup, while a known account with an incorrect password performs an
argon2 verification. Identical error text does not prevent this timing-based
account-existence oracle.

Pass a trusted, pre-hashed client key from the delivery boundary as a separate
login-attempt context, and test it reaches every limiter call. For unknown
accounts, perform verification against a fixed dummy argon2id hash before the
generic denial. Add timing/spy-oriented tests that prove both unknown and
wrong-password paths invoke equivalent password verification and rate-limit
accounting.

### pr2a-M3 — The “login racing deactivation is denied” test covers only one queued ordering

**References:** `src/application/use-cases/login.ts:33-83`;
`src/application/ports/ProfileUnitOfWork.ts:25-37`;
`tests/unit/application/login.test.ts:161-184`;
`tests/unit/application/support/fakes.ts:248-286`.

The test deliberately enqueues deactivation before login. The global fake queue
therefore guarantees that login reads the already-deactivated Profile. It does
not test login acquiring the profile lock first and deactivation arriving while
the login is in flight. In that order, login can return a successful session and
deactivation revokes it afterwards; whether that is acceptable must be defined
rather than inferred from a favorable test order.

Define the linearization semantics: either a login that began first may succeed
only with a session already revoked before its response, or the operation must
be retried/denied when deactivation races. Add deterministic two-order/barrier
tests and assert the final session store and the observable login result.

### pr2a-M4 — The fakes do not test key session and transaction guarantees claimed by the ports

**References:** `src/application/ports/SessionPort.ts:14-29`;
`tests/unit/application/support/fakes.ts:166-208, 218-245`;
`tests/unit/application/login.test.ts:187-205`; `design.md` §D7 (lines 39-46).

`FakeSessionPort.resolveValid` returns any stored session; it never enforces
absolute or idle expiry despite the port contract. No unit test covers expiry or
`touch`. `FakeMatchingUnitOfWork` also has no rollback if a Slot/Proposal/Event
save fails after an earlier save has succeeded; it only avoids writes when the
callback throws before persistence. Thus the passing tests cannot evidence the
atomic persistence and session-expiry properties that PR 2b must provide.

Make the fake enforce the port contract, including expiry and idle timeout, and
add failure-injection tests for each persistence step. Keep the definitive
transaction and expiry tests in PR 2b against Postgres, but do not label the
current unit suite as proving them.

### pr2a-M5 — Registration creates Account and Profile in separate, unguarded writes

**References:** `src/application/use-cases/registerProfile.ts:47-91`;
`src/application/ports/AccountRepository.ts:13-17`;
`src/application/ports/ProfileRepository.ts:3-8`; `tests/unit/application/registerProfile.test.ts:24-165`.

New registration saves the Account and then the Profile without a unit of work.
A profile-save failure leaves an orphan Account. Two concurrent requests for the
same email can both observe no account; the database unique constraint may make
one fail, but the application has no atomicity contract or defined conversion
to `ConflictError`. The tests are sequential and do not inject either failure.

Introduce an Account/Profile registration unit of work that owns account lookup,
credential hash persistence, and Profile creation/reactivation atomically. Map
the durable email/Profile uniqueness violations to `ConflictError` and test
save-failure and concurrent-registration paths.

### pr2a-M6 — “Concurrent duplicate submission” is tested sequentially, not concurrently

**References:** `src/application/use-cases/submitProposal.ts:20-59`;
`tests/unit/application/submitProposal.test.ts:110-121`;
`tests/unit/application/support/fakes.ts:210-245`; `tasks.md` 3.22-3.23 and
4.9-4.10 (lines 83-84, 100-101).

The duplicate test awaits the first submission before invoking the second. The
lock-log assertions only prove that a lock was eventually called, not that the
decision data was read after locking under contention. The fake can serialize
correctly, but no test starts two promises or uses a barrier to exercise that
behavior. Similar application-level tests are absent for submit-vs-approve,
submit-vs-close, approve-vs-reject, and approve-vs-close.

Add queued concurrent calls with controllable barriers to prove the use cases
return one coherent outcome. PR 2b must repeat this against Postgres; only the
real row-lock/partial-index adapter can prove database behavior.

## MINOR

### pr2a-N1 — Role is checked, but expected Profile type is not

**References:** `src/application/use-cases/shared/guards.ts:18-37`;
`src/application/use-cases/publishSlot.ts:35-44`;
`src/application/use-cases/submitProposal.ts:31-54`.

An Actor with role `hospital` and an active Artist Profile would pass the
current guards; `publishSlot` would create a Slot owned by that Artist Profile.
Normal registration should prevent this inconsistency, but application guards
are the right defense-in-depth boundary for corrupted/imported data. Require
the live Profile type to match the role for Hospital and Artist actions.

### pr2a-N2 — Invalid runtime validation decisions are silently treated as rejection

**References:** `src/application/use-cases/validateProfile.ts:8-11, 46-55`.

At runtime, an unvalidated `decision` other than `"approve"` falls through to
the reject branch. Route validation should prevent this later, but the
application use case should fail closed with a validation error rather than
turn malformed input into an irreversible governance action.

### pr2a-N3 — Open-Slot listing performs an N+1 Profile lookup and hides a broken relation

**References:** `src/application/use-cases/listOpenSlots.ts:39-56`;
`tests/unit/application/listOpenSlots.test.ts:32-103`.

The use case runs one Profile lookup per Slot and converts a missing owning
Hospital to an empty name. A dedicated internal listing query would eliminate
the N+1 pattern and fail fast on a broken relation instead of returning
misleading content. This is a performance/data-quality concern, not an
authorization bypass.

## OPEN QUESTIONS

1. For a login that linearizes immediately before deactivation, should the user
   receive success with a simultaneously revoked session, or must the response
   be denied? The implementation and tests need one explicit contract.
2. Is a rejected Profile re-registration intended to authenticate with the
   existing password, or should it use a separate email-verification/recovery
   mechanism? It cannot safely be email-only.
3. Should the public query port return a broad internal read record and let the
   application map the DTO, or can the infrastructure adapter be trusted as
   the sole allow-list boundary? The current code assumes the latter, which is
   unsafe at runtime.
