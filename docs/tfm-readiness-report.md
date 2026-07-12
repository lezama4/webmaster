# Vivetutiempo TFM Readiness Report and Master Finding Tracker

**Assessment date:** 2026-07-12  
**Method:** read-only source, specification, review, test-suite, configuration,
and documentation audit. No Git command, build, lint, migration, server, or test
command was run for this report.

## Executive conclusion

The repository contains a substantial Block 1 *domain/application/infrastructure
foundation*, but it is **not a deliverable TFM MVP yet**. The only Next.js page is
an explicit scaffold, Phase 5 route/UI work, Phase 6 seeds/E2E work, and Phase 7
deployment/documentation execution are unchecked in the authoritative task list
([`tasks.md:130-162`](../openspec/changes/bootstrap-vivetutiempo-platform/tasks.md)).
There is no public URL, seed script, demo account, API route, functional page, or
E2E spec.

There are also release-blocking static inconsistencies: the application still
depends on the old `LoginRateLimiter.isAllowed`/`recordFailure` protocol
([`src/application/use-cases/login.ts:93-119`](../src/application/use-cases/login.ts)),
whereas the current Prisma adapter exposes `consumeAttempt`/`recordSuccess`
([`src/infrastructure/auth/loginRateLimiter.ts:48-126`](../src/infrastructure/auth/loginRateLimiter.ts)).
The adapter therefore cannot implement the current port
([`src/application/ports/LoginRateLimiter.ts:18-22`](../src/application/ports/LoginRateLimiter.ts)).
This must be reconciled and then typechecked before treating the latest
infrastructure remediation as integrated.

The last recorded local Vitest run in this workspace (not rerun here) reported
**261 passed and 33 skipped**. The skipped tests are the 15 PostgreSQL-backed
integration files; the task record explicitly states that they await a working
Docker/PostgreSQL or CI execution
([`tasks.md:128`](../openspec/changes/bootstrap-vivetutiempo-platform/tasks.md)).
There is no reviewed CI run or deployed smoke-test evidence.

## 1. Master finding tracker

Statuses: **RESOLVED** = source and focused tests close the issue statically;
**OPEN** = a release-relevant gap remains; **DEFERRED** = intentionally outside
Block 1; **PENDING-VERIFICATION-IN-CI** = a code/test remediation exists but the
required real-PostgreSQL/CI evidence was not executed. Multiple source-review
IDs are grouped only where they describe the same defect.

| Original finding ID(s) | Severity | One-line consolidated finding | Status | Closure phase / evidence |
| --- | --- | --- | --- | --- |
| planning-B1; pr2-plan-B2 | BLOCKER | Slot transitions must lock before reads so a late submit cannot survive approval/close. | PENDING-VERIFICATION-IN-CI | `PrismaMatchingUnitOfWork` is lock-first (`src/infrastructure/persistence/prisma/MatchingUnitOfWork.ts:44-129`); submit/approve and submit/close barrier tests exist, but PostgreSQL tests remain skipped. |
| planning-B2 | BLOCKER | Closing a Slot must cascade-reject submitted Proposals. | PENDING-VERIFICATION-IN-CI | Domain/use case and integration test exist; no real DB execution evidence. |
| planning-M1 | MAJOR | The original seed model was internally inconsistent. | OPEN | Corrected five-Slot seed is specified, but `prisma/seed.ts` and credentials are absent (tasks 6.1/6.3 unchecked). |
| planning-M2; pr2a-B2 | MAJOR/BLOCKER | Re-registration must reuse one Profile and prove control of the existing account. | RESOLVED | Same-profile transition is in `Profile.ts`; password and role verification is in `registerProfile.ts:61-105`, with negative unit tests. |
| planning-M3; pr2-plan-M3; pr2a-M3/M4 | MAJOR | Session lifecycle, revocation and login/deactivation linearisation need atomic real-adapter proof. | PENDING-VERIFICATION-IN-CI | Session/Profile UoW code and tests exist; integration suite has not executed. See also open session touch and port mismatch rows. |
| planning-M4; pr2-plan-M6; pr2a-B1 | MAJOR/BLOCKER | Anonymous output requires a runtime, field allow-list rather than entity pass-through. | PENDING-VERIFICATION-IN-CI | Fresh DTO mapping exists in application and Prisma projection; HTTP endpoint/no-leak test is still Phase 5/6. |
| planning-M5 | MAJOR | “Prepared” does not meet the required deployed, demonstrable Core outcome. | OPEN | No deployment, production migration, seed, URL, or smoke evidence; Phase 7 is entirely unchecked. |
| planning-M6; pr2-plan-N1; pr2a-N1/N2 | MAJOR/MINOR | Authorisation must cover role, ownership, profile type, terminal states, linkage and malformed decisions. | RESOLVED at application layer | Guards and denial matrix unit tests are present; HTTP enforcement remains Phase 5. |
| planning-N1 | MINOR | Strict-TDD wording/evidence was contradictory. | RESOLVED | Phase 2/3 explicitly declare RED→GREEN tasks; preserve commit/evidence history for the defence. |
| planning-N2; pr2a-N3 | MINOR | Open-Slot visibility, future scheduling and non-N+1 listing need an explicit query contract. | PENDING-VERIFICATION-IN-CI | Domain bounds and dedicated `OpenSlotListingQuery` exist; real Prisma listing integration evidence is pending. |
| planning-N3 | MINOR | “No PII” was inaccurate for accounts and hospital-context data. | RESOLVED in documentation | Threat model now classifies email, location and messages as sensitive; retention implementation remains open. |
| pr1-B1 | BLOCKER | Prisma must persist deactivation and re-review audit state. | PENDING-VERIFICATION-IN-CI | Schema/migrations include `DEACTIVATED` and `reviewRequestedAt`; migration test is skipped. Full append-only review history remains explicitly backlog. |
| pr1-M1; threat-model-T07 | MAJOR | Aggregate rehydration must reject all inconsistent Slot/Proposal status matrices. | OPEN | `assertValidSlotAggregate` only rejects `open + accepted` (`src/domain/slot/aggregate.ts:24-40`); filled/closed contradictions remain accepted. |
| pr1-M2; threat-model-T15 | MAJOR | Profile name and Proposal message need bounded, normalised input. | OPEN | `Proposal` validates IDs but not its message (`src/domain/proposal/Proposal.ts:43-79`); Profile only checks non-empty value (`src/domain/profile/Profile.ts:58-68`). |
| pr1-M3 | MAJOR | Hexagonal boundaries must reject outer-layer, IO and persistence dependencies. | RESOLVED | ESLint now blocks aliases, relative outer-layer imports, Node built-ins and restricted globals; negative lint tests exist. |
| pr1-M4 | MAJOR | Secrets must be ignored and local database exposure controlled. | OPEN | `.env*` is ignored, but Compose publishes `5432:5432` on all interfaces with a predictable dev password (`docker-compose.yml:3-11`). |
| pr1-N1 | MINOR | `reviewRequestedAt` must be valid and immutable after reactivation. | OPEN | Rehydration validates/clones it, but `reactivateProfile` stores raw `clock.now()` (`Profile.ts:160-163`). |
| pr1-N2 | MINOR | Slot creation must reject an invalid clock result. | OPEN | `createSlot` validates input date but compares against unchecked `clock.now()` (`Slot.ts:116-143`). |
| pr1-N3 | MINOR | Domain integrity/abuse test gaps must be closed. | OPEN | The aggregate, profile-name, Proposal-message, and invalid-clock gaps above remain. |
| pr1-N4 | MINOR | Playwright must support deployed smoke targets. | RESOLVED (configuration only) | `PLAYWRIGHT_BASE_URL` is honoured and disables local web server (`playwright.config.ts:4-20`); no E2E spec/execution exists. |
| pr2-plan-B1/B3; pr2b-N1 | BLOCKER/MINOR | Schema/migration identifiers and partial unique indexes must be exact and demonstrably enforced. | PENDING-VERIFICATION-IN-CI | Static SQL matches schema and catalog tests exist; behavioural duplicate-insert proof has not executed. |
| pr2-plan-M1/M2; pr2a-M6; pr2b-M5 | MAJOR | Every declared race needs forced overlap and both required orderings. | OPEN | Only submit/approve and submit/close are barrier-forced. Other matching races and login-first/deactivate-second are not; app tests also lack controllable barriers. |
| pr2-plan-M4; pr2a-M2; pr2b-B1 | MAJOR/BLOCKER | Login limiting must be per-account/client, timing-resistant and atomically consumed. | OPEN | Application/port and Prisma adapter currently use incompatible protocols; no integrated atomic limiter can be established. The intended concurrent limiter test exists but has not run. |
| pr2-plan-M5; pr2b-M4 | MAJOR | CSRF requires canonical-origin route enforcement, including login. | OPEN | The pure predicate and unit tests exist, but no routes exist to invoke it (tasks 5.1-5.13 unchecked). |
| pr2a-M1; pr2a-verify-M2; threat-model-T02 | MAJOR | Live-profile authorisation must remain protected until the Slot mutation commits. | OPEN | Slot use cases nest Profile UoW inside Matching UoW; the Profile lock is released before Matching persistence, leaving a deactivation window. |
| pr2a-M5; threat-model-T08 | MAJOR | Registration requires atomic Account/Profile persistence and durable uniqueness-to-conflict mapping. | PENDING-VERIFICATION-IN-CI | Application port/fake implement atomic intent; no reviewed Prisma `RegistrationUnitOfWork` adapter is present in `src/infrastructure/**`, so durable behaviour is not delivered. |
| pr2b-M1; pr2a-verify-M1 | MAJOR | `touch` must not revive an idle/absolute-expired session. | OPEN | Prisma `touch` now has validity predicates, but its boolean result conflicts with the `Promise<void>` port; fake still touches expired rows. Integration proof is pending. |
| pr2b-M2 | MAJOR | Argon2id cost must be explicit and upgradeable. | RESOLVED statically | Adapter pins OWASP-baseline options and unit tests inspect encoding (`passwordHasher.ts:25-94`, `passwordHasher.test.ts`). |
| pr2b-M3 | MAJOR | Integration tests must be isolated/serial and migrations run globally. | PENDING-VERIFICATION-IN-CI | Vitest now has a serial integration project with global migration setup (`vitest.config.ts:18-51`); no CI execution reviewed. |
| pr2b-N2 | MINOR | SHA-256 pseudonyms for email/IP are not strong privacy protection. | OPEN | `loginRateLimiter.ts:14-24` still uses unsalted SHA-256 for email and accepts externally supplied `ipHash`; use keyed HMAC and define rotation/retention. |
| pr2b-N3 | MINOR | Tests must prove only session token hashes are stored. | PENDING-VERIFICATION-IN-CI | Static adapter hashes tokens, but no direct persisted-row assertion was found. |
| block3-BLOCKER-01 | BLOCKER | Simulated patronage cannot be reviewed from this branch because its code/spec/security review are absent. | DEFERRED | Block 3 is a separate future branch; no payment claim is ready for the TFM Core. |

## 2. Capability readiness matrix

“Executed” means a recorded execution exists; it is not inferred from source.

| Capability | Implementation state | Test/evidence state | Honest readiness |
| --- | --- | --- | --- |
| Domain entities, transitions, Slot creation bounds, accept/close cascades | Implemented | Unit suite exists; earlier local Vitest record executed. | **Implemented; tested-and-executed**, except aggregate-matrix/clock/profile-message gaps. |
| Application use cases, actor/role/ownership guards, public DTO mapper | Implemented | Unit suite exists; earlier local record executed. | **Implemented; tested-and-executed**, but stale-authority/registration durability gaps remain. |
| Schema, migrations, Prisma repositories and partial indexes | Implemented | PostgreSQL integration suite exists. | **Tested-but-not-executed** (awaits CI/real Postgres). |
| Matching concurrency | Candidate implementation present | Barrier tests cover only two named races. | **Tested-but-not-executed** and incomplete race matrix. |
| Session lifecycle/revocation | Candidate adapter present | Integration tests exist but skipped; port mismatch blocks integrated confidence. | **Tested-but-not-executed / open**. |
| Login rate limiting | Conflicting application and infrastructure protocols | Adapter tests exist but cannot establish end-to-end use. | **Open; not release-ready**. |
| Password hashing | Implemented | Unit tests exist; earlier local suite record includes unit tests. | **Implemented; tested-and-executed** (static parameters); real production benchmarking still pending. |
| CSRF | Pure policy implemented | Unit predicate tests exist; no route integration. | **Implemented helper; not an enforced control**. |
| HTTP APIs, input/body validation, cookie issuance, error mapping | Not implemented | No route tests. | **Pending**. |
| UI, accessibility, role workflows, public events page | Not implemented; homepage says scaffold in progress (`src/app/page.tsx:1-9`). | No UI/E2E tests. | **Pending**. |
| Seed data and reproducible demo accounts | Not implemented | No seed test. | **Pending**. |
| E2E/demo chain and deployed smoke | Not implemented | Playwright configuration only. | **Pending**. |
| Production deployment, public URL, operational verification | Not implemented | No reviewed deployment or CI run. | **Pending**. |
| Block 3 simulated support payments | Absent from this branch | No source/test/security review available here. | **Deferred**. |

## 3. TFM delivery requirements

| Requirement | Status | Evidence / missing work |
| --- | --- | --- |
| Complete README | **Not complete** | Setup is useful, but functionality checklist is unchecked, migration text is stale, seed credentials are pending, live URL is pending, slides/video are pending (`README.md:76-141`). |
| Public repository | **Not verifiable by reading** | A local `.git` directory exists, but repository visibility/remote were not inspected (Git prohibited). Record the public URL manually. |
| Working deployment URL | **Missing** | README says “pending”; Phase 7.4-7.8 are unchecked. |
| Slides | **Draft exists, not final** | `docs/slides-outline.md` is a strong outline but has placeholders and explicitly says to update from execution evidence. Produce the actual deck/PDF. |
| Video | **Script exists, not final** | `docs/video-script.md` is an honest draft; record/export the video only after the demonstrated revision is available. |
| Test credentials | **Missing** | README table is all pending; no `prisma/seed.ts`. |
| Reproducible full demo | **Missing** | Requires routes/UI, seed, deployment, E2E/smoke execution. |

## 4. Documentation-to-reality coherence

The documents are generally commendably cautious, but the following must be
corrected before submission or defence:

1. **README overstates runnable authentication.** It lists DB-backed cookie
   sessions and session security as stack features ([`README.md:21-22`](../README.md)),
   yet no route handler creates or sets a cookie and there are no protected
   routes. Reword it as *implemented adapter candidates; HTTP wiring pending*.
2. **README migration instructions are stale.** It says migrations “land in
   Phase 4” and comments out their command (`README.md:76-81`), although
   migrations are present. Replace with the actual safe local/test/prod
   workflow after it is executed.
3. **The threat model is materially stale.** Its scope says infrastructure was
   not read (`docs/security-threat-model.md:6-11`) and its T-02/T-03/T-08/T-09/
   T-10/T-11/T-12/T-14/T-16 statuses describe pre-remediation code. Update it
   after resolving the current port mismatch, retaining only evidence actually
   executed. It currently underclaims some code fixes and does not record the
   new integration mismatch.
4. **The threat model must not be read as an implementation guarantee.** It
   still correctly labels route/deployment controls pending, but its current
   wording should distinguish “adapter exists” from “integrated and CI-proven.”
5. **Memoria and slides must retain their own caution.** Both correctly call
   infrastructure/integration/deployment in progress, but any final wording
   such as “lock-first prevents races” must say “designed/implemented and
   awaiting PostgreSQL execution” until the CI artefact is available.
6. **Do not claim Block 3.** The stable proposal calls it follow-on scope and
   this branch contains no implementation. Keep it as future work, not a
   demonstrated payment architecture.

## 5. Prioritised path to “done”

1. **Restore a coherent, type-safe authentication contract.** Choose one atomic
   limiter port operation, align `login`, fakes, Prisma adapter and tests; align
   `SessionPort.touch` return semantics and make both fake and adapter reject
   expired touches. Run typecheck/lint afterward.
2. **Close integrity/security gaps in the core.** Complete Slot/Proposal
   aggregate validation; bound/normalise Profile and Proposal text; validate
   Clock output; make re-review timestamp defensive; restrict local Compose
   database binding; HMAC security telemetry.
3. **Fix cross-resource authorisation atomicity and registration durability.**
   Use a single transaction/context that holds profile authority through Slot
   mutation persistence; implement a real Prisma `RegistrationUnitOfWork` with
   durable uniqueness→`ConflictError` translation.
4. **Finish and execute the complete PostgreSQL verification gate.** Force every
   declared race with barriers in both required orderings; run migrations and
   all integration tests in CI; retain a dated CI URL/commit as evidence.
5. **Implement Phase 5 end-to-end.** Add routes, schema/body/ID/method checks,
   verified-session→Actor mapping, cookies, CSRF enforcement on all mutations,
   safe error mapping, accessible pages, and HTTP no-leak tests.
6. **Implement Phase 6 demonstration data.** Add an idempotent seed, populate
   all documented credentials, and make public-data tests run against it.
7. **Deliver and verify Phase 7.** Deploy to managed PostgreSQL, apply migration,
   seed, expose a live URL, execute Playwright against it, and record the exact
   revision and result.
8. **Finalize the academic package.** Update README, threat model, memory,
   slides, and video only from the verified deployed revision; publish the
   repository/URL and test credentials. Keep Block 2/3 explicitly future work.

## Final readiness decision

**Do not present Block 1 as complete, deployed, concurrency-proven, or
Internet-ready.** It is an advanced, review-rich implementation foundation with
valuable domain/application evidence. The release gates above—especially the
rate-limit contract mismatch, missing HTTP/UI/seed/deployment layers, and
unexecuted PostgreSQL evidence—must close before it meets the proposal’s stated
TFM success criteria.
