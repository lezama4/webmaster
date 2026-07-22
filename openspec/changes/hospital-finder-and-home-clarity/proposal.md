# Proposal — hospital-finder-and-home-clarity

**Project:** Vivetutiempo (web master)
**Change:** `hospital-finder-and-home-clarity`
**Phase:** Proposal (PRD altitude — no technical design, no specs)
**Persistence:** hybrid (this file + Engram `sdd/hospital-finder-and-home-clarity/proposal`)
**Depends on:** `bootstrap-vivetutiempo-platform` (Block 1 Core, deployed)
**Sequencing:** Feature A ships and is verified BEFORE Feature B starts. This is a hard sequence, not a preference.

---

## 1. Intent

### The problem

Two distinct gaps, both on the public (anonymous) surface — the front door of the platform.

**Gap A — there is no way to find a participating hospital.** The platform's whole premise is that hospitals open their agenda to culture. Today a visitor cannot see *which* hospitals participate, where they are, or whether there is one near them. `Home.trust.hospitals` currently lists four illustrative names (two real seed profiles, two fabricated, with a disclaimer) — the home *gestures* at hospitals without the platform ever actually publishing a hospital directory. For a patient's family, "is my hospital in this?" is the first real question, and it has no answer.

**Gap B — the landing never says what the platform is.** The current home opens on a full-bleed hero with a serif headline and two CTAs, then goes straight into Mission (emotional "why"), Institutional trust, Artists, Voices, Closing CTA. Nowhere in that sequence does a first-time visitor get a plain, concrete answer to *what is this and how does it work*. Mission earns the "why" but assumes the "what". `/ayuda` explains the four-role step flow, but only to someone who already decided to dig. The landing is doing emotional work on top of an unstated premise.

### Why now

The Core is deployed and demonstrably working end to end. What it lacks is a credible public face. As a TFM deliverable, the reviewer's first thirty seconds are on the landing page — and right now those thirty seconds do not communicate the product. Equally, the hospital directory is the natural next public read surface, and it is the *right* one to build now because it forces a second explicit public allow-list. That makes ADR D6 look like a repeatable architectural pattern rather than a one-off, which is exactly the kind of demonstrable, principled decision the TFM is graded on.

There is also a narrow-window argument: the public projection discipline is currently clean and uncontested. Adding the second projection now, while the first is fresh and its tests are the obvious template, is far cheaper than retrofitting the pattern later under feature pressure.

### What success looks like

**Feature A.** An anonymous visitor opens `/encuentra-tu-momento`, searches by hospital name, city or postal code, sees matching hospitals in a list and as pins on a map, and can tell at a glance whether a participating hospital is near them. No login. No external network request to render the map. And — critically — nothing on that page, in the JSON it is built from, or in the DOM it renders, discloses anything about that hospital's events, slots or proposals.

**Feature B.** A first-time visitor lands on the home, and within one screen-scroll past the hero understands: this connects hospitals with artists, it fills waiting hours with live culture, it is free, it is non-profit, and the flow is hospital publishes → artist proposes → event published. If they want depth, `/quienes-somos` gives them purpose, the four roles, the full flow, admin validation, **what data is published and what deliberately is not**, and why it is free.

Success for the change as a whole includes one non-functional property stated as a test, not as an intention: **non-correlation** (§5).

---

## 2. Target users and situations

| Role | Situation this change serves |
|---|---|
| **Patient / Family** | "Is my hospital part of this? Is there one near me?" — Feature A. And, before that, "what even is this site?" — Feature B. |
| **Prospective Hospital** | Evaluating whether to join; wants to see peer institutions participating and understand the governance model (admin validation) before registering. |
| **Prospective Artist** | Wants to know geographic reach before signing up. |
| **Anonymous visitor / TFM reviewer** | Arrives cold on the landing and must understand the product without reading docs. |

Both features are **fully anonymous**. Neither adds an authenticated capability.

---

## 3. Scope

### In scope — Feature A: "Encuentra tu momento" (FIRST)

- New public route `/encuentra-tu-momento`. No `[locale]` segment — this project resolves locale from the `NEXT_LOCALE` cookie (falling back to `Accept-Language`), so one path serves `es`/`eu`/`en`.
- A **new, separate** public projection `PublicHospitalProjection` with the allow-list `name`, `city`, `postalCode`, `latitude`, `longitude`.
- A new application port + use case + Prisma adapter + composition-root wiring, mirroring the `listPublishedEvents` read path exactly.
- Search/filter over hospitals by **name**, **city** and **postal code**.
- A **mocked map**: inline SVG, pins positioned from `latitude`/`longitude` via a shared projection function. No tile provider, no API key, no external HTTP request, no new npm dependency.
- Seed expansion: 3–4 **new** ACTIVE hospitals in distinct Spanish cities with plausible coordinates, added idempotently.
- New i18n namespace in `messages/es.json`, `messages/eu.json`, `messages/en.json`.
- Tests: allow-list unit test, hostile-adapter unit test, integration test against the real DB, Playwright e2e covering both the data boundary and the rendered page.

### In scope — Feature B: home clarity + `/quienes-somos` (SECOND)

- A short explanatory block on the home, inserted **between Hero and Mission**. It answers "what is this, concretely"; Mission then earns the emotional "why".
- The user-approved Spanish copy is the **basis, not frozen text** — it is expected to be refined during spec/design. The headline already exists in the current hero:

  > **Ayudamos a que la vida no se detenga**
  > Vivetutiempo conecta hospitales con artistas para llenar las horas de espera con música, talleres y actuaciones en directo. Gratis para todos. Sin ánimo de lucro.
  >
  > Hospitales publican huecos → Artistas proponen actividades → Se publica el evento
  >
  > [Ver próximos eventos] [Cómo funciona →]

- New route `/quienes-somos` covering, in depth: purpose and social mission; the four roles (Admin, Hospital, Artist, Patient/Family); the full flow; profile validation by an Admin; **what data is published and what is deliberately not**; and why the platform is free and non-profit.
- New i18n namespace(s) across all three locale files.
- Navigation entries in `SiteHeader` / `SiteFooter` for both new routes.

### Out of scope (non-goals)

- **Modifying `PublicEventProjection` or ADR D6 in any way.** Not relaxed, not extended, not "just one more field".
- **Gating public events behind authentication.** This is real future work and it is deliberately deferred. The design must not make it *harder*, but must not implement or half-implement it.
- **A real map.** No Leaflet, Mapbox, react-map-gl, deck.gl, tile server, geocoding API or geolocation permission prompt. The map is explicitly and honestly mocked.
- **Flipping "Hospital Esperanza" to ACTIVE.** It is deliberately PENDING to demo the admin validation queue, and tests depend on that. It stays PENDING.
- **Exposing `addressLine`.** Street address is out of the public projection by decision (§4).
- **Distance / "near me" ranking, radius search, or browser geolocation.** Postal-code and city text search only.
- **Any change to authenticated hospital-facing screens.**
- **Rewriting `/ayuda`.** `/ayuda` owns the four-role step-by-step how-to; `/quienes-somos` owns purpose, roles, governance, data stance and funding model. Clear content ownership, no duplicated copy that can drift.

### Planned follow-on scope (leave room, do NOT build now)

- Authenticated gating of the public events surface.
- A real map provider behind a `MapTileProvider`-style seam, if the mocked map ever proves insufficient.
- Hospital-level "activity intensity" signals — which would need a fresh privacy analysis precisely because it edges toward correlation.

---

## 4. Decided constraints (do not re-open)

These were settled with the product owner before this proposal. They are inputs, not open questions.

1. **`PublicHospitalProjection` is a NEW, SEPARATE allow-list.** `PublicEventProjection` (ADR D6) is untouched.
2. **Non-correlation is the privacy property being bought** (§5).
3. **Public fields:** `name`, `city`, `postalCode`, `latitude`, `longitude`. **`addressLine` is excluded** — coordinates are sufficient to place a pin, and a street address is materially more identifying than a city-level coordinate.
4. **Only `status: ACTIVE` and `type: HOSPITAL` profiles may appear publicly.** Pending, rejected and deactivated hospitals are invisible.
5. **The use case rebuilds the DTO field by field** from the port result, never passing the adapter's object through — the pr2a-B1 defence-in-depth pattern already used by `listPublishedEvents`.
6. **Public events stay publicly visible for now.**
7. **Seed:** add new ACTIVE hospitals; do not touch Esperanza; keep `prisma/seed.ts` idempotent (upsert keyed by fixed id — `PrismaProfileRepository.save` already upserts).
8. **All user-facing copy needs `es`, `eu`, `en`.** Basque requires human review before merge; it is not shipped as final on this agent's word.
9. **Strict TDD is active.** Runner `npm run test`. Integration tests require `VIVETUTIEMPO_RUN_INTEGRATION=true` or they are *silently skipped* — skipped is never reported as passed.
10. **Conventional commits, no AI attribution.** Code, identifiers, comments and docs in English; UI strings live in `messages/*.json`.

---

## 5. The central architectural stance

### 5.1 A new allow-list, not a wider one

The tempting move is to reuse `PublicEventProjection` and add a hospital field. We are explicitly rejecting that.

An allow-list only means something if widening it is expensive. The moment one projection serves two surfaces with different privacy requirements, its field list stops being a statement about *what is safe to publish* and becomes a union of *whatever each caller happened to need*. That is how allow-lists decay into deny-lists by accident.

So: a second, independent, narrow allow-list, with its own DTO, its own port, its own use case, its own adapter, and its own tests. The cost is duplicated plumbing. The payoff is that each public surface's exposure is readable in one file, and that the project now has a **repeatable pattern** — "any new public surface gets its own explicit allow-list, documented as an ADR" is already a stated project convention, and this change is the first time it is exercised twice.

### 5.2 Non-correlation — the invariant this change must buy

State it plainly, because it is the whole privacy argument:

> **Someone browsing both public surfaces must not be able to infer that a given hospital hosts a given event.**

Concretely, and testably:

- The hospital directory MUST NOT expose any Slot-, Proposal- or Event-derived field. Not event counts. Not "next activity". Not a "has upcoming events" boolean.
- The events surface MUST NOT gain any hospital-identifying field — directly or by proxy (no hospital id, name, city, postal code, coordinates; ADR D6 already forbids Slot `location`).
- No shared identifier, ordering, or timing signal may allow joining the two datasets.

This matters because a hospital is a place where identifiable people are unwell. "Hospital X hosts a music session in the paediatric oncology ward on Tuesdays" is a sentence this platform must never publish, and must never let anyone *assemble*. The individually-harmless facts are the risk; the join is the leak.

The important consequence: **non-correlation cannot be enforced by either projection alone.** Each one is individually clean. The property is a relation between them. So it needs its own explicit test, not just two allow-list tests.

### 5.3 Making `addressLine` exclusion enforced, not remembered

Exploration flagged this correctly: nothing in the type system or schema stops someone adding `addressLine` to the adapter's Prisma `select`. Today it is discipline. Discipline degrades.

This change must convert that into something mechanical. The design phase picks the mechanism; the proposal's requirement is that **at least one automated check fails if a forbidden field appears on the public hospital projection**. Candidate mechanisms (for `sdd-design` to choose between):

- An exact-key-set assertion on the DTO in a unit test (`Object.keys(result[0]).sort()` deep-equals the allow-list) — catches widening at the use-case boundary, already the `listPublishedEvents` pattern.
- A hostile-adapter test: a fake port that deliberately returns `addressLine`, `email`, `id` and event data, asserting the use case strips all of it — catches the adapter-widening scenario the field-by-field rebuild exists to defend against.
- An integration-level assertion that the real Prisma adapter's output has exactly the allow-listed keys — catches a `select` widened in infrastructure.
- An e2e assertion that the forbidden strings never appear in the rendered page or the JSON boundary.

The first two are mandatory. The third and fourth are strongly recommended, mirroring `public-event-projection-query.test.ts` and `public-projection.spec.ts`.

---

## 6. Affected capabilities

| Capability | Nature of change |
|---|---|
| **public-hospital-directory** (new) | Anonymous search over ACTIVE hospitals by name/city/postal code; mocked coordinate map. New allow-list, port, use case, adapter, route. |
| **public-event-browsing** (existing) | **No functional change.** Gains one new obligation: an explicit non-correlation test asserting it discloses no hospital-identifying data. ADR D6 unchanged. |
| **public-information** (new/expanded) | Home clarity block + `/quienes-somos`. Presentation only — no new data access, no new port. |
| **seed dataset** | 3–4 new ACTIVE hospitals across distinct Spanish cities. Idempotent. Esperanza untouched. |
| **i18n** | New namespaces in all three locale files; introduces the need for a parity guard (§8). |

---

## 7. ADRs this change introduces

To be formalized in `sdd-design`. Numbering continues the project's existing single ADR register (bootstrap ended at D8), so D6 remains the stable reference it already is in the project context.

- **D9 — `PublicHospitalProjection`: a second, independent public allow-list.** Why a new DTO/port/use-case/adapter rather than widening `PublicEventProjection`. Records the field list, records `addressLine` as a deliberate exclusion with its rationale, and records the `ACTIVE` + `HOSPITAL` filter as a security predicate rather than a UX filter.
- **D10 — Non-correlation as a cross-surface invariant.** States the property, states that it cannot be enforced by either projection in isolation, and specifies the test that owns it.
- **D11 — Mocked map: inline SVG with coordinate projection, zero dependencies.** Why not a tile library (dependency cost, API key, external requests from a health-adjacent page, and the fact that a real map implies a precision the data does not have). Covers the projection function, accessibility (each pin focusable and labelled), responsiveness (`viewBox`), and testability (stable `data-testid` / `aria-label` per pin, assertable without pixel diffing).
- **D12 — Search execution strategy.** Server-side filtering in the port versus client-side filtering over a fully-loaded projection. Small dataset favours client-side simplicity; the privacy argument and future dataset growth favour the port. `sdd-design` decides and records the tradeoff, including how search input is handled safely.
- **D13 — Locale parity guard.** Introducing a mechanical check that `es`/`eu`/`en` share an identical key set. Currently parity is convention-only with no automated guard.

---

## 8. Risks and mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **`addressLine` exclusion is not type-enforced.** Nothing prevents a future `select` widening. | High — a silent privacy regression that no test catches. | Mandatory exact-key-set assertion + hostile-adapter test at the use-case boundary; recommended integration and e2e key assertions. Field-by-field DTO rebuild (constraint 5) means a widened adapter cannot leak through the use case. See §5.3. |
| R2 | **No automated `es`/`eu`/`en` locale-parity test.** Two new namespaces × three files is manual. A key present in `es` but missing in `eu` surfaces at runtime, not at build. | Medium — user-visible breakage in the least-exercised locale, likely found by a Basque-speaking reviewer rather than CI. | ADR D13: add a lightweight parity test comparing flattened key sets across the three files. Cheap, catches an entire class of defect, and retroactively protects the existing namespaces too. |
| R3 | **Non-correlation is easy to violate accidentally** — a helpful future "3 upcoming events" badge on a hospital card would break it without looking like a privacy change. | High — this is the change's core privacy claim; violating it silently is worse than never claiming it. | ADR D10 + a dedicated hostile-adapter test in the style of `listPublishedEvents.test.ts`, asserting both directions: the hospital DTO rejects event-derived fields, and the event DTO rejects hospital-derived fields. Record the invariant in the DTO doc comments (matching D6's style) so the next developer reads it before widening. |
| R4 | **N=1 active hospital today.** Search and a multi-pin map cannot be demonstrated with one data point. | Medium — feature looks broken/pointless in the demo. | Seed 3–4 new ACTIVE hospitals across distinct cities and postal codes. Esperanza stays PENDING (tests and the admin-queue demo depend on it). Upsert-keyed by fixed id keeps the seed idempotent. |
| R5 | **Basque copy quality cannot be verified by the agent.** Existing `eu.json` is genuine translation, so the project's bar is real translation, not stubs. | Medium — shipping machine Basque on a page about trust and governance undermines the page. | Flag `eu` copy for explicit human review as a blocking checklist item before merge. Do not present it as final. |
| R6 | **Coordinate projection distorts at national scale.** A naive linear lat/lon projection visibly skews Bilbao vs Madrid. | Low — acceptable for a *stated* mock. | Label the map honestly as indicative in UI copy. Do not imply navigational accuracy. Keep the projection in one shared, unit-testable function. |
| R7 | **Home block placement could break the `<Reveal>` scroll narrative** (Hero → Mission → Trust → Artists → Voices → Closing). | Low-Medium — regression in the landing's polish, which is the TFM's first impression. | Insert between Hero and Mission, matching the existing `<Reveal>` + `border-t border-border` section conventions. Visual review before merge. |
| R8 | **Content drift between `/ayuda` and `/quienes-somos`.** Two pages explaining overlapping things diverge over time. | Low | Explicit content ownership stated in §3 and to be restated in the spec: `/ayuda` = step-by-step how-to; `/quienes-somos` = purpose, roles, governance, data stance, funding. |
| R9 | **Route naming precedent.** No existing segment is multi-word (`ayuda`, `events`, `login`, `register`). | Negligible | `encuentra-tu-momento` / `quienes-somos` are standard kebab-case Next.js segments. Noted so a reviewer does not read it as an inconsistency. |
| R10 | **Feature B is more visible and more fun than Feature A**, creating pressure to reorder. | Medium — Feature A carries all the architectural and privacy weight; doing it second under time pressure is exactly how allow-list discipline gets skipped. | Sequence is a constraint, not a preference. Feature A ships and is verified before Feature B begins. Restated in §9. |

---

## 9. Sequencing — Feature A precedes Feature B

**Feature A ("Encuentra tu momento") is built, tested and verified before any Feature B work starts.**

The reasoning is not scheduling convenience. Feature A is where the architecture and privacy decisions live — the second allow-list, the non-correlation invariant, the enforcement tests, the seed expansion. Feature B is presentation-layer copy and layout with no new data access. If they run together, the cheap, visible, satisfying work crowds out the careful work, and the privacy tests become the thing that gets trimmed when the deadline bites.

There is also a content dependency in the right direction: `/quienes-somos` must state *what data is published and what is deliberately not*. That statement is only truthful once Feature A has actually defined and enforced the public hospital allow-list. Writing it first would mean writing a privacy promise the code has not yet made.

Feature A is done when: the allow-list, non-correlation and hostile-adapter tests pass; the integration test passes with `VIVETUTIEMPO_RUN_INTEGRATION=true` (skipped is not passed); the e2e leak check passes; and the page works in all three locales.

---

## 10. Rollback plan

Both features are **additive on the public surface** and touch no authenticated flow, no domain invariant, and no existing state machine.

- **Feature A:** new files plus one new export in the composition root and optional nav links. Reverting is deleting the route and the new port/DTO/use-case/adapter. `PublicEventProjection` is untouched by construction, so a revert cannot regress the existing public surface.
- **Feature B:** presentation-only. Revert is removing one home section, one route, and the added `messages/` namespaces.
- **Seed:** additive upserts keyed by fixed ids. Reverting the seed file stops creating the new rows; existing dev rows are inert demo data, not user data.
- **Deployment:** Vercel promotes the last good build; no migration is required by this change (no schema change — all fields already exist on `Profile`).

---

## 11. Open questions for `sdd-spec` / `sdd-design`

- Exact seed roster: which 3–4 cities, postal codes and coordinates.
- Server-side vs client-side search filtering (ADR D12), including how the search term is validated and how empty/no-results states behave.
- Whether the home clarity block and `/quienes-somos` share one i18n namespace or use two.
- Whether the map renders as pure SVG pins or an SVG frame with absolutely-positioned HTML `<button>` pins — an accessibility/testability tradeoff, not a visual one.
- Whether the locale-parity guard (D13) is scoped to the new namespaces or applied repository-wide from the start (recommended: repository-wide; the marginal cost is near zero and the coverage is much larger).
- Final refined Spanish copy for the home block, and its `eu`/`en` counterparts.

---

## 12. Next phase

- `sdd-spec` — Given/When/Then scenarios for hospital search (name, city, postal code, no results, empty dataset), the ACTIVE + HOSPITAL visibility rule, the allow-list assertion, the non-correlation invariant in both directions, and the two content surfaces of Feature B.
- `sdd-design` — formalize ADRs D9–D13, the port/DTO/use-case/adapter shapes, the coordinate projection function, the search strategy, and the test topology across unit / integration / e2e.

`sdd-spec` and `sdd-design` can run in parallel; both depend only on this proposal.
