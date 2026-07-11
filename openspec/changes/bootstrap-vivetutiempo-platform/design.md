# Design — bootstrap-vivetutiempo-platform (Block 1: Core)

**Stack (fixed):** Next.js (App Router + Route Handlers) + TypeScript + Tailwind + PostgreSQL/Prisma + Vitest/Playwright. Clean/Hexagonal in one repo. Docker only for local Postgres. Deploy: Vercel + managed Postgres.

## Technical Approach

A hexagonal monolith: pure `domain/` (entities + state machines), `application/` (use cases + ports), `infrastructure/` (Prisma/auth adapters), and Next.js as the delivery mechanism. The key invariant (accept one Proposal → publish Event, fill Slot, auto-reject rivals) is a pure domain decision persisted atomically by one transactional adapter. Blocks 2/3 stay cheap: role-generic accounts, `completed` Event state, and the ports-first pattern leave additive seams — nothing for them is built now.

**Label-collision note:** this design has been revised twice against independent adversarial reviews (`reviews/codex-planning-review.md`, PR 1, and `reviews/codex-pr2-plan-review.md`, PR 2), each numbering its own findings B1-B3/M1-M6/N1-N3. A bare code (e.g. `M3`, `M6`, `B2`) below refers to the PR 1 review unless suffixed `pr2-review` (e.g. `M6 pr2-review`), which flags an identically-numbered but unrelated PR 2 finding.

## Architecture Decisions (ADRs)

### D1 — Auth: cookie sessions (DB-backed), not JWT
**Choice:** httpOnly + Secure + SameSite=Lax session cookie; session rows in Postgres; passwords hashed (argon2id). Exposed to `application/` via `SessionPort` + `PasswordHasher` ports; domain never sees auth.
**Rejected:** JWT — stateless tokens can't be revoked when an Admin rejects/deactivates a profile (a governance requirement here), and add expiry/refresh complexity with zero benefit in a same-origin monolith with one DB.
**Rationale:** Sessions are simpler, revocable, OWASP-friendlier (no token storage in JS), and trivially explainable in a TFM defense.

### D2 — Patient/Family in Block 1: seeded login, zero gated capability
**Choice:** `Account.role` enum includes `PATIENT`; one seeded Patient account proves role-based auth works, but Patient capability equals anonymous (browse published Events). No Patient Profile row — `Profile` (with `pending/active/rejected`) exists only for Hospital/Artist.
**Seam for Block 2:** Rating will reference `Account.id` + `Event.id` (unique pair) on `completed` Events. Account is already lightweight (email + password); nothing to migrate.
**Rejected:** No Patient account at all — fails the proposal's "log in with all four roles" success criterion.

### D3 — Slot shape (minimal, demo-credible)
`title`, `description`, `scheduledAt` (datetime), `durationMinutes`, `location` (free text: ward/room), `status`. **No capacity** — no Block 1 rule consumes it; additive later if needed.

### D4 — Concurrency: lock-first Slot row, single unit-of-work callback
**Choice (redesigned per accepted review B2 — BLOCKER, PR 2 plan review; supersedes the PR 1-era "guarded UPDATE, lock optional" design below):** `MatchingUnitOfWork` exposes one operation, `withLockedSlot(slotId, work)`. In a single DB transaction it (1) takes `SELECT ... FOR UPDATE` on the Slot row FIRST, before any Slot/Proposal data is read; (2) loads the complete, live Slot + its full Proposal set INSIDE that same locked transaction; (3) invokes `work(lockedSlot, proposals)` — a callback that re-checks authorization/status against the now-locked, live data and computes the pure domain operation (`acceptProposal`, `closeSlot`, `rejectProposal`'s guarded transition, or `submitProposal`'s insert guard); and (4) persists whatever `work` returns, still inside the same transaction, before commit. Every Slot-resolving use case — `submitProposal`, `approveProposal`, `rejectProposal`, `closeSlot` — calls `withLockedSlot`; none of them computes an outcome from a pre-lock read and hands it to a separate `commit(outcome)` step. Belt-and-braces: two partial unique indexes on `proposals`, written against Prisma's generated identifiers — exact SQL and rationale in "Migration / Rollout" below (B1 fix).

**Fix (accepted review B2 — BLOCKER, PR 2 plan review):** the previous design let a use case load Slot+Proposals, compute the domain outcome from that read, and only afterward acquire the row lock inside `commit`. That ordering cannot repair a stale read: a lock taken after the outcome is computed can only detect a conflicting *write*, not incorporate a Proposal that was inserted between the read and the lock. Concretely, a submit could read the Slot as `open`, an approval could then fill the Slot and auto-reject the Proposals it saw, and only afterward the pending submit's lock-then-write step would insert a new `submitted` Proposal into an already-`filled` Slot — an actionable Proposal outside the auto-reject cascade. `withLockedSlot(slotId, work)` fixes the ordering by acquiring the lock before any decision-informing read: `work` always receives freshly-locked, live data, and is responsible for the whole "re-check → decide → persist" sequence inside the lock.

**Fix (accepted review M1 — MAJOR, PR 2 plan review):** `rejectProposal` is not exempt from this protocol. A manual rejection of a single Proposal also calls `withLockedSlot`, re-loads the live Proposal set inside the lock, and transitions the targeted Proposal to `rejected` with a guarded update (a 0-row result — e.g. the Proposal is already terminal, or an `approveProposal`/`closeSlot` on the same Slot committed first — aborts the transaction with `ConflictError`). This prevents an uncoordinated rejection from racing an approval/close that is deciding the same Slot concurrently.

**Rejected:** optimistic version column (more machinery, same guarantee); serializable isolation (retry complexity); the prior "guarded `UPDATE` inside `commit`, row lock optional/added only at write time" design (rejected per B2 above — it does not prevent the stale-outcome race, only a subset of write conflicts).

### D5 — App Router placement
Next.js requires `src/app`; it is the UI-layer *entry* (thin pages + route handlers), while `src/ui` holds presentational components. Documented adaptation of the four-layer rule to a Next constraint.

### D6 — Public Event projection: allow-list DTO, not a Prisma `include`
**Choice (accepted review M4):** public, unauthenticated browsing (`listPublishedEvents`) MUST return a dedicated `PublicEventProjection` DTO built field-by-field, never a raw Prisma model or an `include`d relation. Allowed fields: `title`, `description`, `scheduledAt`, `durationMinutes`, and the artist's public display name (`Profile.name` of the accepted Proposal's Artist). Forbidden, always: exact `location` (ward/room), the accepted `Proposal.message`, any email, and any internal/database identifier (Slot id, Proposal id, Profile id, Account id — a public-safe `Event.publicId` or the `Event.id` used only as an opaque browsing key is acceptable, but nothing else internal leaks alongside it).
**Rationale:** a hospital's exact location and an artist's private message are sensitive-by-context even though the demo data is fictional; an `include`-based projection is one refactor away from leaking them. An explicit allow-list DTO makes the boundary testable (a no-leak test asserts the forbidden fields are structurally absent, not just empty).

**Fix (accepted review M6 — MAJOR, PR 2 plan review): a dedicated read port, not a generic-repository join.** The generic `EventRepository`/`SlotRepository`/`ProposalRepository`/`ProfileRepository` ports are insufficient to build `PublicEventProjection` without either an application-layer join (leaking Prisma `include` shapes into `application/`) or the use case receiving a raw relation graph it must then trust itself to redact. Add `PublicEventProjectionQuery` — an application port (e.g. `listPublished(): Promise<PublicEventProjection[]>`) whose Prisma implementation is the ONLY place permitted to join/select across Event → Slot → Proposal → (Artist) Profile, and which returns the finished, already-allow-listed shape — never a Prisma model, never a partial entity. `listPublishedEvents` (the use case) depends only on this port; it cannot import Prisma and cannot receive a field it did not ask for. Unit tests assert the mapper/port boundary structurally cannot receive or forward a forbidden field; the infrastructure query itself is integration-tested in PR 2 against Docker Postgres (the public HTTP no-leak test remains PR 3/6, per review).

**Rejected:** returning the Event entity/aggregate directly and relying on the frontend to not render sensitive fields — fails defense-in-depth, and the API response itself would leak to anyone inspecting network traffic. Building the projection inside the generic use case via ad hoc repository calls (rejected per M6 — invites a Prisma `include` or raw relation graph to leak into `application/`).

### D7 — Session lifecycle & CSRF hardening
**Choice (accepted review M3):** beyond D1's cookie attributes and DB-backed sessions:
- **Expiry:** each session row carries an absolute expiry (e.g. 12h from issuance) and an idle expiry (e.g. 30min since last use); either lapsing invalidates the session.
- **Rotation:** a new session id is issued on every successful login (never reuse/extend a pre-auth session id) — mitigates session fixation.
- **Revocation:** logout deletes the session row (not just clears the cookie). `SessionPort` exposes `revokeAllForAccount(accountId)`, called whenever a Profile transitions `active → deactivated` or `pending/active → rejected` (Admin action), so all of that account's live sessions are invalidated immediately — this is the concrete mechanism behind D1's "JWT can't be revoked" rejection.

**Fix (accepted review M3 — MAJOR, PR 2 plan review): `SessionPort` as an atomic, tested contract, plus a lock-first coordination port for Profile/session transitions.** `SessionPort` exposes exactly these operations, each unit-tested against an in-memory fake and integration-tested against the Postgres adapter: `create(accountId) -> Session` (issues a fresh opaque, CSPRNG-generated id — never reuses/extends a pre-auth id, per Rotation above), `resolveValid(sessionId) -> Session | null` (null on absolute-expiry, idle-expiry, or not-found; callers MUST treat null as unauthenticated), `touch(sessionId)` (bumps `lastActiveAt`, resetting the idle-expiry clock, on every authenticated request), `revokeOne(sessionId)` (logout — deletes the row), `revokeAllForAccount(accountId)` (deletes every row for the account). Because a session row's lifecycle is entangled with the owning Profile's status (a deactivation/rejection must revoke sessions; a login must not issue one to a Profile a concurrent Admin action is deactivating), a second port — `ProfileUnitOfWork.withLockedProfile(accountId, work)` — mirrors D4's `withLockedSlot`: it locks the Profile/Account row FIRST, loads the live Profile inside that lock, then lets `work` either (a) transition the Profile's status and call `SessionPort.revokeAllForAccount` (deactivation, Admin rejection), or (b) re-check live-`active` status and call `SessionPort.create` (login) — all before commit. This closes both the crash-between-writes gap (a transition and its revocation are one transaction) and the login-vs-deactivation race (login's status check and session issuance happen inside the same lock a concurrent deactivation would also need).

- **Brute-force (fix, accepted review M4 — MAJOR, PR 2 plan review):** login attempts are rate-limited via `LoginRateLimiter`, an **application-layer port** (listed with the other Phase 3 ports; the `login` use case depends on the port, never on a concrete adapter). The Phase 4 adapter is a **Postgres-backed atomic counter/window** — an in-memory limiter is ineffective across Vercel's multiple serverless instances and cold restarts, and Postgres is already the deployment's shared, transactional store, so no new infrastructure dependency is introduced. Keyed per-account AND per-IP within a rolling window; IP is stored as a truncated/hashed value (never the raw address), with a documented retention/cleanup policy — expired rolling-window rows are purged, not retained indefinitely. Unknown accounts and known-but-locked-out accounts receive the same generic error (no user-existence oracle).
- **CSRF (fix, accepted review M5 — MAJOR, PR 2 plan review):** every authenticated mutation route handler — INCLUDING `POST /api/auth/login`, which sets a session cookie and is explicitly in scope, not excluded — checks the request's normalized `Origin` (falling back to `Referer`) against **one canonical, allowlisted public URL read from server configuration** (e.g. `APP_PUBLIC_URL`), never against the request's own `Host` header, which an attacker can spoof or relay through a misconfigured or absent trusted-proxy setup. Absent, malformed, or mismatched Origin/Referer values are **rejected — fail closed** (a missing header is not treated as "no CSRF risk"). No mutation is ever accepted through GET.
**Rejected:** relying on `SameSite=Lax` alone (insufficient per OWASP for a hospital-context governance app); token-based CSRF (double-submit cookie) — more moving parts than a canonical-origin check for a same-origin monolith with no third-party embeds; comparing Origin/Referer against the request's own `Host` (rejected per M5 — spoofable without a verified trusted-proxy configuration, which this deployment does not have); an in-memory/per-instance rate limiter (rejected per M4 — not shared across Vercel instances).

### D8 — Schema additions required before any repository/adapter work (Profile lifecycle + DB-backed sessions)
**Choice (accepted review B3 — BLOCKER, PR 2 plan review):** the static `prisma/schema.prisma` (Phase 1) predates D1's DB-backed sessions and the Profile `deactivated`/`rejected → pending` transitions (Domain Model, below). Before any Phase 4 repository/adapter task, the base migration MUST add:
- `ProfileStatus.DEACTIVATED` (enum value) — supports Admin deactivation (M3).
- `Profile.reviewRequestedAt: DateTime` — durable evidence of the current/latest review request; a re-registration (`rejected → pending`) updates this timestamp so Admin traceability survives a restart. A full append-only review-history table (one row per review request) is the more complete design and is explicitly **BACKLOG** for Block 1 — the single-timestamp field is the accepted minimal contract for this PR.
- A `Session` model: `id` (opaque, CSPRNG-generated), `accountId` (FK to `Account`, indexed for lookup by account — required by `revokeAllForAccount`), `tokenHash` (hash of the opaque bearer token — the row never stores a reusable token in plaintext), `absoluteExpiresAt`, `lastActiveAt` (idle-expiry basis), `createdAt`.

**Migration order (accepted review N2 — MINOR, PR 2 plan review):** schema additions (`DEACTIVATED`, `reviewRequestedAt`, `Session` model) + base tables/FKs FIRST, then the raw-SQL partial-unique-index migration (B1, below) — never the reverse, since the partial indexes reference the `proposals` table that must already exist with its final shape. A dedicated task/test creates the base schema against an empty database and asserts success before the partial-index migration runs.

**Rationale:** without these fields, D1 (DB-backed sessions) and D7 (deactivation revocation, session rotation, idle/absolute expiry) have no persistable contract; Phase 4 infra tasks would either invent ad hoc columns mid-implementation or silently fall back toward an in-memory/JWT approach, contradicting D1's stated rejection of JWT.
**Rejected:** storing a reusable bearer token directly in the Session row — a leaked DB row (backup, log, replica) would then be directly usable as a live session; hashing the token (as with passwords) means only the client-held opaque value authenticates, and the DB copy is one-way.

## Domain Model

| Aggregate | Fields (key) | State machine |
|---|---|---|
| Account | email (unique), passwordHash, role: ADMIN\|HOSPITAL\|ARTIST\|PATIENT | — |
| Profile | accountId (unique), type: HOSPITAL\|ARTIST, name, status, reviewRequestedAt (D8/B3) | pending → active \| rejected; active → deactivated (Admin, M3); rejected → pending (re-registration, same profile, M2) |
| Slot | hospitalProfileId, D3 fields, status | open → filled \| closed (owning Hospital's `closeSlot`, cascades reject — B2) |
| Proposal | slotId, artistProfileId, message, status | submitted → accepted \| rejected |
| Event | slotId (unique), proposalId (unique), title, status | created → published → completed |

Domain rules enforced in `domain/` (framework-free): only `active` profiles act, re-checked live on every mutating call — a Profile that became `rejected`/`deactivated` after session issuance MUST fail the action in `application/`, not rely on the session snapshot (M6); only owner Hospital decides; accept requires Slot `open`; accept cascade is one operation; Event auto-publishes on accept. Resubmit-after-reject allowed: the DB partial unique index on `("slotId","artistProfileId") WHERE "status" = 'SUBMITTED'` (exact SQL against Prisma's generated identifiers in "Migration / Rollout" below, B1) permits a new `submitted` Proposal from the same Artist once their prior one is `rejected`, but blocks two simultaneously-`submitted` Proposals from the same Artist for the same Slot (M2 DECISION, pr2-review — distinct from the M2 "re-registration" finding just below: a duplicate concurrent submission by the same Artist is denied with `ConflictError`).

**Profile transitions (accepted review M2/M3):**
- `rejected → pending`: a rejected Hospital/Artist re-registering reactivates the **same** `Profile` row (not a new one, not a new Account) — preserves `Profile.accountId` unique and full review traceability. Recorded as a new review request via a `Profile.reviewRequestedAt` timestamp update (D8/B3) — the minimal, accepted contract for Block 1; a full append-only review-history row is BACKLOG.
- `active → deactivated`: Admin-only. Deactivation is terminal-in-practice for Block 1 (no `deactivated → active` reactivation path defined yet — out of scope until a real need surfaces) and MUST synchronously invalidate every live session for that Profile's Account (`SessionPort.revokeAllForAccount`, see D7).

**Slot `closeSlot` (accepted review B2):** the owning Hospital MUST be able to close/withdraw its own `open` Slot. `closeSlot` is a domain operation, `closeSlot(slot, proposals, clock) → {closedSlot, rejectedProposals[]}`, mirroring `acceptProposal`'s shape: it transitions the Slot to `closed` **and** transitions every `submitted` Proposal against it to `rejected` explicitly and auditably in the same operation — no Proposal is left orphaned in `submitted` against a non-open Slot. Denied on a Slot that is not `open` (already `filled` or `closed`). Persisted atomically via the same `MatchingUnitOfWork` coordination as `submitProposal`/`approveProposal` (D4).

**Slot invariants (accepted review N2):** enforced at construction/validation in `domain/slot/Slot.ts` — `scheduledAt` MUST be strictly in the future at creation time (relative to the injected `Clock`, never `Date.now()` directly — keeps the rule testable); `durationMinutes` MUST be a positive integer; `title`, `description`, and `location` MUST satisfy sane, explicit length bounds (e.g. title 3–120 chars, description ≤ 2000 chars, location 1–200 chars) so a Slot can never be constructed with a past date, non-positive duration, or degenerate/oversized text. Violations raise a domain validation error, not a Prisma/DB constraint failure.

**`listOpenSlots` visibility (accepted review N2):** only `active` Artists (authenticated) may call `listOpenSlots`; it returns fields needed to decide whether to propose — `title`, `description`, `scheduledAt`, `durationMinutes`, `location`, owning Hospital's public name — and excludes Slots that are `filled`/`closed` or whose `scheduledAt` has already passed. This listing is Artist-authenticated and internal-facing; it is intentionally richer than the public `PublicEventProjection` (D6), which never exposes `location`.

## Application Layer

Use cases: `registerProfile` (branches to `rejected → pending` reactivation of the same Profile when one already exists for the Account — M2), `login`/`logout` (login rate-limited via `LoginRateLimiter` and coordinated with the live Profile check via `ProfileUnitOfWork.withLockedProfile` — M3/M4 pr2-review, D7), `validateProfile` (Admin; reject branch revokes sessions via `ProfileUnitOfWork` — M3 pr2-review), `deactivateProfile` (Admin-only, `active → deactivated`, cascades `SessionPort.revokeAllForAccount` inside the same `ProfileUnitOfWork` transaction — M3 pr2-review), `publishSlot`, `listOpenSlots`, `submitProposal` (open-Slot guard + same-Artist-duplicate guard, both via `MatchingUnitOfWork.withLockedSlot` — D4/B2/M2 pr2-review), `approveProposal`, `rejectProposal` (both via `withLockedSlot` — M1 pr2-review), `closeSlot` (owner-Hospital-only, cascades reject on outstanding Proposals, via `withLockedSlot` — B2 pr2-review), `listPublishedEvents` (public, returns `PublicEventProjection` allow-list via `PublicEventProjectionQuery` — D6/M6 pr2-review), plus owner listings. Each receives an `Actor` context and enforces **role + ownership + live Profile status** (defense in depth vs UI/route checks; a Profile that turned `rejected`/`deactivated` after session issuance MUST still be denied — M6).

Ports: `AccountRepository`, `ProfileRepository`, `SlotRepository`, `ProposalRepository`, `EventRepository`, `PublicEventProjectionQuery` (dedicated public read-model port — M6 pr2-review, D6), `MatchingUnitOfWork` (exposes `withLockedSlot(slotId, work)` — B2 pr2-review, D4), `ProfileUnitOfWork` (exposes `withLockedProfile(accountId, work)` — M3 pr2-review, D7, mirrors `MatchingUnitOfWork`), `SessionPort` (`create`/`resolveValid`/`touch`/`revokeOne`/`revokeAllForAccount` — M3 pr2-review, D7), `LoginRateLimiter` (M4 pr2-review, D7), `PasswordHasher`, `Clock`, `IdGenerator`. (Block 3 later adds `PaymentGateway` here — port slot only, not now.)

**Actor & error taxonomy (accepted review N1 — MINOR, PR 2 plan review):** every use case receives an `Actor` (`{ accountId, role, profileId?, profileStatus? }`, sourced from the resolved, live session — never from client-supplied input) and raises from one shared application error taxonomy: `UnauthenticatedError` (no/invalid/expired session), `ForbiddenError` (role/ownership/live-status denial), `ConflictError` (lock/guard/unique-index race — including the M2 duplicate-submission case), and a domain validation error (invariant violation, e.g. Slot invariants). Route handlers map these to HTTP status once, at the boundary; denial tests assert against the taxonomy, not against HTTP status codes, so they stay meaningful independent of the delivery mechanism.

## Approve-Proposal Sequence (lock-first — accepted review B2, PR 2 plan review)

```
Hospital UI → route handler: POST /api/slots/{id}/proposals/{pid}/approve
  handler: session → Actor (401/403 if none/inactive)
  → approveProposal use case
      → MatchingUnitOfWork.withLockedSlot(slotId, (lockedSlot, proposals) => {
          proposal = proposals.find(pid)   -- MUST belong to lockedSlot, else 403/404 (M6)
          checks actor owns lockedSlot (403); re-checks actor Profile is live-`active` (403, M6)
          domain.acceptProposal(lockedSlot, proposals, proposalId, clock)
            → {filled Slot, accepted P, rejected P*, published Event} | DomainError
          return outcome for persistence
        })
      [ONE tx: SELECT ... FOR UPDATE on the Slot row FIRST; Slot+Proposals loaded
        INSIDE that lock; domain decision computed from the locked, live data;
        guarded slot update, proposal updates, event insert — all before commit;
        guard failure or unique-index hit → ConflictError 409]
  ← 200 event | 409 on race | 403 on stale/foreign actor or mismatched proposal/slot
```

## Submit-Proposal Sequence (lock-first — accepted review B1/B2, duplicate-guard — M2, PR 2 plan review)

```
Artist UI → route handler: POST /api/slots/{id}/proposals
  handler: session → Actor (401/403 if none/inactive/non-Artist)
  → submitProposal use case
      → MatchingUnitOfWork.withLockedSlot(slotId, (lockedSlot, proposals) => {
          checks lockedSlot is (live, locked) open, else ConflictError
          checks no existing `submitted` Proposal by this Artist for this Slot
            (M2 DECISION: duplicate concurrent same-Artist submission → ConflictError;
            also enforced by the (slotId, artistProfileId) WHERE status='SUBMITTED'
            partial unique index as belt-and-braces)
          return the new Proposal insert for persistence
        })
      [SAME lock-first pattern as approve/reject/close: SELECT ... FOR UPDATE on the
        Slot row BEFORE the open-check, the duplicate-check, and the insert; a
        partial-index violation on commit is translated to ConflictError, never a
        raw DB error]
  ← 201 Proposal | 409 if the Slot left `open` between the read and the commit, or a
    duplicate same-Artist submission is detected
```

## Reject-Proposal Sequence (lock-first — accepted review M1, PR 2 plan review — new use-case sequence)

```
Hospital UI → route handler: POST /api/slots/{id}/proposals/{pid}/reject
  handler: session → Actor (401/403 if none/inactive)
  → rejectProposal use case
      → MatchingUnitOfWork.withLockedSlot(slotId, (lockedSlot, proposals) => {
          proposal = proposals.find(pid)   -- MUST belong to lockedSlot, else 403/404
          checks actor owns lockedSlot (403); re-checks actor Profile is live-`active` (403)
          checks proposal is still `submitted`, else denied (terminal state, or
            ConflictError if it raced a concurrent approve/close, M1 pr2-review)
          guarded transition: proposal → `rejected`
          return outcome for persistence
        })
      [SAME lock-first pattern as approve/submit/close — a concurrent approve or
        close on the same Slot cannot race this rejection; whichever transaction
        commits first wins, the other observes the updated, locked state and is
        denied/aborted]
  ← 200 rejected Proposal | 409 on race | 403 on stale/foreign actor or mismatched proposal/slot
```

## Close-Slot Sequence (lock-first — accepted review B2, PR 2 plan review)

```
Hospital UI → route handler: POST /api/slots/{id}/close
  handler: session → Actor (401/403 if none/inactive)
  → closeSlot use case
      → MatchingUnitOfWork.withLockedSlot(slotId, (lockedSlot, proposals) => {
          checks actor owns lockedSlot (403); checks lockedSlot is open (else denied)
          domain.closeSlot(lockedSlot, proposals, clock)
            → {closedSlot, rejectedProposals[]} | DomainError
          return outcome for persistence
        })
      [ONE tx, same lock-first pattern as submit/approve/reject: guarded slot
        update to `closed` + cascade proposal updates to `rejected`, computed from
        data read inside the lock]
  ← 200 closedSlot | 409 on race | 403 non-owner or already non-open
```

## File Changes (greenfield — key creations)

| Path | Purpose |
|---|---|
| `src/domain/{account,profile,slot,proposal,event}/` | Entities, state machines, `acceptProposal`, `closeSlot`, domain errors, Slot invariants |
| `src/application/{use-cases,ports,dto}/` | Use cases + port interfaces (incl. `LoginRateLimiter`, `PublicEventProjectionQuery`, `ProfileUnitOfWork`) + `Actor`/error taxonomy (N1, pr2-review) + `PublicEventProjection` DTO (D6) |
| `src/infrastructure/persistence/prisma/` | Prisma repos + `MatchingUnitOfWork` (`$transaction`, `withLockedSlot(slotId, work)` — lock-first, shared by submit/approve/reject/close, B2/M1, pr2-review) + `ProfileUnitOfWork` (`withLockedProfile`, M3, pr2-review) + `PublicEventProjectionQuery` Prisma impl (M6, pr2-review) |
| `src/infrastructure/auth/` | `SessionPort` adapter (create/resolveValid/touch/revokeOne/revokeAllForAccount; expiry/rotation/revocation, D7/M3 pr2-review), argon2 hasher, Postgres-backed `LoginRateLimiter` adapter (M4, pr2-review), CSRF canonical-origin check (M5, pr2-review) |
| `src/app/` | Pages + route handlers (thin; Zod validation at boundary) |
| `src/ui/` | Presentational components (Tailwind) |
| `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` | Schema (incl. `DEACTIVATED`, `reviewRequestedAt`, `Session` model — D8/B3, pr2-review) + base migration + partial-unique raw SQL against Prisma's generated identifiers (B1, pr2-review) + seed |
| `tests/` (unit/integration), `e2e/` (Playwright), `vitest.config.ts`, `playwright.config.ts` | Test scaffolding (enables strict TDD) |
| `docker-compose.yml` | Local Postgres only |

## Seed Dataset (D-seed)

All passwords `VivetuTiempo2026!` (seed-only, documented in README).

| Role | Accounts |
|---|---|
| Admin | `admin@vtt.test` |
| Hospital | `hospital.sanjuan@vtt.test` (active), `hospital.esperanza@vtt.test` (pending — demos Admin validation) |
| Artist | `artist.clara@vtt.test`, `artist.mateo@vtt.test` (active); `artist.lucia@vtt.test` (pending) |
| Patient | `patient.ana@vtt.test` |

**Fix (accepted review M1 — the previous 4-Slot/2-Event seed was internally impossible):** `Event.slotId` and `Event.proposalId` are each unique, so every Event needs its own originating filled Slot + accepted Proposal. The seed now declares **5 Slots** for San Juan:
- S1 `open` with 2 competing `submitted` Proposals (Clara, Mateo — demos choose + auto-reject).
- S2 `filled`, with Mateo's Proposal `accepted` → published Event #1 (Block 1's live demo chain).
- S3 `open` with no Proposals (empty-state demo).
- S4 `closed` via `closeSlot`, with a `submitted` Proposal that was cascade-rejected on close (demos B2).
- S5 `filled`, with Clara's Proposal `accepted` → Event #2, seeded directly in `completed` state (Block 2 seam demo — a valid, unique Slot/Proposal origin distinct from Event #1's).

Events: 1 `published` (from S2), 1 `completed` (from S5). Reproduces the full demo chain from a fresh DB via `prisma db seed`.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit (Vitest) | Domain state machines, accept cascade, `closeSlot` cascade, Profile `deactivated`/`rejected→pending` transitions, Slot invariants (N2) | Pure functions, zero mocks |
| Unit (Vitest) | Use cases: role/ownership/status errors, live-status re-check, `closeSlot`, `rejectProposal`, `deactivateProfile`, re-registration branch, public-projection field allow-list, login gated by `LoginRateLimiter`, Profile-transition/session-revocation coordination via `ProfileUnitOfWork`, Actor/error-taxonomy denials (N1, pr2-review) | In-memory fake adapters implementing ports |
| Integration (Vitest) | Prisma repos; `withLockedSlot` lock-first race matrix — **submit-vs-approve, submit-vs-close, approve-vs-close, approve-vs-reject, close-vs-reject, and two concurrent same-Artist submissions (B2/M1/M2, pr2-review)**; `closeSlot` cascade persistence; partial-unique-index catalog assertion via `pg_indexes` (B1, pr2-review); empty-database base-schema-creation assertion (B3/N2, pr2-review); `SessionPort` expiry/rotation/revocation and `ProfileUnitOfWork` login-vs-deactivation race, against Postgres (M3, pr2-review); `LoginRateLimiter` window/cleanup behavior against Postgres (M4, pr2-review) | Docker Postgres |
| E2E (Playwright) | Full demo chain + public browsing + `closeSlot` flow + authorization edge-case matrix (M6, planning-review) + public no-leak assertions (D6; dedicated-read-port boundary per M6, pr2-review) + CSRF fail-closed cases including login (M5, pr2-review), per seeded creds | Against seeded app |

**Strict TDD is ACTIVE (accepted review N1 — resolves the proposal-vs-design contradiction):** now that the Vitest/Playwright runner is scaffolded (Phase 1, done), strict test-first (RED → GREEN → REFACTOR, one commit or clearly separated diff per step) applies to every `domain/` and `application/` task from this point forward — it is no longer merely a future target. `infrastructure/`/`ui/` stay pragmatic (tests follow the code, still required). Expected evidence for the TFM defense: a RED commit/diff showing the failing test before its implementation, for each domain/application task in `tasks.md`. `sdd-init`'s cached `strict_tdd` flag should be refreshed to reflect this (tracked outside this change's scope — see report).

## Data & Privacy Stance (accepted review N3 — supersedes proposal §6/§8's "no PII" framing)

The proposal's "no PII beyond lightweight accounts" / "published Events contain no sensitive data" framing is imprecise and would not hold up under scrutiny. This design instead commits to **data minimization**:
- **What is held:** account email + password hash (credentials); Profile display name (Hospital/Artist) + `reviewRequestedAt` timestamp (D8); Slot `location` (ward/room — sensitive-by-context in a hospital, never exposed publicly, see D6); the accepted Proposal's `message` (private, Hospital-only); session records (opaque-token hash + absolute/idle expiry timestamps, never a reusable token — D7/D8); login-rate-limiter windows (hashed/truncated IP + per-account attempt counters, rolling-window retention — M4). No health data, no patient identity is collected in Block 1 (Patient/Family is anonymous browsing only).
- **Legal basis / notice:** for a TFM demo, all data is fictional seed data; a production deployment would need explicit consent/notice at registration (legitimate-interest or consent basis for Hospital/Artist account data) before handling real staff/artist information — flagged as a pre-production requirement, not built now.
- **Retention:** seed/demo data has no retention policy (ephemeral, reset on reseed). A production system would need an explicit retention window per data class (credentials, profile, Slot/Proposal history) — out of scope for Block 1, noted for Block 2/3 planning.
- **Deletion:** no user-facing deletion flow exists in Block 1 (no real personal data at stake in the demo). A production system needs an account-deletion procedure (cascading Profile/Slot/Proposal handling, or anonymization if traceability must survive) before onboarding real users — explicitly deferred, not silently assumed away.

## Migration / Rollout

Greenfield — no data migration, but ordered schema creation MUST be respected (accepted review B3/N2, PR 2 plan review):

1. **Base schema migration:** Account/Profile (incl. `ProfileStatus.DEACTIVATED`, `Profile.reviewRequestedAt`)/Slot/Proposal/Event tables, enums, FKs, plus the `Session` table (D8) and its account-lookup index — Prisma-generated (`prisma migrate dev`/`deploy`).
2. **Raw-SQL migration (B1 fix, below):** the two partial unique indexes on `proposals`, applied strictly AFTER step 1 — never before, since the indexes reference the `proposals` table in its final shape.
3. A dedicated integration test creates the schema from an empty database and asserts both migrations apply cleanly, and that both partial indexes exist with their intended predicates (queried from `pg_indexes`), before any application code depends on them.

**Fix (accepted review B1 — BLOCKER, PR 2 plan review): raw SQL must target Prisma's generated identifiers.** Prisma maps the model to table `proposals` but does NOT snake_case columns, and enum labels keep the schema's literal casing. The partial-unique migration MUST read:
```sql
CREATE UNIQUE INDEX proposals_accepted_per_slot
  ON "proposals" ("slotId")
  WHERE "status" = 'ACCEPTED'::"ProposalStatus";

CREATE UNIQUE INDEX proposals_submitted_per_slot_artist
  ON "proposals" ("slotId", "artistProfileId")
  WHERE "status" = 'SUBMITTED'::"ProposalStatus";
```
The previous `UNIQUE(slot_id) WHERE status='accepted'` / `(slot_id, artist_profile_id) WHERE status='submitted'` phrasing (snake_case columns, lowercase enum literals) does not match the generated schema and would fail the migration outright rather than create either safety constraint. An integration test queries `pg_indexes` (or `pg_get_indexdef`) after migration and asserts both indexes exist with these exact predicates, catching a silent identifier mismatch before the application is built on top of it.

Rollback per proposal §9 (git revert, Vercel redeploy, seed-only data).

## Open Questions

None blocking implementation. The four open questions raised in `reviews/codex-planning-review.md` were resolved in the prior revision: (1) closing a Slot explicitly and auditably rejects its outstanding Proposals (B2, `closeSlot`); (2) Admin can deactivate an `active` Profile, with immediate session invalidation (M3, D7); (3) the public Event projection is the D6 allow-list (title, description, scheduledAt, durationMinutes, artist display name only); (4) rejected-profile re-registration reactivates the same Profile (`rejected → pending`), not a new one (M2).

The three open questions raised in `reviews/codex-pr2-plan-review.md` are resolved by this revision: (1) `MatchingUnitOfWork` owns transactional reads via the `withLockedSlot(slotId, work)` callback — repositories do not separately expose ad hoc `FOR UPDATE` reads (D4); (2) a duplicate same-Artist submission to the same open Slot returns `ConflictError` — one open Proposal per Artist per Slot, enforced by the `("slotId","artistProfileId") WHERE "status" = 'SUBMITTED'` partial unique index as belt-and-braces (M2); (3) a Postgres-backed rate limiter is accepted for the Vercel/Postgres deployment target, with hashed/truncated IP storage and a documented rolling-window retention/cleanup policy (M4, D7). Noted risk (resolved, not just flagged): the exact partial-unique-index SQL against Prisma's generated identifiers is now specified above (B1).
