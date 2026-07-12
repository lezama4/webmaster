# PR 2b remediation verification — adversarial review

## Scope and execution status

Read-only comparison of `codex-pr2b-review.md` with the current infrastructure,
Prisma, integration-test, Vitest, and touched application code. The unit Vitest
project was executed: **23 test files and 269 tests passed**. PostgreSQL
integration tests were not run because the local database/virtualisation remains
unavailable.

The current GitHub Actions configuration is not ready to supply integration
evidence: it sets `DATABASE_URL` only, while the revised rate limiter requires
`RATE_LIMIT_HMAC_SECRET` or `SESSION_SECRET` before it can derive any scoped
key. This is a static CI configuration finding, not an executed-CI result.

## Verdict by original finding

| Finding | Verdict | Evidence and assessment |
| --- | --- | --- |
| **pr2b-B1** | **PARTIAL** | The old read-then-write protocol is correctly replaced at the port and use case with one `consumeAttempt` call (`src/application/ports/LoginRateLimiter.ts:11-31`; `src/application/use-cases/login.ts:93-119`). The adapter uses `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` (`src/infrastructure/auth/loginRateLimiter.ts:99-153`), performs all scoped keys in a transaction (`:102-130`), and converts database-operation failures to a denial (`:101-115`). Its integration test fires a concurrent burst, asserts the exact allowed count and final count (`tests/integration/login-rate-limiter.test.ts:98-128`). However, this test and every real login limiter invocation fail before the guarded `try` when no HMAC secret is configured; the CI workflow provides no such secret (`.github/workflows/ci.yml:38-40`). The remediation is therefore not executable in the stated CI environment. |
| **pr2b-M1** | **PARTIAL** | `touch` now updates only rows satisfying both absolute and idle predicates and deletes/returns `false` on a zero-row update (`src/infrastructure/auth/session.ts:91-120`). The port carries the boolean unauthenticated result (`src/application/ports/SessionPort.ts:14-31`). Tests cover idle/absolute expiry, equality boundaries, just-before-boundary behaviour, the resolve/touch interleaving, and stale-row deletion (`tests/integration/session-lifecycle.test.ts:81-163`). However, `resolveValid` still uses strict `>` rather than the `>=`/equality-expired policy tested by `touch` (`src/infrastructure/auth/session.ts:77-85`); see `pr2b-verify-M2`. The decisive PostgreSQL tests have not executed. |
| **pr2b-M2** | **RESOLVED** | Argon2id parameters are explicit: memory 19,456 KiB, time cost 2, parallelism 1, version 19, output 32 (`src/infrastructure/auth/passwordHasher.ts:29-50`). `needsRehash` parses the encoded hash and fails safe (`:76-94`); successful login re-hashes and persists a weaker verified hash (`src/application/use-cases/login.ts:120-127`). Unit tests passed and include encoded-parameter and rehash coverage (`tests/unit/infrastructure/passwordHasher.test.ts:13-57`). Runtime capacity benchmarking for Vercel remains an operational follow-up, not a defect in the requested remediation. |
| **pr2b-M3** | **PARTIAL** | Vitest now isolates unit and integration projects; the integration project disables file parallelism and registers a global setup (`vitest.config.ts:18-51`). The setup probes the database then applies migrations once before test files load (`tests/integration/support/globalSetup.ts:22-45`); individual tests no longer bootstrap migration ordering. This corrects the static configuration, but no CI/real-PostgreSQL execution proves that the selected Vitest 4 settings and global setup behave as intended. |
| **pr2b-M4** | **NO-RESUELTO** | The original review's CSRF finding remains applicable. `src/infrastructure/auth/csrf.ts:1-79` is still a pure predicate and explicitly defers route wiring. No `src/app/api/**/route.ts` handlers exist, so neither login nor any mutation can enforce the canonical-origin policy. Unit predicate tests do not substitute for route-level enforcement. |
| **pr2b-M5** | **PARTIAL** | The former unbarriered matching tests have been substantially strengthened: approve/approve, approve/close, approve/reject, close/reject, duplicate submit, and both login/deactivation orders now use `afterLock` deferred barriers and assert final rows (for example `tests/integration/approve-close-race.test.ts:43-133`, `tests/integration/login-vs-deactivation-race.test.ts:39-208`). Nevertheless, submit/approve and submit/close still test only their resolver-first direction (`tests/integration/submit-approve-race.test.ts:34-96`; `submit-close-race.test.ts:25-84`). More importantly, every test uses a fixed 200 ms delay as evidence that the second transaction reached PostgreSQL and blocked (`tests/integration/support/barrier.ts:13-16`), not an observable second-side lock-wait acknowledgement. Under slow CI, the first transaction can be released before the second actually reaches `SELECT ... FOR UPDATE`; overlap is likely but not deterministically proved. No PostgreSQL run exists yet. |
| **pr2b-N1** | **PARTIAL** | The catalog test now checks `CREATE UNIQUE INDEX`, exact column order, `WHERE` predicates, and `pg_index.indisunique`/`indpred` (`tests/integration/partial-index-catalog.test.ts:18-70`). It also adds behavioural duplicate ACCEPTED and SUBMITTED insert tests (`:72-125`). This closes the test-design gap statically, pending its first real database execution. |
| **pr2b-N2** | **PARTIAL** | The email-scoped limiter key now uses HMAC-SHA-256 with an application secret and documents rotation (`src/infrastructure/auth/loginRateLimiter.ts:16-54`), so it no longer stores bare SHA-256(email). The client key is still appended exactly as supplied (`:56-60`), and no delivery boundary exists to prove that it is a trusted keyed pseudonym rather than a reversible/low-entropy input. The original review explicitly identified this boundary. The missing CI secret additionally prevents the intended protection/test suite from operating. |
| **pr2b-N3** | **PARTIAL** | The session test directly reads the row, proves `tokenHash` differs from the bearer token, and proves neither row id nor stored hash authenticates (`tests/integration/session-lifecycle.test.ts:165-185`). The adapter hashes lookup values and persists only the hash (`src/infrastructure/auth/session.ts:13-66`). This is a complete static/test remediation, pending real PostgreSQL execution. |

## New findings

### pr2b-verify-B1 — CI does not configure the secret required by the rate limiter

**References:** `src/infrastructure/auth/loginRateLimiter.ts:43-53, 88-111`,
`.github/workflows/ci.yml:38-40`,
`tests/integration/login-rate-limiter.test.ts:110-145`.

`scopedKeys()` invokes `hashKeyPart()` before `consumeAttempt` enters its
fail-closed `try` block. When neither `RATE_LIMIT_HMAC_SECRET` nor
`SESSION_SECRET` is present, it throws. CI declares only `DATABASE_URL`, and
the integration tests do not set either secret. Consequently the limiter tests
and login/deactivation race cannot run successfully in CI as configured; the
claimed PostgreSQL verification gate is blocked before it reaches its SQL.

Set a non-production workflow secret/value in the CI job, add an explicit test
or startup validation for the missing-secret behaviour, and move scoped-key
derivation inside the defined fail-closed boundary if an authentication denial
rather than an uncaught error is intended.

### pr2b-verify-M1 — Barrier tests rely on elapsed time, not proof of second-side lock wait

**References:** `tests/integration/support/barrier.ts:13-16`,
`tests/integration/matching-race.test.ts:64-75`,
`tests/integration/login-vs-deactivation-race.test.ts:84-91, 171-179`.

The first transaction is deterministically held after it obtains its lock, but
the test merely sleeps 200 ms after starting the second transaction. It has no
signal that the second query reached PostgreSQL and is waiting on the lock. A
slow CI worker can therefore execute the tested operations serially while still
passing the final-state assertions. Expose an explicit test-only hook at the
second lock attempt, inspect PostgreSQL lock-wait state, or use separate
connection instrumentation before releasing the first transaction.

### pr2b-verify-M2 — `resolveValid` and `touch` disagree at expiry equality

**References:** `src/infrastructure/auth/session.ts:77-85, 102-120`,
`tests/integration/session-lifecycle.test.ts:108-130`.

`touch` correctly treats equality at the idle and absolute thresholds as
expired by using strict database `gt` predicates, and its tests assert that
behaviour. `resolveValid`, however, declares expiry only when `now > deadline`.
At exactly either deadline it returns a valid session, while a subsequent touch
returns `false` and deletes it. Define one boundary contract—normally equality
means expired—and use `>=` in `resolveValid`; add direct equality assertions for
`resolveValid` as well as `touch`.

## Conclusion

PR 2b materially improves the implementation: the Argon2id remediation is
resolved, and the rate-limit/session/index/isolation/race work is substantially
better designed. It is not fully closed. CSRF remains unimplemented at the
delivery boundary; the integration suite cannot pass in the declared CI
environment without an HMAC secret; and several race tests still lack a
deterministic acknowledgement that the second operation is blocked. No
concurrency or PostgreSQL guarantee should be claimed until those issues are
fixed and the CI integration suite executes successfully for the reviewed
commit.
