# Verification Report — auditable-profile-approval

**Change:** auditable-profile-approval (ADRs D21-D27)
**Branch verified:** feat/auditable-approval-ui (tip of the 4-PR feature-branch chain), base tracker feat/auditable-approval
**Persistence mode:** hybrid (openspec file + engram topic sdd/auditable-profile-approval/verify-report)
**Verdict:** PASS WITH WARNINGS — 0 CRITICAL, 1 WARNING, 3 SUGGESTION, 2 human-gated items OPEN by design (not defects)
**Stance:** Adversarial. Each security-critical clause was actively attacked (empirical sabotage, scripted bypass, forced-failure rollback), not merely read.

## Build / Test Evidence (all executed this run)

| Command | Result |
|---|---|
| npm run lint | clean (exit 0) |
| npx tsc --noEmit | clean (exit 0) |
| npm run test (unit) | 656 passed / 84 skipped — exact baseline, zero regressions |
| VIVETUTIEMPO_RUN_INTEGRATION=true npm run test | 740 passed / 0 skipped against real Neon dev Postgres |
| npm run db:seed | re-run immediately after integration wipe — reseeded OK |
| npx playwright test admin-profile-audit + non-correlation | 14/14 passed |
| D14 empirical sabotage (add reviewBasis to projection, tsc, revert) | tsc FAILED as required (TS2344 does not satisfy constraint never at PublicHospitalProjection.ts line 93), reverted, tsc clean again |

Working tree left clean apart from the pre-existing untracked widen-beyond-hospitals/verify-report.md and this report. No push, production untouched.

## Security-Critical Contract — Attack Results

1. **Atomicity (D23) — HOLDS.** PrismaProfileUnitOfWork.saveReview uses the SAME tx handle as saveProfile/sessions inside one prisma.$transaction. Integration test sabotages ctx.saveReview to throw AFTER the status write (through the REAL validateProfile); result: status stays pending, ZERO review rows — no partial state. Passed against real Postgres. No path found to obtain a status change without its audit row.

2. **Basis cannot be bypassed (D24) — HOLDS.** assertValidBasis runs BEFORE assertStatus in all three domain transitions; blank/whitespace/over-1000 throws DomainValidationError. Route bodies only read basis (coerced to empty string if absent/non-string), never default a real basis, never reject at route level — the domain is the sole authority. e2e scripted POST approve with a whitespace-only basis returned 422, no status change (row still pending). DomainError to 422 mapping confirmed in httpErrors.ts (NOT 500).

3. **Admin identity session-sourced (D23) — HOLDS.** Both use cases hard-set adminAccountId from actor.accountId. Route body type is basis-only — a client-supplied adminAccountId/actorId is never read. Unit test asserts a spoofed body value is ignored; integration cycle test asserts every row adminAccountId equals adminActor.accountId.

4. **Append-only history (D21/D22) — HOLDS.** No profileReview update/delete/upsert/updateMany exists anywhere in src/. Migration FK is ON DELETE RESTRICT — a profile with reviews cannot be deleted out from under its trail. Integration cycle proof: reject then re-apply then approve then deactivate persists exactly THREE ordered rows (REJECT, APPROVE, DEACTIVATE), three distinct ids, none overwritten.
   **4b. reactivateProfile records no review — HOLDS.** Signature unchanged (profile, clock) returning Profile; cycle proof confirms re-apply adds zero rows.

5. **No public exposure (D26) — HOLDS.** D14 guard empirically sabotaged (see table) — _NoForbiddenFields fails tsc on a forbidden key. ForbiddenPublicHospitalKey names reviewBasis, adminAccountId, reviewedBy, reviewedAt, decision, reviews. PublicHospitalDirectoryQuery selects only the six allow-listed profiles columns, no join to profile_reviews. e2e asserts exactly the six keys and none of the audit substrings in the raw /api/hospitals body.

6. **Migration additive (D25) — HOLDS.** The profile_review_audit migration.sql contains only CREATE TYPE, CREATE TABLE, CREATE INDEX, and one ADD CONSTRAINT FK on the NEW table. No ALTER COLUMN/DROP/UPDATE on any pre-existing table. Integration tests prove pre-existing active/rejected/deactivated profiles survive byte-identical with zero review rows. No back-fill: neither the migration nor seed.ts inserts a profileReview row for legacy profiles (seed discards the domain review half).

7. **Deactivate UI — HOLDS.** New active-profiles section in page.tsx renders a deactivate-only ProfileRowActions; every action gated on a non-blank trimmed basis. Admin-only enforced twice: the page redirects non-admins, and deactivateProfile calls assertRole(actor, admin) which throws ForbiddenError to 403 (session-sourced actor, no client role trust).

8. **Honesty (R8) — HOLDS.** Threat-model T-22 rewrite states the platform built the accountable decision but did NOT build verification. es/en prompt copy uses attestation language (verification basis, confirming, checked), no platform-verified/confirmed overclaim.

## Task Completion

Phases 0-5 checked off except: 5.7 DEFERRED (no read-side review-history surface exists; design permitted it as a UI/spec call), 5.9 OPEN (Basque native review — blocking gate), 5.12 OPEN (manual prompt/honesty read — awaits user). Phase 6 (this verification) executed here.

## Findings

### CRITICAL
None. Every security-critical clause was attacked and held.

### WARNING
- **W1 — Migration-safety legacy-label requirement is not rendered in the UI.** The migration-safety spec states the admin surface MUST render zero-review profiles as an explicit no-basis-recorded (legacy) label. The AdminProfiles.review.legacy i18n key ships in all three locales but is UNUSED — no JSX renders it, because the review-history read side was deferred (5.7). The spec scenario is conditioned on an authenticated admin surface that renders review history, which does not exist, so nothing is mislabelled; but the requirement text is stronger than what shipped. Design explicitly allowed this deferral. Tracked honestly rather than silently passed.

### SUGGESTION
- **S1 — Deactivate failure-path atomicity is proven by shared mechanism, not a dedicated test.** The forced-failure rollback integration test exercises the approve path (validateProfile); deactivate shares the identical withLockedProfile/saveReview mechanism and its success path is exercised by the cycle proof, but no test forces a mid-transaction failure specifically on deactivateProfile. Consider adding one for symmetry.
- **S2 — Seeded active profiles carry zero review rows.** seed.ts calls the domain approveProfile and discards the returned review, so demo active centres read as legacy/no-basis. Not a D25 violation (honest absence is correct; fabrication is what is forbidden), but demo data will show every active centre as pre-audit once a history surface exists.
- **S3 — decision as a forbidden public key is broad.** decision is a generic token; harmless today (public body has only six keys) but a future unrelated field named decision would trip the guard. Acceptable as belt-and-suspenders.

### OPEN by design (assessed, NOT defects — per instructions)
- **eu copy is uncertified DRAFT** (5.9): structural parity passes (localeParity.test.ts), translation quality PENDING native-speaker sign-off. Blocking gate before merge; not an implementation defect.
- **Manual role-prompt / honesty read** (5.12): awaits the user human review. Implementer non-authoritative read recorded; not a substitute for sign-off.

## Verdict

PASS WITH WARNINGS. The append-only, atomic, session-attributed, domain-enforced, publicly-invisible audit contract is implemented correctly and survived every adversarial probe. The single WARNING is a knowingly-deferred UI label, not a security gap. Merge-readiness is gated only on the two human items (eu review, manual prompt read), exactly as planned.
