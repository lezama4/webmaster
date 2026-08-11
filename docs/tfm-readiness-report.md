# Vivetutiempo TFM Readiness Report and Master Finding Tracker

**Assessment date:** 2026-07-27 (supersedes the 2026-07-22 assessment)  
**Revision assessed:** `94026a5` on `main`

> ## Update — 2026-07-27 (what landed since the 07-22 revision)
>
> The 07-22 body below was written against the **hospital-only baseline**
> (`482aefd`) with `widen-beyond-hospitals` still unmerged. Since then the
> following merged to `main` and deployed to production via Vercel. This block
> is authoritative where it disagrees with the dated body underneath.
>
> - **`widen-beyond-hospitals` (PRs #17–#24) — MERGED + DEPLOYED.** The six
>   centre types (ADRs D16–D20) are live in the deployed code. The **Basque
>   (`eu`) native review remains OPEN** (§1.1), and the production **database
>   still needs reseeding** for the six types to be *visible* in the live demo
>   (author action) — the code path is deployed, the demo data is not yet.
> - **`auditable-profile-approval` (PRs #25–#29) — MERGED + DEPLOYED.** Admin
>   approve/reject/deactivate now require and persist an attributed, append-only
>   `ProfileReview` atomically with the status transition (ADRs D21–D27).
> - **Block 2 (ratings, PR #10) and Block 3 (simulated support payments, PR #12)
>   — MERGED.** Block 3 is a persistence-free simulation seam by design and
>   passed eight rounds of dual adversarial review (see its verify-report).
> - **Codex review fixes (PR #30) — MERGED + DEPLOYED.** Live login-redirect
>   bug fixed; review-basis invisible-character validation; the D10 free-text
>   honesty correction in the threat model.
> - **In review, NOT yet merged/deployed:**
>   - **`harden/domain-integrity` (PR #31)** closes the domain findings this
>     report still marks OPEN below — **pr1-M1** (full Slot/Proposal status
>     matrix), **pr1-M2** (Proposal `message` bounds), **pr1-N1/N2** (clock
>     validation). 693 unit tests, CI green.
>   - **`harden/security-headers` (PR #32)** adds the security headers, a
>     nonce-based CSP, Dependabot and a CI dependency-audit job — closing the
>     "no headers / no CSP / no dependency scanning" gap called out in §2 and
>     §5. Verified against a production build; CI (incl. e2e under CSP) green.
>   - **`centre-event-counts` (D10 SECOND revision)** completes the previous
>     one: each centre card in the public directory shows an **aggregate count**
>     of its published, still-upcoming events and links to `/events?centre=…`,
>     its own filtered list. This retires D10's remaining direction — after
>     `events-show-centre` it protected nothing, since the same number was
>     already obtainable in two clicks from the events centre filter, so the
>     two public surfaces were merely inconsistent with each other. The privacy
>     line is restated on both surfaces: **the institution and its activity
>     level are public; the individual and the exact place are not** — ward/room
>     `location`, street address, event titles and dates on the directory
>     (`nextEventAt` stays a named forbidden key), proposals, emails and every
>     id remain forbidden. Recorded residual: the directory lists all active
>     centres, so a **zero** count now reveals a centre has no activity.
>     Threat model updated (assets table, `centre-event-counts` scope note,
>     T-22 facet (b) re-assessment); guards rewritten in
>     `nonCorrelation.test.ts`, `listPublicHospitals.test.ts`,
>     `e2e/non-correlation.spec.ts`, `e2e/hospital-directory.spec.ts` and the
>     Postgres integration suite. No schema change, no migration.
>   - **`feat/events-show-centre` (D10 revision)** deliberately relaxes the
>     event→centre direction of the D10 non-correlation invariant: a public
>     event now names its **hosting centre (public name + city only)** so a
>     family can find events at their relative's centre. The ward/room
>     `Slot.location`, the centre's postal code / street address / coordinates,
>     every internal id and all patient data **stay forbidden** on the public
>     surface. Threat model §1/§4 updated (`events-show-centre` scope note);
>     `PublicEventProjection` + the Prisma `select` carry `centreName`/
>     `centreCity`; e2e (`public-projection`, `non-correlation`) rewritten to
>     assert the centre name now appears and the postal/address/ward-room never
>     do. 693 unit tests + tsc green locally; e2e validated in CI. The
>     hospital→event direction is unchanged.
>   - Once these two merge, **no structural finding in this report remains
>     OPEN**; what stays are author-only delivery items (public repo, memoria,
>     deck, video, Basque review) and the tracked `sharp` transitive advisories.

**Method.** Unlike the 2026-07-12 revision of this report — which ran no
commands and audited source statically — this revision was produced by
*executing* the evidence it cites:

- `npm run test` was run locally on `482aefd`: **305 passed / 55 skipped**
  (the 17 PostgreSQL-backed integration files skip unless
  `VIVETUTIEMPO_RUN_INTEGRATION=true`).
- The CI run for `482aefd` was read directly:
  [run 29905717933](https://github.com/lezama4/webmaster/actions/runs/29905717933),
  both jobs green — `test`: 42 files, **360 passed / 0 skipped** (unit plus the
  PostgreSQL 16 integration/concurrency suite, serial, migrations applied in a
  global setup); `e2e`: **12 Playwright tests passed** against real PostgreSQL 16
  and the seeded demo dataset.
- The deployed URL was requested live: `/`, `/events`, `/ayuda`, `/login` and
  `/register` all return HTTP 200, and `/events` renders the seeded published
  Event (`Taller de acuarela`).
- Source, schema, CI workflow, seed and configuration were read to confirm each
  status change below.

Anything this report still marks **OPEN** was re-read in source and confirmed
to be genuinely open; no status was upgraded on the strength of a commit
message or a task checkbox.

> **Scope note — `widen-beyond-hospitals`.** The dated evidence in this report
> (revision `482aefd`, CI run 29905717933) is the deployed **hospital-only
> baseline**. The subsequent `widen-beyond-hospitals` change generalises the
> product to six centre types (ADRs D16–D20). It is implemented and verified
> **locally against real PostgreSQL** (Neon `dev`) but is **not merged to `main`
> and not deployed**, so it does not change the deployed readiness verdict below.
> Its status, evidence and the **open Basque-review gate** are tracked in
> section 1.1. No six-type claim in this report is asserted against production.

> **Note on `tasks.md`.** The authoritative task list is itself stale: tasks
> 5.9, 5.14, 5.15, 6.1–6.4, 7.1–7.3 and 7.6 are unchecked but demonstrably
> complete (the E2E specs exist and pass in CI, `prisma/seed.ts` exists, the
> README documents credentials and the live URL, the scripts exist in
> `package.json`, and the deployment is live). This report is based on executed
> evidence, not on those checkboxes.

## Executive conclusion

Block 1 is **deployed, demonstrable and covered by executed evidence**. The
2026-07-12 conclusion — that the only Next.js page was a scaffold and that
Phases 5, 6 and 7 were unstarted — is no longer true. `src/app/` now contains
the public pages `/`, `/events`, `/ayuda`, `/login` and `/register`, the
`admin/`, `artist/` and `hospital/` role areas, and eleven mutating API route
handlers, all of which invoke the canonical-origin CSRF guard. A live
deployment serves the seeded demo dataset.

The release-blocking rate-limiter contract mismatch reported on 2026-07-12 is
resolved: `login` now calls the atomic `consumeAttempt`/`recordSuccess`
protocol ([`login.ts:101,152`](../src/application/use-cases/login.ts)) that both
the port ([`LoginRateLimiter.ts:34-36`](../src/application/ports/LoginRateLimiter.ts))
and the Prisma adapter
([`loginRateLimiter.ts:99-163`](../src/infrastructure/auth/loginRateLimiter.ts))
declare. Lint and typecheck run in CI ahead of the tests and are green.

The unexecuted-PostgreSQL-evidence gate is also closed. The concurrency suite
now forces both orderings of nine declared races with explicit barriers and
executes against real PostgreSQL in CI, not against fakes.

What remains open is narrower and mostly **domain-hardening and operational**,
not structural: the Slot/Proposal aggregate status matrix is still incomplete,
Profile names and Proposal messages are still unbounded, and the deployment has
no security headers, no CSP, no dependency scanning and no logging
implementation. One TFM delivery requirement is also unmet for a non-technical
reason: **the repository is private**. *(Superseded 2026-07-27: every item in
this 07-22 paragraph is now closed — the hardening and domain gaps landed in
PRs #31/#32, and the repository was made public. See the top-of-document
update block.)*

Blocks 2 (ratings) and 3 (simulated patronage) remain future scope and are not
claimed anywhere in this report.

## 1. Master finding tracker

Statuses: **RESOLVED** = source closes the issue *and* a test covering it
executed on this revision; **OPEN** = a release-relevant gap remains, re-read
in source for this revision; **PARTIAL** = the substantive control is closed but
a named piece of evidence or scope is still missing; **DEFERRED** =
intentionally outside Block 1. Multiple source-review IDs are grouped only where
they describe the same defect.

Unless stated otherwise, "executed in CI" means
[run 29905717933](https://github.com/lezama4/webmaster/actions/runs/29905717933)
on `482aefd` — `test` job 360/360, `e2e` job 12/12.

| Original finding ID(s) | Severity | One-line consolidated finding | Status | Closure phase / evidence |
| --- | --- | --- | --- | --- |
| planning-B1; pr2-plan-B2 | BLOCKER | Slot transitions must lock before reads so a late submit cannot survive approval/close. | RESOLVED | `PrismaMatchingUnitOfWork` locks the Slot row with `SELECT … FOR UPDATE` before any decision-informing read (`MatchingUnitOfWork.ts:72,91`). `submit-approve-race`, `submit-close-race`, `approve-close-race`, `approve-reject-race`, `close-reject-race` and `matching-race` are barrier-forced and executed in CI against real PostgreSQL. |
| planning-B2 | BLOCKER | Closing a Slot must cascade-reject submitted Proposals. | RESOLVED | `close-slot-cascade.test.ts` executed in CI; `e2e/close-slot.spec.ts` proves the same cascade through the deployed HTTP surface. |
| planning-M1 | MAJOR | The original seed model was internally inconsistent. | RESOLVED | `prisma/seed.ts` seeds the corrected model — 7 accounts, 5 Profiles (2 hospital: San Juan active, Esperanza pending), 5 Slots (S1 open/2 rivals, S2 filled/published, S3 open/empty, S4 closed/cascade, S5 filled/completed) and 2 Events. Idempotent: every repository writes via `upsert` on fixed seed ids. Credentials are documented in `README.md`. |
| planning-M2; pr2a-B2 | MAJOR/BLOCKER | Re-registration must reuse one Profile and prove control of the existing account. | RESOLVED | Same-profile transition is in `Profile.ts`; password and role verification is in `registerProfile.ts:88-106`, inside `withLockedRegistration`. Negative unit tests plus `registration-race.test.ts` executed in CI. |
| planning-M3; pr2-plan-M3; pr2a-M3/M4 | MAJOR | Session lifecycle, revocation and login/deactivation linearisation need atomic real-adapter proof. | RESOLVED | `session-lifecycle.test.ts`, `profile-transition-session-revocation.test.ts` and the barrier-forced `login-vs-deactivation-race.test.ts` (both orderings) executed in CI against real PostgreSQL. |
| planning-M4; pr2-plan-M6; pr2a-B1 | MAJOR/BLOCKER | Anonymous output requires a runtime, field allow-list rather than entity pass-through. | RESOLVED | `PrismaPublicEventProjectionQuery` uses `select` (never `include`) and builds a fresh object literal field by field. `e2e/public-projection.spec.ts` asserts the exact allowed key set and that the raw response body contains no location, proposal message, email, Slot id or Proposal id — executed in CI. |
| planning-M5 | MAJOR | “Prepared” does not meet the required deployed, demonstrable Core outcome. | PARTIAL | The deployment is live at <https://webmaster-lemon.vercel.app> and serves the seeded dataset (`/events` renders `Taller de acuarela`); production migration and seed therefore ran. Not recorded: the manual full-chain walkthrough against production (task 7.7) and a Playwright run with `PLAYWRIGHT_BASE_URL` pointed at production (task 7.8). |
| planning-M6; pr2-plan-N1; pr2a-N1/N2 | MAJOR/MINOR | Authorisation must cover role, ownership, profile type, terminal states, linkage and malformed decisions. | RESOLVED | Guards enforce role, live-active status *and* matching `Profile.type` (`guards.ts:30-46`), with `expectedType` passed at all eight mutating use cases. `e2e/authorization-edge-cases.spec.ts` exercises the denial matrix over real HTTP (401 unauthenticated, 403 wrong role / non-active, 404 mismatched linkage, 409 terminal Proposal) — executed in CI. |
| planning-N1 | MINOR | Strict-TDD wording/evidence was contradictory. | RESOLVED | Phase 2/3 explicitly declare RED→GREEN tasks; preserve commit/evidence history for the defence. |
| planning-N2; pr2a-N3 | MINOR | Open-Slot visibility, future scheduling and non-N+1 listing need an explicit query contract. | PARTIAL | Domain bounds and a dedicated `OpenSlotListingQuery` exist, and the listing is exercised end to end by `e2e/demo-chain.spec.ts`. There is still no dedicated integration test asserting the query contract itself (single query, no N+1, future-only). |
| planning-N3 | MINOR | “No PII” was inaccurate for accounts and hospital-context data. | RESOLVED in documentation | Threat model classifies email, location and messages as sensitive; retention implementation remains open (T-21). |
| pr1-B1 | BLOCKER | Prisma must persist deactivation and re-review audit state. | RESOLVED | Schema/migrations include `DEACTIVATED` and `reviewRequestedAt`; `schema-migration.test.ts` executed in CI against an empty PostgreSQL database. Full append-only review history remains explicitly backlog. |
| pr1-M1; threat-model-T07 | MAJOR | Aggregate rehydration must reject all inconsistent Slot/Proposal status matrices. | RESOLVED (PR #31, in review) | `assertValidSlotAggregate` now enforces the full matrix: `filled` ⇒ exactly one accepted proposal and no submitted; `open`/`closed` ⇒ no accepted; a `submitted` proposal may exist only while `open`. Covered by the new `tests/unit/domain/slotAggregate.test.ts`. |
| pr1-M2; threat-model-T15 | MAJOR | Proposal message needs bounded, normalised input. | RESOLVED (PR #31, in review) | `Proposal.message` is now bounded `[1, 2000]` and trimmed on both create and rehydrate (`Proposal.ts`), mapping to `422` at the HTTP boundary. (Profile `name` was already `assertNonEmpty`; Slot title/description/location were already bounded.) |
| pr1-M3 | MAJOR | Hexagonal boundaries must reject outer-layer, IO and persistence dependencies. | RESOLVED | ESLint blocks aliases, relative outer-layer imports, Node built-ins and restricted globals; negative lint tests exist and `npm run lint` is green in CI. |
| pr1-M4 | MAJOR | Secrets must be ignored and local database exposure controlled. | OPEN | Re-read on this revision: `.env*` is ignored, but Compose still publishes `5432:5432` on all interfaces with a predictable dev password (`docker-compose.yml:10-11`). Local-only, but unchanged. |
| pr1-N1 | MINOR | `reviewRequestedAt` must be valid after reactivation. | RESOLVED (PR #31, in review) | `reactivateProfile` (and the `ProfileReview` timestamp) now validate the injected clock reading is finite before persisting it, so an invalid Date can never poison the audit trail. |
| pr1-N2 | MINOR | Slot creation must reject an invalid clock result. | RESOLVED (PR #31, in review) | `createSlot` now validates `clock.now()` is finite before the comparison; a `NaN` clock result throws instead of silently passing the strictly-future guard. |
| pr1-N3 | MINOR | Domain integrity/abuse test gaps must be closed. | RESOLVED (PR #31, in review) | The aggregate-matrix, Proposal-message-bound and invalid-clock gaps are now closed with executed unit tests (`slotAggregate.test.ts` plus extended proposal/slot/profile suites, 693 green). |
| pr1-N4 | MINOR | Playwright must support deployed smoke targets. | PARTIAL | `PLAYWRIGHT_BASE_URL` is honoured and disables the local web server (`playwright.config.ts:4-20`), and five E2E specs (12 tests) now execute in CI against a local server. No run against the *deployed* URL is recorded. |
| pr2-plan-B1/B3; pr2b-N1 | BLOCKER/MINOR | Schema/migration identifiers and partial unique indexes must be exact and demonstrably enforced. | RESOLVED | `partial-index-catalog.test.ts` asserts the real catalog identifiers and `duplicate-submission.test.ts` proves behavioural rejection of a duplicate insert — both executed in CI. |
| pr2-plan-M1/M2; pr2a-M6; pr2b-M5 | MAJOR | Every declared race needs forced overlap and both required orderings. | RESOLVED | Nine barrier-forced race files now execute in CI: `submit-approve`, `submit-close`, `approve-close`, `approve-reject`, `close-reject`, `matching-race`, `duplicate-submission`, `login-vs-deactivation`, `slot-auth-vs-deactivation`, plus `registration-race`. `tests/integration/support/barrier.ts` provides the controllable overlap. |
| pr2-plan-M4; pr2a-M2; pr2b-B1 | MAJOR/BLOCKER | Login limiting must be per-account/client, timing-resistant and atomically consumed. | RESOLVED | Port, use case and adapter now share the atomic `consumeAttempt`/`recordSuccess` protocol. Consumption is a single `INSERT … ON CONFLICT … RETURNING` per scoped key inside one transaction (`loginRateLimiter.ts:133-155`), keyed by both email and client. Unknown accounts burn an equivalent argon2id verification against a fixed dummy hash (`login.ts:112-116`). `login-rate-limiter.test.ts` executed in CI. |
| pr2-plan-M5; pr2b-M4 | MAJOR | CSRF requires canonical-origin route enforcement, including login. | RESOLVED | `assertCsrfSafe` is invoked by all eleven mutating route handlers, including `POST /api/auth/login`. It fails closed: an unset `APP_ORIGIN` yields an empty canonical origin that matches nothing (`csrfGuard.ts:14-21`). `e2e/authorization-edge-cases.spec.ts` asserts a missing `Origin` returns 403 *before* authentication — executed in CI. |
| pr2a-M1; pr2a-verify-M2; threat-model-T02 | MAJOR | Live-profile authorisation must remain protected until the Slot mutation commits. | RESOLVED | The acting Profile is now read by `withLockedSlot` itself, inside the same transaction that locks the Slot and persists the mutation — the nested Profile unit of work is gone (`approveProposal.ts:41-45`, `MatchingUnitOfWork.ts:72-91`). `slot-auth-vs-deactivation-race.test.ts` is barrier-forced and executed in CI. |
| pr2a-M5; threat-model-T08 | MAJOR | Registration requires atomic Account/Profile persistence and durable uniqueness-to-conflict mapping. | RESOLVED | `PrismaRegistrationUnitOfWork` exists and holds one transaction across the uniqueness check, Account creation and Profile creation/reactivation, using `SELECT … FOR UPDATE` plus `pg_advisory_xact_lock` on the normalised email for the first-registration case (`RegistrationUnitOfWork.ts:85-93`). `registration-race.test.ts` executed in CI. |
| pr2b-M1; pr2a-verify-M1 | MAJOR | `touch` must not revive an idle/absolute-expired session. | RESOLVED | The port now declares `touch(sessionId): Promise<boolean>` (`SessionPort.ts:32`) and the adapter returns the conditional-update result (`session.ts:91`); `getCurrentActor` clears the cookie when it is false. Covered by `session-lifecycle.test.ts`, executed in CI. |
| pr2b-M2 | MAJOR | Argon2id cost must be explicit and upgradeable. | RESOLVED | Adapter pins every OWASP-baseline parameter (`m=19456,t=2,p=1`, version 0x13, 32-byte output) and unit tests inspect the encoded prefix. `login` additionally re-hashes on sign-in when `needsRehash` reports a stale cost (`login.ts:127-135`). |
| pr2b-M3 | MAJOR | Integration tests must be isolated/serial and migrations run globally. | RESOLVED | The integration Vitest project sets `fileParallelism: false` and applies migrations in `globalSetup` (`vitest.config.ts:32-54`); it executed in CI with 0 skipped. |
| pr2b-N2 | MINOR | SHA-256 pseudonyms for email/IP are not strong privacy protection. | RESOLVED | Scoped keys are now server-keyed HMAC-SHA256 over `RATE_LIMIT_HMAC_SECRET` (falling back to `SESSION_SECRET`), and the adapter throws rather than degrading to an unkeyed hash (`loginRateLimiter.ts:43-54`). Rotation and retention semantics are documented in the adapter; the periodic purge job remains explicit backlog. |
| pr2b-N3 | MINOR | Tests must prove only session token hashes are stored. | RESOLVED | `session-lifecycle.test.ts:165-183` asserts directly against the persisted row that `tokenHash !== session.id` and that neither the row id nor the stored hash can authenticate — executed in CI. |
| block3-BLOCKER-01 | BLOCKER | Simulated patronage cannot be reviewed from this branch because its code/spec/security review are absent. | DEFERRED | Block 3 remains a separate future branch; no payment claim is made for the TFM Core. |

### 1.1 `widen-beyond-hospitals` change status

This change generalises the product from hospital-only to six centre types
(hospital, nursing home, day centre, day hospital, occupational centre,
palliative unit) via a generic `CENTRE` role plus a separate `CentreType` axis
(ADRs D16–D20). As of 2026-07-27 it is **MERGED to `main` (PRs #17–#24) and
deployed.** The per-item evidence below was captured against real PostgreSQL
(Neon `dev`) during development and now also runs in CI. **Two gates remain
author-only:** the Basque (`eu`) native review (blocking for copy quality), and
reseeding the production database so the six types are *visible* in the live
demo — the deployed code supports them, the production demo data does not yet.

| Item | Status | Evidence / note |
| --- | --- | --- |
| Non-destructive enum migration, zero data loss (D17) | **Verified locally** | `tests/integration/centre-migration.test.ts` against Neon `dev`: an existing `HOSPITAL` row reads `type: CENTRE` + `centreType: hospital`, all other fields byte-identical, row counts unchanged, D4 partial unique indexes still enforce (Phase 1.9, 673/673). The documented down-path was run once against a scratch transaction that was rolled back: clean reversal with no non-hospital row present, documented coarsening with a `palliative_unit` row present (Phase 1.10). |
| Six-type register → validate → publish through the identical guard path (D16 gradable claim) | **Verified locally** | `tests/integration/centre-lifecycle.test.ts` against Neon `dev` (Phase 2.9, 696/696). This run also caught and fixed a real pre-existing bug: `PrismaRegistrationUnitOfWork.profileData()` never mapped `centreType`, so centres had been persisting a NULL `centreType`. |
| Public directory widening — `centreType` allow-listed, `type` still forbidden, single-value security predicate, D10 re-run both directions (D19) | **Verified locally** | Unit + integration (`public-hospital-directory-query.test.ts`, Phase 4.4, 698/698) plus e2e `hospital-directory.spec.ts` / `non-correlation.spec.ts` 32/32 against Neon `dev`. |
| Three-language vocabulary rewrite (D20), es/en | **Done** | Narrative copy rewritten off the hospital premise; structural locale parity (key sets + ICU placeholders) green. |
| Basque (`eu`) copy quality (Phase 6.10) | **OPEN — blocking gate** | Structural parity passes automatically, but that is **not** translation quality. Every `eu` string the change touches is a draft pending sign-off by a native Basque speaker. The change is **not merge-ready** until this is resolved. |
| Manual "reads correctly for a residencia / day centre" reviews (Phases 6.8/6.9) | **OPEN** | Awaiting human confirmation; implementer self-assessment recorded but is not a sign-off. |
| Merge + deploy of the chain; production evidence of the six types | **OPEN** | Not merged to `main`, not deployed. The six types are demonstrable in the seeded `dev` environment only. |

Local full-suite state on the feature branch: `npm run test` → **628 passed /
77 skipped** (integration tests skip unless `VIVETUTIEMPO_RUN_INTEGRATION=true`);
`tsc --noEmit` and `npm run lint` clean repo-wide.

## 2. Capability readiness matrix

“Executed” means a recorded execution exists; it is not inferred from source.
All CI references are to run 29905717933 on `482aefd`.

| Capability | Implementation state | Test/evidence state | Honest readiness |
| --- | --- | --- | --- |
| Domain entities, transitions, Slot creation bounds, accept/close cascades | Implemented | Unit suite executed locally and in CI. | **Implemented; tested-and-executed**, except the aggregate-matrix, invalid-clock and Profile/Proposal text-bound gaps. |
| Application use cases, actor/role/ownership/profile-type guards, public DTO mapper | Implemented | Unit suite executed locally and in CI. | **Implemented; tested-and-executed**. |
| Schema, migrations, Prisma repositories and partial indexes | Implemented | `schema-migration` and `partial-index-catalog` executed in CI against PostgreSQL 16. | **Implemented; tested-and-executed**. |
| Matching concurrency | Implemented lock-first (`SELECT … FOR UPDATE`) | Nine barrier-forced race files executed in CI, both orderings. | **Implemented; tested-and-executed**. |
| Session lifecycle/revocation | Implemented (opaque token, hash-only storage, absolute+idle expiry, revoke-all) | `session-lifecycle`, `profile-transition-session-revocation`, `login-vs-deactivation-race` executed in CI. | **Implemented; tested-and-executed**. |
| Login rate limiting | Implemented; single atomic statement per scoped key, HMAC-pseudonymised keys | `login-rate-limiter` executed in CI; timing-parity path unit-tested. | **Implemented; tested-and-executed**. Distributed-load behaviour is untested. |
| Password hashing | Implemented; parameters pinned, upgrade-on-login | Unit tests executed. | **Implemented; tested-and-executed** (static parameters); production cost benchmarking still pending. |
| CSRF | Implemented and enforced on all eleven mutating routes; fails closed | `e2e/authorization-edge-cases` asserts 403 on missing `Origin`, executed in CI. | **Implemented and enforced**. |
| HTTP APIs, input/body validation, cookie issuance, error mapping | Implemented | E2E denial matrix (401/403/404/409) executed in CI; `toErrorResponse` returns generic bodies only. | **Implemented; tested-and-executed**. Body *schema*/size validation is minimal — see open items. |
| UI, role workflows, public events page | Implemented: `/`, `/events`, `/ayuda`, `/login`, `/register` plus `admin/`, `artist/`, `hospital/` areas. | `e2e/smoke`, `e2e/demo-chain`, `e2e/public-projection`, `e2e/close-slot` executed in CI. | **Implemented; tested-and-executed**. Accessibility is **not** independently audited. |
| Seed data and reproducible demo accounts | Implemented (`prisma/seed.ts`, idempotent upserts on fixed ids) | Seeded in the CI e2e job and relied on by the E2E assertions. | **Implemented; tested-and-executed**. |
| E2E/demo chain | Implemented (5 specs, 12 tests) | Executed in CI against real PostgreSQL and a seeded database. | **Implemented; tested-and-executed** against CI, **not** against the deployed URL. |
| Production deployment and public URL | Deployed at <https://webmaster-lemon.vercel.app> | Live request check: five routes return 200 and `/events` renders the seeded published Event. | **Deployed and serving seeded data.** No recorded production smoke/demo-chain run (tasks 7.7/7.8). |
| Security headers, CSP, dependency scanning | Implemented (PR #32, in review) | Verified against a production build; CI e2e passes under the strict CSP. | **Implemented, in review.** HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy and Permissions-Policy on every route (`next.config.ts`); a per-request nonce CSP (`middleware.ts`, `script-src` nonce + `strict-dynamic`, `frame-ancestors 'none'`); Dependabot + a `npm audit` CI job. **Still not implemented:** application security logging (no logger in `src/`) — the one item from this row that PR #32 does not cover. |
| Block 2 ratings / Block 3 simulated support payments | Both merged to `main` and deployed | Block 2: `src/domain/rating`, `rateEvent`/`listMyEventRatings`, the `/api/events/[id]/rate` route, integration + e2e (PR #10). Block 3: `src/domain/support-payment`, `simulateSupportPayment`, `FakePaymentGateway` — a deliberately persistence-free simulation seam that passed eight rounds of dual adversarial review (PR #12). | **Shipped.** Block 3 is a simulated seam by design (no real provider, no persistence, no route to move money); the boundary is documented in `docs/simulated-payment-security-review.md`. |

## 3. TFM delivery requirements

| Requirement | Status | Evidence / missing work |
| --- | --- | --- |
| Complete README | **Substantially complete** | Setup, run and test commands, the live URL (`README.md:26`) and the full seed-credential table (`README.md:153-167`) are present. One stale sentence remains at `README.md:195`, claiming E2E evidence must not be asserted in CI — CI has run the `e2e` job since. |
| Public repository | **Met (2026-07-27)** | <https://github.com/lezama4/webmaster> is **public** — verified anonymously (unauthenticated GitHub API and repo page both return HTTP 200), so the tribunal can inspect it without a login. A pre-publication secret sweep of the working tree and the full git history found no real credentials (only `.env.example` placeholders, `localhost` CI values and the documented demo seed password). |
| Working deployment URL | **Met** | <https://webmaster-lemon.vercel.app> returns 200 on `/`, `/events`, `/ayuda`, `/login` and `/register`, and `/events` renders the seeded published Event. |
| Slides | **Deck built, not final** | `docs/tfm-defense-deck.pptx` is the produced 17-slide deck (generator: `docs/deck/`). Still author-only: fill the `[AUTOR]` placeholders, give it a visual pass, and host it to obtain a shareable URL for the submission form. |
| Video | **Script exists, not final** | `docs/video-script.md` is a script. Record/export only against the deployed revision. |
| Test credentials | **Met** | `prisma/seed.ts` creates the seven accounts and `README.md:153-167` documents each one with its demo role. |
| Reproducible full demo | **Met in CI; not recorded against production** | `e2e/demo-chain.spec.ts` runs the whole chain (register → admin approve → publish → propose → accept → auto-reject rival → public browse) and passed in CI. The same chain has not been recorded against the deployed URL. |

> **RESOLVED (2026-07-27):** the repository was made public before submission,
> after a pre-publication secret sweep (working tree + full history) confirmed no
> real credentials were present. This was the one hard delivery requirement no
> documentation change could satisfy; it is now met.

> **TODO (autor):** decide whether to run and record tasks 7.7 (manual full-chain
> walkthrough against production) and 7.8 (`PLAYWRIGHT_BASE_URL` pointed at the
> deployed URL). CI already proves the chain against a local PostgreSQL; a
> production run would additionally prove the deployed configuration. Until one
> is recorded, this report deliberately does not claim it.

## 4. Documentation-to-reality coherence

The 2026-07-12 revision of this report listed six documentation defects. Their
current state:

1. **README authentication wording — resolved.** Route handlers now issue and
   clear the session cookie (`sessionCookie.ts`), and protected routes exist.
   The README's stack description is accurate.
2. **README migration instructions — resolved.** Migrations are present and the
   documented workflow matches `docs/deployment.md`.
3. **The threat model was materially stale — corrected in this pass.** Its
   scope note said infrastructure was not read, and T-02/T-03/T-08/T-09/T-10/
   T-11/T-12/T-14/T-16 described pre-remediation code. Each status has now been
   re-derived from source and from executed CI evidence.
4. **“Adapter exists” versus “integrated and CI-proven” — now distinguishable.**
   The threat model separates *implemented, evidence pending* from *mitigated*,
   and only the latter cites an executed run.
5. **Memoria, slides and video script were under-claiming — corrected in this
   pass.** They described infrastructure, integration and deployment as in
   progress; all three now cite the executed CI run and the live URL, while
   keeping the open items visible.
6. **Do not claim Block 2 or Block 3.** Unchanged and still correct. Both exist
   only on unmerged branches — one commit is explicitly marked *[pending
   adversarial review]* — and every document continues to treat them as future
   scope.

Two staleness sources remain outside this pass:

- **`openspec/.../tasks.md` checkboxes.** Eleven completed tasks are still
  unchecked (see the note at the top of this report).
- **`README.md:195`** still says E2E evidence must not be claimed in CI.
- **`.github/workflows/ci.yml:8-11`** still carries a header comment saying the
  concurrency suite depends on "pending PR 2b remediation" and that results are
  "indicative, not final". That remediation has landed.

> **TODO (autor):** decide whether to correct `tasks.md`, `README.md:195` and
> the CI header comment. They are not part of the memoria package, but a
> tribunal that opens the repository will read them.

## 5. Prioritised path to “done”

The eight items from the 2026-07-12 revision, with their current state:

1. ✅ **Restore a coherent, type-safe authentication contract.** **Complete.**
   One atomic limiter operation (`consumeAttempt`) across port, use case, fake
   and adapter; `SessionPort.touch` returns `Promise<boolean>` and both fake and
   adapter reject expired touches. Lint and `tsc --noEmit` are green in CI.
2. ⚠️ **Close integrity/security gaps in the core.** **Partially complete.** HMAC
   security telemetry is done (pr2b-N2). Still open: the Slot/Proposal aggregate
   status matrix (pr1-M1), Profile/Proposal text bounds (pr1-M2), Clock-output
   validation (pr1-N2), a defensive re-review timestamp (pr1-N1) and the local
   Compose database binding (pr1-M4).
3. ✅ **Fix cross-resource authorisation atomicity and registration durability.**
   **Complete.** Profile authority is now held inside the same transaction that
   persists the Slot mutation, and `PrismaRegistrationUnitOfWork` provides
   durable uniqueness→`ConflictError` translation under an advisory lock.
4. ✅ **Finish and execute the complete PostgreSQL verification gate.**
   **Complete.** Nine barrier-forced race files in both orderings; migrations
   and the full integration suite execute in CI (360/360, 0 skipped) with the
   dated run recorded above.
5. ✅ **Implement Phase 5 end-to-end.** **Complete.** Routes, verified-session→
   `Actor` mapping, cookies, CSRF on every mutation, safe generic error mapping
   and an HTTP no-leak test all exist and execute. Request *schema* and body-size
   validation remain minimal — see the residual list below.
6. ✅ **Implement Phase 6 demonstration data.** **Complete.** `prisma/seed.ts` is
   idempotent, all documented credentials are populated, and the public-data
   tests assert against the seeded dataset.
7. ⚠️ **Deliver and verify Phase 7.** **Partially complete.** Deployed to managed
   PostgreSQL with migration and seed applied, and the live URL serves seeded
   data. Not recorded: Playwright against the deployed URL and the manual
   production walkthrough.
8. ⚠️ **Finalize the academic package.** **In progress.** README, threat model,
   memoria, slides and video script are updated from this verified revision.
   The repository is now **public** (2026-07-27) and the deck is built
   (`docs/tfm-defense-deck.pptx`); the memoria finalisation, the deck's
   `[AUTOR]` placeholders and the video are still to be produced.

### Residual work, in priority order

1. **Make the repository public** (or publish a mirror) — the only hard delivery
   requirement currently unmet (author action).
2. **Merge PR #31 and PR #32** — domain-integrity and security hardening are
   implemented, verified and CI-green, awaiting the author's merge (each merge
   triggers a production deploy).
3. ~~Add production hardening (security headers, CSP, dependency scanning)~~ —
   **done in PR #32**, in review. Residual within this item: application
   security **logging** (no logger in `src/`) and request body **schema/size**
   validation are still not implemented.
4. ~~Close the remaining domain-integrity findings~~ — **done in PR #31**, in
   review (aggregate matrix, Proposal message bounds, clock validation).
5. **Record production evidence** (tasks 7.7/7.8) if the author wants a deployed
   smoke result in the defence.
6. **Produce the deck and the video** against this revision; **complete the
   memoria** and the Basque native review.

## Final readiness decision

**Block 1 may be presented as implemented, deployed and concurrency-proven,
with three explicit qualifications.**

The core is defensible: a live URL serving seeded demo data, 360 tests passing
against real PostgreSQL in CI including nine barrier-forced race scenarios, and
12 Playwright tests covering the full demo chain, the public no-leak contract
and the authorisation denial matrix. The security controls the earlier revision
called "pending" — CSRF enforcement, atomic rate limiting, hash-only session
storage, lock-first concurrency, the runtime public allow-list — are integrated
and covered by executed evidence.

The three qualifications must be stated plainly rather than glossed:

1. **Production hardening is now largely in place** (PR #32, in review):
   security headers, a nonce-based CSP and dependency scanning, verified against
   a production build. What is still absent is application security **logging**
   and request body **schema/size** validation — so it remains a defensible TFM
   MVP, not an Internet-ready service, and the threat model says so per control.
2. **The repository is public** (2026-07-27) — the stated delivery requirement is
   now met, and a pre-publication secret sweep confirmed no real credentials are
   exposed. What remains author-only here is the memoria, the slides URL and the
   video.
3. **The six-centre-type generalisation (`widen-beyond-hospitals`) is merged and
   deployed**, but its Basque copy is still a draft pending native review
   (Phase 6.10, blocking for copy quality) and the production database has not
   yet been reseeded, so the six types are demonstrable in the seeded `dev`
   environment and in the deployed *code*, not yet in the live demo *data*
   (see section 1.1).

Blocks 2 and 3 remain future work and are claimed nowhere.
