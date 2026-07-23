# Proposal — widen-beyond-hospitals

**Project:** Vivetutiempo (web master)
**Change:** `widen-beyond-hospitals`
**Phase:** Proposal (PRD altitude — no technical design, no specs)
**Persistence:** hybrid (this file + Engram `sdd/widen-beyond-hospitals/proposal`)
**Depends on:** `bootstrap-vivetutiempo-platform` (Block 1 Core, deployed) and `hospital-finder-and-home-clarity` (D9–D15, public directory + home clarity, deployed).
**ADR numbering:** continues the single register. The last change owned D9–D15, so this change owns **D16–D20**.

---

## 1. Intent

### The problem

Vivetutiempo was built around one kind of participating organisation: a **hospital**. That word is baked into two database enums, the authorization guards, the public directory's security predicate, the registration use case, the seed, ~1200 test occurrences and ~730 documentation occurrences. But "hospital" was never the concept — it was the *first instance* of the concept.

The concept is this, and the whole proposal should be read through it:

> **People whose circumstances keep them from going to culture, so culture comes to them.**

A hospital patient is one such person. So is a resident of a care home who no longer leaves it, a person spending the day in an occupational centre for disability, someone in a day hospital for oncology or psychiatric care, and a person in a palliative unit. The platform's premise — open an institution's idle hours to live culture — applies unchanged to all of them. What does *not* apply is the assumption, encoded everywhere in the product, that the institution is a hospital and the person is a "paciente".

Six kinds of care centre must be able to register and publish slots:

1. **Hospitales** (exists today)
2. **Residencias de mayores**
3. **Centros de día** (mayores y discapacidad)
4. **Hospitales de día** (oncológicos, psiquiátricos)
5. **Centros ocupacionales y de atención a la discapacidad**
6. **Unidades de cuidados paliativos**

Deliberately **out of scope**: centros penitenciarios and centros de menores — different governance, and for minors a far higher legal bar than this change is prepared to clear.

### Why now

The Core is deployed, the public directory and home-clarity surfaces are deployed (PRs #10 and #11 merged), and the product tells a coherent hospital-only story end to end. That coherence is exactly the moment to generalise: the domain model is small and uncontested, the public-projection discipline (D9/D10/D14) is fresh and its tests are the obvious template, and the registration path has exactly one non-artist type — so the 1:1 assumption is visible in one place instead of scattered across features that grew on top of it. Every month of new hospital-specific copy and tests makes the widening more expensive, not less.

As a TFM deliverable, this change is also the one that turns a demo into a *thesis*: it demonstrates that the architecture separates **authorization** (who may publish) from **domain kind** (what sort of place this is), and that adding a seventh centre type later is **data, not code**. That is a gradable architectural claim, and this change is where it is either proven or exposed as false.

### What success looks like

- Any of the six centre types can register (self-declared, admin-validated, exactly as hospitals do today), pick its **centre type** during registration, publish slots, and appear in the public directory tagged and filterable by type.
- An existing `HOSPITAL` row keeps working with **zero data loss**, now carrying the generic organisation role and centre type `hospital`.
- Adding a seventh centre type in future is a data change (a new enum value + copy), not a change to authorization code, guards, or the public read path.
- The product's **language** no longer tells a hospital-only story: home, about and help copy speak to the general concept, and type-specific terms ("residente", "participante", "paciente") appear only where the UI actually knows the type — in **all three locales**, with Basque reviewed by the assigned native speaker.
- The TFM documentation set describes the generalised product, not a hospital-only one.
- The safeguarding gap that widening opens is **written down** in the threat model as an explicit, accepted, demo-scoped risk — not silently inherited.

---

## 2. Target users and situations

| Role | Situation this change serves |
|---|---|
| **Prospective care centre (6 types)** | "We are a residencia / centro de día / unidad de paliativos — can we join and open our agenda to culture?" Today the answer is structurally "no". |
| **Existing hospital** | Nothing changes for them functionally; their data survives the migration and they keep publishing slots exactly as before. |
| **Patient / resident / participant / family** | "What kind of centre is this, and is there one near my relative?" The directory must distinguish a day centre from a palliative unit, or it is useless to the family it exists to serve. |
| **Admin** | Validates six kinds of self-declared centre instead of one; the queue and validation flow are unchanged in shape. |
| **TFM reviewer** | Reads the architecture claim — role ≠ kind, seventh type is data — and checks whether the code actually delivers it. |

The authorization model is **unchanged**: one role publishes slots, one role proposes activities. This change does not add a role, a permission, or an authenticated capability.

---

## 3. Scope

### In scope

- **Domain model:** introduce a generic organisation role and a **separate `CentreType` attribute** carrying the six kinds. Both `AccountRole` and `ProfileType` (which BOTH carry `HOSPITAL` today) are generalised; see §5.
- **Migration:** non-destructive rename of the `HOSPITAL` enum value to a generic value on both enums, plus a new `CentreType` enum/column backfilled to `hospital` for every existing row. No data loss (D17).
- **Registration redesign:** replace the strict 1:1 `profileTypeForRole` map in `registerProfile.ts` with a generic role plus a **required centre-type input**; expose the six choices in the registration UI instead of a hidden hospital default (D18).
- **Authorization guards:** update the literal `"hospital"` role/profile-type checks in `guards.ts` and its ~8 call sites (`listHospitalSlots`, `approveProposal`, `publishSlot`, `closeSlot`, `rejectProposal`) to the generic role. Same call shape, same guarantees.
- **Public directory:** centre type joins the D9 allow-list and becomes **public and filterable**; the security predicate widens from `type: "HOSPITAL"` to the six ACTIVE centre types (D19). The finder gains a type filter.
- **Vocabulary across `es`/`eu`/`en`:** a deliberate strategy (§6, D20), not a find/replace — the copy encodes hospital/patient semantics *narratively* in `Home.mission`, `About.purpose`, `Help.howItWorks`, `Home.trust`, etc.
- **Finder title copy:** "Encuentra tu hospital" → a generic centre-oriented title. The **route slug `/encuentra-tu-momento` does not change** (it is already generic; see §6.2).
- **Seed:** add ACTIVE centres of the new types across distinct cities, idempotently, so type filtering is demonstrable. Do not touch the existing PENDING "Hospital Esperanza".
- **Tests:** the ~1200 `hospital` occurrences across `e2e/` and `tests/`, split explicitly into **mechanical** renames and **semantic** new-scenario work (§8, R7).
- **TFM documentation:** update `README.md`, `docs/memoria-tfm-borrador.md`, `docs/slides-outline.md`, `docs/video-script.md`, `docs/security-threat-model.md`, `docs/tfm-readiness-report.md`. This is a **graded deliverable**, a task in this change, not a follow-up (§8, R8).
- **Threat model:** record the widened safeguarding risk as an explicit, accepted, demo-scoped open item (§4.3, R2).

### Out of scope (non-goals)

- **Institutional verification / accreditation.** Registration stays self-declared with admin validation, exactly as for hospitals today. Widening the model does not change *how* trust is established — it only widens *who* self-declares. The raised safeguarding bar is recorded as a risk, not closed here (§4.3).
- **Centros penitenciarios and centros de menores.** Different governance; minors carry a far higher legal bar. Explicitly excluded.
- **Any new authorization role or permission.** No new role in the enum, no new guard shape. The seventh-type extensibility is bought by the *type* axis being data, not by inflating the *role* axis.
- **Changing `PublicEventProjection` / ADR D6 / the non-correlation invariant D10.** The event surface is not touched. Adding type to the directory is assessed against D10 (§5.3) and found not to weaken it, but D10 itself is not edited.
- **Renaming internal hospital-named identifiers** (`Slot.hospitalProfileId`, the `HospitalSlots` relation, `listHospitalSlots`, `HospitalSlotBoardQuery`, `PublicHospitalProjection`, `hospitalDirectoryDeps`, etc.). These are internal and behaviour-neutral; a mechanical rename across ~1200 occurrences adds real regression risk for zero user-visible benefit. Recorded as a deliberate deferral with rationale (§5.4), not an oversight.
- **A real map, authenticated gating of public events, or distance/geolocation search.** Unchanged non-goals inherited from the finder change.

### Planned follow-on scope (leave room, do NOT build now)

- Real institutional verification / accreditation for the more vulnerable centre types — this is the natural next safeguarding step once the model supports them.
- Internal identifier rename (`hospital*` → generic) as a separate mechanical PR if the naming smell becomes a maintenance cost.
- A seventh centre type — which, if this change succeeds, is a data change and needs no new proposal.

---

## 4. Decided constraints (do not re-open)

These were settled with the product owner before this proposal. They are inputs, not open questions.

### 4.1 The model

1. **A generic organisation role plus a separate centre-type attribute.** NOT more values in the role enum. Authorization is unchanged: one role publishes slots, one role proposes.
2. **Adding a seventh centre type later must be data, not code** — a new enum value plus copy, with no change to guards, the public read path, or authorization.
3. **There are TWO enums**, `AccountRole` (the authorization gate) and `ProfileType` (the domain kind), and both carry `HOSPITAL` today. Both are generalised; the centre type lives on a new, third axis. This is not a rename of one value — `registerProfile.ts`'s `profileTypeForRole` is a strict 1:1 role→type map that needs real redesign.

### 4.2 The directory

4. **Centre type is PUBLIC and filterable.** It joins the `PublicHospitalProjection` allow-list (D9). Rationale, recorded: with six categories, a directory that cannot distinguish a day centre from a palliative unit is useless to the family it exists to serve. The correlation assessment is in §5.3 and is stated, not assumed.

### 4.3 Verification and safeguarding

5. **Institutional verification does NOT block this change.** Registration stays self-declared with admin validation, exactly as it is for hospitals today.
6. **The widened safeguarding risk MUST be recorded** in `docs/security-threat-model.md` as an explicit open risk. Widening to residencias and disability centres raises the safeguarding bar because those populations include people with cognitive impairment and vulnerable adults, and — unlike large public hospitals — the new centre types have weaker independent trust markers and can be small enough that "one such centre in this city" narrows the population.
7. **No overstatement beyond the demo framing.** The README already declares the project a TFM demo rather than a real rollout. The proposal, the copy and the docs must not claim a safeguarding posture the code does not implement.

### 4.4 Process

8. **All user-facing copy needs `es`, `eu`, `en`.** Basque requires human review by the assigned native speaker before merge; it is not shipped as final on this agent's word.
9. **Existing `HOSPITAL` rows survive with zero data loss.** The migration is non-destructive (D17).
10. **Conventional commits, no AI attribution.** Code, identifiers, comments and docs in English; UI strings live in `messages/*.json`.

---

## 5. The central architectural stance

### 5.1 Role and kind are two different questions

The tempting move is to add five values to the role enum: `RESIDENCIA`, `CENTRO_DIA`, and so on. We are explicitly rejecting that.

A role answers **"what may this account do?"** — publish slots, or propose activities. There are, and will remain, exactly two answers for participating organisations-plus-artists: the organisation that opens its agenda, and the artist that proposes. A centre type answers a completely different question: **"what kind of place is this?"** Conflating them means every new centre type forces a change to the authorization surface — new guard literals, new branches, new tests of *who can do what* — to express a fact that has nothing to do with permissions. That is how an authorization enum rots into a domain taxonomy, and it is exactly the failure this change exists to avoid.

So: the role axis stays binary-shaped (organisation vs artist, plus admin/patient as today), and a **separate `CentreType`** carries the kind. Authorization guards keep asking "is this the organisation role?" and never ask "which of six types?". The payoff is the gradable claim of this TFM: **the seventh centre type is a new row of data, not a new branch of code.**

### 5.2 Two enums, not one — and a real migration

Exploration corrected the original framing: `HOSPITAL` lives in **two** places — `AccountRole` (`'ADMIN','HOSPITAL','ARTIST','PATIENT'`) and `ProfileType` (`'HOSPITAL','ARTIST'`), both defined in `prisma/migrations/20260711000000_init/migration.sql` and mirrored in `src/domain` and `src/infrastructure/persistence/prisma/mappers.ts`. Generalising the model therefore touches both, plus a new third axis for the type.

The migration (formalised as D17) is non-destructive:

- **Rename** `HOSPITAL` → a generic organisation value on both `AccountRole` and `ProfileType`. Postgres does this in a single cheap statement (`ALTER TYPE ... RENAME VALUE`), and every existing row keeps working because the underlying value is renamed in place.
- **Add** a new `CentreType` enum/column, **backfilled to `hospital`** for every existing row — not user input, because every existing profile of the old type genuinely is a hospital.

**Verified, not assumed:** the ADR D4 raw-SQL partial unique indexes (`20260711000001_partial_unique_indexes/migration.sql`) reference **`ProposalStatus`** (`'ACCEPTED'`, `'SUBMITTED'`), NOT `ProfileType` or `AccountRole`. I confirmed this against the migration file directly. D4 is **not at risk** from widening these enums.

### 5.3 Centre type on the public directory — the correlation assessment, stated

Centre type joins the D9 allow-list. Today `type` is on the projection's `ForbiddenPublicHospitalKey` list (confirmed at `src/application/dto/PublicHospitalProjection.ts:36`) and blocked by the D14 compile-time assert, so publishing it is a deliberate edit to D9/D14, not a silent field addition. The security predicate also widens from `where: { type: "HOSPITAL", status: "ACTIVE" }` to the six ACTIVE centre types.

Two distinct risks must not be conflated:

- **Cross-surface correlation (D10).** The question is whether adding type to the directory lets someone join the directory to the public event surface and infer "centre X hosts event Y". **It does not, and here is why explicitly:** the public event surface (`PublicEventProjection`, D6) exposes **no location, no centre identity, and no Slot `location`** — the hospital is not on the event surface *at all*. Adding `centreType` to the directory therefore creates **no new join key** against events, because there is nothing on the event side to join to. **D10 is not weakened.** This is an assessment of the actual field sets, not an assertion of safety — and D19 requires **re-running both non-correlation suites** (`tests/unit/application/nonCorrelation.test.ts`, `e2e/non-correlation.spec.ts`), not merely adding assertions, so any adapter that accidentally joins type with a Slot/Event-derived field fails.
- **Single-surface identifiability (new, standalone).** Independent of correlation: "there is 1 unidad de cuidados paliativos in this city" plus a name is a stronger signal about who might be inside than "there is 1 hospital in this city" ever was — hospitals are large and heterogeneous; a palliative unit or a small disability day centre may narrowly identify its population. This is **not** a cross-surface leak; it is an inherent property of publishing institutional metadata that the product's core purpose (families must distinguish centre types) requires. It is accepted, because the directory lists **institutions that self-registered to be publicly listed**, names **no individual**, and publishes only institutional metadata. It is recorded in the threat model alongside the verification risk (§4.3).

### 5.4 Internal hospital-named identifiers stay, deliberately

`Slot.hospitalProfileId`, the `HospitalSlots` relation, `listHospitalSlots`, `HospitalSlotBoardQuery`, `PublicHospitalProjection`, `hospitalDirectoryDeps` and similar are internal identifiers. Renaming them touches a large fraction of the ~1200 `hospital` occurrences, is pure churn with no behaviour change, and every touched line is a chance to introduce a regression in a change that already carries a real migration and a full vocabulary rewrite. They stay `hospital`-named in this change. The maintainability smell is real and is recorded as planned follow-on scope (§3), to be done — if done — as a separate mechanical PR that is trivially reviewable *because* it changes nothing else.

---

## 6. Vocabulary — the hard problem, not the rename

This is the part exploration flagged as genuinely hard, and it deserves first-class treatment. The blast radius is not "rename `hospital` to `centro`". The copy encodes hospital/patient semantics **narratively**: `Home.mission`, `About.purpose`, `Help.howItWorks`, `Home.trust` contain full sentences written *from the premise of a hospital ward* ("Las estancias hospitalarias largas aíslan", "Cada hueco lo abre un hospital, no una plataforma anónima"). And the problem exists **independently in three languages** — translating a Spanish choice into Basque and English does not solve it, because the lexical gap exists separately in each.

### 6.1 There is no clean generic noun — so stop looking for one

For the **person**: "paciente" is wrong for a residencia (residente) and for a centro de día (usuario/participante). No single Spanish noun covers hospital patient + residencia resident + day-centre participant. Basque and English have the same gap. "Persona usuaria" is bureaucratic; "centro sociosanitario" is accurate but cold; "centro" alone is vague.

**The proposed resolution — a hybrid, and the key move is to phrase around the relationship, not to find a noun:**

- **In cross-type narrative and structural copy** (home, about, help, footer — anywhere the UI does *not* know the concrete type), use **relational phrasing built on the core concept** — "people whose circumstances keep them from going to culture". Instead of an awkward umbrella noun, phrase around what is true of all six: *the people who are there*, *the people in their care*, *quienes viven o pasan el día allí*. Relational phrasing generalises cleanly where a single noun cannot, and it stays warm — which the bureaucratic nouns do not. The institution, where a noun is unavoidable, is "centro de cuidado" / "care centre" / (eu — native review).
- **Where the UI already knows the concrete type** (registration, the slot board, admin validation, the directory's type tag), use the **type-specific correct term**: hospital → paciente, residencia → residente, centro de día → usuario/participante, and so on. This is where accuracy and warmth both live, and the UI has the type in hand, so there is no cost to being precise.

This hybrid is proposed for **all three languages**, applying the same principle (relational-where-general, specific-where-known) in each — not by translating the Spanish. Basque is flagged for the assigned native-speaker review; the English and Basque relational phrasings are drafted independently, not derived from the Spanish, precisely because the gap is language-specific.

The alternatives, and why they lose: (a) **role-specific copy per centre type everywhere** — most accurate, but 3 languages × 6 types of narrative copy to write and keep in sync, unmaintainable for a demo; (b) **one generic umbrella noun everywhere** — simplest, but every candidate noun is either vague or cold, and it flattens exactly the warmth that is this product's whole tone. The hybrid takes accuracy where it is free (type known) and warmth where a noun would fail (type unknown).

### 6.2 The finder title, and the route slug that must NOT change

`/encuentra-tu-momento` is titled **"Encuentra tu hospital"** (`messages/es.json:88-89`, same in `en`/`eu`), and its copy assumes hospitals throughout. The **title copy** must change to a generic centre-oriented phrase ("Encuentra un centro" / "Encuentra tu momento" as the aspirational option — final wording decided in spec/copy).

But — a concrete finding worth stating loudly — the **route slug is already generic**: it is `encuentra-tu-momento` ("your moment"), not `encuentra-tu-hospital`. Only the *visible copy* says hospital. So the slug **stays unchanged**, deliberately: PR #11 (Open Graph and sharing, now merged) publishes share/OG links that point at `/encuentra-tu-momento`, and changing the slug would break every already-shared link and every social preview for zero benefit. This is a decided constraint, not an open question: **change the copy, keep the slug.**

---

## 7. Affected capabilities

| Capability | Nature of change |
|---|---|
| **organisation registration** (existing) | Generic role + required centre-type input replaces the 1:1 `profileTypeForRole` map; UI exposes six choices. Self-declared + admin-validated, unchanged in shape. |
| **authorization guards** (existing) | Literal `"hospital"` role/profile checks generalised to the organisation role. Same call shape, same guarantees, ~8 call sites. |
| **domain model + persistence** (existing) | `AccountRole` and `ProfileType` `HOSPITAL` values generalised; new `CentreType` axis added; mappers updated. Non-destructive migration. |
| **public-centre-directory** (was public-hospital-directory) | Security predicate widens to six ACTIVE centre types; `centreType` joins the D9 allow-list and becomes filterable. New type filter in the finder. |
| **public-event-browsing** (existing) | **No functional change.** D6/D10 untouched. Gains one obligation: re-run both non-correlation suites to confirm type adds no join. |
| **i18n / copy** (existing) | Vocabulary strategy across `es`/`eu`/`en`; narrative copy rewritten off the hospital premise; finder title changed. D13 parity guard already protects key sets. |
| **seed dataset** | New ACTIVE centres of the new types across distinct cities, idempotent. Esperanza untouched. |
| **TFM documentation** | Six docs describing a hospital-only product updated to the generalised product. Graded deliverable. |
| **test suites** | ~1200 `hospital` occurrences split into mechanical renames and semantic new-type scenarios. |

---

## 8. ADRs this change introduces

To be formalised in `sdd-design`. Numbering continues the single register (last change owned D9–D15).

- **D16 — Generic organisation role + `CentreType` as a separate data axis.** Why role and kind are two questions, why the type axis is data and the role axis is not widened, and how the seventh-type-is-data property is delivered and tested. Records that BOTH `AccountRole` and `ProfileType` are generalised.
- **D17 — Non-destructive enum migration.** `ALTER TYPE ... RENAME VALUE` of `HOSPITAL` → generic on both enums; new `CentreType` enum/column backfilled to `hospital`; zero data loss. Records the verified fact that D4's partial unique indexes reference `ProposalStatus` only and are unaffected.
- **D18 — Registration redesign.** Replace the strict 1:1 `profileTypeForRole` map with a generic role plus a required centre-type input; expose six choices in the UI; keep `hospitalLocationFrom` (or its generalised successor) working for all types. Guards keep the same role gate.
- **D19 — `centreType` joins the D9 public allow-list; the security predicate widens to six types.** Removes `type` from `ForbiddenPublicHospitalKey`, adds `centreType` to the projection and to the D14 layered enforcement. Records the §5.3 correlation assessment (D10 not weakened, because events expose no centre identity) and requires re-running both non-correlation suites. Records the standalone single-surface identifiability risk as accepted-and-documented.
- **D20 — Vocabulary strategy across three languages.** Relational phrasing where the type is unknown, type-specific terms where the UI knows the type; applied independently per language, not translated; finder title changed, route slug preserved; Basque native-speaker review as a blocking gate.

---

## 9. Risks and mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **Two enums, one migration — a botched `ALTER TYPE` or missed backfill loses or orphans existing hospital rows.** | High — data loss on the deployed product. | D17: rename-in-place (values preserved), additive `CentreType` column backfilled to `hospital`, tested against a real Postgres migration run before deploy. Verified D4 is unaffected. Migration is reversible in dev; document the down path. |
| R2 | **Safeguarding bar rises for residencias and disability centres** (cognitive impairment, vulnerable adults) while verification stays self-declared. | High (real-world) / accepted (demo) | §4.3: record as an explicit, accepted, demo-scoped risk in `docs/security-threat-model.md`. Real verification is named as the next follow-on. No copy or doc may claim a posture the code does not implement (§4.4-7). **Note:** the dedicated `pending-hospital-onboarding` memory could not be retrieved in this session; its substance is captured from exploration §6 and must be reconciled if that memory is later recovered. |
| R3 | **Vocabulary is treated as a find/replace and ships hospital-premised narrative copy under generic labels.** | High — the product's tone and truthfulness both break; a "residencia" page that says "durante su estancia hospitalaria". | D20 + §6: the hybrid relational strategy is a copy-writing task, not a rename; narrative copy (`Home.mission`, `About.purpose`, `Help.howItWorks`, `Home.trust`) is rewritten, not substituted. Reviewed per locale. |
| R4 | **Single-surface identifiability** — type + city narrows small/rare centre types (palliative, small day centres) toward their population. | Medium (real-world) / accepted (demo) | §5.3: documented in the threat model as inherent to the product's discovery purpose; institutions self-register to be listed; no individual is named. Not a D10 correlation leak — assessed and distinguished explicitly. |
| R5 | **Centre type accidentally becomes a cross-surface join key**, weakening D10. | High if true | §5.3: assessed false — the event surface exposes no centre identity, so there is nothing to join to. D19 **re-runs** both non-correlation suites (not just adds assertions) to catch any adapter that introduces a join. |
| R6 | **Registration redesign breaks the single-type assumption in non-obvious places** (`hospitalLocationFrom`, seed, admin validation copy, mappers). | Medium | D18: redesign `profileTypeForRole` deliberately rather than patching; strict TDD on the use case; integration test that all six types register, validate and publish a slot. |
| R7 | **~1200 `hospital` test occurrences** — a blind rename passes tests that no longer assert anything meaningful, or breaks fixtures wholesale. | Medium-High | §3: split explicitly into **mechanical** (fixture/id renames where `hospital` is an internal name kept per §5.4 — often NO change needed) and **semantic** (new per-type scenarios: register a residencia, filter by type, migration survival). Do not auto-replace; the internal identifiers deliberately stay `hospital`-named. |
| R8 | **~730 doc occurrences across six TFM files** left stale post-merge. | Medium — a graded deliverable describing the wrong product. | §3: doc update is an in-change task, not housekeeping. `README.md`, `docs/memoria-tfm-borrador.md`, `docs/slides-outline.md`, `docs/video-script.md`, `docs/security-threat-model.md`, `docs/tfm-readiness-report.md`. The threat-model and readiness-report updates carry the safeguarding risk (R2). |
| R9 | **Basque copy quality cannot be verified by the agent**, and the relational phrasing must be drafted natively, not translated. | Medium | D20 + §4.4-8: `eu` copy is a blocking human-review checklist item; drafted independently per §6.1, not derived from Spanish. Not shipped as final on the agent's word. |
| R10 | **Merge conflict with in-flight Block 3 (payments).** | Medium | §10: exploration found no payment code in `src/` and no `AccountRole`/`ProfileType` overlap. Land or park Block 3 before starting this change (it is smaller and already reviewed) to avoid rebasing 6 payment commits across a vocabulary rewrite and migration. Confirm payments does not key anything by centre type before this lands. |
| R11 | **Route-slug change breaks shared/OG links from PR #11.** | Medium if done | §6.2: decided constraint — the slug is already generic; **change the copy, keep the slug.** No slug change ships. |

---

## 10. Delivery sequence

This change is large — a migration, a registration redesign, an allow-list widening, a three-language vocabulary rewrite, ~1200 test touches and ~730 doc touches. It is **not** a single PR. It is a dependency-ordered chain, and the ordering is load-bearing.

**Pre-condition (state check, not work):** PRs #10 (event ratings) and #11 (Open Graph + sharing) are **merged to `main` and deployed** — good, they are no longer a conflict source. Block 3 (simulated payments) is **six local unpushed commits on `feat/support-payments`, reviewed to ESCALATED**. Exploration found no `src/` payment code and no enum overlap, so conflict risk is low; but this change rewrites `messages/*.json` and runs a migration, so:

> **Land or park Block 3 first.** It is smaller, already reviewed, and has no overlap with the enum/vocabulary work. Clearing it off the working tree avoids rebasing 6 payment commits across a migration and a full copy rewrite. Confirm payments keys nothing by centre type before this change merges.

**Then, in order:**

1. **Model + migration (D16, D17).** Generalise both enums, add `CentreType`, backfill existing rows to `hospital`, update mappers and `src/domain`. Prove the migration against real Postgres with zero data loss. No user-visible change yet except the schema. *Must be first — everything else depends on the type axis existing.*
2. **Registration + guards (D18).** Redesign `profileTypeForRole`, add the required centre-type input, generalise the guard literals and their ~8 call sites, expose six choices in the registration UI. Integration test: all six types register → validate → publish a slot. *Depends on 1.*
3. **Public directory widening (D19).** Widen the security predicate to six ACTIVE types, move `centreType` onto the D9 allow-list and into the D14 layered enforcement, add the type filter, re-run both non-correlation suites. Seed new-type centres. *Depends on 1; independent of 2.*
4. **Vocabulary rewrite (D20).** The three-language hybrid copy across narrative + labels, the finder title, all `messages/*.json`. Basque native review gate before merge. *Touches the same JSON as 2 and 3 — sequence it after them to avoid re-conflicting, or fold the per-surface copy into 2 and 3 and reserve this step for the narrative `Home`/`About`/`Help` rewrite.*
5. **Test blast radius.** Split mechanical vs semantic; add the new-type scenarios; confirm internal `hospital`-named identifiers (kept per §5.4) still read coherently. *Runs continuously with 1–4; called out separately because R7 is where a green-but-vacuous suite hides.*
6. **TFM documentation (R8).** Update all six docs to the generalised product; the threat model and readiness report carry the safeguarding risk (R2). *Last, because it must describe what actually shipped.*

Steps 1 → 2/3 → 4 → 6 is the hard order. Chain the PRs; do not attempt a single 400+-line PR. `sdd-tasks` decides the exact PR boundaries against the delivery strategy.

---

## 11. Rollback

- **Migration (D17):** the enum rename is reversible in-place; the `CentreType` column is additive and can be dropped. Because existing rows are backfilled to `hospital`, a rollback leaves them as hospitals — their original meaning. Document the down migration.
- **Registration / guards / directory:** revert the code; the schema can stay generalised harmlessly (existing rows remain valid hospitals under the generic role). No authenticated flow, no domain invariant beyond the type axis, no new state machine.
- **Vocabulary / docs:** presentation and text only; revert restores the hospital-only copy.
- **Seed:** additive upserts by fixed id; reverting stops creating new-type rows; existing dev rows are inert demo data.
- **Deployment:** Vercel promotes the last good build; the only irreversible-by-promotion element is the migration, which is itself reversible (see above).

---

## 12. Open questions for `sdd-spec` / `sdd-design`

- Final generic value name for the renamed role/type (`ORGANIZATION`? `CARE_CENTRE`?) and the `CentreType` value names.
- Whether `ProfileType` is kept as a distinct enum from `AccountRole` after generalisation, or whether the type axis makes one of them redundant. (Model decision; design owns it. The role/kind separation is fixed; the enum topology is not.)
- Final finder title copy and the type-filter UI shape (chips? dropdown?).
- Final relational phrasings per language for narrative copy, and the type-specific term table for hospital/residencia/centro de día/hospital de día/centro ocupacional/paliativos in `es`/`eu`/`en`.
- Exact new-type seed roster (which types, cities, coordinates) so type filtering is demonstrable.
- Whether the safeguarding risk warrants a soft in-product disclaimer on registration for the more vulnerable types, or stays doc-only for the demo.
- The precise mechanical/semantic split for the ~1200 test occurrences, given internal identifiers stay `hospital`-named.

## 13. Next phase

- `sdd-spec` — Given/When/Then for: each of the six types registering, validating and publishing a slot; the migration preserving existing hospital rows; the directory security predicate admitting exactly the six ACTIVE types and nothing pending/rejected; type filtering; the allow-list including `centreType` and excluding everything else; both non-correlation directions still holding.
- `sdd-design` — formalise D16–D20, the enum topology and migration steps, the `registerProfile` redesign, the widened projection and predicate, the vocabulary term tables, and the test topology across unit / integration / e2e.

`sdd-spec` and `sdd-design` can run in parallel; both depend only on this proposal.
