# Design — widen-beyond-hospitals

**Depends on:** `bootstrap-vivetutiempo-platform` (D1–D8, deployed) and `hospital-finder-and-home-clarity` (D9–D15, deployed). **ADR numbering continues the single register — the last change owned D9–D15, so this change owns D16–D20.**

**Strict TDD is ACTIVE** for every `domain/` and `application/` task here (carried forward). The domain invariants introduced (D16 role/kind separation, D18 centre-type registration invariant) and the D19 allow-list widening are RED-first: the failing test — including the D19 exact-key-set and both D10 non-correlation suites — precedes the change. `infrastructure/`/`ui/` stay pragmatic; the migration (D17) is proven against real Postgres before it is trusted.

## Technical Approach

The whole change rests on one structural move, made once and reused everywhere: **role and kind are two orthogonal axes.** "Hospital" today conflates them — it is simultaneously the authorization role (this account publishes slots) and the domain kind (this place is a hospital). We split it. The role axis keeps its shape (rename the one value `HOSPITAL` → `CENTRE` on both enums that carry it); a new, third `CentreType` axis carries the six kinds. Because the axes are orthogonal, the authorization surface — guards, the security predicate, the use cases — does not learn about six types. It keeps asking the single question it always asked ("is this the slot-publishing side, active?"), now phrased as `CENTRE` instead of `HOSPITAL`. Everything that must distinguish the six types (registration input, the public tag/filter, admin display, copy) reads the new attribute, never the role.

That orthogonality is what makes the change safe rather than sprawling. The security-critical line in the public adapter changes by exactly one renamed literal (`type: "HOSPITAL"` → `type: "CENTRE"`) — it does NOT grow into a six-value `in` list, because the six types share the one profile-type. The guards change by a literal swap at ~8 call sites, no new branches. The genuinely new work is concentrated in five places, each an ADR: the enum topology (D16), the migration (D17), the registration redesign (D18), the allow-list widening (D19), and the three-language vocabulary rewrite (D20) — which is the hard part, and is not a rename.

**Deliberately deferred (proposal §5.4, honoured here):** internal `hospital`-named identifiers (`PublicHospitalProjection`, `PublicHospitalDirectoryQuery`, `listPublicHospitals`, `hospitalDirectoryDeps`, `HospitalFinder`, `HospitalMap`, `Slot.hospitalProfileId`, the `HospitalSlots` relation, `/api/hospitals`) keep their names. They are now misnomers; renaming them is behaviour-neutral churn across a large fraction of the ~1200 `hospital` occurrences and adds regression risk to a change already carrying a migration and a full copy rewrite. Recorded as planned follow-on, not oversight.

## Architecture Decisions (ADRs)

### D16 — A generic `CENTRE` role/profile-type value plus a separate `CentreType` data axis

**Choice.** Generalise the shared `HOSPITAL` value to `CENTRE` on **both** enums that carry it, and add a **third, independent `CentreType` enum** for the six kinds. Concrete end state:

| Axis | Enum | Before | After |
|---|---|---|---|
| Authorization role | `AccountRole` (domain `src/domain/account/Account.ts`, Prisma) | `admin` \| `hospital` \| `artist` \| `patient` | `admin` \| **`centre`** \| `artist` \| `patient` |
| Domain profile kind | `ProfileType` (domain `src/domain/profile/Profile.ts`, Prisma) | `hospital` \| `artist` | **`centre`** \| `artist` |
| Care-centre kind (NEW) | `CentreType` (domain `src/domain/profile/Profile.ts`, Prisma) | — | `hospital` \| `nursing_home` \| `day_centre` \| `day_hospital` \| `occupational_centre` \| `palliative_unit` |

Domain literals stay lowercase (matching every existing union); Prisma labels stay UPPER_SNAKE (`CENTRE`, `NURSING_HOME`, `DAY_CENTRE`, `DAY_HOSPITAL`, `OCCUPATIONAL_CENTRE`, `PALLIATIVE_UNIT`), mapped in `mappers.ts` exactly as `Audience`/`ProfileType` already are.

**Why `CENTRE` and not `ORGANIZATION` or `CARE_CENTRE`.** `ORGANIZATION` is rejected because the product copy already uses "Organizaciones mecenas" for **patrons** (`Home.trust.patronsLabel`) — reusing "organization" for the slot-publishing role invites a real semantic collision in the domain vocabulary. `CARE_CENTRE` is rejected as more verbose with no added clarity: the `CentreType` axis already carries the "what kind of care" specificity, so the role value only needs to name the general entity. `CENTRE` is the **minimal faithful generalisation** — hospital was one kind of centre; the value now names the category — and it harmonises with `CentreType` so the model reads coherently ("this account is a `centre`; its `centreType` is `hospital`").

**Why two enums are KEPT, not collapsed into one.** `ProfileType` is not redundant with `AccountRole`. `assertActiveProfile(profile, expectedType)` (`guards.ts`) compares the live `Profile.type` against the expected `ProfileType` as a **defense-in-depth drift guard** (pr2a-N1): a `centre`-role Account holding a corrupted `artist` Profile is still denied a centre-only action. Collapsing the two enums deletes that independent check. They stay separate; both simply have their `HOSPITAL` value renamed.

**Why `CentreType` is a real enum, not a validated free-string set.** It is a closed, finite, product-defining taxonomy — exactly the shape of the existing `Audience` enum in the same schema. A Prisma enum gives DB-level integrity (a typo'd category cannot be persisted and then vanish from every filter), exhaustiveness checking that keeps the i18n label map and the client filter in lockstep with the data, and consistency with `Audience`. A free-string set (the Block-3 campaign-reference style) is rejected: it trades that integrity for the ability to add a seventh value without a migration, which is the wrong trade for a PUBLIC, filterable, safety-relevant axis.

**The gradable TFM claim, stated precisely.** "The seventh centre type is data, not code" means: adding a seventh kind is **one enum value + one migration `ADD VALUE` + one i18n label per locale**, and touches **zero** authorization code — no guard literal, no new branch, no change to the security predicate's shape, no new use case, no change to the public read path's logic. Contrast a seventh *role*, which would touch guards, branches and their tests. The claim is not "no schema change ever"; it is "the type axis extends by value+copy while the authorization surface stays frozen." The integration test that all six types register → validate → publish a slot **through the identical guard path** is what proves it.

### D17 — Non-destructive, hand-written enum migration; zero data loss

**Choice.** One hand-written raw-SQL migration, `prisma/migrations/<timestamp>_widen_centre_types/migration.sql`, applied in this order:

```sql
ALTER TYPE "AccountRole" RENAME VALUE 'HOSPITAL' TO 'CENTRE';
ALTER TYPE "ProfileType" RENAME VALUE 'HOSPITAL' TO 'CENTRE';

CREATE TYPE "CentreType" AS ENUM (
  'HOSPITAL','NURSING_HOME','DAY_CENTRE','DAY_HOSPITAL',
  'OCCUPATIONAL_CENTRE','PALLIATIVE_UNIT'
);

ALTER TABLE "profiles" ADD COLUMN "centreType" "CentreType";

-- Backfill: every existing profile of the (now renamed) CENTRE type genuinely
-- IS a hospital. Artists keep NULL. Not user input — a fact about the data.
UPDATE "profiles" SET "centreType" = 'HOSPITAL' WHERE "type" = 'CENTRE';
```

**Why RENAME, not add-new-value + backfill + drop.** `ALTER TYPE ... RENAME VALUE` (Postgres 10+) renames the label **in place** — the enum OID is unchanged, so every existing `HOSPITAL` row reads as `CENTRE` with **no row rewrite and zero data loss**, in a single cheap statement. The add-new-value alternative would require `ALTER TYPE ... ADD VALUE`, which **cannot be used in the same transaction that references it** (the classic "unsafe use of new value" restriction), forcing a multi-migration dance and a later `DROP VALUE` that Postgres does not even support cleanly. RENAME sidesteps all of it and is transaction-safe.

**Why the migration MUST be hand-written.** Prisma's declarative diff does **not** infer a RENAME. Editing `HOSPITAL` → `CENTRE` in `schema.prisma` and running `prisma migrate dev` generates a **destructive DROP-and-recreate** of the enum, which would fail or orphan rows. The migration is therefore authored by hand (the raw SQL above) exactly as the D4 partial-unique-index migration already is, and `schema.prisma` is edited to the target state so Prisma sees no drift afterwards. This is the single most dangerous step to get wrong; it is called out here and must be a `size:exception`-level review point.

**D4 is verified unaffected.** The D4 partial-unique-index migration (`20260711000001_partial_unique_indexes/migration.sql`) references **`ProposalStatus`** (`'ACCEPTED'`, `'SUBMITTED'`) only — confirmed against `schema.prisma:183-189` and the migration file. It touches neither `AccountRole` nor `ProfileType`, so renaming those enum values leaves its `WHERE` clauses intact.

**Down path (documented, honest about its limit).** Reverse: `UPDATE ... SET centreType = NULL`; `ALTER TABLE "profiles" DROP COLUMN "centreType"`; `DROP TYPE "CentreType"`; `ALTER TYPE ... RENAME VALUE 'CENTRE' TO 'HOSPITAL'` on both enums. This is clean **only while no non-hospital centre exists**. If a `nursing_home`/`palliative_unit` row was created after the up-migration, the down-migration renames its role to `HOSPITAL` and drops its category — a semantic coarsening, not a crash. Acceptable for a demo; documented, not hidden. Prove the up-migration against real Postgres (Neon `dev`) with the seed loaded before deploy.

### D18 — Registration redesign: role→profile-type stays 1:1, `centreType` is a new orthogonal required input

**The current shape, and what actually changes.** `profileTypeForRole` (`Account.ts`) is a strict 1:1 map (`hospital→hospital`, `artist→artist`). It does **not** break — after the rename it is `centre→centre`, `artist→artist`, still 1:1. The 1:1 role↔profile-type relation was never the obstacle; the obstacle was that "hospital" carried the *kind*. So the redesign is **additive**, not a teardown:

1. `profileTypeForRole` keeps its structure with the renamed value (`centre`/`artist`).
2. `RegisterProfileInput` gains a required-when-`centre` `centreType: CentreType` field.
3. `createProfile`/`Profile` gain `centreType`, guarded by a new domain invariant.
4. `hospitalLocationFrom` → `centreLocationFrom`, gated on `role === "centre"` (was `"hospital"`), same field-picking behaviour.

**New domain invariant (D16 made enforceable).** In `Profile.ts`: `type === "centre"` **requires** a valid `centreType`; `type === "artist"` **forbids** it. `assertValidCentreType` checks membership in the six-value set; a cross-field check in `createProfile`/`rehydrateProfile` enforces the biconditional. This is the invariant that keeps the two axes honestly coupled at exactly one point (a centre must declare a kind; an artist has none) without letting the kind leak into authorization.

**Guards: shape unchanged, literal swapped.** `assertRole(actor, "hospital")` → `assertRole(actor, "centre")` and `assertActiveProfile(profile, "hospital")` → `assertActiveProfile(profile, "centre")` at the ~8 call sites (`listHospitalSlots`, `approveProposal`, `publishSlot`, `closeSlot`, `rejectProposal`). No new argument, no branch on `centreType` — the guard authorises "the active centre side", never "which of six kinds". This is D16's claim expressed in the authorization layer.

**Registration UI (D18 + D20 labels).** The role select option `Register.role.hospital` becomes `Register.role.centre` ("Centro de cuidado"). When role is `centre`, a **required** `centreType` `<select>` appears (replacing the hidden hospital default) with six options, plus the existing optional location fields (now shown for any centre, not just hospitals). Server-side, the register route (`api/auth/register/route.ts`) and `registerProfile` validate `centreType` presence for a centre role — the use case does not trust the form (matching the existing "enforced server-side too" stance for location).

**Admin queue.** The pending-profile admin surface is authenticated and authorised, so it MAY carry `centreType` (it is not the public allow-list). The admin pending-profile query/DTO gains `centreType`, and `src/app/admin/profiles/page.tsx` shows the specific kind ("Residencia de mayores") rather than a flat "Centro", via a new `AdminProfiles.centreType.*` label group.

### D19 — `centreType` joins the D9 public allow-list; the security predicate stays a one-value check

**Choice.** Add `centreType: CentreType` to `PublicHospitalProjection` as a new allow-listed field — the **coarse six-value category only**, never a finer sub-label (no "oncology palliative ward 3B", no unit name) that could narrow to a specific unit inside a building. Concretely:

- **`PublicHospitalProjection`** gains `readonly centreType: CentreType;` — a non-null field (every active centre has a kind, per D18's invariant).
- **`type` STAYS forbidden.** This corrects a conflation in the proposal (§5.3 said "remove `type` from `ForbiddenPublicHospitalKey`"). `type` (the `ProfileType` role axis, `centre`/`artist`) and `centreType` (the kind axis) are **different fields**. The public surface exposes the *kind* (`centreType`), never the internal role-type (`type`) — which is redundant anyway, since the predicate already guarantees only centres appear. `type` remains in `ForbiddenPublicHospitalKey`; `centreType` is simply not added to it, and the `_NoForbiddenFields` compile assert continues to hold.

**The security predicate barely changes — and that is the point.** `where: { type: "HOSPITAL", status: "ACTIVE" }` → `where: { type: "CENTRE", status: "ACTIVE" }`. It does **NOT** become a six-value `centreType IN (...)` list. Because all six kinds share the one `ProfileType.CENTRE`, admitting "all active centres, no artists, nothing pending/rejected/deactivated" is still a **single renamed literal on the same axis**. `centreType` is a *selected, displayed* attribute, never part of the security predicate. Widening the directory's audience from one kind to six therefore did **not** complicate the line the whole surface's safety depends on — orthogonal axes keep the security predicate as auditable as before ("must never acquire an unrelated condition" is easier to honour, not harder). The adapter adds `centreType: true` to the `select` and one field to the field-by-field rebuild.

**D10 (cross-surface non-correlation) is re-assessed and re-run, not merely edited.** The event surface (`PublicEventProjection`, D6) exposes **no location, no centre identity, no Slot `location`** — the centre is not on the event surface at all. Adding `centreType` to the directory creates **no new join key against events, because there is nothing on the event side to join to**. D10 is not weakened. D19's obligation is therefore twofold:
- **Extend the exact-key-set allow-list deliberately.** The duplicated expected-key list in `tests/unit/application/listPublicHospitals.test.ts` and the `HOSPITAL_ALLOW_LISTED_FIELDS` set in `tests/unit/application/nonCorrelation.test.ts` gain `centreType` **by hand** (never derived) — so the addition is a visible, reviewed allow-list edit that names ADR D19, not a silent widening. A test asserts `centreType` is present AND that no Slot/Proposal/Event-derived field accompanies it.
- **Re-run BOTH suites** (`nonCorrelation.test.ts`, `e2e/non-correlation.spec.ts`) unchanged in intent, so any adapter that accidentally joins `centreType` with a Slot/Event-derived field fails.

**Single-surface identifiability (standalone, accepted).** Re-assessing the "lone palliative unit in a city" risk the proposal flagged: exposing `(centreType, city)` narrows **nothing across surfaces**, because events carry no location — there is no second surface to correlate against. The residual risk is purely single-surface: "there is one palliative unit in this city, named X" is a stronger population signal than "one hospital" was, because the new kinds are smaller and more homogeneous. This is **inherent to the product's discovery purpose** (families must distinguish a day centre from a palliative unit or the directory is useless), it publishes only **institutional metadata about institutions that self-registered to be listed**, and it **names no individual**. Accepted and recorded in the threat model (R4), with the coarse-category rule (never a sub-label) as the concrete mitigation.

**Rename deferral (3b), decided here.** `PublicHospitalProjection`, `PublicHospitalDirectoryQuery`, `listPublicHospitals`, `hospitalDirectoryDeps`, and the route `/api/hospitals` **keep their names** in this change (proposal §5.4). Rationale: the blast radius of renaming these across the DTO, port, adapter, use case, container, route, e2e and unit tests is large and behaviour-neutral, and — decisively — **`/api/hospitals` is a shipped public route path and `/encuentra-tu-momento` is the shipped slug consumed by PR #11's Open Graph and share links.** Neither URL may change: the slug is preserved (proposal §6.2) and the API path is preserved. The DTO's doc comment is updated to state that "hospital" here now means "any care centre" pending the follow-on rename. What must NOT break: the `/encuentra-tu-momento` slug, the `/api/hospitals` path, and the OG/share metadata targeting them.

### D20 — Vocabulary across three languages: relational where the kind is unknown, specific where it is known

**Choice — the strategy, not a find/replace.** Two registers, applied **independently per language** (drafted natively, never translated from Spanish, because the lexical gap exists separately in each):

- **Where the UI does not know the concrete kind** (home, about, help, footer, finder intro — cross-type narrative and structural copy): use **relational phrasing built on the core concept** — "people whose circumstances keep them from going to culture, so culture comes to them" — rather than hunting for an umbrella noun. Phrase around *the people who are there* / *the people in their care*, and name the institution, where a noun is unavoidable, with the generic care-centre term.
- **Where the UI knows the concrete kind** (registration, slot board, admin validation, the directory's type tag/filter): use the **type-specific correct term**.

**Generic institution noun (kind unknown):**

| | es | en | eu (DRAFT — native review) |
|---|---|---|---|
| institution | centro de cuidado (or "centro" where context is clear) | care centre | zaintza-zentro |
| the people there (relational) | las personas que están allí / quienes viven o pasan el día allí | the people who are there / the people in their care | bertan dauden pertsonak |

**Type-specific person term (kind known):**

| centreType | es | en | eu (DRAFT — native review) |
|---|---|---|---|
| hospital | paciente | patient | paziente |
| nursing_home | residente | resident | egoiliar |
| day_centre | usuario / participante | attendee / participant | erabiltzaile |
| day_hospital | paciente | patient | paziente |
| occupational_centre | participante / usuario | participant | parte-hartzaile |
| palliative_unit | paciente | patient | paziente |

**CentreType display labels (filter chips, registration options, admin queue, directory tag):**

| centreType | es | en | eu (DRAFT — native review) |
|---|---|---|---|
| hospital | Hospital | Hospital | Ospitalea |
| nursing_home | Residencia de mayores | Nursing home | Adinekoen egoitza |
| day_centre | Centro de día | Day centre | Eguneko zentroa |
| day_hospital | Hospital de día | Day hospital | Eguneko ospitalea |
| occupational_centre | Centro ocupacional | Occupational centre | Zentro okupazionala |
| palliative_unit | Unidad de cuidados paliativos | Palliative care unit | Zaintza aringarrien unitatea |

**Load-bearing narrative strings — the rewrite (R3), not substitution.** These are the strings written *from the premise of a hospital ward*; they must be re-written, not word-swapped. Recommended `es` targets (final wording is the copy/apply phase's; `en` parallels; **all `eu` is DRAFT pending native review**):

| Key | Before (es) | After (es) — rewrite |
|---|---|---|
| `Finder.nav` / `Finder.title` | "Encuentra tu hospital" | "Encuentra tu centro" (utility-clear; aspirational alt "Encuentra tu momento" noted — **slug stays `/encuentra-tu-momento`**) |
| `Home.trust.title` | "Cada hueco lo abre un hospital, no una plataforma anónima." | "Cada hueco lo abre un centro de cuidado, no una plataforma anónima." |
| `Home.trust.hospitalsLabel` | "Hospitales participantes" | "Centros participantes" |
| `About.title` | "…llevar cultura en directo a la cama del hospital." | "…llevar cultura en directo allí donde el cuidado retiene a las personas." |
| `About.purpose.description` | "Las estancias hospitalarias largas aíslan…" | "Las estancias largas y los días lejos de casa aíslan. Vivetutiempo existe para que la música, el teatro y los talleres lleguen al centro de cuidado sin sustituir la atención, siempre coordinados con el propio centro." |
| `Layout.footer.description` | "…a pacientes durante sus estancias hospitalarias…" | "…a las personas que están en centros de cuidado, durante estancias largas o días lejos de casa." |
| `About.roles[].name` "Hospital" | "Hospital" | "Centro de cuidado" |
| `Home.what.*`, `Help.howItWorks`, `Help.steps.*` | ward/hospital-premised | generalise "planta/hospital" → "centro", keep relational person phrasing |

**Basque review gate (R9, blocking).** Every `eu` string this change touches is DRAFT: the three tables above, the six `CentreType` labels, and every rewritten narrative key (`Finder`, `Home.trust/mission/what`, `About.*`, `Help.howItWorks/steps`, `Layout.footer`, `Register.centreType/role/name`, `AdminProfiles.centreType`). None ships as final on this agent's word; the assigned native speaker signs off before merge. The D13 locale-parity guard (key sets + ICU placeholder parity) protects structure only and must not be cited as translation-quality assurance.

## Enum Topology and Wiring Detail

**Domain** (`src/domain/`):
- `Account.ts`: `AccountRole = "admin" | "centre" | "artist" | "patient"`; `ACCOUNT_ROLES` updated; `profileTypeForRole`: `centre → "centre"`, `artist → "artist"`.
- `Profile.ts`: `ProfileType = "centre" | "artist"`; new `CentreType = "hospital" | "nursing_home" | "day_centre" | "day_hospital" | "occupational_centre" | "palliative_unit"` + `CENTRE_TYPES` array + `assertValidCentreType`; `Profile.centreType?: CentreType`; `CreateProfileInput`/`RehydrateProfileInput` gain `centreType?`; invariant `type === "centre" ⟺ centreType present` enforced in the factories.

**Mappers** (`mappers.ts`): rename `HOSPITAL`→`CENTRE` in `ACCOUNT_ROLE_TO_*` and `PROFILE_TYPE_TO_*`; add `CENTRE_TYPE_TO_DOMAIN`/`CENTRE_TYPE_TO_PRISMA`; `ProfileRow` gains `centreType?: PrismaCentreType | null`; `toDomainProfile` maps it (present only for centres).

**Persistence** (`ProfileRepository.ts`): persist/select `centreType`.

**Public read path** (D19): DTO + adapter `select` + use-case rebuild each gain `centreType`; predicate `type: "CENTRE"`.

**Guards / use cases** (D18): literal `"hospital"` → `"centre"` at the ~8 sites; no shape change.

## Registration Flow (D18)

```
register/page.tsx (client)
  role select: Centro de cuidado | Artista
  if role === "centre":
     centreType select (REQUIRED, 6 options)   // NEW
     city / postalCode / addressLine (optional) // now shown for any centre
  -> POST /api/auth/register  { role, name, centreType?, city?, ... }
       route validates: role === "centre" ⇒ centreType ∈ CENTRE_TYPES (required)
       -> registerProfile: profileTypeForRole(role) + centreType + centreLocationFrom(input)
            -> createProfile enforces type/centreType invariant
```

## Seed (diversify, ids stable, idempotent)

Keep the existing 11 hospital rows as `centreType: "hospital"` (their names say "Hospital X" — coherent), Esperanza still PENDING (negative case). **Add five NEW ACTIVE centres, one per new kind**, with new fixed `IDS`, distinct cities/postal prefixes, `addressLine` populated (D14 non-vacuous), each with its own `centre.<name>@vtt.test` Account — so all six categories are demonstrable and the type filter is showable. Upsert-by-fixed-id keeps the seed idempotent; existing ids are untouched.

| Name | centreType | City | Postal |
|---|---|---|---|
| Residencia Aranzazu | nursing_home | Vitoria-Gasteiz | 01004 |
| Centro de Día Aixerrota | day_centre | Getxo | 48992 |
| Hospital de Día Turia | day_hospital | Valencia | 46021 |
| Centro Ocupacional Aravaca | occupational_centre | Madrid | 28023 |
| Unidad de Cuidados Paliativos Ría | palliative_unit | Vigo | 36202 |

Names are fictional (river/district register per the existing convention), naming no real institution — deliberate given the single-surface identifiability note (D19/R4).

## Filtering (follow D12: client-side)

The type filter is **client-side**, following D12 unchanged. The full active set already ships to the browser for the map+list; `centreType` is one more already-shipped field per row, so filtering by it is an in-memory predicate identical in rationale to name/city — and server-side filtering stays incoherent with the map (D12's decisive argument). UI: a small set of accessible filter controls (one per `centreType` + "all"), combined with the text query by AND, reflected to the URL as `?type=` alongside `?q=`, and announced through the existing `aria-live` result-count region (D11). `filterHospitals` (or a sibling pure fn) gains the type predicate — unit-testable without a DOM. The D12 revisit trigger (~200 rows) is unchanged.

## New and Changed Files

| Path | Status | Purpose |
|---|---|---|
| `prisma/migrations/<ts>_widen_centre_types/migration.sql` | NEW | Hand-written RENAME + `CentreType` + backfill (D17) |
| `prisma/schema.prisma` | EDIT | Enum values renamed; `CentreType` enum; `Profile.centreType` column |
| `src/domain/account/Account.ts` | EDIT | `AccountRole` value; `profileTypeForRole` (D16) |
| `src/domain/profile/Profile.ts` | EDIT | `ProfileType` value; `CentreType`; `Profile.centreType` + invariant (D16/D18) |
| `src/infrastructure/persistence/prisma/mappers.ts` | EDIT | Role/type maps; `CentreType` maps; `ProfileRow.centreType` |
| `src/infrastructure/persistence/prisma/ProfileRepository.ts` | EDIT | Persist/select `centreType` |
| `src/application/use-cases/registerProfile.ts` | EDIT | `centreType` input; `centreLocationFrom` (D18) |
| `src/app/api/auth/register/route.ts` | EDIT | Parse + validate `centreType` |
| `src/app/register/page.tsx` | EDIT | `centreType` select; generalised labels |
| `src/application/use-cases/shared/guards.ts` callers (~8 sites) | EDIT | Literal `"hospital"` → `"centre"` |
| `src/application/dto/PublicHospitalProjection.ts` | EDIT | Add `centreType`; keep `type` forbidden (D19) |
| `src/infrastructure/persistence/prisma/PublicHospitalDirectoryQuery.ts` | EDIT | `select centreType`; `where type:"CENTRE"` |
| `src/application/use-cases/listPublicHospitals.ts` | EDIT | Rebuild includes `centreType` |
| admin pending-profile query/DTO + `src/app/admin/profiles/page.tsx` | EDIT | `centreType` display (D18) |
| `src/ui/finder/filterHospitals.ts` + `src/app/encuentra-tu-momento/HospitalFinder.tsx` | EDIT | Type filter + `?type=` (D12) |
| `prisma/seed.ts` | EDIT | `centreType` on all; 5 new-kind ACTIVE centres |
| `messages/{es,eu,en}.json` | EDIT | Vocabulary rewrite + `CentreType`/`Register`/`AdminProfiles`/`Finder` labels (D20) |
| `README.md`, `docs/memoria-tfm-borrador.md`, `docs/slides-outline.md`, `docs/video-script.md`, `docs/security-threat-model.md`, `docs/tfm-readiness-report.md` | EDIT | Generalised product + safeguarding risk (R2/R4/R8) |

**No files are renamed** (3b deferral). Tests below are edited/added.

## Mechanical vs Semantic Split (for `sdd-tasks`)

**Mechanical (behaviour-neutral literal/rename; low judgement):**
- `HOSPITAL` → `CENTRE` value in `schema.prisma` (via the hand-written migration), the two domain unions, the two `mappers.ts` map pairs, `profileTypeForRole`, and the ~8 guard call-site literals.
- The bulk of the ~1200 `hospital` test occurrences need **NO change** — they reference internal identifiers that are deliberately kept (§5.4). Do NOT auto-replace them.

**Semantic (judgement, new logic/data/copy):**
- `CentreType` enum + column + migration + backfill (D17).
- `registerProfile` `centreType` input + the type/centreType invariant (D18).
- Allow-list widening + predicate rename + D10 re-run + exact-key-set extension (D19).
- Vocabulary rewrite in es/eu/en — narrative rewrite, not substitution (D20).
- Seed diversification (five new-kind centres).
- Client-side type filter + controls + URL (D12).
- Admin queue `centreType` display.
- New per-type register→validate→publish integration scenarios; migration-survival test.
- TFM docs rewrite + threat-model addition.

## Testing Strategy

| Layer | What | File |
|---|---|---|
| Unit | `Profile`: `type/centreType` invariant (centre requires kind; artist forbids it); `assertValidCentreType` rejects unknowns | `tests/unit/domain/profile.test.ts` |
| Unit | `registerProfile`: centre registration requires `centreType`; artist rejects it; each of six kinds constructs a valid pending profile | `tests/unit/application/registerProfile.test.ts` |
| Unit | `listPublicHospitals`: exact-key-set **including `centreType`** (hand-duplicated list); hostile adapter (`addressLine`, email, ids, `type`, event data) rejected | `tests/unit/application/listPublicHospitals.test.ts` |
| Unit | D10 non-correlation BOTH directions, `HOSPITAL_ALLOW_LISTED_FIELDS` gains `centreType`; assert no Slot/Event field accompanies it | `tests/unit/application/nonCorrelation.test.ts` |
| Unit | `filterHospitals`: type predicate alone, type AND text query, "all" passthrough, order preserved | `tests/unit/ui/filterHospitals.test.ts` |
| Unit | Locale parity repo-wide incl. new `CentreType`/`Register`/`AdminProfiles` keys + ICU parity (D13) | `tests/unit/i18n/localeParity.test.ts` |
| Integration | Migration survival: an existing `HOSPITAL` row reads as `centre` + `centreType = hospital`, zero loss; new-kind rows round-trip | `tests/integration/centre-migration.test.ts` |
| Integration | Public adapter: only `type:"CENTRE" + ACTIVE` rows; artists/pending/Esperanza absent; exact key set incl. `centreType`; `addressLine`/`type` absent; all six kinds present | `tests/integration/public-hospital-directory-query.test.ts` |
| Integration | All six kinds register → admin validates → publish a slot through the identical guard path (D16 gradable claim) | `tests/integration/centre-lifecycle.test.ts` |
| E2E | `/api/hospitals` exposes `centreType`, never `addressLine`/email/id/`type`; directory renders six kinds; type filter narrows; live region announces | `e2e/hospital-directory.spec.ts` |
| E2E | D10 re-run: no `centreType`-derived join; no event title on `/encuentra-tu-momento`; no centre name/city on `/events` | `e2e/non-correlation.spec.ts` |

Integration tests require `VIVETUTIEMPO_RUN_INTEGRATION=true`; a skipped integration test is never reported as passed. The migration-survival test is the gate on D17.

## TFM Documentation and Threat Model

This change **rewrites the TFM deliverable set** — `README.md`, `docs/memoria-tfm-borrador.md`, `docs/slides-outline.md`, `docs/video-script.md`, `docs/security-threat-model.md`, `docs/tfm-readiness-report.md` — from a hospital-only product to the generalised six-kind product. This is a graded, in-change task (R8), not follow-up housekeeping; the docs must describe what actually shipped, so they land last.

**Threat-model addition (R2 + R4), explicit and accepted:** widening onboarding to residencias, disability day/occupational centres and palliative units **raises the safeguarding bar** — those populations include people with cognitive impairment and vulnerable adults, the new kinds have **weaker independent trust markers** than large public hospitals, and a small/rare kind (a lone palliative unit) can be small enough that "one such centre in this city" narrows the population (single-surface identifiability, D19). Verification stays **self-declared with admin validation** (unchanged in shape). This is recorded as an **explicit, accepted, demo-scoped open risk**, with real institutional verification/accreditation named as the next follow-on. No copy or doc may claim a safeguarding posture the code does not implement.

## Rollback

Purely additive on the authenticated and public surfaces beyond the migration. Revert the code and the schema can stay generalised harmlessly (existing rows remain valid hospitals under the `centre` role). The migration is reversible in place (D17 down path; clean while no non-hospital centre exists). Seed rows are additive upserts by fixed id. Vercel promotes the last good build.

## Open Questions

None blocking implementation. Resolved above: enum names (`CENTRE` on both role/type enums; `CentreType` as a real Prisma enum, D16); migration mechanics (hand-written RENAME + backfill, D17); registration shape (1:1 map kept, `centreType` added, D18); allow-list (add `centreType`, keep `type` forbidden, one-value predicate, D19); vocabulary strategy + term tables + slug preservation + rename deferral (D20 / 3b); filtering (client-side, D12); seed diversification.

Two items remain outside this design's authority, open for implementation:
1. **Basque (`eu`) copy quality** — blocking native-speaker review before merge (R9). Every `eu` string here is DRAFT.
2. **Final `es`/`en` narrative wording** — the tables above are the agreed basis and rule, not frozen text; the copy/apply phase owns final wording within the D20 strategy, and any data-stance claim may assert only what D9/D10/D14/D19 enforce.
