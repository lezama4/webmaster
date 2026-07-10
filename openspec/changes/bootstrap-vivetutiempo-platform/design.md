# Design — bootstrap-vivetutiempo-platform (Block 1: Core)

**Stack (fixed):** Next.js (App Router + Route Handlers) + TypeScript + Tailwind + PostgreSQL/Prisma + Vitest/Playwright. Clean/Hexagonal in one repo. Docker only for local Postgres. Deploy: Vercel + managed Postgres.

## Technical Approach

A hexagonal monolith: pure `domain/` (entities + state machines), `application/` (use cases + ports), `infrastructure/` (Prisma/auth adapters), and Next.js as the delivery mechanism. The key invariant (accept one Proposal → publish Event, fill Slot, auto-reject rivals) is a pure domain decision persisted atomically by one transactional adapter. Blocks 2/3 stay cheap: role-generic accounts, `completed` Event state, and the ports-first pattern leave additive seams — nothing for them is built now.

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

### D4 — Concurrency: pure domain decision + transactional guarded write, coordinated across submit/approve/close
**Choice:** `approveProposal` use case loads Slot + its Proposals, calls pure domain op `acceptProposal(slot, proposals, proposalId, clock)` → returns new Slot/Proposal states + Event to create. A single `MatchingUnitOfWork` port persists the outcome in one DB transaction with a guarded update (`UPDATE slots SET status='filled' WHERE id=? AND status='open'`; 0 rows → abort/conflict error). Belt-and-braces: partial unique index `UNIQUE(slot_id) WHERE status='accepted'` on proposals (raw SQL in migration — Prisma schema can't express partial uniques).

**Fix (accepted review B1 — BLOCKER):** the guarded `UPDATE` alone does not serialize `submitProposal` against a concurrent `approveProposal`/`closeSlot`. A submit request can read the Slot as `open`, then an approval fills the Slot and auto-rejects the Proposals it saw, and only afterward the pending submit inserts a new `submitted` Proposal into a Slot that is already `filled` — an actionable Proposal outside the auto-reject cascade. **All three transitions that depend on Slot openness — `submitProposal`, `approveProposal`, `closeSlot` — MUST coordinate on the same Slot row inside one transaction:** either `SELECT ... FOR UPDATE` on the Slot row before evaluating/writing, or an atomic `INSERT ... SELECT ... WHERE slot.status = 'open'` guard for the insert path (0 rows affected → `ConflictError`, mirroring the existing guarded-update pattern). `MatchingUnitOfWork` is extended to serialize all three operations through this shared row-lock/guard, not only the approve path; `closeSlot`'s cascade-reject (see Domain Model) commits through the same unit of work.

**Rejected:** optimistic version column (more machinery, same guarantee); serializable isolation (retry complexity).

### D5 — App Router placement
Next.js requires `src/app`; it is the UI-layer *entry* (thin pages + route handlers), while `src/ui` holds presentational components. Documented adaptation of the four-layer rule to a Next constraint.

### D6 — Public Event projection: allow-list DTO, not a Prisma `include`
**Choice (accepted review M4):** public, unauthenticated browsing (`listPublishedEvents`) MUST return a dedicated `PublicEventProjection` DTO built field-by-field, never a raw Prisma model or an `include`d relation. Allowed fields: `title`, `description`, `scheduledAt`, `durationMinutes`, and the artist's public display name (`Profile.name` of the accepted Proposal's Artist). Forbidden, always: exact `location` (ward/room), the accepted `Proposal.message`, any email, and any internal/database identifier (Slot id, Proposal id, Profile id, Account id — a public-safe `Event.publicId` or the `Event.id` used only as an opaque browsing key is acceptable, but nothing else internal leaks alongside it).
**Rationale:** a hospital's exact location and an artist's private message are sensitive-by-context even though the demo data is fictional; an `include`-based projection is one refactor away from leaking them. An explicit allow-list DTO makes the boundary testable (a no-leak test asserts the forbidden fields are structurally absent, not just empty).
**Rejected:** returning the Event entity/aggregate directly and relying on the frontend to not render sensitive fields — fails defense-in-depth, and the API response itself would leak to anyone inspecting network traffic.

### D7 — Session lifecycle & CSRF hardening
**Choice (accepted review M3):** beyond D1's cookie attributes and DB-backed sessions:
- **Expiry:** each session row carries an absolute expiry (e.g. 12h from issuance) and an idle expiry (e.g. 30min since last use); either lapsing invalidates the session.
- **Rotation:** a new session id is issued on every successful login (never reuse/extend a pre-auth session id) — mitigates session fixation.
- **Revocation:** logout deletes the session row (not just clears the cookie). `SessionPort` exposes `revokeAllForAccount(accountId)`, called whenever a Profile transitions `active → deactivated` or `pending/active → rejected` (Admin action), so all of that account's live sessions are invalidated immediately — this is the concrete mechanism behind D1's "JWT can't be revoked" rejection.
- **Brute-force:** login attempts are rate-limited per account + per IP within a rolling window; repeated failures return a generic error (no user-existence oracle).
- **CSRF:** `SameSite=Lax` reduces but does not eliminate CSRF for state-changing GET-adjacent or cross-site form flows. Every authenticated mutation route handler additionally checks the request's `Origin` (falling back to `Referer`) against the app's own `Host`, rejecting mismatches with 403 — an explicit CSRF policy, not an implicit one.
**Rejected:** relying on `SameSite=Lax` alone (insufficient per OWASP for a hospital-context governance app); token-based CSRF (double-submit cookie) — more moving parts than an Origin/Host check for a same-origin monolith with no third-party embeds.

## Domain Model

| Aggregate | Fields (key) | State machine |
|---|---|---|
| Account | email (unique), passwordHash, role: ADMIN\|HOSPITAL\|ARTIST\|PATIENT | — |
| Profile | accountId (unique), type: HOSPITAL\|ARTIST, name, status | pending → active \| rejected; active → deactivated (Admin, M3); rejected → pending (re-registration, same profile, M2) |
| Slot | hospitalProfileId, D3 fields, status | open → filled \| closed (owning Hospital's `closeSlot`, cascades reject — B2) |
| Proposal | slotId, artistProfileId, message, status | submitted → accepted \| rejected |
| Event | slotId (unique), proposalId (unique), title, status | created → published → completed |

Domain rules enforced in `domain/` (framework-free): only `active` profiles act, re-checked live on every mutating call — a Profile that became `rejected`/`deactivated` after session issuance MUST fail the action in `application/`, not rely on the session snapshot (M6); only owner Hospital decides; accept requires Slot `open`; accept cascade is one operation; Event auto-publishes on accept. Resubmit-after-reject allowed: partial unique `(slot_id, artist_profile_id) WHERE status='submitted'`.

**Profile transitions (accepted review M2/M3):**
- `rejected → pending`: a rejected Hospital/Artist re-registering reactivates the **same** `Profile` row (not a new one, not a new Account) — preserves `Profile.accountId` unique and full review traceability. Recorded as a new review request (e.g. a `reviewRequestedAt` timestamp update / append-only review-history row), not a silent flip.
- `active → deactivated`: Admin-only. Deactivation is terminal-in-practice for Block 1 (no `deactivated → active` reactivation path defined yet — out of scope until a real need surfaces) and MUST synchronously invalidate every live session for that Profile's Account (`SessionPort.revokeAllForAccount`, see D7).

**Slot `closeSlot` (accepted review B2):** the owning Hospital MUST be able to close/withdraw its own `open` Slot. `closeSlot` is a domain operation, `closeSlot(slot, proposals, clock) → {closedSlot, rejectedProposals[]}`, mirroring `acceptProposal`'s shape: it transitions the Slot to `closed` **and** transitions every `submitted` Proposal against it to `rejected` explicitly and auditably in the same operation — no Proposal is left orphaned in `submitted` against a non-open Slot. Denied on a Slot that is not `open` (already `filled` or `closed`). Persisted atomically via the same `MatchingUnitOfWork` coordination as `submitProposal`/`approveProposal` (D4).

**Slot invariants (accepted review N2):** enforced at construction/validation in `domain/slot/Slot.ts` — `scheduledAt` MUST be strictly in the future at creation time (relative to the injected `Clock`, never `Date.now()` directly — keeps the rule testable); `durationMinutes` MUST be a positive integer; `title`, `description`, and `location` MUST satisfy sane, explicit length bounds (e.g. title 3–120 chars, description ≤ 2000 chars, location 1–200 chars) so a Slot can never be constructed with a past date, non-positive duration, or degenerate/oversized text. Violations raise a domain validation error, not a Prisma/DB constraint failure.

**`listOpenSlots` visibility (accepted review N2):** only `active` Artists (authenticated) may call `listOpenSlots`; it returns fields needed to decide whether to propose — `title`, `description`, `scheduledAt`, `durationMinutes`, `location`, owning Hospital's public name — and excludes Slots that are `filled`/`closed` or whose `scheduledAt` has already passed. This listing is Artist-authenticated and internal-facing; it is intentionally richer than the public `PublicEventProjection` (D6), which never exposes `location`.

## Application Layer

Use cases: `registerProfile` (branches to `rejected → pending` reactivation of the same Profile when one already exists for the Account — M2), `login`/`logout`, `validateProfile` (Admin), `deactivateProfile` (Admin-only, `active → deactivated`, cascades `SessionPort.revokeAllForAccount` — M3), `publishSlot`, `listOpenSlots`, `submitProposal` (open-Slot guard coordinated with approve/close — D4), `approveProposal`, `rejectProposal`, `closeSlot` (owner-Hospital-only, cascades reject on outstanding Proposals — B2), `listPublishedEvents` (public, returns `PublicEventProjection` allow-list — D6), plus owner listings. Each receives an `Actor` context and enforces **role + ownership + live Profile status** (defense in depth vs UI/route checks; a Profile that turned `rejected`/`deactivated` after session issuance MUST still be denied — M6).

Ports: `AccountRepository`, `ProfileRepository`, `SlotRepository`, `ProposalRepository`, `EventRepository`, `MatchingUnitOfWork`, `SessionPort` (incl. `revokeAllForAccount`, session rotation on login), `PasswordHasher`, `Clock`, `IdGenerator`. (Block 3 later adds `PaymentGateway` here — port slot only, not now.)

## Approve-Proposal Sequence

```
Hospital UI → route handler: POST /api/slots/{id}/proposals/{pid}/approve
  handler: session → Actor (401/403 if none/inactive)
  → approveProposal use case
      loads Slot+Proposals (proposal.slotId MUST match the URL's slotId — else 403/404, M6)
      checks actor owns Slot (403); re-checks actor Profile is live-`active` (403, M6)
      domain.acceptProposal(...) → {filled Slot, accepted P, rejected P*, published Event} | DomainError
      → MatchingUnitOfWork.commit(outcome)   [ONE tx: SELECT ... FOR UPDATE (or
        equivalent atomic guard) on the Slot row, guarded slot update,
        proposal updates, event insert; guard failure or unique-index hit → ConflictError 409]
  ← 200 event | 409 on race | 403 on stale/foreign actor or mismatched proposal/slot
```

## Submit-Proposal Sequence (race-guarded — accepted review B1)

```
Artist UI → route handler: POST /api/slots/{id}/proposals
  handler: session → Actor (401/403 if none/inactive/non-Artist)
  → submitProposal use case
      loads Slot; checks Slot is (still, live) open
      → MatchingUnitOfWork.commit(insert)   [SAME row-lock/guard as approve/close:
        SELECT ... FOR UPDATE on the Slot row, or atomic
        INSERT ... SELECT ... WHERE slot.status = 'open'; 0 rows → ConflictError]
  ← 201 Proposal | 409 if the Slot left `open` between the read and the commit
```

## Close-Slot Sequence (accepted review B2)

```
Hospital UI → route handler: POST /api/slots/{id}/close
  handler: session → Actor (401/403 if none/inactive)
  → closeSlot use case
      loads Slot+Proposals; checks actor owns Slot (403); checks Slot is open (else denied)
      domain.closeSlot(...) → {closedSlot, rejectedProposals[]} | DomainError
      → MatchingUnitOfWork.commit(outcome)   [ONE tx, same row-lock/guard as
        submit/approve: guarded slot update to `closed` + cascade proposal
        updates to `rejected`]
  ← 200 closedSlot | 409 on race | 403 non-owner or already non-open
```

## File Changes (greenfield — key creations)

| Path | Purpose |
|---|---|
| `src/domain/{account,profile,slot,proposal,event}/` | Entities, state machines, `acceptProposal`, `closeSlot`, domain errors, Slot invariants |
| `src/application/{use-cases,ports,dto}/` | Use cases + port interfaces + `PublicEventProjection` DTO (D6) |
| `src/infrastructure/persistence/prisma/` | Prisma repos + `MatchingUnitOfWork` (`$transaction`, row-lock/guard shared by submit/approve/close) |
| `src/infrastructure/auth/` | Session adapter (expiry/rotation/revocation, D7), argon2 hasher, login rate-limiter, CSRF Origin/Host check |
| `src/app/` | Pages + route handlers (thin; Zod validation at boundary) |
| `src/ui/` | Presentational components (Tailwind) |
| `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` | Schema + partial-unique raw SQL + seed |
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
| Unit (Vitest) | Use cases: role/ownership/status errors, live-status re-check, `closeSlot`, `deactivateProfile`, re-registration branch, public-projection field allow-list | In-memory fake adapters implementing ports |
| Integration (Vitest) | Prisma repos, tx guard — **interleaved `submitProposal`/`approveProposal` race (B1, not just two approvals)**, `closeSlot` cascade persistence | Docker Postgres |
| E2E (Playwright) | Full demo chain + public browsing + `closeSlot` flow + authorization edge-case matrix (M6) + public no-leak assertions (M4), per seeded creds | Against seeded app |

**Strict TDD is ACTIVE (accepted review N1 — resolves the proposal-vs-design contradiction):** now that the Vitest/Playwright runner is scaffolded (Phase 1, done), strict test-first (RED → GREEN → REFACTOR, one commit or clearly separated diff per step) applies to every `domain/` and `application/` task from this point forward — it is no longer merely a future target. `infrastructure/`/`ui/` stay pragmatic (tests follow the code, still required). Expected evidence for the TFM defense: a RED commit/diff showing the failing test before its implementation, for each domain/application task in `tasks.md`. `sdd-init`'s cached `strict_tdd` flag should be refreshed to reflect this (tracked outside this change's scope — see report).

## Data & Privacy Stance (accepted review N3 — supersedes proposal §6/§8's "no PII" framing)

The proposal's "no PII beyond lightweight accounts" / "published Events contain no sensitive data" framing is imprecise and would not hold up under scrutiny. This design instead commits to **data minimization**:
- **What is held:** account email + password hash (credentials); Profile display name (Hospital/Artist); Slot `location` (ward/room — sensitive-by-context in a hospital, never exposed publicly, see D6); the accepted Proposal's `message` (private, Hospital-only). No health data, no patient identity is collected in Block 1 (Patient/Family is anonymous browsing only).
- **Legal basis / notice:** for a TFM demo, all data is fictional seed data; a production deployment would need explicit consent/notice at registration (legitimate-interest or consent basis for Hospital/Artist account data) before handling real staff/artist information — flagged as a pre-production requirement, not built now.
- **Retention:** seed/demo data has no retention policy (ephemeral, reset on reseed). A production system would need an explicit retention window per data class (credentials, profile, Slot/Proposal history) — out of scope for Block 1, noted for Block 2/3 planning.
- **Deletion:** no user-facing deletion flow exists in Block 1 (no real personal data at stake in the demo). A production system needs an account-deletion procedure (cascading Profile/Slot/Proposal handling, or anonymization if traceability must survive) before onboarding real users — explicitly deferred, not silently assumed away.

## Migration / Rollout

Greenfield — no migration. Rollback per proposal §9 (git revert, Vercel redeploy, seed-only data).

## Open Questions

None blocking implementation. The four open questions raised in `reviews/codex-planning-review.md` are resolved by this revision: (1) closing a Slot explicitly and auditably rejects its outstanding Proposals (B2, `closeSlot`); (2) Admin can deactivate an `active` Profile, with immediate session invalidation (M3, D7); (3) the public Event projection is the D6 allow-list (title, description, scheduledAt, durationMinutes, artist display name only); (4) rejected-profile re-registration reactivates the same Profile (`rejected → pending`), not a new one (M2). Noted risk (unchanged): Prisma partial unique indexes require raw SQL migrations — flag in tasks.
