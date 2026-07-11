# PR 2 plan adversarial review — application and infrastructure

Scope: planning artifacts and `prisma/schema.prisma` only. No source under
`src/` was reviewed, and no build, test, install, or Git command was run.

## BLOCKER

### B1 — The planned raw-SQL partial indexes do not match the current Prisma database identifiers

**References:** `tasks.md` 4.2 (line 93); `design.md` §D4 (lines 24-29);
`prisma/schema.prisma:41-45, 104-123`.

Task 4.2 specifies `UNIQUE(slot_id) WHERE status='accepted'` and
`(slot_id, artist_profile_id) WHERE status='submitted'`. The Prisma schema,
however, maps the table to `proposals` but does not map fields to snake case:
the generated PostgreSQL columns are `"slotId"` and `"artistProfileId"`.
The enum labels are `ACCEPTED` and `SUBMITTED`, not lowercase values. Unless
the plan also adds explicit Prisma `@map` directives, the stated raw SQL will
fail its migration rather than create either safety constraint.

Specify the exact migration SQL against the generated schema, including quoted
camel-case columns and enum casts/literals (for example, predicates using
`'ACCEPTED'::"ProposalStatus"`). Add an integration assertion that queries the
catalog and proves both partial indexes exist with the intended predicates.

### B2 — The locking sequence still permits a stale approval/close outcome to omit a newly submitted Proposal

**References:** `design.md` §D4 (lines 24-29), §Approve-Proposal Sequence
(lines 81-88), and §Close-Slot Sequence (lines 109-115); `tasks.md` 4.4,
4.9-4.11 (lines 95, 100-102); `specs/slot-proposal-coordination/spec.md`
§Submission Cannot Race Past a Concurrent Approval or Close (lines 67-75).

The sequences load Slot + Proposals and calculate the pure domain outcome
*before* `MatchingUnitOfWork.commit` takes `SELECT ... FOR UPDATE`. A submit can
commit after that read but before the approval/close transaction acquires the
Slot lock. The resulting stale cascade will not include the newly submitted
Proposal, leaving it `submitted` under a filled/closed Slot. A row lock taken
only during persistence cannot repair an outcome calculated from a stale
snapshot.

The unit of work must acquire the Slot row lock first, then load the Slot and
complete Proposal set, re-check authorization/status, execute the domain
operation, and persist its result inside the same transaction. Model this as a
transaction callback (for example `withLockedSlot(slotId, work)`) rather than
`commit(precomputedOutcome)`. Test the interleaving explicitly with barriers:
approval/close reads first, a submit commits, then approval/close attempts to
lock and must reload/recompute rather than persist the stale outcome.

### B3 — PR 2 has no explicit schema/migration work for DB sessions or the required Profile fields

**References:** `design.md` §D1 (lines 11-14), §D7 (lines 39-46), §Profile
transitions (lines 60-62); `tasks.md` 3.1, 4.1, 4.6, and 4.12 (lines 62,
92, 97, 103); `prisma/schema.prisma:29-33, 53-83`.

The static schema has neither `ProfileStatus.DEACTIVATED` nor
`Profile.reviewRequestedAt`, and no Session model/table. Yet Phase 4 only says
“base schema” and later refers to a “session table”; no task requires the
Profile schema fix, session fields, relations, indexes, or their migration.
This leaves the deactivation/re-registration audit and DB-backed-session design
without a persistable contract.

Make 4.1 explicit and complete before repositories/adapters: add
`DEACTIVATED`, the durable review-request field/history, and a Session model
linked to Account with expiry/idle timestamps and an account lookup index. The
session record must define whether it stores a hash of an opaque, CSPRNG session
token (recommended) rather than a reusable bearer token. Include these changes
in the base migration before the raw partial-index migration, and test schema
creation from an empty database.

## MAJOR

### M1 — `rejectProposal` is omitted from the concurrency protocol

**References:** `design.md` §Application Layer (lines 70-74), §Approve-Proposal
Sequence (lines 76-89); `tasks.md` 3.12-3.13 and 4.4-4.11 (lines 73-74,
95-102); `specs/slot-proposal-coordination/spec.md` §Only the Owning Hospital
Approves or Rejects Proposals (lines 77-115).

The plan serializes submit, approve, and close, but not a manual rejection.
An owning Hospital can reject the same Proposal while an approval has read it
as `submitted`; locking only the Slot in approval does not prevent an
uncoordinated proposal update from being overwritten or from causing a filled
Slot/Event to be committed with no accepted Proposal.

Route every decision on a Proposal through the same Slot-row lock, or use
guarded proposal status updates whose zero-row result aborts the entire approval
transaction. Add integration tests for approve-vs-reject and close-vs-reject;
assert one coherent serial outcome and no contradictory success response.

### M2 — The race-test matrix is incomplete for the declared invariant

**References:** `design.md` §D4 (lines 24-29) and §Testing Strategy
(lines 152-159); `tasks.md` 4.5, 4.10-4.11 (lines 96, 101-102);
`specs/slot-proposal-coordination/spec.md` §Submission Cannot Race Past a
Concurrent Approval or Close (lines 67-75).

The plan tests two approvals and submit-vs-approve, but not submit-vs-close or
approve-vs-close. It also has no integration test for two concurrent submissions
by the same Artist, which must be reconciled with the partial unique
`(slot, artist) WHERE submitted` rule and mapped to a defined domain error.

Add deterministic, barrier-based tests for all four races and verify the final
database state, not only HTTP status. Test that a partial-index violation is
translated to `ConflictError`/a deliberate validation result without leaving a
partially-written Event, Slot, or Proposal cascade.

### M3 — Session revocation/expiry is described but not planned as an atomic, tested application contract

**References:** `design.md` §D7 (lines 39-46) and §Application Layer
(lines 70-74); `tasks.md` 3.4-3.7, 3.18-3.19, and 4.6/4.12 (lines 65-68,
79-80, 97, 103); `specs/profile-onboarding/spec.md` §Non-Active Profiles Are
Blocked From Acting and §Admin Deactivates an Active Profile (lines 72-77,
97-113).

`deactivateProfile` is tested to call `revokeAllForAccount`, but
`validateProfile` has no planned rejection-revocation test even though D7
requires it. There are no tasks/tests for rejecting expired absolute or idle
sessions, rotating the identifier on login, deleting the row on logout, or
preventing a concurrent login from issuing a new session after revocation.
Nor does the plan say the Profile transition and `revokeAllForAccount` share one
transaction; a crash between them leaves a deactivated/rejected actor with a
live session.

Define SessionPort operations and tests for create/rotate, resolve-valid,
touch-idle, revoke-one, and revoke-all. Make deactivation/rejection plus
revoke-all transactional, and make login/session issuance verify the current
Profile state within a coordinated transaction. Add expiry, rotation, logout,
rejection, deactivation, and login-vs-deactivation tests.

### M4 — The login rate limiter has no application port or Vercel-safe persistence strategy

**References:** `design.md` §D7 (line 44); `tasks.md` 3.1, 3.4-3.5, and 4.13
(lines 62, 65-66, 104).

`LoginRateLimiter` appears only as an infrastructure file in task 4.13. It is
absent from the Phase 3 port list and from the login use-case tests, so login
would either depend on a concrete infrastructure adapter (breaking the
hexagonal boundary) or omit the control. The plan also does not choose shared,
atomic storage. An in-memory limiter is ineffective across Vercel instances and
restarts.

Add a `LoginRateLimiter` application port and test login against it. Define a
Postgres-backed atomic counter/window (or another shared store), cleanup policy,
IP handling/privacy treatment, and generic responses for both unknown and known
accounts.

### M5 — The CSRF design trusts the request Host instead of a canonical origin, and lacks fail-closed tests

**References:** `design.md` §D7 (lines 39-46); `tasks.md` 4.14 and 5.13
(lines 105, 121).

Comparing `Origin`/`Referer` to the request `Host` is unsafe unless the Host is
validated by trusted proxy configuration. A hostile Host header can make an
attacker-controlled Origin appear to match. The plan also does not state that
missing/invalid Origin and Referer must fail closed, nor does it test the
policy. Login sets a session cookie but is outside the stated “authenticated
mutation” coverage, leaving login CSRF unaddressed.

Compare normalized Origin/Referer against one canonical, allowlisted public URL
from server configuration, reject absent/malformed/mismatched values, and never
perform mutations through GET. Add tests for allowed origin, hostile Host,
cross-site Origin, absent headers, and login. If login is deliberately excluded,
document the threat analysis and compensating control.

### M6 — The public projection cannot be implemented cleanly from the stated ports alone

**References:** `design.md` §D6 (lines 34-37), §Application Layer
(lines 70-74); `tasks.md` 3.1 and 3.26-3.27 (lines 62, 87-88);
`specs/public-event-browsing/spec.md` §The Public Projection Is an Explicit
Allow-List (lines 31-58).

The allow-list mapper needs Slot description/schedule/duration plus the accepted
Proposal's Artist display name, while the listed port set contains only generic
`EventRepository`, `SlotRepository`, `ProposalRepository`, and
`ProfileRepository`. No read-model method specifies the joined, published-only
input shape. This invites an application use case to import Prisma or receive a
raw relation graph, undermining D6.

Add a query/read port whose method returns only the fields required to construct
`PublicEventProjection`, filtered to published Events. Unit-test that the mapper
cannot receive or forward forbidden fields, and add the infrastructure query
test in PR 2; retain the public HTTP no-leak test for PR 3/6.

## MINOR

### N1 — Actor and error contracts are not named in the Phase 3 port plan

**References:** `design.md` §Application Layer (lines 70-74); `tasks.md` 3.1
(line 62) and 3.24-3.25 (lines 85-86).

Every use case is said to receive an `Actor`, but no Actor type/source or
consistent application error taxonomy (`Unauthenticated`, `Forbidden`,
`Conflict`, validation) is planned. Define them with the ports so denial tests
do not rely on HTTP concerns or diverge across use cases.

### N2 — Migration safety should include index creation and schema assertions

**References:** `design.md` §Migration / Rollout (lines 171-173); `tasks.md`
4.1-4.2 (lines 92-93).

The project is greenfield, so online index creation is not essential, but the
plan should still state migration order and a clean-database verification:
schema additions first, base tables/foreign keys, Session table/indexes, then
partial indexes. This makes the TFM evidence reproducible and detects B1 before
the application is built.

## OPEN QUESTIONS

1. Will `MatchingUnitOfWork` own transactional reads through a callback, or are
   repositories expected to support explicit `FOR UPDATE` reads? The interface
   must choose one to avoid the stale-outcome race in B2.
2. What exact semantic/result should a duplicate same-Artist submission return:
   idempotent existing Proposal, validation failure, or conflict? The database
   constraint alone cannot make that product decision.
3. Is a database-backed rate limiter acceptable within the Vercel/Postgres
   deployment target, and if so what retention and IP minimization policy will
   it use?
