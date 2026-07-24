# Design — auditable-profile-approval

**Depends on:** `bootstrap-vivetutiempo-platform` (D1–D8, deployed), `hospital-finder-and-home-clarity` (D9–D15, deployed) and `widen-beyond-hospitals` (D16–D20). **ADR numbering continues the single register — the last change owned D16–D20, so this change owns D21–D27.**

**Strict TDD is ACTIVE** for every `domain/` and `application/` task here (carried forward). The new domain invariants — a status transition CANNOT be produced without a valid, attributed review record (D21/D24) — are RED-first: the failing test (a blank basis throws before any status change; the returned pair carries the acting admin id and a clock timestamp) precedes the change. `infrastructure/`/`ui/` stay pragmatic; the migration (D25) is proven against real Postgres before it is trusted.

## Technical Approach

The whole change rests on one structural move, made once in the domain and reused by all three transitions: **an admin status transition stops being a pure status flip and becomes a status flip that also emits an attributed, reasoned, append-only review record — and the two are inseparable.** Today `approveProfile(profile)` returns a new `Profile` and records nothing (`Profile.ts:293`, verified). After this change the three admin transitions each take **who** (the acting admin's account id), **why** (a validated basis note) and a **clock**, and return **both** the transitioned `Profile` **and** a `ProfileReview` record. Because the basis is validated *inside* that function, a blank or over-long basis throws **before** any status changes — you cannot obtain the `active` Profile without also producing a valid record of who approved it and on what stated basis.

That inseparability is what makes the control real rather than cosmetic. A UI-only "reason" field is bypassed by a scripted `POST`; a domain that lets you flip the status and *optionally* log a reason drifts into unlogged approvals the first time a code path forgets. Coupling the record to the transition at the domain boundary means the accountability holds for **every** caller — the route, a future admin CLI, a test — with no discipline required of the caller beyond supplying the arguments the type already demands.

Everything else hangs off that move and is deliberately small: the record is persisted in the **same** `withLockedProfile` transaction that already carries the transition and its session-revocation cascade (D23), so atomicity is inherited, not invented. The record is **append-only** (D21), so the reject→re-apply→approve cycle keeps every decision instead of overwriting. The basis is a **bounded, trimmed, non-blank** string (D24). The migration is **purely additive** and **never fabricates** a basis for pre-existing rows (D25). The audit data is structurally off the public projections and the D14 guard is extended to name it (D26). And the *only* role-aware part — the prompt that cues institutional verification for a centre and identity+safeguarding for an artist — is **UI/i18n copy** (D27); the domain treats both roles identically and just requires a valid string.

**Deliberately deferred (proposal §3, honoured here):** the real-world verification machinery — collaboration-agreement (convenio) flow, certificate/accreditation upload, background-check integration, out-of-band contact tooling. This change builds the *accountable decision*; those build the *evidence the decision is based on*. They are the named T-22 follow-on, to be built if the site goes public with real data. Recorded as planned future work, not oversight.

## Architecture Decisions (ADRs)

### D21 — An append-only `ProfileReview` record, NOT last-decision fields on `Profile`

**Choice.** Persist each admin decision as a row in a new **append-only** `ProfileReview` table — `(id, profileId, adminAccountId, decision, basis, createdAt)` — never updated, never deleted. Do **not** store the audit as `reviewedBy` / `reviewedAt` / `reviewBasis` columns on `Profile`.

**Why the append-only record and not fields-on-Profile.** The Profile state machine is a **cycle**, not a one-shot: `pending → rejected` (M1), `rejected → pending` (re-registration, M2, `reactivateProfile`), `pending → active`, `active → deactivated` (M3) — all verified in `Profile.ts:293–317`. So a single Profile can legitimately accumulate **several** admin decisions over its life: rejected ("no verifiable convenio"), re-applied, approved ("convenio VTT-2026-014 confirmed by phone"), later deactivated ("convenio lapsed"). **Last-decision fields overwrite the reject basis the moment the re-applied profile is approved — destroying exactly the evidence this change exists to create.** An audit trail whose defining property is that it discards prior decisions is not an audit trail; it is a status field with extra columns.

**Why this is still the LEAN choice, not scope creep.** "No nos columpiamos" governs the *offline verification flow* (convenio, cert upload, background checks — proposal §3), which we are **not** building. An append-only decision log is squarely **inside** the auditable-decision scope, and it is barely more code than three nullable columns: one Prisma model, one additive migration, one append method on the transaction context, one domain factory. It is also **simpler to reason about** than mutable last-write-wins fields — immutable rows have no update path to get wrong, no partial-update race, no "did we remember to clear the stale basis on re-review?" edge case. Correct **and** lean.

**What fields-on-Profile would have cost (stated explicitly, since it was the alternative).** Choosing three nullable columns on `Profile` would have kept only the **most recent** decision. Lost: the reject reason once a re-applied profile is approved, and the approval reason once a profile is deactivated. For a change whose entire purpose is answering "on what basis did this powerful node enter?", silently dropping the prior answer on the next transition is unacceptable — so fields-on-Profile is rejected even though it is marginally less code.

**Shape.** `ProfileReview` is **immutable after creation** (no domain mutator, no repository update/delete). `decision` is a closed enum `APPROVE | REJECT | DEACTIVATE` (a real Prisma enum, matching the `ProfileStatus`/`Audience` precedent — a typo'd decision cannot be persisted). `profileId` is an FK to `profiles.id`; `adminAccountId` references the acting admin's Account (not a hard FK-to-self requirement if it complicates the migration — a stored id string is sufficient for the audit purpose, decided at the migration task). Ordering is by `createdAt` (and `id` as a stable tiebreaker).

### D22 — All three admin decisions record a basis; applicant re-registration does not

**Choice.** `approveProfile`, `rejectProfile` and `deactivateProfile` each REQUIRE and record a basis. `reactivateProfile` (`rejected → pending`) does **NOT**.

**Why all three admin decisions.** Each is an admin governance act with accountability weight, and each answers a distinct question:
- **Approve** — the load-bearing one: on what verification did the most powerful node (a centre) or a physically-present actor (an artist) enter?
- **Reject** — useful to the applicant: the recorded reason is what lets a re-registration be a *correction* rather than a blind retry. (It is admin-only and never auto-disclosed raw; how much is surfaced to the applicant is a spec/copy decision, not a domain one.)
- **Deactivate** — arguably the highest-stakes: revoking an already-active, already-trusted node. "Why was this centre pulled?" must be answerable, especially for a safeguarding-driven deactivation.

**Why re-registration does NOT record a basis.** `reactivateProfile(profile, clock)` is the **applicant's** action (invoked from `registerProfile`, `:129`, after the applicant proves control of the account), not an admin decision. It already leaves a durable trace — `reviewRequestedAt` — that timestamps *the applicant asking for re-review*. Attaching an admin "basis" to an applicant-initiated transition would be a category error. The applicant's re-application simply re-enters the queue; the **admin's** next decision on it is what records the next basis. So the audit register grows by one row per **admin** decision, cleanly.

### D23 — The acting admin's identity flows as a use-case argument and the record commits atomically with the transition

**Choice.** The domain transition functions gain an explicit `adminAccountId` parameter; the use case passes `actor.accountId` (the resolved, live-session admin) into them, and the resulting `ProfileReview` is persisted **inside the same `withLockedProfile` transaction** as the status change and the session-revocation cascade.

**Why an argument, never a session read.** `Actor.accountId` is "sourced from the resolved, live session — NEVER from client-supplied input" (`Actor.ts:6`, verified). `validateProfile` and `deactivateProfile` already run under `assertRole(actor, "admin")` with that `actor` in hand. The domain stays **pure and infrastructure-free**: it does not read a session, a global, or an ambient context — it takes `adminAccountId` as a parameter, exactly as `reactivateProfile(profile, clock)` already takes its `Clock` as a parameter rather than reaching for `Date.now()`. This keeps the domain testable and closes R3 (a spoofed admin id): the id is the authenticated caller's, resolved server-side, never a value the request body can set.

**Why atomic with the existing unit of work.** Both use cases already commit through `ProfileUnitOfWork.withLockedProfile` (`ProfileUnitOfWork.ts:41`), whose contract is that "a failure between steps leaves no partial state" (D7). The review write MUST join that unit — otherwise a crash could commit the `active` status with no record, or a record with no status change (R6). Concretely, the `LockedProfileContext` (`:9`) gains an append method, e.g. `saveReview(review: ProfileReview): Promise<void>`, and the use case calls it alongside `ctx.saveProfile(updated)` and (on reject/deactivate) `ctx.sessions.revokeAllForAccount(...)`, all in the one transaction. No new transaction, no second round-trip, no partial-state window.

**Domain signature shape (proven RED-first).** The three functions return **both** artifacts so the transition cannot be taken without emitting the record:

```
approveProfile(profile, { adminAccountId, basis, reviewId }, clock): { profile: Profile, review: ProfileReview }
rejectProfile(profile,  { adminAccountId, basis, reviewId }, clock): { profile: Profile, review: ProfileReview }
deactivateProfile(profile, { adminAccountId, basis, reviewId }, clock): { profile: Profile, review: ProfileReview }
```

`reviewId` is supplied by the use case from the existing `IdGenerator` port (`registerProfile.ts:11`/`:141` precedent); `clock` from the existing `Clock` port. The basis is validated first (D24), so an invalid basis throws before the status flip. (The exact grouping of parameters vs. a small `ReviewContext` object is a spec detail; the invariant is what matters: no transitioned Profile without a valid, attributed review.)

### D24 — Basis validation: non-blank, bounded, trimmed, enforced in the domain

**Choice.** The basis is a required `string`, **trimmed once**, rejected when empty after trimming, and rejected when it exceeds a bounded maximum. Validation lives in the domain transition (a blank/over-long basis throws `DomainValidationError`), not only in the route or the form.

**Rules, concretely.**
- **Non-blank.** Reuse the codebase's existing discipline — `assertNonEmpty(field, value)` (`Profile.ts:124`) already rejects `value.trim().length === 0` with a `DomainValidationError`. The basis uses the same check. A whitespace-only note is denied at the domain (R2): the UI cannot be the only gate, because a scripted `POST /api/admin/profiles/[id]/approve` bypasses the UI entirely.
- **Bounded.** A new `MAX_REVIEW_BASIS_LENGTH` constant caps the trimmed length (proposed **1000** characters — enough for "Convenio VTT-2026-014 verified by phone with the centre's named contact on 2026-07-20", not an essay). This directly serves T-15 ("bound and normalise text"): an unbounded audit note is a storage-abuse and rendering vector (R7). 1000 vs. a tighter 500 is a spec/policy call; the design fixes the *presence* of a bound and the constant's location, the exact number is confirmable at spec time.
- **Trimmed and stored trimmed.** Read the raw input once, trim once, validate the trimmed value, persist the trimmed value — the same read-once/field-by-field discipline the factories use (`createProfile`, `:229`). No re-reading, no validating one value and storing another.
- **Domain-level.** The route may (and should) reject early for a friendly error, but the **authoritative** check is in the domain function, so every caller inherits it — matching the project's established "enforced server-side too, the use case does not trust the form" stance (`registerProfile.ts:29`, verified).

### D25 — Additive migration; legacy profiles read as "no basis recorded", never back-filled

**Choice.** A **Prisma-generated** migration (not hand-written) adds the `ProfileReview` table and the `ReviewDecision` enum. It is **purely additive**: no existing column changes, no existing `profiles` row is touched. Pre-existing `active` / `rejected` / `deactivated` profiles have **zero** `ProfileReview` rows and read as **"legacy: no basis recorded."**

**Why Prisma-generated is safe here (unlike D17).** D17 had to be hand-written because Postgres enum-value **RENAME** is invisible to Prisma's declarative diff and would generate a destructive DROP-and-recreate. This change introduces a **brand-new table and a brand-new enum** — the shape Prisma's diff models correctly and non-destructively. So we edit `schema.prisma` (new `model ProfileReview`, new `enum ReviewDecision`, a back-relation on `Profile`) and run `prisma migrate dev`; the generated SQL is reviewed before it is trusted, but it needs no hand-authoring. It references neither `AccountRole` nor `ProfileType`, so it cannot disturb the D17 enums or the D4 partial-unique indexes.

**Why legacy rows are NOT back-filled.** Every existing profile predates the control; there is **no** true record of who approved it or why. Inventing a placeholder basis ("legacy", "pre-audit", or worse a plausible-looking sentence) would write **false evidence** into an audit table — strictly worse than an honest absence (R5). The correct reading of "this profile has no `ProfileReview` rows" is exactly what it is: **the decision predates auditing.** The queue/admin surface renders that as an explicit, non-fabricated label (an `AdminProfiles.review.legacy` i18n string, e.g. "Sin base registrada (anterior a la auditoría)"). The absence is data; it is not filled in.

**No data loss (proposal §5).** Additive DDL only; not one Profile row is rewritten or dropped. Down path: drop the `ProfileReview` table and the `ReviewDecision` enum — clean and total, because nothing else references them and the Profile rows never changed. The recorded audit history is lost on a down-migration, which is the correct semantics for reverting the feature.

### D26 — Audit data never reaches any public projection; the D14 guard is extended to name it

**Choice.** Review basis, `adminAccountId` and review timestamps are **structurally absent** from both public surfaces, and the D14 forbidden-key compile assert on `PublicHospitalProjection` is **extended** to name the new fields so an accidental future edit fails `tsc`.

**Why it is already structurally safe.** The audit lives in a **separate table** (`ProfileReview`), not on `Profile`. Both public read paths are explicit allow-lists rebuilt **field-by-field**:
- `PublicHospitalProjection` (`PublicHospitalProjection.ts:38`, verified) exposes **exactly** `name, city, postalCode, latitude, longitude, centreType` — six fields — and `PublicHospitalDirectoryQuery` `select`s only those columns from `profiles`. A `ProfileReview` row is on a different model; it cannot appear in a `profiles` `select`, and nothing joins it in.
- `PublicEventProjection` (D6) carries no centre identity at all, so there is nothing for the audit data to attach to (the D10 non-correlation assessment is unchanged).

**Why extend the D14 guard anyway (belt and suspenders).** The `ForbiddenPublicHospitalKey` union + `_NoForbiddenFields` compile assert (`PublicHospitalProjection.ts:48–77`, verified) fails `tsc` if the projection interface ever gains a **named** forbidden key. It does **not** auto-block arbitrary unknown keys — the real guarantee is the field-by-field rebuild, which only ever copies the six allow-listed fields. But naming the audit fields (`reviewBasis`, `reviewedBy` / `adminAccountId`, `reviewedAt`, and a `reviews` relation key) in `ForbiddenPublicHospitalKey` makes the intent **explicit and compiler-enforced**: if a future contributor tries to surface "last approved by" on the directory, `tsc` stops them at the interface edit, before any test runs. Cost is three or four union members; value is a permanent, reviewed statement that audit data is public-forbidden. The existing exact-key-set / no-leak tests (`listPublicHospitals.test.ts`, the E2E raw-JSON assertion) are re-run unchanged in intent and continue to assert the exact six keys and the absence of every forbidden value.

**Admin queue MAY carry it (it is authenticated).** `PendingProfileView` (the admin-only DTO) is authorized (admin-only, `listPendingProfiles.ts:26`), so if the queue chooses to show a re-applied profile's **prior** reject basis as context, that is permissible — it is not a public surface. Any such addition is still a deliberate allow-list edit on that DTO, not a spread of a query result (the file's existing D6 discipline, `:35`).

### D27 — Role-specific verification prompt is UI/i18n; the domain requires only a valid string

**Choice.** The basis input shows a **role-specific prompt/placeholder** that cues the verification relevant to that role's risk — but this lives entirely in **UI copy and i18n**, not in the domain. The domain requires a non-blank, bounded string (D24) regardless of role.

**The two prompts (final wording is the copy phase's; `eu` is DRAFT pending native review, per the D20 R9 gate):**

| Role | The prompt cues (the admin is asked to attest…) | es (draft) | en (draft) |
|---|---|---|---|
| **centre** | **institutional** verification: the collaboration agreement / convenio reference, or the out-of-band contact with the named institution that confirmed it is a real care centre | "Base de verificación: convenio/nº de referencia o contacto directo (fuera de plataforma) con el centro que confirma su identidad institucional." | "Verification basis: agreement/reference no. or out-of-band contact with the centre confirming its institutional identity." |
| **artist** | **identity + safeguarding attestation**: how the artist's identity was checked and that a safeguarding expectation was set for presence with vulnerable people | "Base de verificación: identidad comprobada y compromiso de protección (safeguarding) para la presencia con personas vulnerables." | "Verification basis: identity checked and safeguarding commitment recorded for presence with vulnerable people." |

**Why the role-split is copy, not code.** The **risk asymmetry** (proposal §2) is real — a centre's approval concentrates institutional power, an artist's authorises physical presence — and the prompt should reflect it so the admin is asked the *right* question. But encoding that split in the domain (a `centreBasis` vs `artistBasis` type, or a role-conditional validation) buys nothing: the stored artifact is the same shape (an attributed, bounded note), the accountability property is identical, and a role-conditional domain rule would be a second place for the two axes to couple for no invariant gain. The domain stays **role-blind on the basis**; the UI reads the profile's `type` (already present in `PendingProfileView`) to pick the prompt string. Adding a role — or refining a prompt — is then an i18n edit, never a domain change.

**Honesty gate (R8, into the threat model).** The prompt asks the admin to **attest** to a verification; it does **not** perform one. No copy — prompt, help text, or doc — may state or imply that the platform *verified* a convenio or *ran* a background check. The built control is "an accountable human decision with a recorded, role-cued basis"; the actual verification is the admin's offline responsibility and, at scale, the named future work. This wording constraint is recorded in the threat model alongside T-22.

## Domain and Wiring Detail

**Domain** (`src/domain/profile/Profile.ts`):
- New `ProfileReview` type — `{ id, profileId, adminAccountId, decision: ReviewDecision, basis: string, at: Date }` — immutable, obtained only via a `recordReview`-style factory that validates the basis (D24).
- New `ReviewDecision = "approve" | "reject" | "deactivate"` union (+ array + `assertValidReviewDecision`, mirroring `assertValidCentreType`).
- `approveProfile` / `rejectProfile` / `deactivateProfile` change signature (D23): take `(profile, { adminAccountId, basis, reviewId }, clock)`, return `{ profile, review }`. Basis validated **before** the `assertStatus` status flip's result is returned (both throw paths keep the profile unchanged).
- `MAX_REVIEW_BASIS_LENGTH` constant + a bounded/non-blank basis assertion.
- `reactivateProfile` is **unchanged** (D22 — applicant action).

**Application** (`src/application/`):
- `Actor` unchanged — `actor.accountId` is the admin id source (D23).
- `ValidateProfileInput` gains `basis: string`; `DeactivateProfileInput` gains `basis: string`.
- `validateProfile.ts` / `deactivateProfile.ts`: call the new domain signatures with `actor.accountId`, `deps.idGenerator.next()`, `deps.clock`; persist the returned review via the new `ctx.saveReview(...)`. `ValidateProfileDeps` / `DeactivateProfileDeps` gain `idGenerator` + `clock` (both already exist as ports).
- `ProfileUnitOfWork.LockedProfileContext` gains `saveReview(review: ProfileReview): Promise<void>` (D23 — atomic append).
- New `ProfileReviewRepository` port (or fold append into the UoW context only — decided at spec: the UoW-context append is the minimum; a standalone read repository is only needed if the queue surfaces history).

**Persistence** (`src/infrastructure/persistence/prisma/`):
- `schema.prisma`: `model ProfileReview` + `enum ReviewDecision` + `Profile.reviews ProfileReview[]` back-relation; Prisma-generated migration (D25).
- `mappers.ts`: `REVIEW_DECISION_TO_DOMAIN` / `_TO_PRISMA`; `toDomainProfileReview`.
- The `withLockedProfile` adapter implements `saveReview` as a transaction-scoped `profileReview.create`.

**HTTP** (`src/app/api/admin/profiles/[id]/{approve,reject,deactivate}/route.ts`):
- Parse and pass `basis` from the request body (currently these routes send no body — the fetch in `ProfileRowActions.tsx:16` posts an empty body; it will now send `{ basis }`). Coerce/guard as the codebase does (`String(...)` today; the domain is the authoritative validator, D24).

**UI** (`src/app/admin/profiles/`):
- `ProfileRowActions.tsx` gains a basis textarea (role-cued placeholder from D27 i18n) required before approve/reject can submit; deactivate (wherever it is triggered) likewise.
- `page.tsx` may render a legacy/basis label (D25/D26) — authenticated surface.
- `messages/{es,eu,en}.json`: `ProfileActions.basis.*` (centre/artist prompts), `AdminProfiles.review.legacy`. `eu` DRAFT, native-review gate (D20 R9).

## New and Changed Files

| Path | Status | Purpose |
|---|---|---|
| `prisma/schema.prisma` | EDIT | `ProfileReview` model, `ReviewDecision` enum, `Profile.reviews` back-relation (D25) |
| `prisma/migrations/<ts>_profile_review_audit/migration.sql` | NEW | Prisma-generated additive table+enum (D25) |
| `src/domain/profile/Profile.ts` | EDIT | `ProfileReview`, `ReviewDecision`, basis bound; three transitions return `{ profile, review }` (D21–D24) |
| `src/application/Actor.ts` | — | Unchanged; `accountId` is the admin id source (D23) |
| `src/application/ports/ProfileUnitOfWork.ts` | EDIT | `LockedProfileContext.saveReview` (D23) |
| `src/application/ports/ProfileReviewRepository.ts` | NEW (if history is read) | Read side, only if the queue surfaces prior basis (D26) |
| `src/application/use-cases/validateProfile.ts` | EDIT | `basis` input; pass admin id + id + clock; `saveReview` (D23) |
| `src/application/use-cases/deactivateProfile.ts` | EDIT | `basis` input; same wiring (D23) |
| `src/infrastructure/persistence/prisma/mappers.ts` | EDIT | `ReviewDecision` maps; `toDomainProfileReview` |
| `src/infrastructure/persistence/prisma/*UnitOfWork*.ts` | EDIT | Implement transaction-scoped `saveReview` (D23) |
| `src/app/api/admin/profiles/[id]/approve/route.ts` | EDIT | Parse `basis` from body |
| `src/app/api/admin/profiles/[id]/reject/route.ts` | EDIT | Parse `basis` from body |
| `src/app/api/admin/profiles/[id]/deactivate/route.ts` | EDIT | Parse `basis` from body |
| `src/app/admin/profiles/ProfileRowActions.tsx` | EDIT | Basis textarea, role-cued placeholder, required (D27) |
| `src/app/admin/profiles/page.tsx` | EDIT | Optional legacy/basis label (D25) |
| `src/application/dto/PublicHospitalProjection.ts` | EDIT | Extend `ForbiddenPublicHospitalKey` with audit keys (D26) |
| `messages/{es,eu,en}.json` | EDIT | `ProfileActions.basis.*`, `AdminProfiles.review.legacy` (D27; `eu` DRAFT) |
| `docs/security-threat-model.md` | EDIT | T-22 update: built control vs. future control (see below) |

**No public projection is functionally widened** — the only edit to `PublicHospitalProjection.ts` is to the *forbidden* list (D26).

## Mechanical vs Semantic Split (for `sdd-tasks`)

**Mechanical (low judgement):**
- `ReviewDecision` enum/union + maps in `mappers.ts` (mirror `CentreType`).
- Threading `basis` through the two route handlers and the two use-case input types.
- Adding the textarea to `ProfileRowActions.tsx`.

**Semantic (judgement, new logic/data):**
- The domain signature change: three transitions returning `{ profile, review }` with basis validated first (D21–D24) — RED-first.
- `saveReview` on the UoW context + its transaction-scoped adapter, atomic with the existing transition/revocation (D23).
- The additive migration + schema, and the **legacy = no basis recorded** reading (D25) — no back-fill.
- Extending the D14 forbidden-key guard and re-running the no-leak suites (D26).
- Role-cued prompt copy in es/eu/en (D27) + the honesty-gate wording.
- Threat-model T-22 rewrite.

## Testing Strategy

| Layer | What | File |
|---|---|---|
| Unit | `approveProfile`/`rejectProfile`/`deactivateProfile`: a blank/whitespace basis throws BEFORE the status changes; an over-`MAX_REVIEW_BASIS_LENGTH` basis throws; a valid call returns `{ profile: <new status>, review }` with `review.adminAccountId === passed id`, `review.basis === trimmed`, `review.at === clock.now()`, `review.decision` correct | `tests/unit/domain/profile.test.ts` |
| Unit | `ProfileReview` is immutable / obtainable only via the factory; `assertValidReviewDecision` rejects unknowns | `tests/unit/domain/profile.test.ts` |
| Unit | `validateProfile`/`deactivateProfile`: passes `actor.accountId` as the review's admin id (NOT any input field); persists the review via `saveReview` in the same unit; a blank basis is rejected (fail-closed) | `tests/unit/application/validateProfile.test.ts`, `deactivateProfile.test.ts` |
| Unit | `PublicHospitalProjection`: exact six-key set unchanged; `_NoForbiddenFields` still holds with the new forbidden keys named; hostile adapter supplying `reviewBasis`/`reviewedBy` is rejected by the field-by-field rebuild | `tests/unit/application/listPublicHospitals.test.ts` |
| Integration | Reject→re-apply→approve→deactivate on ONE profile persists FOUR ordered `ProfileReview` rows, none overwritten (D21 cycle proof) | `tests/integration/profile-review-audit.test.ts` |
| Integration | The review row, the status transition and the session revocation commit/rollback as ONE unit — a forced failure after the status write leaves NO review row and NO status change (D23 atomicity) | `tests/integration/profile-review-audit.test.ts` |
| Integration | Migration survival: pre-existing `active`/`rejected` profiles have zero `ProfileReview` rows and read as "no basis recorded"; no Profile row altered (D25) | `tests/integration/profile-review-audit.test.ts` |
| E2E | `POST /api/admin/profiles/[id]/approve` with an empty/blank `basis` is rejected; with a valid basis, approves and the public `/api/hospitals` JSON still exposes NONE of `reviewBasis`/admin id/`reviewedAt` | `e2e/admin-profile-audit.spec.ts` |
| Unit | Locale parity incl. `ProfileActions.basis.*`, `AdminProfiles.review.legacy` + ICU parity (D13) | `tests/unit/i18n/localeParity.test.ts` |

Integration tests require `VIVETUTIEMPO_RUN_INTEGRATION=true`; a skipped integration test is never reported as passed. The atomicity and migration-survival tests are the gates on D23/D25.

## Threat Model Update (T-22)

`docs/security-threat-model.md` is updated so T-22 distinguishes the **built** control from the **future** control, replacing the current "verification stays self-declared with admin validation (unchanged in shape)" wording:

- **Built now (this change):** the admin approve/reject/deactivate decision is **accountable** — every decision records the acting admin, a timestamp, and a required, bounded, role-cued verification basis, in an append-only log; a decision without a recorded basis is impossible at the domain level. This is a genuine reduction in the "unaccountable approval" risk: the platform can now answer *who approved this node, when, and on what stated basis*.
- **NOT built (named future / real-world control):** the platform does **not** verify the attested basis. The collaboration-agreement (convenio) flow, certificate/accreditation upload, out-of-band contact tooling and background-check integration remain the T-22 follow-on, to be designed and built **before any real (non-demo) centre or artist onboards with real data**, and especially for the more vulnerable `widen-beyond-hospitals` populations. The role-cued prompt asks the admin to attest to verification (institutional for a centre, identity+safeguarding for an artist); it does not perform it. **No copy or doc may claim a safeguarding or verification posture the code does not implement** (R8).

This is a graded, in-change edit (not follow-up housekeeping): the doc must describe what actually shipped.

## Rollback

Purely additive on persistence and behaviour. Revert the code and the schema can retain or drop the `ProfileReview` table harmlessly — no existing Profile row was ever altered. The migration down path drops the table and the enum cleanly (nothing else references them); the recorded audit history is lost on revert, which is the correct semantics for reverting the feature. Vercel promotes the last good build.

## Open Questions

None blocking implementation. Resolved above: audit storage (append-only `ProfileReview`, D21); which transitions record a basis (approve/reject/deactivate; not applicant re-registration, D22); admin identity plumbing (use-case argument from `actor.accountId`, atomic with the transition, D23); basis validation (non-blank, bounded, trimmed, domain-enforced, D24); migration + legacy reading (additive, no back-fill, "no basis recorded", D25); public exclusion (structural + extended D14 guard, D26); role-specific prompt (UI/i18n, domain role-blind, D27).

Two items are spec-phase details, not design blockers:
1. **`MAX_REVIEW_BASIS_LENGTH` exact value** — the design fixes the presence of a bound and the constant; 1000 is the proposed number, confirmable at spec time against T-15's text-bounding decisions.
2. **Whether the admin queue surfaces prior reject basis** to the admin (authenticated, permissible per D26) or keeps the read side write-only for this MVP — a UI/spec call; the write side and its atomicity are fixed here.
3. **`eu` copy quality** — every `eu` string this change adds is DRAFT and blocks on native-speaker review before merge (D20 R9 gate, carried forward).
