# Verification Report — widen-beyond-hospitals

**Change:** `widen-beyond-hospitals` (ADRs D16–D20)
**Branch verified:** `feat/widen-centres-docs` (tip of the 7-PR feature-branch-chain)
**Base:** `feat/widen-centres` (tracker) — diff = 86 files, 3571+/465-
**Mode:** hybrid (Engram + openspec file) · Strict TDD active for domain/application
**Verdict:** **PASS WITH WARNINGS** — the security/data/migration/authorization contract is fully honoured and empirically proven; residual vocabulary work remains and human gates are OPEN by design. NOT archive-ready yet.

## Executive summary
0 CRITICAL · 2 WARNING · 3 SUGGESTION. Every automated spec scenario has a passing covering test. The two load-bearing guards (D14 forbidden-key, D10 non-correlation) were sabotaged-then-reverted and both proved genuinely load-bearing. The one real gap an adversarial pass found: the D20 vocabulary rewrite is INCOMPLETE — ~10 always-rendered functional strings across all three locales still presuppose "hospital"/"planta", which is exactly the work the still-OPEN manual-review gate (6.8/6.9) exists to catch and must not be waived.

## Execution evidence (all real, this machine)
| Check | Command | Result |
|---|---|---|
| Type-check | `npx tsc --noEmit` | **exit 0** (clean) |
| Lint | `npm run lint` (eslint, incl. D10 import zones) | **exit 0** (clean) |
| Unit + skipped-integration | `npm run test` | **628 passed / 77 skipped** (baseline matched) |
| Full incl. integration | `VIVETUTIEMPO_RUN_INTEGRATION=true npm run test` | **705 passed / 0 skipped** (60 files) — reseeded after |
| E2E (dev) | `playwright test hospital-directory + non-correlation` | **32 passed** |

Working tree left clean on `feat/widen-centres-docs` (both sabotages reverted; `git status` empty).

## Contract compliance (the 8 decided points)
1. **Two enums renamed + new `CentreType`; single-check authz.** CONFIRMED. `AccountRole`/`ProfileType` carry `centre`; `CentreType` has the six values. Grepping `centreType` across `src/application/use-cases/**` and `.../shared/**` shows it ONLY in registration passthrough + admin/public display — zero guard branches on `centreType`. Predicate is one literal (`where: { type: "CENTRE", status: "ACTIVE" }`), not a six-value IN list.
2. **Migration D17 hand-written, non-destructive.** CONFIRMED. `20260723000000_widen_centre_types/migration.sql` = `ALTER TYPE ... RENAME VALUE` (both enums) + `CREATE TYPE CentreType` + additive `ADD COLUMN` + `UPDATE ... WHERE type='CENTRE'` backfill. No drop+recreate. `centre-migration.test.ts` (339 lines) passed vs real Neon Postgres in the 705-run: HOSPITAL rows survive as `CENTRE` + `centreType='hospital'`, zero row loss. D4 partial unique indexes reference only `ProposalStatus` — untouched. Down-path documented in the migration comment.
3. **D19 allow-list + D14 forbidden-key guard.** CONFIRMED EMPIRICALLY. Added `readonly type: string;` to the DTO → tsc failed at `PublicHospitalProjection.ts(77): TS2344 "type" does not satisfy the constraint "never"` (the `_NoForbiddenFields` assert) + 8 cascade errors. Reverted.
4. **D10 non-correlation both directions.** CONFIRMED EMPIRICALLY. Made `listPublicHospitals` emit `upcomingEventCount: 3` (badge join) → 7 unit tests failed (`nonCorrelation.test.ts` + `listPublicHospitals.test.ts`). Reverted. E2E both directions pass incl. lone `palliative_unit` city leak test. ESLint import zones enforced both ways incl. composition factories.
5. **Registration six types; hospital accounts survive; `centreType` persists; PR2 bug fixed.** CONFIRMED. Route validates via `assertValidCentreType`; domain enforces the `type===centre ⇔ centreType` biconditional. The RegistrationUnitOfWork NULL-drop bug is FIXED (`profileData()` serializes `centreType`, lines 64-67) and covered by `centre-lifecycle.test.ts` (six kinds register→validate→publish through the identical guard path), green in the 705-run.
6. **Filter D12 client-side, real controls, keyboard, aria-live.** CONFIRMED. `filterHospitals` pure fn with `centreType` AND-predicate; real `<select id="centre-type-filter">` reflected to `?type=`; e2e verified Tab reach, URL sync, AND with text, visible tag, aria-live count.
7. **Vocabulary / brand / slug.** PARTIAL — WARNING-1. Brand "Vivetutiempo" NOT reintroduced. Slug `/encuentra-tu-momento` and `/api/hospitals` UNCHANGED. Locale + ICU parity green. But ~10 operational strings still presuppose hospital/ward.
8. **Docs six-type without overstating.** CONFIRMED. Not-deployed + eu-draft qualified; T-22 accepted-open, not a control.

## Issues

### WARNING-1 — D20 vocabulary rewrite is incomplete; ~10 always-rendered strings still presuppose hospital/planta (all 3 locales)
Spec item 7 requires "no visible surface still presupposes 'hospital'". Primary narrative keys are correctly generalised (Finder.title="Encuentra tu centro", Home.trust.title, About.*, Layout.footer, About.roles). Still ward/hospital-premised — NOT example data, they render every visit:
- `ProposeActivity.sent` — "el hospital la revisará" / "the hospital will review it" / "ospitaleak berrikusiko du"
- `Events.description` (also reused as OG/share text) — "…en hospitales participantes… con cada planta"
- `Events.empty.description` — "…que organicen los hospitales…"
- `ArtistSlots.description` / `ArtistSlots.empty.description` — "Hospitales que esperan…" / "Los hospitales publican…"
- `PublishSlot.description` — "…la agenda de la planta…"
- `AdminProfiles.description` / `AdminProfiles.empty.description` — "…los hospitales y artistas…"
- `Home.artists.title` — "…a planta." · `Home.reviews.eyebrow` — "Voces desde planta"

No automated spec fails (the reads-correctly checks are the MANUAL 6.8/6.9, OPEN). No D10 impact (generic "hospitales", not seeded names). Consequence: 6.8/6.9 has concrete catchable work and MUST NOT be signed off until generalised. WARNING not CRITICAL: breaks no automated spec, and the change is already non-merge-ready on the human gates.

### WARNING-2 — `AdminProfiles.types.centre` labels the generic centre role "Hospital"
`messages/*.json AdminProfiles.types.centre` = "Hospital" (es/en) / "Ospitalea" (eu). In `admin/profiles/page.tsx` this is only the FALLBACK branch (real centres render `centreType.*` correctly), so effectively unreachable under D18's invariant — but a latent mislabel; would render "Hospital" for a centre row with null `centreType`. Fix to "Centro" / "Zentroa".

### SUGGESTION-1 — `Home.hero.imageAlt` describes a "hospital common room" (all locales)
Borderline: accurately describes the actual hero photograph. Reconsider if the hero becomes generic.

### SUGGESTION-2 — `design.md` seed table is stale
Lists Aranzazu/Aixerrota/Turia/Ría; shipped seed uses Urumea/Monteverde/Besòs/Bernesga/Aravaca. README reconciled; design.md not.

### SUGGESTION-3 — `Home.trust.hospitals` sample list is hospital-only under the now-generic "Centros participantes" label.

## Deliberately-open items (assessed, NOT defects)
- **Basque eu draft — 6.10 BLOCKING:** correctly OPEN; localeParity verifies STRUCTURE only and is not cited as translation QA. Correct posture.
- **Manual reads-correctly — 6.8/6.9:** correctly OPEN; WARNING-1 is direct evidence this gate is load-bearing.

## Task completeness
Phases 1–7 automatable tasks DONE and consistent with code. Phase 8 (this gate) executed. Human-gated 6.8/6.9/6.10 OPEN as expected. Not merge-ready until 6.10 signs off.

## Recommendation
Route WARNING-1 + WARNING-2 as a small messages-only fix through `sdd-apply`, then HOLD `sdd-archive` until human gates 6.8/6.9/6.10 close. No CRITICAL blockers to the technical contract.
