# Design — hospital-finder-and-home-clarity

**Depends on:** `bootstrap-vivetutiempo-platform` (Block 1 Core, deployed). **ADR numbering continues that register — bootstrap ended at D8, so this change owns D9–D15.**

**Sequencing (hard constraint from the proposal):** Feature A (`/encuentra-tu-momento`) ships and is VERIFIED before Feature B (home clarity + `/quienes-somos`) starts. Feature A carries all the architectural and privacy weight; Feature B is presentation only.

**Strict TDD is ACTIVE** for every `domain/` and `application/` task here (carried forward from bootstrap's Testing Strategy). RED commit/diff before implementation. `infrastructure/`/`ui/` stay pragmatic — tests follow the code, still required.

## Technical Approach

Feature A is a second instance of the public read-model pattern D6 established, deliberately built as a **parallel, independent stack** rather than an extension of the first: new DTO, new port, new use case, new Prisma adapter, new container factory, new route. Nothing in the Events path is edited. The whole feature is a read path over columns that already exist on `Profile` — **no schema change, no migration**.

The one genuinely new architectural obligation is **D10**: a privacy property that lives *between* two surfaces and therefore cannot be enforced inside either one. Everything else is disciplined repetition of an existing, proven shape.

Presentation splits at a single, explicit boundary: an `async` Server Component fetches the full ACTIVE hospital set once and hands it to one Client Component that owns search and map interactivity. No data-fetching client code, no `fetch` from the page to its own API.

Feature B adds zero data access. It is one new section in `src/app/page.tsx`, one static page, nav entries, and translations.

## Architecture Decisions (ADRs)

### D9 — `PublicHospitalProjection`: a second, independent public allow-list

**Choice:** a NEW DTO at `src/application/dto/PublicHospitalProjection.ts` exposing exactly five fields — `name`, `city`, `postalCode`, `latitude`, `longitude`. `PublicEventProjection` and ADR D6 are not touched, not widened, not parameterised, not generalised into a shared base type.

**Field nullability (decided here, not deferred):** `Profile.city`, `postalCode`, `addressLine`, `latitude`, `longitude` are ALL `String?`/`Float?` in the schema — a hospital may register without them. The DTO mirrors that honestly: `name: string`, and `city: string | null`, `postalCode: string | null`, `latitude: number | null`, `longitude: number | null`.

**Rejected:** requiring non-null `city`/`postalCode`/coordinates in the adapter's `where` clause. That is superficially tidier but silently **hides a participating hospital from the directory** because of an incomplete admin record — the exact failure the feature exists to prevent ("is my hospital in this?" must not answer "no" when the answer is "yes, but its postal code is blank"). It would also mean the `where` clause mixes a security predicate with a data-completeness predicate, so a future edit relaxing completeness could accidentally relax the security predicate in the same line. Consequence of the accepted choice: a hospital without coordinates appears in the list but has no map pin (see D11), and the map caption states how many of the found hospitals are plottable.

**Security predicate:** `where: { type: "HOSPITAL", status: "ACTIVE" }` — and nothing else. This is a **security predicate, not a UX filter**: it is the sole reason a PENDING/REJECTED/DEACTIVATED profile, or an Artist profile, cannot reach the public. It is stated in one place, tested at three levels (unit fake, integration against real Postgres, e2e against the seeded app), and must never acquire an unrelated condition. Filtering on the Prisma enum literal directly (no domain rehydration) matches the existing read-model adapters `PrismaPendingProfileQuery` and `PrismaOpenSlotListingQuery`.

**`addressLine` is EXCLUDED.** Rationale, stated once so it is arguable rather than assumed: coordinates are sufficient for a pin and for "which city is this in"; a street address is materially more identifying and enables physical presence at a specific building where identifiable people are unwell. The feature's user need — *find whether my hospital participates, and roughly where* — is fully served without it. `addressLine` therefore buys nothing and costs privacy, which is the definition of a field that should not be in an allow-list. Enforcement is D14, not discipline.

**Ordering:** `orderBy: [{ city: { sort: "asc", nulls: "last" } }, { name: "asc" }]`. Ordering MUST be derived only from allow-listed fields. Ordering by `createdAt` or `id` is forbidden — insertion order weakly encodes registration/seed sequence and is exactly the kind of incidental signal D10 exists to keep out.

**Rejected:** widening `PublicEventProjection` to serve both surfaces. Once one projection serves two surfaces with different privacy needs, its field list stops meaning "what is safe to publish" and becomes the union of "whatever each caller needed" — that is how an allow-list decays into a deny-list without anyone deciding to. The cost of the accepted choice is duplicated plumbing (~5 files). The payoff is that each surface's total public exposure is readable in one short file, and that D6 becomes a repeatable documented pattern instead of a one-off.

### D10 — Non-correlation is a cross-surface invariant, and it owns its own test file

**The invariant:** *someone browsing both public surfaces must not be able to infer that a given hospital hosts a given event.*

Concretely, in both directions:
- `PublicHospitalProjection` MUST NOT carry any Slot/Proposal/Event-derived field — no counts, no `nextEventAt`, no `hasUpcomingEvents`, no activity titles.
- `PublicEventProjection` MUST NOT gain any hospital-identifying field, directly or by proxy.
- No shared identifier, ordering, or timing signal may permit joining the two datasets.

**Rationale:** a hospital is a place where identifiable people are unwell. Each individual fact here is harmless — a hospital participates; an event happens on Tuesday. **The JOIN is the leak.** "Hospital X, 3 activities this week, next one Tuesday 17:00" plus a public event list is enough to put a specific person outside a specific building at a specific time.

**Key structural consequence, and the reason this is its own ADR:** the property is a *relation between two projections*. Neither projection can enforce it alone — each one, inspected in isolation, looks perfectly innocent. It therefore gets a dedicated owner: **`tests/unit/application/nonCorrelation.test.ts`**, which imports BOTH use cases and asserts the property from the outside. Placing these assertions inside `listPublicHospitals.test.ts` or `listPublishedEvents.test.ts` would be wrong: the invariant would be split across two files, and a developer editing one surface would see only half of it.

**Threat model this is graded against (the "helpful badge" scenario):** a future contributor adds an "3 upcoming events" badge to a hospital card. It looks like a UX improvement, not a privacy change, and it would pass code review. It must fail the suite. Enforcement layers, and exactly which one catches which route:

| Route the badge could take | Layer that FAILS | File |
|---|---|---|
| New field on `PublicHospitalProjection` | Exact-key-set assertion (any added key fails, whatever it is named) | `tests/unit/application/listPublicHospitals.test.ts` + `nonCorrelation.test.ts` |
| Hostile/widened adapter returns event data | Hostile-adapter test, both directions | `tests/unit/application/nonCorrelation.test.ts` |
| Named event-ish field added to the DTO interface | Compile error, in the DTO file itself | `src/application/dto/PublicHospitalProjection.ts` (D14) |
| Finder page imports `listPublishedEvents` and joins in the UI | ESLint restricted-import zone, proven by a test | `eslint.config.mjs` + `tests/unit/lint/eslint-boundary.test.ts` |
| Anything creative (route handler, server action, RSC prop drilling) | e2e string assertions on both rendered surfaces | `e2e/non-correlation.spec.ts` |

The UI-join route is the one the application layer genuinely cannot see, so it is closed with the repo's existing, proven mechanism: `no-restricted-imports` zones asserted by a Vitest test (`tests/unit/lint/eslint-boundary.test.ts` already proves `application/` cannot import `infrastructure/` this way — this is precedent, not invention). Zones added:

- `src/app/encuentra-tu-momento/**` and `src/app/api/hospitals/**` MUST NOT import `listPublishedEvents`, `PublicEventProjection`, `PublicEventProjectionQuery`, or `publicDeps`.
- `src/app/events/**` and `src/app/api/events/**` MUST NOT import `listPublicHospitals`, `PublicHospitalProjection`, `PublicHospitalDirectoryQuery`, or `hospitalDirectoryDeps`.

**Composition-root reinforcement:** `hospitalDirectoryDeps()` is a SEPARATE exported factory. The hospital query is deliberately NOT added to the existing `publicDeps()`. Merging them would hand any caller of `publicDeps()` both surfaces in one object — making the join a one-line convenience rather than a deliberate act. Cheap, structural, and it makes the correct thing the easy thing.

**Doc-comment obligation (D6 style):** both DTO files carry the invariant in their doc comment, and `nonCorrelation.test.ts` opens with: *"If you are here because a test failed after you added a field, you are changing ADR D10. Read it before editing this list."*

**Rejected:** relying on code review. R3 rates this High precisely because the violating change does not look like a privacy change. A reviewer sees a badge; the invariant is invisible at the diff level.

### D11 — Mocked map: decorative SVG frame + HTML `<button>` pins

**Choice:** a `relative`-positioned container holding (a) an inline SVG frame, `aria-hidden="true"` `focusable="false"`, purely decorative, and (b) real HTML `<button type="button">` pins absolutely positioned with `left: X%` / `top: Y%` computed by a shared pure projection function. Zero new dependencies, zero external requests, no tiles, no API key, no geocoding, no geolocation.

**Rejected: pure-SVG interactive pins (`<circle role="button" tabIndex={0}>`).** Exploration leaned this way and it is defensible, but accessibility is non-negotiable here — the platform serves patients and families — and a native `<button>` provides keyboard focusability, Enter/Space activation, `:focus-visible`, disabled semantics, and a correct accessible name **for free**. `role="button"` on an SVG element requires hand-rolling key handlers and focus rings, which is more code and more surface for a subtle AT bug. Percentage positioning also tracks container resize with no recomputation, whereas SVG-internal pins need the projection re-run against the current viewBox. The decorative SVG still supplies the "map-like" visual frame, so nothing is lost visually.

**Rejected:** a static geography image with positioned pins (asset licensing + maintenance, fragile across aspect ratios); a CSS-grid schematic (not a map at all — misrepresents relative direction in a feature about *where* hospitals are); any real map library (no new dependency is justified for a mocked map; none is installed).

**Coordinate projection — and an explicit honesty statement.** `src/ui/finder/projectCoordinates.ts`:

```
BBOX (peninsular Spain + Balearics): lat 35.9 .. 43.9, lng -9.4 .. 4.4
x% = (lng - MIN_LNG) / (MAX_LNG - MIN_LNG) * 100
y% = (MAX_LAT - lat) / (MAX_LAT - MIN_LAT) * 100     // y inverted: north is up
both clamped to [0, 100]
```

**This is a simple linear (equirectangular-style) stretch over a hand-picked bounding box. It is NOT geographically accurate.** It applies no Mercator or any other standard projection, the aspect ratio is distorted by the container, and points outside the bbox (Canary Islands, Ceuta, Melilla) are **clamped to the edge**, which is visibly wrong for them. This is accepted deliberately: the map is a *mock*, its job is "roughly where in Spain, and how spread out", not navigation. This is stated in the design, in the function's doc comment, and — critically — in **visible UI copy** ("indicative map, not to scale"), not only in a tooltip or an `aria-label`. A user must not be able to mistake it for a real map.

**Accessibility (specified, not aspirational):**
- **The list is the primary surface; the map is progressive enhancement.** The same filtered hospitals ALWAYS render as a real `<ul>` of cards. This is the single most important decision here: a map is inherently visual, so equivalence must come from a genuine parallel representation, not from piling ARIA onto a graphic. A screen-reader user loses nothing by ignoring the map entirely.
- Container: `role="group"` + `aria-label` from i18n. Decorative SVG: `aria-hidden="true"`, `focusable="false"` (the IE-era `focusable` attribute still matters for some AT).
- Each pin: `<button type="button" aria-label="{name}, {city} ({postalCode})" aria-pressed={isSelected} data-testid="hospital-pin">`. Activating a pin selects the hospital, scrolls its list card into view, and sets `aria-current="true"` on that card.
- **Focus order is DOM order is list order** — the deterministic `city, name` sort of D9, never geographic order. Tab order that wanders around a map is disorienting.
- Hit target ≥ 44×44 CSS px (WCAG 2.2 AA, 2.5.8) via button padding; the visible dot may be smaller.
- `prefers-reduced-motion: reduce` disables pin/selection transitions.
- **Result-count live region:** `<p aria-live="polite" aria-atomic="true">` announcing "N hospitals found" (and "M of N shown on the map" when some lack coordinates, per D9). Without this a sighted user sees pins appear/vanish while a screen-reader user gets silence — client-side filtering (D12) changes the DOM with no navigation to announce.
- Empty state: zero pins + the existing `EmptyState` component + the live region announcing zero.
- Responsiveness: fixed-aspect container (`aspect-[4/3]`), SVG `viewBox` + `preserveAspectRatio`; percentage-positioned pins need no breakpoint logic. Below `sm`, map above list, single column.

**Playwright coverage (`e2e/hospital-directory.spec.ts`) — no pixel diffing, no screenshot comparison:**
1. Pin count equals visible list-card count, before and after a search.
2. `Tab` reaches the first pin; assert `:focus`; `Enter` activates it; assert the corresponding card carries `aria-current="true"` and the button `aria-pressed="true"`.
3. Each pin's `aria-label` contains its hospital name (asserted against seed constants).
4. Live region text matches the filtered count after typing a query.
5. The "indicative / not to scale" caption is visible.

`projectCoordinates` is unit-tested independently (`tests/unit/ui/projectCoordinates.test.ts`): known lat/lng → known percentages; y-inversion (a more northern point yields a SMALLER `y`); clamping above/below the bbox on both axes; bbox corners map to 0% and 100%.

### D12 — Search executes CLIENT-SIDE over the already-loaded active set, with the query mirrored to the URL

**Choice:** the port exposes `listActive()` with **no query parameter**. The Server Component fetches the full ACTIVE hospital set once per request and passes it to a Client Component that filters in memory. The query is reflected into the URL as `?q=` for shareability.

**The decisive argument is the map, not the dataset size.** The map (D11) renders a pin for *every* active hospital by definition. The full active set must therefore reach the browser regardless of how search works. Given that, server-side filtering would mean shipping the whole set for the map *and* round-tripping per keystroke for the list — strictly more work for strictly less responsiveness, to protect data that is already in the client. Server-side filtering is not merely unnecessary here; it is incoherent with the map.

**On the privacy objection ("shipping the whole directory client-side"):** it does not apply to this dataset. Every row is a *published, public* directory entry, reachable by anyone submitting an empty search. Client-side filtering exposes nothing that server-side filtering would withhold. The privacy work in this change is the **field** allow-list (D9/D14) and the **cross-surface** invariant (D10) — which rows are visible is settled by the `ACTIVE + HOSPITAL` security predicate at the adapter, not by where the substring match runs. Restricting client-side data would be meaningful only if the payload contained rows or fields the user was not entitled to; by construction, it contains neither.

**URL shareability** is preserved without a server round-trip: `page.tsx` reads `searchParams.q` for the initial query (a shared or bookmarked `/encuentra-tu-momento?q=bilbao` works, including with JS disabled for the unfiltered list), and the Client Component syncs subsequent typing via a debounced (300 ms) `window.history.replaceState`. In Next 16 this updates the URL **without** re-running the Server Component or resetting scroll — `router.replace` would re-render the server tree on every keystroke for no benefit. Back-button semantics stay clean because `replaceState` does not stack history entries per character.

**Component boundary (explicit):**
```
src/app/encuentra-tu-momento/page.tsx        Server Component, force-dynamic
  await listPublicHospitals(hospitalDirectoryDeps())
  const { q } = await searchParams            // Next 16: searchParams is a Promise
  -> <HospitalFinder hospitals={...} initialQuery={normaliseQ(q)} />   "use client"
       -> <HospitalMap hospitals={filtered} ... />                      "use client"
       -> <ul> of hospital cards
```
The DTO crosses the RSC boundary cleanly — every field is a primitive or `null`, no `Date`, no class instance, so it serialises without a custom transform. (`PublicEventProjection` carries a `Date`; this one deliberately does not.)

**Matching semantics:** `filterHospitals(hospitals, query)` in `src/ui/finder/filterHospitals.ts` — a pure function, which is precisely why it is testable without a DOM. Empty/whitespace query returns everything. Otherwise it normalises both sides (`.trim().toLocaleLowerCase("es")`, then `NFD` + strip combining marks) so `malaga` matches `Málaga` — mandatory for Spanish, and a silent failure if omitted. `name` and `city` use substring match; `postalCode` uses **prefix** match (`48` should find `48013`; `013` should not). `null` fields never match. Deterministic input order is preserved from D9.

**Safe handling of search input:**
- No SQL is involved at any point — filtering never reaches the database, which **eliminates injection as a category** rather than mitigating it.
- No regular expression is ever constructed from user input. Use `String.prototype.includes`/`startsWith`, never `new RegExp(query)` — a user-supplied pattern is a ReDoS vector and a correctness trap.
- The query is echoed only as a controlled `<input value>` and inside translated "no results for X" copy; React escapes both. `dangerouslySetInnerHTML` is forbidden on this page.
- Input capped at 100 characters; `searchParams.q` may legitimately arrive as `string[]` (repeated param) — take the first element, never `String(array)`.

**Rejected:** server-side filtering via a port parameter (`listActive(query)`). It moves a trivial substring match into the persistence layer, adds a network round-trip per keystroke plus debounce/race/stale-response handling, requires a loading state, and — as argued above — cannot avoid shipping the full set anyway because of the map. **Rejected:** filtering by full page navigation on form submit (`router.push`). Shareable and JS-free, but a full RSC round-trip per search on a handful of rows is a visible regression in responsiveness for a feature whose whole value is a fast answer to "is my hospital here?".

**Revisit trigger (recorded so this decision has an expiry, not an assumption):** move filtering server-side when the ACTIVE hospital set exceeds roughly **200 rows or ~50 KB serialised**. At that point the map itself needs rethinking (clustering or viewport-bounded fetching), so both decisions get revisited together. Until then, client-side filtering is correct, not merely adequate.

### D13 — Locale parity guard: repository-wide, as a Vitest test

**Choice:** `tests/unit/i18n/localeParity.test.ts`, covering **all** namespaces in `messages/{es,eu,en}.json`, not only the ones this change adds.

**Mechanism:** flatten each file to dot-paths; treat `es` as reference (it is the `next-intl` default locale); assert the symmetric difference against `eu` and `en` is empty, with per-locale missing/extra key lists in the failure message so the fix is obvious without debugging. Two further assertions, both cheap and both catching real bug classes:
- **No empty-string values** — catches a placeholder-shaped stub committed to satisfy the key check while shipping a blank UI. (Does not, and cannot, detect a wrong-language or low-quality translation. R5 human review of Basque remains blocking; this guard does not weaken that and must not be presented as if it did.)
- **ICU placeholder parity** — extract the `{name}`-style argument set per key and assert it matches across locales. `next-intl` throws at runtime on a missing argument, so a translator dropping `{minutes}` produces a production error that no other check catches.

**Why a Vitest test rather than an ESLint rule:** no existing ESLint rule performs cross-file JSON key-set comparison, so this would mean authoring and maintaining a custom rule — real cost for the same outcome. **Why not a bespoke CI step:** `npm run test` already runs in CI, so a test gets CI coverage for free *and* local/watch feedback in seconds instead of minutes. Most importantly, **a test is this repository's established idiom for enforcing a non-code rule** — `tests/unit/lint/eslint-boundary.test.ts` already proves an architectural constraint this way. Consistency with an existing proven pattern beats introducing a third enforcement mechanism.

**Why repository-wide rather than new namespaces only:** scoping to new namespaces requires writing and maintaining a filter — literally *more* code than comparing everything — while leaving ~15 existing namespaces unguarded. The marginal cost of full coverage is negative. If the repo-wide run fails on day one against pre-existing drift, that is a **finding, not an obstacle**: fix the drift in a separate commit before the guard lands, and record it.

### D14 — `addressLine` exclusion is enforced at compile time, then at four runtime boundaries

**Requirement:** at least one automated check must FAIL if a forbidden field appears. Discipline is not a mechanism, and discipline degrades.

**Choice: a layered combination, headlined by a compile-time assertion that fires in the same file as the careless edit.** In `src/application/dto/PublicHospitalProjection.ts`:

```ts
/** Named fields that must NEVER appear on the public hospital projection (D9/D10). */
type ForbiddenPublicHospitalKey =
  | "addressLine" | "id" | "accountId" | "email" | "status" | "type"
  | "reviewRequestedAt" | "createdAt" | "updatedAt"
  | "slots" | "slotId" | "proposalId" | "eventId"
  | "upcomingEventCount" | "nextEventAt" | "hasUpcomingEvents";

type AssertNever<T extends never> = T;
/** Compile error if PublicHospitalProjection ever gains a forbidden key. */
type _NoForbiddenFields = AssertNever<
  Extract<keyof PublicHospitalProjection, ForbiddenPublicHospitalKey>
>;
```

If someone adds `addressLine` to the interface, `Extract` yields `"addressLine"`, which does not satisfy `T extends never`, and **the build fails on the line directly below the interface they just edited** — in the editor, before any test runs, before commit. That is the property asked for: it survives a careless edit because it is impossible not to see.

**Honest limit, stated rather than glossed:** this catches only *named* keys. A genuinely novel field (`wardCount`, `bedCapacity`) passes it. It is therefore **not sufficient alone**, and the layers below are not redundant belt-and-braces — each catches a class the others cannot:

| Layer | Catches | Where |
|---|---|---|
| Compile-time named-key assert | Known-forbidden names, instantly, in-file | `dto/PublicHospitalProjection.ts` |
| **Exact-key-set assertion** (`Object.keys(item).sort()` vs a list **duplicated in the test**) | **ANY** added field, whatever it is called | `tests/unit/application/listPublicHospitals.test.ts` |
| Hostile-adapter test (fake port returns `addressLine`, email, ids, event data) | A widened/compromised adapter at runtime, where TS structural typing does not strip extras | same file + `nonCorrelation.test.ts` |
| Integration assertion on the real Prisma adapter output | A widened `select` against real Postgres | `tests/integration/public-hospital-directory-query.test.ts` |
| e2e string assertion on `/api/hospitals` JSON and the rendered page | Any leak by any route, including RSC flight payload | `e2e/hospital-directory.spec.ts` |

**The duplication in the exact-key-set test is deliberate and must not be "cleaned up".** The expected key list is written out in the test and NOT derived from the DTO type or from a shared constant. If it were derived, one edit would update both and the check would be vacuous. Duplication forces a second, deliberate edit in a file whose doc comment names the ADR being changed. A future refactor that DRYs this up silently disables the guard — flag it in review.

**Field-by-field rebuild (pr2a-B1, carried forward):** `listPublicHospitals` rebuilds a fresh DTO literal field by field from the port's result, never spreading or forwarding the port object. A TypeScript interface does not strip extra runtime properties, and JSON serialisation exposes whatever is actually on the object. The Prisma adapter does the same at its own boundary. Two independent rebuild points, neither treated as the sole allow-list boundary.

**Seed obligation — otherwise the strongest test passes vacuously.** The new seeded hospitals MUST have `addressLine` **populated with a distinctive string**, exported from `e2e/support/helpers.ts` (extending the existing `SEED_HOSPITAL_LOCATIONS` convention). If `addressLine` is left null in the seed, `expect(raw).not.toContain(address)` passes because there is nothing to leak — a green test asserting nothing. This is the most likely way this design gets implemented incorrectly while appearing complete.

**Rejected:** a `zod` runtime schema with `.strict()` at the boundary. It would work, but it adds a validation dependency to a layer that currently has none, and it moves the guarantee from "the object was constructed correctly" to "the object was checked after construction" — weaker, and it fails at runtime in production rather than at compile time in the editor.

### D15 — i18n: THREE namespaces (`Finder`, `About`), and the home block extends `Home`

**Choice:**
- `Finder` — new namespace, `/encuentra-tu-momento` (Feature A).
- `About` — new namespace, `/quienes-somos` (Feature B).
- The home clarity block goes **inside the existing `Home` namespace** as `Home.what`, alongside `Home.mission` / `Home.trust`.

**Rationale.** The established convention is one namespace per page/component (`Home`, `Help`, `Events`, `Login`, `Audience`, ...). The home block is not a page — it is a section of the home page — so it belongs to `Home` exactly as `Home.mission` does. `/quienes-somos` is a page, so it gets its own.

**Explicitly rejected: one shared namespace for the home block and `/quienes-somos`.** It is the only option that breaks the existing convention, and it does so in the direction that creates the risk the proposal already flagged as R8. A shared namespace invites reusing the same keys in a landing teaser and a full explanatory page; the two surfaces then evolve together by accident and drift apart under edit, ending in copy that contradicts itself about what the platform does. Separate namespaces make any duplication **visible in the diff** — which is the point, since the two surfaces should say related but not identical things.

**Naming:** namespaces are English PascalCase (`Finder`, `About`), not `EncuentraTuMomento`/`QuienesSomos`, even though the route segments are Spanish. Routes are user-facing product surface; namespace keys are identifiers, and identifiers are English per project convention.

**Content ownership (R8), recorded so the copy phase has a rule rather than a preference:** `/ayuda` owns the step-by-step how-to per role. `/quienes-somos` owns purpose, roles, governance, **what data is published and what deliberately is not**, and why the platform is free and non-profit. The data-stance section of `/quienes-somos` may only claim what D9/D10/D14 actually enforce — this is the content dependency that makes Feature A's precedence a correctness requirement, not a preference. Writing it first would mean publishing a privacy promise the code has not made.

## New and Changed Files

### Feature A — `/encuentra-tu-momento` (ships and is verified FIRST)

| Path | Status | Purpose |
|---|---|---|
| `src/application/dto/PublicHospitalProjection.ts` | NEW | D9 allow-list + D10 invariant doc comment + D14 compile-time forbidden-key assert |
| `src/application/ports/PublicHospitalDirectoryQuery.ts` | NEW | `listActive(): Promise<readonly PublicHospitalProjection[]>` |
| `src/application/use-cases/listPublicHospitals.ts` | NEW | Depends ONLY on the port; field-by-field rebuild (pr2a-B1) |
| `src/infrastructure/persistence/prisma/PublicHospitalDirectoryQuery.ts` | NEW | The only adapter reading `Profile` for this surface; `select`, never `include` |
| `src/infrastructure/composition/container.ts` | EDIT | `hospitalDirectoryDeps()` — a SEPARATE factory, deliberately not merged into `publicDeps()` (D10) |
| `src/app/encuentra-tu-momento/page.tsx` | NEW | Server Component, `force-dynamic`, reads `searchParams.q` |
| `src/app/encuentra-tu-momento/HospitalFinder.tsx` | NEW | `"use client"` — search input, live region, list, URL sync |
| `src/app/encuentra-tu-momento/HospitalMap.tsx` | NEW | `"use client"` — decorative SVG + `<button>` pins (D11) |
| `src/ui/finder/filterHospitals.ts` | NEW | Pure filter fn (D12) — unit-testable without a DOM |
| `src/ui/finder/projectCoordinates.ts` | NEW | Pure lat/lng → `%` projection (D11) |
| `src/app/api/hospitals/route.ts` | NEW | `GET`, public, mirrors `api/events/route.ts` |
| `src/app/layout.tsx` | EDIT | `SiteHeader`/`SiteFooter` nav entry |
| `prisma/seed.ts` | EDIT | 3 new ACTIVE hospitals, additive + idempotent |
| `messages/{es,eu,en}.json` | EDIT | `Finder` namespace (all three, same commit) |
| `eslint.config.mjs` | EDIT | D10 surface-isolation restricted-import zones |

**Colocation note:** client components live beside their route (`src/app/encuentra-tu-momento/`), matching the existing `src/app/_home/Reveal.tsx` and `src/app/LanguageSelector.tsx` convention. The two *pure* modules go in `src/ui/` instead, because they are presentation logic that must be importable by both a client component and a Node-side Vitest test, and because `src/ui` is the presentational layer per D5.

### Feature B — home clarity + `/quienes-somos` (starts only after A is verified)

| Path | Status | Purpose |
|---|---|---|
| `src/app/page.tsx` | EDIT | New section between Hero and Mission, wrapped in `<Reveal>` + `border-t border-border` |
| `src/app/quienes-somos/page.tsx` | NEW | Static Server Component, mirrors `src/app/ayuda/page.tsx` |
| `src/app/layout.tsx` | EDIT | Nav entry |
| `messages/{es,eu,en}.json` | EDIT | `About` namespace + `Home.what` |

## Wiring Detail

**Port** — `src/application/ports/PublicHospitalDirectoryQuery.ts`:
```ts
export interface PublicHospitalDirectoryQuery {
  /** Only ACTIVE Hospital profiles, already projected to the D9 allow-list. */
  listActive(): Promise<readonly PublicHospitalProjection[]>;
}
```

**Use case** — `src/application/use-cases/listPublicHospitals.ts`:
```ts
export interface ListPublicHospitalsDeps {
  readonly publicHospitalDirectoryQuery: PublicHospitalDirectoryQuery;
}
export async function listPublicHospitals(
  deps: ListPublicHospitalsDeps,
): Promise<readonly PublicHospitalProjection[]> {
  const records = await deps.publicHospitalDirectoryQuery.listActive();
  return records.map(toPublicHospitalProjection);   // fresh literal, field by field
}
```
No `Actor`, no authorization — this surface is anonymous by design, exactly like `listPublishedEvents`. It imports nothing but the port and DTO types, which the ESLint layer-boundary rule already enforces.

**Prisma adapter** — `select`, never `include`; fresh object literal per row:
```ts
const rows = await this.client.profile.findMany({
  where: { type: "HOSPITAL", status: "ACTIVE" },              // security predicate, D9
  select: { name: true, city: true, postalCode: true, latitude: true, longitude: true },
  orderBy: [{ city: { sort: "asc", nulls: "last" } }, { name: "asc" }],
});
return rows.map((row): PublicHospitalProjection => ({
  name: row.name, city: row.city, postalCode: row.postalCode,
  latitude: row.latitude, longitude: row.longitude,
}));
```
`addressLine` is absent from the `select`, so it never leaves Postgres. Note the DTO uses no `Date` — nothing here needs `mappers.ts`.

**Container** — a distinct factory (D10):
```ts
export function hospitalDirectoryDeps(): ListPublicHospitalsDeps {
  return { publicHospitalDirectoryQuery:
    new PrismaPublicHospitalDirectoryQuery(prismaClient) };
}
```
Uses the existing module-level `prismaClient` singleton (globalThis-cached in dev). `publicDeps()` is unchanged.

**Route handler** — `GET /api/hospitals`, mirroring `api/events/route.ts`: no auth, no CSRF guard (GET is safe and never mutates), `toErrorResponse` on failure, returns `{ hospitals }`.

**Why an API route at all, when the page does not use it.** The page calls the use case directly (Server Component, no self-`fetch`), so the route has exactly one job: **be the assertion boundary for the privacy tests.** Exact-key-set and forbidden-string assertions against a raw JSON payload are dramatically stronger and clearer than picking through rendered HTML or an RSC flight payload, and `/api/events` set this precedent. The marginal attack surface is zero: it exposes precisely the data the page already exposes, GET-only, no parameters, no auth state. A privacy guarantee you cannot cheaply assert against is a privacy guarantee that erodes.

## App Router Segments

Flat, unprefixed, kebab-case segments directly under `src/app/`: `/encuentra-tu-momento`, `/quienes-somos`.

**There is NO `[locale]` segment, and none is introduced.** Locale is resolved server-side from the `NEXT_LOCALE` cookie (set by `LanguageSelector`), falling back to `Accept-Language`, default `es` — see `src/i18n/request.ts`. The same URL serves all three locales. Both pages use `getTranslations`/`getLocale` from `next-intl/server`. Adding a locale segment is out of scope and would be a repository-wide routing change.

These are the first multi-word segments in the app (`ayuda`, `events`, `login`, `register` are all single words). This is standard Next.js kebab-case and is noted only so a reviewer does not read it as an inconsistency (R9).

`/encuentra-tu-momento` sets `export const dynamic = "force-dynamic"` — matching `/events`, since the directory must reflect an admin activating a hospital without a rebuild. `/quienes-somos` is fully static.

## Seed Extension

Three NEW ACTIVE hospitals in distinct cities with distinct postal-code prefixes (so prefix search is demonstrable), added as fixed `IDS.profiles.*` entries with `approveProfile(createProfile({...}))`, inside the existing `prisma.$transaction`. `PrismaProfileRepository.save` is an `upsert` keyed by that fixed id, so re-running the seed is idempotent by construction.

| Name | City | Postal | Lat / Lng | `addressLine` |
|---|---|---|---|---|
| Hospital Universitario del Mar | Valencia | 46011 | 39.4699 / -0.3763 | populated, distinctive |
| Hospital Santa Clara | Sevilla | 41003 | 37.3891 / -5.9845 | populated, distinctive |
| Hospital San Rafael | Zaragoza | 50009 | 41.6488 / -0.8891 | populated, distinctive |

Each needs its own `Account` (`hospital.<name>@vtt.test`, seed password per the existing README convention).

**"Hospital Esperanza" stays PENDING** — the Admin validation queue demo and its tests depend on it, and it doubles as the negative case proving the ACTIVE predicate works. **"Hospital San Juan" (Bilbao, 48013) is untouched.** Result: 4 ACTIVE hospitals across 4 cities with 4 distinct postal prefixes (48/46/41/50), and 1 PENDING that must never appear — enough to demonstrate multi-pin rendering, city search, postal-prefix search, and the security predicate.

**`addressLine` MUST be populated for all three** (D14) — otherwise the leak assertions pass vacuously.

Coordinates are real city-centre values. They are real; the *projection* rendering them (D11) is not accurate. Do not confuse the two.

## Testing Strategy

| Layer | What | File |
|---|---|---|
| Unit | `listPublicHospitals`: pass-through, empty list, **exact-key-set** (D14), hostile adapter (`addressLine`, email, ids, event data) | `tests/unit/application/listPublicHospitals.test.ts` |
| Unit | **D10 non-correlation, BOTH directions** + the doc-comment warning | `tests/unit/application/nonCorrelation.test.ts` |
| Unit | `filterHospitals`: empty query, substring name/city, postal **prefix**, diacritic-insensitive (`malaga` → `Málaga`), `null` fields never match, order preserved, 100-char cap | `tests/unit/ui/filterHospitals.test.ts` |
| Unit | `projectCoordinates`: bbox corners, y-inversion, clamping both axes | `tests/unit/ui/projectCoordinates.test.ts` |
| Unit | Locale parity repo-wide: key sets, no empty values, ICU placeholder parity (D13) | `tests/unit/i18n/localeParity.test.ts` |
| Unit | D10 surface-isolation ESLint zones reject a violating fixture (EXTEND existing file) | `tests/unit/lint/eslint-boundary.test.ts` |
| Unit | `FakePublicHospitalDirectoryQuery` honours the port contract (EXTEND) | `tests/unit/application/support/fakes.ts`, `fakeContracts.test.ts` |
| Integration | Real Prisma adapter vs Postgres: only ACTIVE+HOSPITAL rows; Esperanza (PENDING) absent; Artist profiles absent; exact key set on real rows; `addressLine` absent; ordering deterministic | `tests/integration/public-hospital-directory-query.test.ts` |
| E2E | `/api/hospitals` exact key set + no `addressLine`/email/id/Esperanza; page renders 4 hospitals; search filters; pin count == card count; keyboard activation; live region; caption visible | `e2e/hospital-directory.spec.ts` |
| E2E | D10: no seeded event title on `/encuentra-tu-momento`; no seeded hospital name/city/postal on `/events` or `/api/events` | `e2e/non-correlation.spec.ts` |
| E2E | Both new pages render in `es`, `eu`, `en` via the `NEXT_LOCALE` cookie | `e2e/hospital-directory.spec.ts` |

**Integration tests require `VIVETUTIEMPO_RUN_INTEGRATION=true`. A skipped integration test is NEVER reported as passed** — Feature A's done-criterion requires them run and green.

**Existing `e2e/public-projection.spec.ts` is not modified.** It already asserts hospital public-address data does not leak through `/api/events`; the new seed rows strengthen it for free by adding more strings that must not appear.

## Rollback

Both features are purely additive on the public surface. No authenticated flow, no domain invariant, no state machine, **no schema change** (every field already exists on `Profile`).

- Feature A: delete the route, page, two client components, two `src/ui/finder/` modules, DTO, port, use case, adapter, API route; remove one container export and the ESLint zones.
- Feature B: remove one home section and one route.
- Seed: additive upserts by fixed id — reverting the code leaves three inert ACTIVE hospital rows in a demo database, which is harmless.
- Vercel promotes the last good build.

## Open Questions

None blocking implementation. The proposal's deferred decisions are all resolved above: search strategy (D12, client-side with URL mirroring), `addressLine` enforcement (D14, compile-time + four runtime layers), map construction and accessibility (D11, SVG frame + HTML button pins, list-first), i18n structure (D15, `Finder` + `About` + `Home.what`), parity guard (D13, repo-wide Vitest), and the non-correlation test's owner (D10, dedicated file plus an ESLint zone for the UI-join route).

Two items remain **outside this design's authority** and stay open for implementation:
1. **Basque (`eu`) copy quality** — blocking human review before merge (R5). The D13 guard checks key parity and placeholder parity only; it says nothing about whether the translation is good, and must not be cited as if it did.
2. **Final ES copy for the home block and `/quienes-somos`** — the approved text is the agreed basis, explicitly not frozen. `/quienes-somos`'s data-stance section may only claim what D9/D10/D14 enforce.
