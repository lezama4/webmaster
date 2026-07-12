# PR 2b adversarial infrastructure review

## Scope and verification status

Reviewed read-only: `src/infrastructure/**`, `prisma/**`,
`tests/integration/**`, the stable design/specification artefacts, and the
previous review reports. The concurrently edited application source was not
reviewed. No Git, build, install, or test command was run, as required.

The migration SQL is statically consistent with the Prisma schema: it targets
`"proposals"`, quotes `"slotId"` and `"artistProfileId"`, and casts the
uppercase enum labels to `"ProposalStatus"`
([`20260711000001_partial_unique_indexes/migration.sql:10-19`](../../../../prisma/migrations/20260711000001_partial_unique_indexes/migration.sql)).
The catalog tests do query `pg_indexes`; this is a meaningful improvement over
the prior plan.

`PrismaMatchingUnitOfWork` also has the intended structure: it locks the Slot
before loading its Proposal set, invokes the callback on that in-transaction
snapshot, and persists the mutation before the transaction completes
([`MatchingUnitOfWork.ts:50-129`](../../../../src/infrastructure/persistence/prisma/MatchingUnitOfWork.ts)).
The public projection adapter uses a limited Prisma `select`, filters on
`PUBLISHED`, and creates a fresh DTO without a spread
([`PublicEventProjectionQuery.ts:19-47`](../../../../src/infrastructure/persistence/prisma/PublicEventProjectionQuery.ts)).

Those positive observations do not resolve the findings below.

## BLOCKER

### pr2b-B1 — Login rate limiting is not atomic at the decision boundary

**References:** [`src/infrastructure/auth/loginRateLimiter.ts:41-91`](../../../../src/infrastructure/auth/loginRateLimiter.ts),
[`tests/integration/login-rate-limiter.test.ts:27-109`](../../../../tests/integration/login-rate-limiter.test.ts),
[`design.md` §D7](../design.md).

`isAllowed` reads a counter in one operation, while `recordFailure` later
performs a separate `findUnique` followed by `upsert` or `update`. Concurrent
attempts can all observe a count below the threshold before any of them records
its failure. On a new or expired row, concurrent upserts can also lose counts
(their update branch resets `failureCount` to `1`) or surface a uniqueness race,
depending on Prisma's generated query path. Therefore the claimed Postgres
counter/window is not an atomic *consume attempt* operation.

This allows a concurrent credential-stuffing burst to exceed the configured
limit and makes the rate limiter unreliable precisely under attack. The current
tests are entirely sequential, so they cannot expose this interleaving.

Replace the `isAllowed` + `recordFailure` split with one transactional/atomic
operation, for example a single guarded `INSERT ... ON CONFLICT ... DO UPDATE
... RETURNING` that both increments/resets and returns whether the limit was
crossed. The email and client keys should be updated in one transaction, with a
defined fail-closed result. Add a barrier-based PostgreSQL test that fires more
than `RATE_LIMIT_MAX_FAILURES` concurrent failures for a fresh key and asserts
the exact final count and number of permitted password verifications.

## MAJOR

### pr2b-M1 — The session `touch` operation can revive an idle-expired session

**References:** [`src/infrastructure/auth/session.ts:71-101`](../../../../src/infrastructure/auth/session.ts),
[`tests/integration/session-lifecycle.test.ts:58-70`](../../../../tests/integration/session-lifecycle.test.ts),
[`design.md` §D7](../design.md).

`resolveValid` correctly rejects an idle-expired row, but `touch` updates any
row whose absolute expiry is still in the future. It does not require
`lastActiveAt` to still fall within the idle window, and it ignores the update
count. A caller that touches before resolving, or that resolves just before the
idle threshold and touches after it, can reset `lastActiveAt` and make an
otherwise idle-expired session valid again.

Make `touch` conditional on both absolute and idle validity (or replace the
two-step `resolveValid`/`touch` protocol with an atomic resolve-and-touch
operation). Treat a zero-row update as unauthenticated and delete stale rows.
Add tests for touch-after-idle-expiry, a resolve/touch race across the idle
boundary, and equality at both expiry thresholds.

### pr2b-M2 — Argon2id is selected, but the effective work factor is only the library default

**References:** [`src/infrastructure/auth/passwordHasher.ts:16-25`](../../../../src/infrastructure/auth/passwordHasher.ts),
[`node_modules/@node-rs/argon2/index.d.ts:34-61`](../../../../node_modules/@node-rs/argon2/index.d.ts).

The adapter explicitly chooses algorithm value `2` (`Argon2id`), which is
correct. However, it does not set `memoryCost`, `timeCost`, or `parallelism`.
The installed library declaration documents its default memory cost as 4096 KiB
(4 MiB), below the OWASP Argon2id baseline of 19 MiB, two iterations, and one
degree of parallelism ([OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)). A future library update can also change an implicit default without a source diff here.

Set and document explicit, benchmarked parameters (at least an OWASP equivalent
baseline unless deployment capacity justifies a stronger calibrated value),
including `memoryCost`, `timeCost`, `parallelism`, version, and output length.
Test the encoded hash parameters and establish an upgrade-on-successful-login
strategy for hashes with weaker parameters.

### pr2b-M3 — The integration suite shares and destructively resets one database while Vitest is configured for normal parallel execution

**References:** [`tests/integration/support/db.ts:29-48`](../../../../tests/integration/support/db.ts),
[`vitest.config.ts:4-11`](../../../../vitest.config.ts),
[`tests/integration/schema-migration.test.ts:18-25`](../../../../tests/integration/schema-migration.test.ts).

Every integration file obtains the same default `PrismaClient`, and every test
calls `resetDatabase`, which deletes all application tables. The Vitest
configuration includes all integration files but does not disable file
parallelism, supply a per-worker database/schema, or provide a global migration
setup. Consequently, one file can erase another file's fixtures while it is
asserting a race, and non-migration tests can start before the migration test
has applied an empty database.

This makes CI results nondeterministic and can turn the important transaction
tests into flaky evidence. Run integration tests against an isolated database
or schema per worker, or explicitly run this suite serially. Apply migrations
in a global setup step to a fresh, dedicated test database before any test
loads; do not rely on one ordinary test file to establish schema state.

### pr2b-M4 — The CSRF policy is a correct pure predicate but is not an enforcement control yet

**References:** [`src/infrastructure/auth/csrf.ts:1-55`](../../../../src/infrastructure/auth/csrf.ts),
[`design.md` §D7](../design.md), [`tests/integration/`](../../../../tests/integration/).

For unsafe methods, `isCsrfSafe` correctly normalises `Origin`/`Referer`,
compares against a canonical configured origin rather than request `Host`, and
fails closed on absent or malformed headers. However, the source explicitly
states that route-handler wiring, including login, is deferred to Phase 5. No
CSRF tests exist in the reviewed integration directory. The helper alone cannot
prevent a route from omitting the check, accepting mutation via GET, or reading
the canonical origin incorrectly.

Do not describe CSRF as implemented until every state-changing route invokes
this policy before its use case. Add route-level negative tests for cross-site,
hostile-Host, missing Origin/Referer, malformed origin, allowed canonical
origin, and login. Treat any mutation route implemented before that wiring as a
release blocker.

### pr2b-M5 — The race suite checks final database state in most cases, but several claimed races are not forced to overlap and login/deactivation covers only one order

**References:** [`tests/integration/submit-approve-race.test.ts:34-88`](../../../../tests/integration/submit-approve-race.test.ts),
[`tests/integration/submit-close-race.test.ts:25-71`](../../../../tests/integration/submit-close-race.test.ts),
[`tests/integration/approve-close-race.test.ts:31-71`](../../../../tests/integration/approve-close-race.test.ts),
[`tests/integration/approve-reject-race.test.ts:30-75`](../../../../tests/integration/approve-reject-race.test.ts),
[`tests/integration/close-reject-race.test.ts:34-67`](../../../../tests/integration/close-reject-race.test.ts),
[`tests/integration/login-vs-deactivation-race.test.ts:38-108`](../../../../tests/integration/login-vs-deactivation-race.test.ts).

This is not merely a return-code suite: the submit/approve, submit/close, and
other matching tests inspect final Slot, Proposal, and Event rows, which is
good. The two submit races use a deterministic `afterLock` barrier and are
meaningful PostgreSQL lock tests. By contrast, approve/approve,
approve/close, approve/reject, close/reject, and duplicate-submit only launch
two promises; they do not prove that the second transaction reached a blocked
lock rather than running after the first completed. Some can therefore pass by
ordinary serial scheduling or the partial unique indexes rather than exercising
the intended lock interleaving.

The login/deactivation test similarly proves only the order in which
deactivation obtains the Account lock first. It does not exercise login first
followed by deactivation and assert the final database has no usable session
after both operations complete.

Use barriers on both sides or an observable lock-wait signal for every declared
race. Assert final rows, returned errors, and the expected linearisation result
for both orders. This is particularly important because the TFM uses these tests
as evidence for its concurrency claim.

## MINOR

### pr2b-N1 — The partial-index catalog tests do not assert uniqueness explicitly

**References:** [`prisma/migrations/20260711000001_partial_unique_indexes/migration.sql:10-19`](../../../../prisma/migrations/20260711000001_partial_unique_indexes/migration.sql),
[`tests/integration/partial-index-catalog.test.ts:13-40`](../../../../tests/integration/partial-index-catalog.test.ts).

The migration itself is correct on static inspection, and the catalog test does
check the table, names, quoted columns, enum casts, and predicates. The test
only checks that `indexdef` contains selected fragments, however; it does not
assert `CREATE UNIQUE INDEX`, the complete key order, or that the predicate is
partial rather than merely present in an unexpected definition.

Assert `indexdef` starts with/contains `CREATE UNIQUE INDEX`, verify the exact
key list and predicate through `pg_indexes` plus catalog metadata, and retain a
behavioural duplicate-insert integration test as the final enforcement proof.

### pr2b-N2 — The rate-limit “email hash” is reversible for common email addresses if its database is leaked

**References:** [`src/infrastructure/auth/loginRateLimiter.ts:14-24`](../../../../src/infrastructure/auth/loginRateLimiter.ts),
[`prisma/schema.prisma:92-99`](../../../../prisma/schema.prisma).

`SHA-256(email)` avoids storing the raw string but is not a privacy boundary:
email addresses are low-entropy and can be recomputed from likely names and
domains. The optional `ipHash` is stored as supplied, so its privacy quality
also depends entirely on an unreviewed delivery-layer convention.

Prefer a server-keyed HMAC/pseudonymisation value, or use an internal account
identifier when it is available and a separately keyed client identifier. Define
key rotation and the retention period in the infrastructure design.

### pr2b-N3 — Session tests do not assert that the database stores only a token hash

**References:** [`src/infrastructure/auth/session.ts:44-66`](../../../../src/infrastructure/auth/session.ts),
[`tests/integration/session-lifecycle.test.ts:24-91`](../../../../tests/integration/session-lifecycle.test.ts).

Static inspection confirms that `create` writes `hashToken(token)` and returns
the bearer token only to the caller. The tests verify lifecycle operations but
never inspect the persisted `tokenHash` to prove that it differs from the
returned token and is the lookup value. Add that direct assertion, together
with a test that an arbitrary database row primary key cannot authenticate.

## OPEN QUESTIONS

1. Will the delivery layer always call `resolveValid` before `touch`, and can a
   session be used between those two calls? The port should be safe even if that
   convention is missed or the idle threshold passes between them.
2. Which exact post-concurrency contract is intended when login obtains the
   Profile/Account lock first and a deactivation follows: may login respond
   successfully if deactivation subsequently deletes its session, or must the
   response itself be denied? Tests and UI behaviour need one explicit answer.
3. How will integration CI provision a dedicated migrated PostgreSQL database
   and isolate workers? The current suite does not establish that isolation.
4. Which route handlers will enforce `assertCsrfSafe`, how is the canonical
   public URL validated at startup, and how will no-mutation-over-GET be
   enforced at the routing boundary?
5. What Argon2id cost parameters have been benchmarked for the actual Vercel
   runtime and expected authentication concurrency? They should be explicit,
   security-reviewed, and versioned rather than inherited from a library
   default.
