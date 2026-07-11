# Tasks: bootstrap-vivetutiempo-platform (Block 1: Core)

## Review Workload Forecast

**Revised after `reviews/codex-planning-review.md` (all findings accepted, PR 1) AND `reviews/codex-pr2-plan-review.md` (all findings accepted, PR 2) — see task additions across Phases 2-7 below.**

**Label-collision note:** both reviews independently number their findings B1-B3/M1-M6/N1-N3. Where a bare code (e.g. `M3`, `M6`) appears below without qualification, it refers to `codex-planning-review.md` (PR 1's review, already reflected in the pre-existing Phase 1-2/5-7 tasks). Wherever this revision adds/changes a task for a `codex-pr2-plan-review.md` finding, the tag is suffixed `pr2-review` (e.g. `M6 pr2-review`) to disambiguate it from the identically-numbered but unrelated PR 1 finding.

| Field | Value |
|-------|-------|
| Total tasks | 110 (was 92 before this revision — Phase 3 grew 27→31, Phase 4 grew 14→28, net +18 driven by `codex-pr2-plan-review.md`'s lock-first redesign (B2), explicit schema/migration tasks (B3), and the full concurrency test matrix (M1/M2)) |
| Estimated changed lines | ~5500-8000 (greenfield: scaffold + 5 domain entities incl. `closeSlot`/invariants + 11 use cases incl. `closeSlot`/`deactivateProfile` + 11 ports incl. `LoginRateLimiter`/`PublicEventProjectionQuery`/`ProfileUnitOfWork` + `Actor`/error taxonomy + `PublicEventProjection` DTO + 5 Prisma repos + lock-first `MatchingUnitOfWork`/`ProfileUnitOfWork` + auth adapters incl. session hardening/CSRF/Postgres rate-limiter + 12 routes/pages + 5-Slot seed + a substantially expanded unit/integration/E2E suite, notably the full 6-way concurrency race matrix) |
| 400-line budget risk | Very High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 Scaffold+Domain -> PR2 Application+Infra (incl. lock-first race guard for submit/approve/reject/close, session lifecycle/CSRF/rate-limit, schema additions) -> PR3 UI+Seed (incl. public DTO wiring + no-leak test) -> PR4 Deploy+Docs (incl. deploy execution) |
| Delivery strategy | not specified for this run — default `ask-on-risk` |
| Chain strategy | pending (user decision required) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Very High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Scaffold app + pure domain layer incl. `closeSlot` cascade, Profile `deactivated`/`rejected→pending` transitions, Slot invariants (Phases 1-2) | PR 1 | Base = main (or tracker branch). No runtime deps on other units. |
| 2 | Application use cases/ports (`closeSlot`, `rejectProposal`, `deactivateProfile`, re-registration branch, authorization edge-case matrix, `PublicEventProjection` mapper, `Actor`/error taxonomy) + schema additions (`DEACTIVATED`/`reviewRequestedAt`/`Session`) + Prisma infra + lock-first `withLockedSlot`/`withLockedProfile` race guard covering submit/approve/reject/close + session lifecycle hardening + Postgres-backed login rate limiter + canonical-origin CSRF policy (Phases 3-4) | PR 2 | Depends on Unit 1 (domain). Base = PR 1 branch if feature-branch-chain. Schema additions (4.1-4.2) ship FIRST in this PR, before any repository/adapter code (B3). Session lifecycle/rate-limit/CSRF ship here as infra, per review. |
| 3 | Route handlers/pages (incl. close-Slot, reject-Proposal, deactivate-profile, public-DTO wiring) + 5-Slot seed dataset + E2E incl. authorization-edge-case and public no-leak tests (Phases 5-6) | PR 3 | Depends on Unit 2 (application). Base = PR 2 branch if feature-branch-chain. The `PublicEventProjection` mapper and its dedicated read port are defined in PR 2 (3.26-3.27, 4.7-4.8); route wiring and the HTTP-level no-leak verification (5.7, 6.4) land here, per review's "public DTO → PR3" guidance. |
| 4 | Deploy config + README/docs + production migration/seed/deploy execution + live-URL smoke verification (Phase 7) | PR 4 | Depends on Unit 3. Base = PR 3 branch if feature-branch-chain. Deploy-execute tasks (7.4-7.8) added per review M5 — "prepared" is not "deployed and demonstrably working." |

## Phase 1: Project Scaffolding (Foundation) — non-TDD

- [x] 1.1 Init Next.js App Router + TS + Tailwind: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`. (Tailwind v4 uses `postcss.config.mjs`, no `tailwind.config.ts` file — current Next.js scaffold default.)
- [x] 1.2 Create layer folders: `src/domain/`, `src/application/`, `src/infrastructure/`, `src/ui/`, `src/app/` (ADR D5: `src/app` thin). Path aliases (`@domain/*`, `@application/*`, `@infrastructure/*`, `@ui/*`) added in `tsconfig.json`; ESLint boundary rule added in `eslint.config.mjs`.
- [x] 1.3 Add `prisma/schema.prisma`: Account/Profile/Slot/Proposal/Event models + enums (no migration yet). Prisma pinned to 6.19.3 (see apply-progress deviation note — Prisma 7 changed schema config).
- [x] 1.4 Add `docker-compose.yml` for local Postgres.
- [x] 1.5 Configure Vitest: `vitest.config.ts`, `tests/unit/`, `tests/integration/`.
- [x] 1.6 Configure Playwright: `playwright.config.ts`, `e2e/`.
- [x] 1.7 Add `.env.example` (`DATABASE_URL`, `SESSION_SECRET`) + `README.md` skeleton.

## Phase 2: Domain Layer — strict TDD (RED -> GREEN -> REFACTOR)

- [x] 2.1 [RED] `tests/unit/domain/profile.test.ts`: Profile state machine `pending->active|rejected`.
- [x] 2.2 [GREEN] `src/domain/profile/Profile.ts` entity + transitions.
- [x] 2.3 [RED] `tests/unit/domain/slot.test.ts`: Slot state machine `open->filled|closed`.
- [x] 2.4 [GREEN] `src/domain/slot/Slot.ts`.
- [x] 2.5 [RED] `tests/unit/domain/proposal.test.ts`: Proposal state machine `submitted->accepted|rejected`.
- [x] 2.6 [GREEN] `src/domain/proposal/Proposal.ts`.
- [x] 2.7 [RED] `tests/unit/domain/event.test.ts`: Event lifecycle `created->published->completed`.
- [x] 2.8 [GREEN] `src/domain/event/Event.ts`.
- [x] 2.9 [RED] `tests/unit/domain/acceptProposal.test.ts`: accept P1 -> auto-reject P2*, fill Slot, publish Event; deny on non-open Slot (spec scenarios in `slot-proposal-coordination`).
- [x] 2.10 [GREEN] Pure `src/domain/slot/acceptProposal.ts` (ADR D4 invariant).
- [x] 2.11 [REFACTOR] `src/domain/errors.ts` shared domain errors; add `src/domain/account/Account.ts`. (Errors were shared from cycle 1; Account added test-first with `canHoldProfile`/`profileTypeForRole`.)
- [x] 2.12 [RED] `tests/unit/domain/profile.test.ts` (extend): Profile transitions `active -> deactivated` (Admin, M3) and `rejected -> pending` (re-registration, same profile, M2).
- [x] 2.13 [GREEN] Extend `src/domain/profile/Profile.ts` with `deactivate()` and `reactivate()` transitions.
- [x] 2.14 [RED] `tests/unit/domain/slot.test.ts` (extend): Slot invariants — `scheduledAt` strictly future at creation (via injected `Clock`), `durationMinutes` > 0, `title`/`description`/`location` length bounds (N2).
- [x] 2.15 [GREEN] Extend `src/domain/slot/Slot.ts` construction/validation with the invariants above; raise a domain validation error on violation.
- [x] 2.16 [RED] `tests/unit/domain/closeSlot.test.ts`: closing an `open` Slot with `submitted` Proposals transitions the Slot to `closed` and cascades every `submitted` Proposal to `rejected`; deny closing a non-open Slot (B2). (Also covers `assertSlotOwnedBy` pure ownership guard.)
- [x] 2.17 [GREEN] Pure `src/domain/slot/closeSlot.ts` — mirrors `acceptProposal`'s shape (ADR D4 / Domain Model). (Shared cascade-linkage guard extracted to `src/domain/slot/linkage.ts`, reused by `acceptProposal`.)

## Phase 3: Application Layer — strict TDD

- [ ] 3.1 Define ports in `src/application/ports/`: `AccountRepository`, `ProfileRepository`, `SlotRepository`, `ProposalRepository`, `EventRepository`, `PublicEventProjectionQuery` (M6, pr2-review), `MatchingUnitOfWork` (`withLockedSlot`, B2/D4, pr2-review), `ProfileUnitOfWork` (`withLockedProfile`, M3/D7, pr2-review), `SessionPort` (`create`/`resolveValid`/`touch`/`revokeOne`/`revokeAllForAccount`, M3, pr2-review), `LoginRateLimiter` (M4, pr2-review), `PasswordHasher`, `Clock`, `IdGenerator`. Define the `Actor` type and the shared application error taxonomy (`UnauthenticatedError`, `ForbiddenError`, `ConflictError`, validation error) alongside the ports (N1, pr2-review — note: distinct from the pre-existing N1 "strict TDD timing" finding in `codex-planning-review.md`).
- [ ] 3.2 [RED] Test `registerProfile` (creates `pending` Profile) w/ in-memory fakes.
- [ ] 3.3 [GREEN] `src/application/use-cases/registerProfile.ts`.
- [ ] 3.4 [RED] Test `login`: session issuance, invalid creds, and denial via `LoginRateLimiter` (generic error, identical for unknown and locked-out accounts, M4 pr2-review — distinct from the pre-existing M4 "public projection allow-list" finding); test `logout`.
- [ ] 3.5 [GREEN] `src/application/use-cases/login.ts` (depends on `LoginRateLimiter`), `logout.ts`.
- [ ] 3.6 [RED] Test `validateProfile` (Admin-only; non-admin denied).
- [ ] 3.7 [GREEN] `src/application/use-cases/validateProfile.ts`.
- [ ] 3.8 [RED] Test `publishSlot`/`listOpenSlots` (active-Hospital gate).
- [ ] 3.9 [GREEN] `src/application/use-cases/publishSlot.ts`, `listOpenSlots.ts`.
- [ ] 3.10 [RED] Test `submitProposal` (active-Artist gate, open-Slot only).
- [ ] 3.11 [GREEN] `src/application/use-cases/submitProposal.ts`.
- [ ] 3.12 [RED] Test `approveProposal`/`rejectProposal` (ownership 403, cascade via `domain.acceptProposal`, non-open-Slot denial, terminal-Proposal denial).
- [ ] 3.13 [GREEN] `src/application/use-cases/approveProposal.ts`, `rejectProposal.ts` — both commit exclusively through `MatchingUnitOfWork.withLockedSlot` (M1 pr2-review, D4).
- [ ] 3.14 [RED] Test `listPublishedEvents` (public; unpublished items excluded) using a fake `PublicEventProjectionQuery`.
- [ ] 3.15 [GREEN] `src/application/use-cases/listPublishedEvents.ts` depending only on `PublicEventProjectionQuery` (M6 pr2-review) — no repository, no Prisma import.
- [ ] 3.16 [RED] Test `closeSlot` use case: ownership check (403 non-owner), denies on non-open Slot, calls `domain.closeSlot`, persists cascade via `MatchingUnitOfWork.withLockedSlot` (B2).
- [ ] 3.17 [GREEN] `src/application/use-cases/closeSlot.ts`.
- [ ] 3.18 [RED] Test `deactivateProfile` use case: Admin-only (403 non-Admin), `active -> deactivated`, and the transition + `SessionPort.revokeAllForAccount` happen inside one `ProfileUnitOfWork.withLockedProfile` call (M3).
- [ ] 3.19 [GREEN] `src/application/use-cases/deactivateProfile.ts`.
- [ ] 3.20 [RED] Test `registerProfile` reactivation branch: registering while an existing `rejected` Profile exists for the Account transitions that SAME Profile `rejected -> pending`, updating `reviewRequestedAt` as the new review request (not a second Profile row) (M2, D8).
- [ ] 3.21 [GREEN] Extend `src/application/use-cases/registerProfile.ts` with the reactivation branch.
- [ ] 3.22 [RED] Test `submitProposal`, `approveProposal`, `rejectProposal`, and `closeSlot` ALL commit exclusively through `MatchingUnitOfWork.withLockedSlot(slotId, work)`: a fake unit of work that locks first, then supplies the live Slot+Proposals to `work`, proves each use case recomputes its decision from the locked data rather than a pre-lock snapshot (B2/M1, pr2-review, ADR D4).
- [ ] 3.23 [GREEN] Implement/align all four use cases against the `withLockedSlot` callback shape. `submitProposal`'s guard (Slot open + no existing `submitted` Proposal from the same Artist for the same Slot) and `rejectProposal`'s guard (targeted Proposal still `submitted`) both raise `ConflictError` on a 0-row/violated-guard result computed inside the callback (B1/B2/M1/M2, pr2-review — M2 DECISION on duplicate submissions).
- [ ] 3.24 [RED] Test the authorization edge-case matrix (M6): Admin attempting `approveProposal`/`rejectProposal` (denied); Artist/Patient attempting Hospital-only or Admin-only use cases (denied); `approveProposal`/`rejectProposal` where the Proposal's `slotId` does not match the targeted Slot (denied); acting on an already-`accepted`/`rejected` Proposal (denied); an actor whose Profile turned `rejected`/`deactivated` after session issuance attempting any mutating use case (denied via live-status re-check, not session snapshot).
- [ ] 3.25 [GREEN] Add/adjust guard clauses across `approveProposal.ts`, `rejectProposal.ts`, `submitProposal.ts`, `publishSlot.ts`, `closeSlot.ts`, `deactivateProfile.ts` enforcing role + ownership + Proposal/Slot linkage + live Profile status on every call, raising from the N1 error taxonomy.
- [ ] 3.26 [RED] Test `listPublishedEvents` returns only the `PublicEventProjection` allow-list (title, description, scheduledAt, durationMinutes, artist public display name) — no location, Proposal message, email, or internal id (D6); test that the `PublicEventProjectionQuery` port boundary structurally cannot receive or forward a forbidden field (M6 pr2-review).
- [ ] 3.27 [GREEN] `src/application/dto/PublicEventProjection.ts` (allow-list shape) + `PublicEventProjectionQuery` port contract, wired into `listPublishedEvents.ts` (ADR D6; M6 pr2-review).
- [ ] 3.28 [RED] Test `deactivateProfile` and `validateProfile`'s reject branch each run their Profile-status transition and `SessionPort.revokeAllForAccount` inside the SAME `ProfileUnitOfWork.withLockedProfile` call — a simulated failure between the two steps (via a fake) leaves no partial state (M3).
- [ ] 3.29 [GREEN] Extend `deactivateProfile.ts`/`validateProfile.ts` (reject branch) to coordinate the transition + revocation atomically via `ProfileUnitOfWork.withLockedProfile`.
- [ ] 3.30 [RED] Test `login` re-checks the current Profile status inside the SAME `ProfileUnitOfWork.withLockedProfile` call that issues the session — a login racing a concurrent deactivation (simulated via a fake unit of work) MUST be denied, not issue a session (M3).
- [ ] 3.31 [GREEN] Extend `login.ts` to coordinate the live-status check + `SessionPort.create` atomically via `ProfileUnitOfWork.withLockedProfile`.

## Phase 4: Infrastructure Layer — pragmatic tests

- [ ] 4.1 Prisma schema additions (B3 pr2-review — BLOCKER, FIRST, no migration yet): add `ProfileStatus.DEACTIVATED`; add `Profile.reviewRequestedAt: DateTime?`; add a `Session` model (`id`, `accountId` FK + account-lookup index, `tokenHash`, `absoluteExpiresAt`, `lastActiveAt`, `createdAt`) linked to `Account`. Edits `prisma/schema.prisma` only (ADR D8).
- [ ] 4.2 Base Prisma migration: `prisma/migrations/.../migration.sql` — ALL base tables/FKs (Account/Profile/Slot/Proposal/Event) INCLUDING the 4.1 additions and the `Session` table + its index. Order: schema additions + base tables/FKs + Session table/index FIRST — strictly before task 4.4's raw-SQL migration (B3/N2, pr2-review).
- [ ] 4.3 [Integration test] `tests/integration/schema-migration.test.ts`: apply the base migration (4.2) against an empty database; assert success and that all expected tables/columns/indexes (incl. `Session`, `reviewRequestedAt`, `DEACTIVATED`) exist (B3/N2, pr2-review).
- [ ] 4.4 Raw-SQL migration (B1 pr2-review — BLOCKER, applied strictly after 4.2/4.3): partial unique indexes on `"proposals"` against the Prisma-generated identifiers — `CREATE UNIQUE INDEX ... ON "proposals"("slotId") WHERE "status" = 'ACCEPTED'::"ProposalStatus"` and `CREATE UNIQUE INDEX ... ON "proposals"("slotId","artistProfileId") WHERE "status" = 'SUBMITTED'::"ProposalStatus"` (see design.md "Migration / Rollout" for the exact SQL).
- [ ] 4.5 [Integration test] `tests/integration/partial-index-catalog.test.ts`: query `pg_indexes` after migration and assert both partial indexes exist with the exact predicates in 4.4 (B1, pr2-review).
- [ ] 4.6 Prisma repositories in `src/infrastructure/persistence/prisma/` (Account/Profile/Slot/Proposal/Event).
- [ ] 4.7 `PublicEventProjectionQuery` Prisma implementation (M6 pr2-review): the ONLY adapter permitted to join Event→Slot→Proposal→Profile; returns the finished `PublicEventProjection` shape, filtered to published Events.
- [ ] 4.8 [Integration test] `tests/integration/public-event-projection-query.test.ts`: asserts the query returns only allow-listed fields against fixture/seeded data, filtered to published Events (M6 pr2-review; the HTTP-level no-leak test stays PR 3/6).
- [ ] 4.9 `MatchingUnitOfWork` with `withLockedSlot(slotId, work)` (B2 pr2-review, ADR D4): `SELECT ... FOR UPDATE` on the Slot row FIRST, then loads the live Slot + full Proposal set inside the same transaction, invokes the `work` callback, persists its result before commit. Used by `submitProposal`, `approveProposal`, `rejectProposal`, `closeSlot`.
- [ ] 4.10 [Integration test] `tests/integration/matching-race.test.ts`: two parallel `approveProposal` calls on the same Slot -> exactly one `accepted`, one `409 ConflictError` (Docker Postgres).
- [ ] 4.11 [Integration test] `tests/integration/submit-approve-race.test.ts`: barrier-based interleave of `submitProposal` and `approveProposal` on the same Slot — approval locks first; assert the late `submitProposal` is rejected once the Slot is `filled` (Docker Postgres) (B1/B2, pr2-review).
- [ ] 4.12 [Integration test] `tests/integration/submit-close-race.test.ts`: barrier-based interleave of `submitProposal` and `closeSlot` on the same Slot — assert the late `submitProposal` is rejected once the Slot is `closed` (M2 pr2-review).
- [ ] 4.13 [Integration test] `tests/integration/approve-close-race.test.ts`: barrier-based interleave of `approveProposal` and `closeSlot` targeting the same Slot — assert exactly one coherent outcome persists, never a contradictory success response from both (M2 pr2-review).
- [ ] 4.14 [Integration test] `tests/integration/approve-reject-race.test.ts`: barrier-based interleave of `approveProposal` and `rejectProposal` targeting the same Proposal — assert one coherent serial outcome, no contradictory success response (M1 pr2-review).
- [ ] 4.15 [Integration test] `tests/integration/close-reject-race.test.ts`: barrier-based interleave of `closeSlot` and `rejectProposal` targeting a Proposal on the same Slot — assert one coherent serial outcome (M1 pr2-review).
- [ ] 4.16 [Integration test] `tests/integration/duplicate-submission.test.ts`: two concurrent `submitProposal` calls by the SAME Artist against the SAME open Slot — assert exactly one `submitted` Proposal persists and the second attempt is denied with `ConflictError`, never a raw DB constraint error surfacing to the caller (M2 DECISION, pr2-review).
- [ ] 4.17 [Integration test] `tests/integration/close-slot-cascade.test.ts`: closing a Slot with `submitted` Proposals persists the cascade atomically — Slot `closed`, every `submitted` Proposal `rejected` (Docker Postgres) (B2, pr2-review).
- [ ] 4.18 `ProfileUnitOfWork` with `withLockedProfile(accountId, work)` (M3, D7 — mirrors 4.9's `withLockedSlot`): locks the Profile/Account row FIRST, loads the live Profile inside that lock, then lets `work` transition status + call `SessionPort` operations, persisting before commit. Used by `deactivateProfile`, `validateProfile` (reject branch), `login`.
- [ ] 4.19 DB-backed `SessionPort` adapter: `src/infrastructure/auth/session.ts` implementing `create`/`resolveValid`/`touch`/`revokeOne`/`revokeAllForAccount` against the `Session` table (httpOnly/Secure/SameSite=Lax cookie carries only the opaque token; the row stores its hash) (M3, D7, D8).
- [ ] 4.20 [Integration test] `tests/integration/session-lifecycle.test.ts`: absolute expiry rejected, idle expiry rejected, rotation issues a new id on login, logout deletes the row (M3).
- [ ] 4.21 [Integration test] `tests/integration/profile-transition-session-revocation.test.ts`: Admin deactivation and Admin rejection each atomically revoke all sessions for the Account via `ProfileUnitOfWork` (reject-revocation and deactivation-revocation cases, M3).
- [ ] 4.22 [Integration test] `tests/integration/login-vs-deactivation-race.test.ts`: barrier-based interleave of `login` and `deactivateProfile` for the same Account — assert the login is denied once the deactivation commits (M3).
- [ ] 4.23 argon2id `PasswordHasher`: `src/infrastructure/auth/passwordHasher.ts`.
- [ ] 4.24 `Clock`/`IdGenerator` adapters.
- [ ] 4.25 Postgres-backed `LoginRateLimiter` adapter: `src/infrastructure/auth/loginRateLimiter.ts` — atomic counter/window per account + per hashed/truncated IP, rolling-window cleanup policy, generic response for unknown vs. locked-out accounts (M4 pr2-review — distinct from the pre-existing M4 "public projection allow-list" finding, ADR D7).
- [ ] 4.26 [Integration test] `tests/integration/login-rate-limiter.test.ts`: attempts within the window count correctly, the window resets, expired windows are cleaned up, response shape is identical for unknown vs. locked-out accounts (M4 pr2-review).
- [ ] 4.27 CSRF policy: `src/infrastructure/auth/csrf.ts` — compares normalized `Origin`/`Referer` against ONE canonical, allowlisted public URL from server config (never the request `Host`); rejects absent/malformed/mismatched values (fail closed); never allows mutation via GET (M5 pr2-review — distinct from the pre-existing M5 "deployment coverage" finding, ADR D7).
- [ ] 4.28 [Test] `tests/unit/infrastructure/csrf.test.ts`: allowed origin passes; a hostile `Host` header does not bypass the check; cross-site `Origin` is rejected; absent headers are rejected; the `login` route is covered by the same check (M5 pr2-review).

## Phase 5: UI / Route Handlers

- [ ] 5.1 `POST /api/auth/register` (Hospital/Artist self-registration): `src/app/api/auth/register/route.ts`.
- [ ] 5.2 `POST /api/auth/login`, `POST /api/auth/logout` route handlers.
- [ ] 5.3 Admin profile validation: `POST /api/admin/profiles/[id]/approve|reject` + `src/app/admin/profiles/page.tsx` (empty-state per spec).
- [ ] 5.4 Hospital slot publish: `POST /api/slots` + `src/app/hospital/slots/page.tsx`.
- [ ] 5.5 Artist proposal submit: `POST /api/slots/[id]/proposals` + `src/app/artist/slots/page.tsx`.
- [ ] 5.6 Hospital approve/reject: `POST /api/slots/[id]/proposals/[pid]/approve|reject` — both call through the same lock-first use cases (M1 pr2-review).
- [ ] 5.7 Public anonymous events browsing (no auth): `GET /api/events` + `src/app/events/page.tsx`.
- [ ] 5.8 Enforce role + ownership checks per handler (defense-in-depth; delegate to use cases per ADR).
- [ ] 5.9 [E2E] `e2e/demo-chain.spec.ts`: register -> admin approve -> publish -> propose -> accept -> auto-reject rival -> public browse.
- [ ] 5.10 Hospital close/withdraw Slot: `POST /api/slots/[id]/close` (owner-Hospital-only) + UI action in `src/app/hospital/slots/page.tsx` (B2).
- [ ] 5.11 Admin deactivate profile: `POST /api/admin/profiles/[id]/deactivate` + UI action in `src/app/admin/profiles/page.tsx` (M3).
- [ ] 5.12 Admin validation queue surfaces re-registered (`rejected -> pending`) profiles in the same pending queue as first-time submissions — no separate UI path (M2).
- [ ] 5.13 Wire the CSRF canonical-origin check (4.27) into every authenticated mutation route handler (`src/app/api/**/route.ts`), INCLUDING `POST /api/auth/login` (M5 pr2-review — supersedes the earlier "Origin/Host" wiring description).
- [ ] 5.14 [E2E] `e2e/close-slot.spec.ts`: Hospital closes a Slot with outstanding Proposals -> Proposals show `rejected`, Slot no longer accepts new Proposals (B2).
- [ ] 5.15 [E2E] `e2e/authorization-edge-cases.spec.ts`: exercises the M6 denial matrix (Admin approving a Proposal, Artist/Patient on Hospital/Admin routes, mismatched proposal/slot id, already-terminal Proposal, deactivated-mid-session actor) via direct API calls — asserts denial happens in the application layer, not only via hidden UI (M6).

## Phase 6: Seed Dataset

- [ ] 6.1 `prisma/seed.ts`: 7 accounts + **5 Slots** + 2 Events per design D-seed fix (M1) — S1 `open`/2 competing Proposals, S2 `filled`/accepted Proposal/published Event, S3 `open`/no Proposals, S4 `closed` via `closeSlot`/cascade-rejected Proposal, S5 `filled`/accepted Proposal/`completed` Event (Block 2 seam, valid unique origin distinct from S2's).
- [ ] 6.2 [E2E] Public browsing shows only published Events against seeded data.
- [ ] 6.3 Document seed credentials in `README.md`.
- [ ] 6.4 [E2E/API test] Public Events response never includes `location`, Proposal `message`, any email, or any internal id, verified against the seeded dataset (ADR D6, no-leak test) (M4).

## Phase 7: Deployment Prep + Docs

- [ ] 7.1 Vercel config + managed-Postgres env wiring (prod `DATABASE_URL` notes).
- [ ] 7.2 Finalize `README.md`: setup, run, test commands, seed credentials (TFM requirement).
- [ ] 7.3 Add `test`, `test:e2e`, `db:migrate`, `db:seed` scripts to `package.json`.
- [ ] 7.4 Run the production database migration safely: `prisma migrate deploy` against the managed Postgres instance, with a documented rollback path (previous migration / point-in-time restore per proposal §9) (M5).
- [ ] 7.5 Provision/seed demo data in the deployed environment: run the seed script against the deployed database (documented as a one-time, idempotent operation) so the deployed URL reproduces the full demo chain (M5).
- [ ] 7.6 Execute the deploy: trigger the Vercel production deployment and record the resulting live URL in `README.md` (M5).
- [ ] 7.7 Verify the live URL: manually exercise the full demo chain (login as all four seeded roles; publish -> propose -> approve -> Event published -> public browse; close a Slot) against the deployed instance (M5).
- [ ] 7.8 [E2E] Run the Playwright smoke suite against the deployed URL (`PLAYWRIGHT_BASE_URL` pointed at production) and record pass evidence in README/PR (M5).
