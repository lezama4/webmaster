# Vivetutiempo Security Threat Model and OWASP Analysis

## Scope, status, and method

**Revision assessed:** `482aefd` on `main`. **Last updated:** 2026-07-24 (T-22 re-assessment for `auditable-profile-approval`, D21–D27).

This document is a design- and code-informed threat model for Vivetutiempo
Block 1. An earlier revision was limited to the planning artefacts,
`src/domain/**` and `src/application/**`, and explicitly did **not** read the
Prisma schema, migrations, `src/infrastructure/**`, infrastructure tests, route
handlers or deployment configuration. That limitation no longer applies: for
this revision every one of those was read, and each threat status below was
re-derived from the current source rather than carried forward.

Control statuses now distinguish three levels of confidence, and the difference
is load-bearing:

- **Mitigated** — the control is implemented, integrated into the request path,
  and a test covering it **executed** on this revision. Every use of this word
  cites the run.
- **Implemented, evidence pending** — the control exists in source and is wired
  in, but no executed test demonstrates the specific property claimed. Code
  reading alone never earns "Mitigated" in this document.
- **Partial/open gap**, **Designed**, **Pending verification**, **Not currently
  applicable** — as before.

The executed evidence referenced throughout is CI run
[29905717933](https://github.com/lezama4/webmaster/actions/runs/29905717933)
on `482aefd`: the `test` job ran 360 tests with 0 skipped (unit plus the
PostgreSQL 16 integration and concurrency suites, serial, migrations applied in
a global setup), and the `e2e` job ran 12 Playwright tests against real
PostgreSQL 16 and the seeded demo dataset. Both jobs were green.

**What this document still does not certify.** The deployment at
<https://webmaster-lemon.vercel.app> has **no security response headers, no
Content Security Policy, no application logging and no dependency scanning**.
Those are not oversights in the review; they are genuinely absent from the
codebase, and T-16, T-17 and T-18 record them as open. A green test suite is
not production hardening.

**Scope note — `widen-beyond-hospitals` (six centre types).** This model has
been extended to cover the generalisation from a hospital-only product to six
centre types (hospital, nursing home, day centre, day hospital, occupational
centre, palliative unit) via a generic `CENTRE` role plus a separate
`CentreType` axis (ADRs D16–D20). That change is implemented and verified
locally against real PostgreSQL (Neon `dev`), but is **not yet merged to `main`
or deployed** — the dated CI evidence on `482aefd` cited throughout remains the
deployed hospital-only baseline. Two security-relevant facts follow from the
change and are recorded below: `centreType` is now a **public, allow-listed
field** on the directory (D19), and the widening **raises the safeguarding bar**
for more vulnerable populations — recorded as an accepted, documented,
demo-scoped open risk (T-22). D10 cross-surface non-correlation was
re-assessed **as it stood at the time of that change**: the structural
guarantee then held — no public read path added a centre-identifying field to
an event, the ward/room `location` is excluded by the D6 allow-list, and
`type + city` on the directory adds no join key — so the platform did not link
a centre to an event on a visitor's behalf. **That paragraph is now historical:
D10 was deliberately revised twice afterwards** (`events-show-centre`, then
`centre-event-counts`) and the centre↔event link is now public by design in
both directions — see those two scope notes below for the current, authoritative
position and for the privacy line that replaced it. What that earlier position did
**not** guarantee (Codex review, corrected here) is the **content** of the two
centre-authored free-text fields that legitimately reach the public event
projection, the event `title` and the slot `description`: these are not
content-scanned, so a centre that types its own name or a ward/room into them
discloses its own event. That is the centre's editorial choice about its own
activity, not a platform leak of third-party data, but the earlier wording
("events carry no location at all") overstated it. Mitigation: the slot-publish
form now warns the author that title/description are public and that the exact
place belongs in the private `location` field (`PublishSlot.publicHint`). A
content filter on free text is not attempted — it cannot be made complete — and
the residual is recorded here rather than asserted away.

**Scope note — `events-show-centre` (D10 event→centre direction relaxed).**
The D10 non-correlation invariant was **deliberately revised** in one direction
after a usability finding: a family cannot act on a public event ("music this
afternoon") without knowing *which centre* hosts it, so the platform now
publishes the hosting centre's **public name and city** on each event
(`PublicEventProjection.centreName` / `centreCity`, sourced from the centre's
own `Profile` — the same two fields already public on the centre directory).
This is a product decision, recorded as an ADR revision, not a leak: the values
were already public on the directory surface; the change only lets the event
name its host. **What stays forbidden on the public event surface is unchanged
and is where the privacy line now sits: the exact place** — the Slot's
ward/room `location`, the centre's **postal code, street address and
coordinates** — **plus every internal id and all patient-adjacent data.** The
allow-list is still rebuilt field by field (D6) and the e2e suites assert both
that the centre name now appears and that the postal code, street address and
ward/room `location` never do (`e2e/public-projection.spec.ts`,
`e2e/non-correlation.spec.ts`). The events listing also offers a **centre
filter** (`/events?centre=<public name>`): it narrows the list by the centre's
already-public `name` only — server-side, over data the card already shows — so
it exposes nothing new, never accepts an id or the ward/room `location`, and
lives solely on the events surface. At the time of that change the
**hospital→event** direction was left untouched; it was relaxed separately —
see the next note. This note supersedes the "no public read path adds a
centre-identifying field to an event" wording in the `widen-beyond-hospitals`
note above for the event→centre direction.

**Scope note — `centre-event-counts` (D10 SECOND REVISION, hospital→centre
direction relaxed).** Each centre card in the public directory now shows
`upcomingEventCount` — how many published, still-upcoming events that centre
hosts — and links to `/events?centre=<name>`, its own filtered list. This
**retires D10's remaining direction**, deliberately and for a reason worth
stating plainly: after `events-show-centre`, the invariant no longer protected
anything. Events already name their hosting centre and the events listing
already offers a centre filter, so any anonymous visitor could obtain this
exact number in two clicks from `/events?centre=<name>`. Keeping the directory
silent about it made the two public surfaces mutually inconsistent — and an
inconsistency is not a control.

**The privacy line, restated for both surfaces:** the **institution and its
public activity level** are public; the **individual and the exact place** are
not. Still forbidden everywhere, and asserted by the guards: the Slot's
ward/room `location`, the centre's street address, event **titles and dates on
the directory surface** (`nextEventAt` remains a named forbidden key — a date
would tell a visitor *when* to find someone at that centre, which a bare count
does not), Proposals and their messages, emails, every internal id, and any
patient-adjacent data. The count is computed as a Postgres aggregate, so no
event row is materialised on the directory path at all.

**Residual, recorded rather than hidden:** the directory lists **all** active
centres, whereas the events surface only ever revealed those *with* events. The
counts therefore newly make visible that a given centre has **zero** activity.
That is institutional data about an institution that self-registered to a
public directory, and it discloses nothing about any person — accepted at
demo scope, and named here rather than glossed over.

**Scope note — `auditable-profile-approval` (accountable admin decisions,
D21–D27).** Implemented and verified locally against real PostgreSQL (Neon
`dev`); not yet merged to `main` or deployed. Every admin approve/reject/
deactivate decision now records the acting admin's id, a timestamp, and a
required, bounded, role-cued verification basis in an append-only
`ProfileReview` log, enforced in the domain (D21–D24), persisted atomically
with the status transition (D23), and structurally kept off both public
projections with the D14 forbidden-key guard extended to name the new audit
fields (D26). This changes T-22's facet (a) from *no accountability at all*
to *accountable but unverified*: see T-22 below for the full re-assessment —
the platform still does not verify the attested basis.

The model uses the current [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
as its primary taxonomy and cross-references the still widely used
[OWASP Top 10:2021](https://owasp.org/Top10/2021/). OWASP is an awareness and
prioritisation framework, not a certification; this document is not a legal,
penetration-testing, or compliance assessment.

Risk ratings are qualitative and assume an Internet-exposed MVP with no
production telemetry:

- **Impact:** effect on confidentiality, integrity, availability, patient and
  hospital trust, or operational safety.
- **Likelihood:** feasibility before the stated control is fully verified.
- **Control status:** as defined in the scope note above. "Mitigated" is
  reserved for controls with an executed test on this revision; it still never
  means that production configuration or deployment hardening has been verified.

The security-critical product decisions used in the analysis are DB-backed
cookie sessions (D1), lock-first matching (D4), an explicit public allow-list
(D6), session/CSRF hardening (D7), and schema additions needed for lifecycle
and sessions (D8) in
[`design.md`](../openspec/changes/bootstrap-vivetutiempo-platform/design.md).

## 1. Assets and data classification

The platform is not intended to process clinical records, diagnoses, treatment
data, or EHR integrations. Nevertheless, information is sensitive in its
hospital context: a room or ward may reveal where a vulnerable person is likely
to be, and a proposal or attendance pattern can reveal relationships and
operational details. “Fictional demo data” does not remove this threat if the
same architecture later processes live data.

| Asset / data set | Classification | Why it matters | Required handling |
| --- | --- | --- | --- |
| Public event projection: title, description, date/time, duration, artist display name, **hosting centre public name + city** (`events-show-centre`, D10 revision) | Public after publication; integrity-sensitive | It is anonymous-facing for patients, but must name its host so a family can find it; false or altered events damage trust and may cause attendance at the wrong time. The centre name + city were already public on the directory. | Explicit allow-list (name + city only — never the postal code, address, coordinates, ward/room `location`, or any id), published-only filter, output encoding, integrity-protected write path. |
| Public centre directory projection: name, city, postal code, coordinates, centre type (`centreType`, D19) and **upcoming-event count** (`centre-event-counts`, D10 second revision) | Public by design — self-registered institutions | Publishing the centre type is required so families can tell a day centre from a palliative unit, but a small or rare type in a city is a stronger population signal than "one hospital" was (single-surface identifiability, T-22). The event count tells a family whether it is worth looking further; it was already derivable from `/events?centre=<name>`. | Coarse six-value category only (never a sub-label or unit name); explicit allow-list; never the address, email or internal `type`. The event figure is an **aggregate only** — never an event title, an event date or `nextEventAt`, which stay named forbidden keys (D14). |
| Exact Slot location (ward/room), future schedule and operational agenda | Confidential / context-sensitive | Ward, room and timetable information can expose operational or patient-adjacent context. Note: the centre's public *name + city* is NOT in this row — it is public on both the directory and (since `events-show-centre`) the event surface; only the *exact place* and agenda are confidential. | Never expose the ward/room `location`, postal code, street address, coordinates or full agenda publicly; restrict to an active Artist with a legitimate need, and minimise logs. |
| Proposal message and competing-proposal state | Confidential | May contain direct contact details, commercial terms, personal information, or private operational context. | Hospital owner and authorised workflow only; no public projection; bounded and safely rendered. |
| Account email, profile name/type/status, account-to-profile relation | Personal data; confidential | Enables contact, account targeting, role inference, and governance decisions. | Server-side authorisation, data minimisation, retention policy, no unnecessary API disclosure. |
| Password plaintext, password hash, password-reset material if later added | Restricted credential data | Compromise permits account takeover at scale. | Never log plaintext; argon2id with current parameters; strong secret handling; no password echo. |
| Session bearer value, cookie attributes, session-token hash, session row | Restricted authentication data | A live bearer value is equivalent to an authenticated user. | CSPRNG token, store only token hash, `HttpOnly`/`Secure` cookie, expiry, revocation, CSRF protection. |
| Admin decisions, profile-review timestamp/history, security audit events | Confidential; integrity-critical | Evidence of governance and incident reconstruction. | Append-only or protected audit trail, access restriction, defined retention and redaction. |
| Login-limit records and client-address-derived value | Personal/security telemetry | Helps counter brute force but can itself become tracking data. | Store a truncated/hashed client key, short retention, no raw IP in application storage. |
| Database credentials, session secret, deployment variables, backups and logs | Restricted infrastructure data | Exposure can bypass all application controls. | Secret manager/environment controls, least privilege, redaction, backup access control. |

**Data prohibition.** The public API and registration/proposal forms must not
become channels for clinical data, patient names, room identifiers in free-text
descriptions, or emergency instructions. This is a product and validation
requirement, not merely a privacy notice.

## 2. Trust boundaries and attack surfaces

```text
Anonymous browser ── public event endpoint ─┐
                                             │
Authenticated browser + session cookie ─────┼── Next.js route handler / UI
Admin browser + session cookie ─────────────┘            │
                                                          ▼
                                             Application use cases and ports
                                                          │
                                                   trust boundary
                                                          ▼
                                     Infrastructure adapters / PostgreSQL / logs
                                                          │
                                                          ▼
                                             Backups and managed deployment
```

| Boundary / surface | Trust assumption that must be defended | Main abuse cases |
| --- | --- | --- |
| Anonymous public browsing | No caller identity is available and all returned bytes are public. | Data overexposure, enumeration, scraping, cache leakage, content abuse and denial of service. |
| Login, registration and logout | Input is hostile; the browser does not prove the claimed account or role. | Credential stuffing, account enumeration, registration abuse, session fixation, login CSRF. |
| Authenticated Hospital / Artist mutations | A session authenticates an account, not unlimited authority. Every request must derive role and current profile state server-side. | IDOR/BOLA, role escalation, acting after rejection/deactivation, cross-Hospital approval, duplicate submissions. |
| Administrator boundary | Admin actions change governance and can revoke access. | Compromised Admin account, CSRF, abusive deactivation/rejection, missing audit evidence. |
| Delivery layer to application layer | Route handlers must validate request data and turn a resolved session into a trusted `Actor`; application code must not trust body fields. | Client-supplied role/profile IDs, mass assignment, malformed input, error detail leakage. |
| Application to persistence/session adapters | Ports promise transactionality, locking and safe persistence but do not enforce those properties by themselves. | Stale reads, partial writes, unparameterised queries, plaintext session storage, non-atomic revocation. |
| Database, migrations, backups and logs | Data at rest and administrative tools are outside normal user authorisation. | Secret leakage, migration damage, backup exposure, raw-SQL mistakes, log disclosure. |
| Build and dependency supply chain | Dependencies and deployment artefacts execute with application privileges. | Vulnerable or compromised dependency, lockfile drift, unreviewed build configuration. |

No outbound URL-fetching, webhook consumer, EHR integration, file upload, or
payment gateway is present in the reviewed domain/application scope. SSRF is
therefore not a current application entry point, but it becomes in scope as soon
as any of those capabilities is introduced.

The hexagonal boundary reduces accidental framework/ORM imports in the domain
and application layers, as documented in
[`src/domain/README.md`](../src/domain/README.md) and
[`src/application/README.md`](../src/application/README.md). It is a
maintainability and testability control; it is not an authentication boundary
and cannot replace HTTP, database, or deployment security.

## 3. Actors and authorisation matrix

| Actor | Allowed in Block 1 | Explicitly prohibited / abuse to block |
| --- | --- | --- |
| Anonymous visitor | List published public events only. | See Slots, proposals, locations, emails, IDs, pending/closed data, or make mutations. |
| Patient / Family account | In Block 1, no privilege beyond public browsing; a seeded account demonstrates the role. | Hospital/Artist/Admin mutations. Rating is Block 2 only. |
| Artist with pending/rejected/deactivated Profile | May authenticate only if product policy permits it, but must have no role action. | List open slots or submit a proposal. |
| Active Artist | List future open Slots and submit one `submitted` Proposal per Slot. | Create Slots; approve/reject/close; read other Artists’ private proposals; submit duplicates. |
| Hospital with pending/rejected/deactivated Profile | Must have no Hospital action. | Publish, approve, reject, or close a Slot, including use of a pre-existing session. |
| Active Hospital | Publish and close its own Slots; approve/reject a Proposal belonging to its own Slot. | Decide another Hospital’s Slot, approve a mismatched Proposal/Slot, or perform Admin validation. |
| Admin | Approve/reject pending profiles and deactivate active Hospital/Artist profiles. | Approve/reject proposals or operate Hospital Slots merely because of Admin role. |
| External attacker / compromised account | No legitimate privilege. | Exploit endpoints, session tokens, errors, races, configuration, dependencies, or public data. |

The reviewed use cases include role and active-profile guards, Slot ownership
checks, and Proposal-to-Slot linkage checks. See
[`shared/guards.ts`](../src/application/use-cases/shared/guards.ts) and the
coordination specification’s ownership scenarios
([`slot-proposal-coordination/spec.md`](../openspec/changes/bootstrap-vivetutiempo-platform/specs/slot-proposal-coordination/spec.md)).

The conversion from HTTP request and cookie to `Actor` has now been reviewed. It
is implemented in [`sessionCookie.ts`](../src/infrastructure/http/sessionCookie.ts):
`getCurrentActor` resolves the opaque cookie token through `SessionPort`,
clears the cookie when the session is absent, expired or fails the conditional
`touch`, and derives role and profile from the database — never from the request
body. Guards additionally re-read live Profile status inside the mutation's own
transaction, so a session-time snapshot is never the authority for a mutation.

## 4. Threat register

### 4.1 Access control, public data, and workflow integrity

| ID | OWASP mapping | Asset affected | Vector | Impact | Likelihood | Expected control and status |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 Cross-tenant Slot/Proposal decision (IDOR/BOLA) | A01:2025 / A01:2021 Broken Access Control | Slots, proposals, events, Hospital trust | A Hospital changes a Slot ID or Proposal ID to approve, reject, or close another Hospital’s resource. | High integrity and confidentiality impact. | Medium | **Mitigated.** `assertRole`, live-active-profile checks, `assertOwnsSlot` and Proposal→Slot linkage all run inside the locked transaction. The route handler derives `Actor` solely from the session cookie (`sessionCookie.ts:60-91`) and never reads a role or profile id from the body. `e2e/authorization-edge-cases.spec.ts` asserts 403 for a wrong-role actor and 404 for a Proposal that does not belong to the target Slot — executed in CI. |
| T-02 Stale authority after rejection/deactivation | A01:2025 / A07:2025; A01/A07:2021 | Governance decisions, Slots, events | Admin changes Profile status after the actor’s initial profile read but before a Slot mutation commits. | High integrity impact; a removed Hospital can still decide an event. | Medium | **Mitigated.** The `pr2a-M1` gap is closed: the acting Profile is no longer read by a separate `ProfileUnitOfWork` that commits first. `withLockedSlot` locks the Slot row, then the actor's Account row, and passes the live Profile into the callback — all in the transaction that also persists the mutation (`MatchingUnitOfWork.ts:72-91`; `approveProposal.ts:41-45`). The barrier-forced `slot-auth-vs-deactivation-race.test.ts` executed in CI. |
| T-03 Role/Profile type confusion | A01:2025 / A01:2021 | Slot ownership and role separation | Corrupt/imported state pairs a Hospital `Actor` with an active Artist Profile; current guard checks status but not matching profile type. | Medium integrity impact. | Low to medium | **Mitigated.** `assertActiveProfile(profile, expectedType)` now denies a live Profile whose `type` does not match the action's required type (`guards.ts:30-46`), and all eight mutating use cases pass an explicit `expectedType`. Unit-tested and covered end to end by the denial-matrix E2E suite executed in CI. |
| T-04 Public projection data leak | A01:2025, A06:2025 / A01, A04:2021 | Location, proposal message, emails, internal IDs | Infrastructure query or future refactor attaches extra runtime properties; `listPublishedEvents` returns the port object unchanged and JSON serialises extras. | High confidentiality and contextual-safety impact. | High once public endpoint exists | **Mitigated.** `PrismaPublicEventProjectionQuery` uses a Prisma `select` (never `include`) and constructs a fresh object literal field by field, so widening the query cannot leak a property at runtime. Since `events-show-centre` (D10 revision) the `select` also reads the hosting centre `Profile`'s **name + city only** (never its postal code, address or coordinates). `e2e/public-projection.spec.ts` asserts the exact allowed key set (now including `centreName`/`centreCity`) and that the raw response body contains no Slot ward/room location, hospital postal/street address, Proposal message, email, Slot id or Proposal id — executed in CI against the seeded dataset. |
| T-05 Non-public workflow disclosure | A01:2025 / A01:2021 | Unpublished Slots, proposal state/messages, profile status | Generic repository response, cache, error, or list endpoint exposes submitted/rejected content. | High confidentiality impact. | Medium | **Mitigated for content; cache directives pending.** The query filters `status: "PUBLISHED"`, and the E2E suite asserts that a `completed` Event does not appear on `/events` or in `GET /api/events`. HTTP cache directives for the public endpoint are still **Pending verification** — no `Cache-Control` policy is set. |
| T-06 Matching race produces contradictory state | A08:2025, A06:2025 / A08, A04:2021 | Slot/Proposal/Event consistency | Concurrent submit, approve, reject or close runs against stale data and leaves an actionable proposal on a non-open Slot or more than one accepted proposal. | High integrity impact. | Medium to high | **Mitigated.** `PrismaMatchingUnitOfWork` issues `SELECT … FOR UPDATE` on the Slot row before any decision-informing read, loads the full Proposal set in the same transaction, and persists atomically. Nine barrier-forced race files (`submit-approve`, `submit-close`, `approve-close`, `approve-reject`, `close-reject`, `matching-race`, `duplicate-submission`, `login-vs-deactivation`, `slot-auth-vs-deactivation`) executed in CI against real PostgreSQL, plus partial unique indexes proven by `partial-index-catalog` and `duplicate-submission`. |
| T-07 Incomplete persisted aggregate accepted as valid | A08:2025, A06:2025 / A08, A04:2021 | Historical integrity and future decisions | A corrupted or faulty persistence snapshot has a filled Slot with no accepted Proposal, multiple accepted Proposals, or submitted Proposals on a non-open Slot. | High integrity/audit impact. | Medium | **Partial/open gap — unchanged.** Re-read on this revision: `assertValidSlotAggregate` still checks only linkage, duplicate ids and the single `open`-with-accepted contradiction (`aggregate.ts:37-44`). A `filled` Slot with no accepted Proposal, two accepted Proposals, or submitted Proposals on a non-open Slot still rehydrate successfully. `codex-pr1-review.md` M1 remains open: the full status matrix and negative rehydration tests are still required. Note this is a defence-in-depth gap against *corrupt persisted data* — the write paths themselves are lock-protected (T-06). |
| T-08 Account/Profile partial registration or duplicate race | A08:2025, A10:2025 / A08:2021 | Account/profile consistency, onboarding availability | Account save succeeds but Profile save fails; or concurrent same-email registration observes no account twice. | Medium integrity and availability impact. | Medium | **Mitigated.** `PrismaRegistrationUnitOfWork` holds one transaction across the uniqueness check, Account creation and Profile creation/reactivation. Existing accounts are locked with `SELECT … FOR UPDATE`; a first registration (no row to lock) takes `pg_advisory_xact_lock` on the normalised email and re-reads under `FOR UPDATE` (`RegistrationUnitOfWork.ts:85-93`). `registration-race.test.ts` executed in CI. |
| T-22 Widened safeguarding bar under an accountable-but-unverified admission decision (D16–D20, D21–D27) | A06:2025 Insecure Design / A04:2021; also A01:2025 for the public-data facet | Vulnerable populations (residencia residents, day/occupational-centre users, palliative patients); centre trustworthiness; single-surface population identifiability | Two facets. **(a) Admission:** a bad actor self-registers as a residencia, occupational centre or palliative unit — populations that include older people, people with cognitive impairment and vulnerable adults, and whose centre kinds carry weaker independent trust markers than a large public hospital — and the platform does not itself verify the claim. **(b) Public data:** publishing `(centreType, city)` on the directory (D19) narrows the population of a small or rare kind (e.g. a lone palliative unit in a city) more sharply than "one hospital" ever did. | High (real world) for the safeguarding facet; Medium for identifiability. Both **accepted** at demo scope. | **Accepted open risk — documented, demo-scoped; re-assessed after `auditable-profile-approval` (D21–D27), which changes what is BUILT for facet (a) without closing it.** <br><br>**Built now (this change):** the admin approve/reject/deactivate decision is **accountable**. Every decision records the acting admin's id, a server-set timestamp, and a required, bounded (`MAX_REVIEW_BASIS_LENGTH = 1000`, trimmed, non-blank), role-cued verification basis, in an append-only `ProfileReview` log — enforced in the domain, so a decision without a recorded basis is impossible for any caller (route, future admin CLI, or a scripted `POST` bypassing the UI), not merely a UI convention. The role-cued prompt asks the admin to attest to the verification relevant to that role's risk: institutional (convenio/reference or out-of-band contact) for a centre, identity + safeguarding commitment for an artist (D27). This is a genuine reduction in the *unaccountable*-approval risk: the platform can now answer *who* approved a given node, *when*, and *on what stated basis* — evidence it could not previously produce at all. <br><br>**NOT built — the platform does not verify the attested basis.** The admin's basis is a **self-attested note**, not a verified credential: nothing in this change confirms a convenio reference is real, places an out-of-band call to the named institution, checks an uploaded certificate, or runs a background check. Facet (a)'s core risk is therefore **unchanged in kind**, only better-evidenced: an admin can still be deceived, careless, or (in the worst case) complicit, and the record that would exist afterwards proves *that a decision was attested*, not that the underlying claim was true. The collaboration-agreement (convenio) flow, certificate/accreditation upload, out-of-band contact tooling, and background-check integration remain the **named future work**, to be designed and built **before any real (non-demo) centre or artist onboards with real data**, and especially for the more vulnerable `widen-beyond-hospitals` populations. <br><br>**Honesty gate (R8, carried from D27).** No copy, prompt, help text, or document may state or imply that the platform *verified* a convenio, *confirmed* an identity, or *ran* a background check — the built control is "an accountable human decision with a recorded, role-cued basis," and the actual verification remains the admin's offline responsibility today. <br><br>Facet (b) is unchanged by this ADR set: still bounded to the **coarse six-value category only** (never a sub-label or unit name). Note that D10 was subsequently revised **twice** on purpose — `events-show-centre` (an event names its host centre: public name + city, already directory-public) and `centre-event-counts` (a centre card shows an aggregate count of its upcoming events and links to its filtered list). Neither changes facet (b): the directory's `(centreType, city)` identifiability signal is independent of, and unchanged by, the centre↔event link, and neither revision exposes the ward/room `location`, street address, an event date or an event title on the directory. Re-assessed for `centre-event-counts` specifically: a count does narrow "is this small palliative unit active at all", but it says nothing about any individual, and the same number was already derivable from `/events?centre=<name>`. Facet (b) is additionally guarded structurally — `ProfileReview` (basis, admin id, decision, timestamp) lives on a table never joined into either public read path, and the `PublicHospitalProjection` compile-time forbidden-key guard (D14) is extended to name the audit fields (`reviewBasis`, `adminAccountId`, `reviewedBy`, `reviewedAt`, `decision`, `reviews`), so an accidental future attempt to surface "last approved by" on the public directory fails `tsc` before any test runs (D26). |

### 4.2 Authentication, sessions, and request forgery

| ID | OWASP mapping | Asset affected | Vector | Impact | Likelihood | Expected control and status |
| --- | --- | --- | --- | --- | --- | --- |
| T-09 Re-registration without proving account control | A07:2025 / A07:2021 Authentication Failures | Profile lifecycle, Admin review queue | An attacker who knows a rejected Hospital/Artist email triggers `rejected → pending`; the current existing-account branch ignores the supplied password. | High governance and account-integrity impact. | Medium | **Mitigated.** The `pr2a-B2` gap is closed: any existing email must prove control by supplying the account's current password, verified with argon2id before any transition, and the requested role must match the stored `Account.role` (`registerProfile.ts:88-106`). Both checks run inside `withLockedRegistration`. Negative unit tests plus `registration-race.test.ts` executed in CI. |
| T-10 Credential stuffing, brute force, and account enumeration | A07:2025 / A07:2021 | Accounts and availability | Repeated login attempts, distributed attacks, or timing comparison between unknown-email and wrong-password paths. | High account compromise impact. | High on a public login endpoint | **Mitigated for the single-instance/known-vector cases.** The `pr2a-M2` gaps are closed: attempts are keyed by both email and a client key (`x-forwarded-for`, hashed and truncated at the boundary — `login/route.ts:34-40`); consumption is one atomic `INSERT … ON CONFLICT … RETURNING` per key inside a single transaction, failing closed on DB error (`loginRateLimiter.ts:99-155`); an unknown email burns an equivalent argon2id verification against a fixed dummy hash (`login.ts:112-116`); and unknown-account, wrong-password and locked-out all raise the same generic 401. `login-rate-limiter.test.ts` executed in CI. **Residual:** 5 failures / 15 min is not calibrated against distributed attacks, the `x-forwarded-for` client key is only as trustworthy as the platform proxy (documented in the route), and the retention purge job for `login_attempt_windows` is backlog. |
| T-11 Session theft, fixation, expiry or failed revocation | A04:2025, A07:2025 / A02, A07:2021 | Authenticated identity and all role actions | XSS, network/configuration error, database leak, session fixation, stale cookie, logout/deactivation race. | Critical impact. | Medium | **Mitigated at the application and persistence layers.** The cookie is `httpOnly`, `secure` in production, `SameSite=Lax`, path-scoped (`sessionCookie.ts:19-27`). Tokens are `randomBytes` CSPRNG values, always freshly generated on login (no fixation), and the row stores **only** `sha256(token)` — `session-lifecycle.test.ts:165-183` asserts against the persisted row that neither the row id nor the stored hash can authenticate. Absolute and idle expiry, conditional `touch`, logout deletion and `revokeAllForAccount` are covered by `session-lifecycle` and `profile-transition-session-revocation`, executed in CI. **Residual:** the XSS vector is only partly addressed — `httpOnly` blocks token theft, but there is **no CSP** (see T-16). |
| T-12 Login/deactivation race | A01:2025, A07:2025, A08:2025 / A01, A07, A08:2021 | Session validity and revoked privileges | Login and deactivation interleave; a session is issued after or concurrently with deactivation. | High integrity impact. | Medium | **Mitigated.** The live status check and session creation happen inside the same `withLockedProfile` transaction (`login.ts:137-150`). Both linearisation orders are covered: a login committing first may return a session, but the deactivation's own `revokeAllForAccount` cascade revokes it immediately; a login reaching the lock afterwards observes the committed status and is denied. The barrier-forced `login-vs-deactivation-race.test.ts` executed in CI against real PostgreSQL. The decision is documented explicitly at `login.ts:77-86`. |
| T-13 CSRF on login or authenticated mutations | A01:2025 / A01:2021 | Sessions, Slots, profile governance | A hostile site causes a victim’s browser to POST login, publish, approve, reject, close, validate, or deactivate using cookies. | High integrity impact. | Medium | **Mitigated.** `assertCsrfSafe` is invoked by **all eleven** mutating route handlers, including `POST /api/auth/login`. It compares `Origin`/`Referer` only against the configured `APP_ORIGIN` — never the request's own `Host` — and fails closed: an unset variable yields an empty canonical origin that matches nothing (`csrfGuard.ts:14-21`). `e2e/authorization-edge-cases.spec.ts` asserts that a missing `Origin` returns 403 *before* authentication is even attempted — executed in CI. SameSite=Lax is present but is explicitly documented as insufficient on its own. |

### 4.3 Input handling, configuration, operational security, and resilience

| ID | OWASP mapping | Asset affected | Vector | Impact | Likelihood | Expected control and status |
| --- | --- | --- | --- | --- | --- | --- |
| T-14 SQL injection or unsafe migration execution | A05:2025 / A03:2021 Injection | Database integrity/confidentiality | Dynamic SQL in repositories or misapplied raw SQL for the required partial indexes. | Critical impact. | Low to medium | **Mitigated for injection; least privilege still pending.** Every raw statement is a parameterised `Prisma.sql` template — the locking reads, the advisory lock and the rate-limiter upsert all interpolate values as bind parameters, never string concatenation. The plan-review B1 identifier-mismatch risk is closed by `partial-index-catalog.test.ts`, which asserts the real PostgreSQL catalog identifiers, and `schema-migration.test.ts`, which applies the full migration history to an empty database — both executed in CI. **Residual: Pending verification** — the production database account's privileges have not been reviewed and are not least-privilege by evidence. |
| T-15 Stored XSS, oversized content, and rendering abuse | A05:2025, A10:2025 / A03, A05:2021 | Visitor browser, database/log availability, public trust | User-controlled Slot title/description, Profile name, or Proposal message is rendered as HTML, logged unsafely, or made arbitrarily large. | High impact if script executes; medium availability impact. | Medium | **Partial/open gap — largely unchanged.** Slot `title`/`description`/`location` have domain bounds (`assertTextBounds`). Re-read on this revision, **Profile name and Proposal message are still unbounded**: `Proposal`'s `assertFields` validates only the three ids and never touches `message` (`Proposal.ts:55-59`), and `Profile` applies only `assertNonEmpty("name", …)`. `codex-pr1-review.md` M2 remains open. React escapes interpolated text by default and no `dangerouslySetInnerHTML` appears in `src/`, which limits the reflected-script path — but there is **no CSP**, no request body-size limit, and no normalisation. |
| T-16 Security misconfiguration and secret exposure | A02:2025 / A05:2021 | Secrets, database, sessions, HTTP responses | Weak/placeholder session secret, debug mode, permissive headers/CORS, exposed `.env`, TLS/HSTS gaps, publicly reachable local database, or trusted-host mistakes. | Critical impact. | Medium | **Partial/open gap — the most significant remaining exposure.** Closed: the canonical origin is implemented and fails closed (T-13); `.env*` is git-ignored and `.env.example` documents every required secret and its purpose; the rate-limiter secret fails loud at first use rather than degrading to an unkeyed hash; cookies carry correct production flags; TLS is provided by the platform. **Open, verified absent on this revision:** there are **no security response headers at all** — no Content-Security-Policy, no HSTS, no `frame-ancestors`/`X-Frame-Options`, no referrer or permissions policy. There is no `middleware.ts` and no `headers()` block in `next.config.ts`. There is also **no centralised environment validation** (a placeholder `SESSION_SECRET` will not fail startup), and `docker-compose.yml` still publishes `5432:5432` on all interfaces with a predictable dev password (local-only, but unchanged). |
| T-17 Dependency or build supply-chain compromise | A03:2025 / A06:2021 Vulnerable and Outdated Components | Entire application and deployment | Vulnerable or malicious dependency, lockfile drift, compromised CI/deployment credentials. | Critical impact. | Medium | **Pending verification — verified absent.** Closed: the lockfile is committed and CI uses `npm ci` with npm pinned to the version that generated it, so lockfile drift cannot silently occur. **Open:** `.github/` contains only `ci.yml` — there is no Dependabot configuration, no `npm audit` or scanning step in either CI job, no SBOM, and no documented dependency-update ownership. Deployment credential protection and provenance have not been reviewed. |
| T-18 Logging, alerting, and forensic gaps | A09:2025 / A09:2021 | Incident detection, privacy, governance evidence | Failed logins, authorisation denials, Admin actions, revocations or transaction failures are neither recorded nor actionable; alternatively logs record tokens/passwords/messages. | High detection and privacy impact. | Medium | **Pending verification — verified absent.** A search of `src/application/**` and `src/infrastructure/**` on this revision found **no logging implementation of any kind**: no logger, no security-event emission, no correlation id. Nothing is recorded for failed logins, authorisation denials, Admin decisions, revocations or transaction failures. The one positive is negative-by-construction — because nothing logs, nothing leaks credentials or messages into logs. Requirements unchanged: privacy-safe security events with correlation id, actor pseudonym, outcome and reason code; never passwords, session values, raw IPs, proposal text or exact locations; plus alerting and retention. |
| T-19 Unsafe exceptional-condition handling | A10:2025 / related A05/A09:2021 | Availability, data integrity, sensitive diagnostics | Failed adapter save, deadlock, unique violation, malformed request or dependency failure leaks a stack trace, retries unsafely, or leaves partial state. | High impact. | Medium | **Mitigated for diagnostics leakage and rollback; retry policy still open.** `toErrorResponse` is the single HTTP error boundary and always returns a short generic `{ error }` body — never the caught message or stack — mapping the application taxonomy to 401/403/404/409, `DomainError` to 422 and everything unmapped to a generic 500 (`httpErrors.ts`). The E2E denial matrix asserts each status code in CI. Partial state is prevented by the unit-of-work transactions (T-06, T-08), and unique violations surface as `ConflictError`. **Residual: Pending verification** — there is no deadlock retry policy, no idempotency decision for repeated mutations, and no request body-size limit. |
| T-20 SSRF and uncontrolled egress | A01:2025 (SSRF is included under access control) / A10:2021 SSRF | Internal network, cloud metadata, third-party credentials | Future URL preview, image fetch, webhook, EHR or payment integration fetches an attacker-controlled URL. | Critical if introduced. | Not currently applicable | No outbound fetch capability was observed in the permitted scope: **Not currently applicable**. Before any external integration, add URL allow-lists, DNS/IP revalidation, egress restrictions, timeouts, response-size limits, redirect controls and dedicated SSRF tests. |
| T-21 Privacy-retention and backup overcollection | A01/A02/A09:2025 / A01/A05/A09:2021 | Personal/context-sensitive data and backups | Indefinite storage of profiles, messages, client telemetry, logs or backups; deletion only from primary tables; public caches retain withdrawn data. | High privacy and trust impact. | Medium | The current artefacts specify minimisation but no approved retention/deletion schedule: **Pending product, legal and infrastructure decision**. See Section 6. |

## 5. OWASP Top 10 coverage map

OWASP Top 10:2025 changes category names and includes two new categories. The
following map keeps both versions visible so that the project can explain its
coverage to readers using either 2021 or 2025 terminology.

| OWASP Top 10:2025 | Related 2021 category | Vivetutiempo focus and required evidence |
| --- | --- | --- |
| A01 Broken Access Control | A01 Broken Access Control; 2021 A10 SSRF is now included here | **Covered with executed evidence.** Ownership, role, profile-type and live-status checks run inside the mutation transaction; the public projection is a runtime allow-list; CSRF is enforced on all eleven mutating routes. The denial matrix and the no-leak contract are asserted over real HTTP in CI. SSRF is not applicable (no egress). |
| A02 Security Misconfiguration | A05 Security Misconfiguration | **Weakest category.** Cookie flags, canonical origin, secret documentation and TLS are in place, but there are **no security response headers, no CSP and no environment validation**. See T-16. |
| A03 Software Supply Chain Failures | A06 Vulnerable and Outdated Components | **Largely uncovered.** The lockfile is committed and CI installs with `npm ci` under a pinned npm, preventing drift. There is no SBOM, no vulnerability monitoring, no audit step and no documented update ownership. See T-17. |
| A04 Cryptographic Failures | A02 Cryptographic Failures | **Covered with executed evidence.** Argon2id parameters are pinned explicitly (`m=19456,t=2,p=1`, v0x13) with upgrade-on-login; session values are CSPRNG; only `sha256(token)` is persisted, asserted directly against the row in CI; rate-limiter keys are server-keyed HMAC. Secret *rotation* procedure is documented for the limiter key only. |
| A05 Injection | A03 Injection | **Covered for SQL.** All raw statements are parameterised `Prisma.sql` templates; migration identifiers are verified against the live catalog in CI. React escapes output by default and no unsafe HTML rendering exists. Not covered: request body-size limits and Profile/Proposal text bounds (T-15). |
| A06 Insecure Design | A04 Insecure Design | **Covered, with two accepted open items.** Explicit state machines, allow-list projection (events and the centre directory), credential-verified re-registration, lock-first concurrency model, the orthogonal role/`CentreType` design (D16–D20), and adversarial review rounds recorded as artefacts. Retention decisions remain an open product/legal item (T-21); the widened safeguarding bar under an accountable-but-unverified admission decision is an accepted, demo-scoped open risk (T-22). |
| A07 Authentication Failures | A07 Identification and Authentication Failures | **Covered with executed evidence.** DB-backed session lifecycle with fresh token per login (no fixation), absolute and idle expiry, conditional touch, logout deletion and revoke-all; atomic rate limiting keyed by account and client; timing-parity login; CSRF on login. No password recovery flow exists — if one is added it needs its own analysis. |
| A08 Software or Data Integrity Failures | A08 Software and Data Integrity Failures | **Covered with executed evidence** for atomic registration, lock-first matching, partial unique indexes, transactional cascades and migration integrity, all proven by the PostgreSQL suite in CI. Build-pipeline security is not covered (see A03). |
| A09 Security Logging & Alerting Failures | A09 Security Logging and Monitoring Failures | **Not covered.** No logging implementation exists in the codebase. See T-18. |
| A10 Mishandling of Exceptional Conditions | Related to 2021 A05/A09 operational failure modes | **Mostly covered.** A single error boundary returns generic bodies with correct status codes and never leaks a stack; transactions roll back and unique violations map to conflicts. Deadlock retry policy, idempotency and availability limits remain open (T-19). |

The mapping follows the official [2025 list](https://owasp.org/Top10/2025/0x00_2025-Introduction/)
and the official [2021 list](https://owasp.org/Top10/2021/). In particular,
OWASP 2025 places CSRF and SSRF under Broken Access Control, reinforcing the
need to treat the public/API boundary as a first-class authorisation surface.

## 6. Privacy, minimisation, retention, and deletion requirements

This is a security model, not a legal determination. A data controller and
applicable jurisdiction must set the final privacy and retention policy before
production use. The following are minimum engineering requirements.

### 6.1 Minimisation and purpose limitation

1. Do not collect clinical, patient-identifying, diagnosis, treatment or
   emergency information. Make this prohibition visible in forms and
   moderation guidance.
2. Keep the public event projection to the specified five fields. In
   particular, do not publish room/ward, proposal message, email or database
   identifier, as required by
   [`public-event-browsing/spec.md`](../openspec/changes/bootstrap-vivetutiempo-platform/specs/public-event-browsing/spec.md).
3. Do not make exact Hospital locations available to anonymous users. Evaluate
   whether an active Artist needs exact location before a proposal is accepted;
   the current internal open-Slot listing includes it, so this is an explicit
   least-privilege decision to revisit.
4. Store the minimum data needed for account, governance and matching. A
   display name is not automatically public merely because it is stored.
5. Hash/truncate security telemetry such as client address and do not place
   messages, session IDs, credentials or locations in logs.
6. On the public centre directory, publish only the allow-listed institutional
   fields — name, city, postal code, coordinates and the coarse `centreType`
   category (D19) — and never the street address, email, internal `type` field,
   or any finer sub-label than the six-value category. The centre type is
   published because the product's discovery purpose requires families to
   distinguish centre kinds; keeping it coarse is the concrete mitigation for
   the single-surface identifiability recorded in T-22.

### 6.2 Retention and deletion design decisions still required

| Data class | Minimum requirement | Status |
| --- | --- | --- |
| Live sessions | Delete on logout/revoke; expire on absolute or idle expiry; clean expired rows. | **Implemented and executed.** Logout and revoke-all delete rows; `resolveValid`/`touch` delete rows they find expired. Covered by `session-lifecycle` and `profile-transition-session-revocation` in CI. No periodic sweep for rows never touched again. |
| Login-rate records | Use only short rolling-window retention; purge automatically; store no raw IP in application storage. | **Partially implemented.** The window is 15 minutes; rows reset in place when it lapses and are deleted on successful login; keys are HMAC pseudonyms and no raw IP is stored (the boundary hashes and truncates it). **Open:** an account never successfully logged into keeps one row per scoped key indefinitely — the periodic purge job is backlog, documented in the adapter. |
| Rejected/deactivated profiles | Define whether they are retained for governance/audit, anonymised after a period, or deleted on request subject to documented obligations. Re-registration traceability must not create indefinite data by accident. | Policy decision pending. |
| Proposals and messages | Define operational retention after rejection, closure and event completion. Messages should not survive indefinitely merely because they are convenient. | Policy decision pending. |
| Published events | Define correction/withdrawal behaviour, cache invalidation, and whether historical event data is anonymised. | Policy and HTTP-cache implementation pending. |
| Audit/security logs | Retain a minimised, access-controlled history for a defined period; separate security evidence from content data. | Policy and implementation pending. |
| Backups | Encrypt/access-control backups, set expiry, and document how deletion/anonymisation propagates or is honoured at restoration. | Infrastructure decision pending. |

Deletion workflows must be transactionally safe and auditable without retaining
the data that a deletion request was meant to remove. For example, an audit
record can retain a pseudonymous event and timestamp, but must not copy a
proposal message, password data, session bearer value, or exact location.

## 7. Infrastructure verification gate

This gate was written while infrastructure was under construction. It has now
been walked. Each item below is annotated with its outcome on `482aefd`:
**[met]** (verified, with executed evidence where the item demands behaviour),
**[partly met]**, or **[not met]**.

### Authentication, session, and CSRF

- **[met]** Cookies are `HttpOnly`, `Secure` in production, path-scoped and
  `SameSite=Lax`; the login response body carries only the role, never the
  token, and no token appears in HTML, URL or API JSON.
- **[met]** Session values are CSPRNG-generated (`randomBytes`) and only
  `sha256(token)` is persisted — asserted directly against the row in CI.
- **[met]** Absolute expiry, idle expiry and conditional `touch` are enforced,
  and logout/rejection/deactivation delete the intended rows. **[partly met]**
  Expired rows are deleted when encountered, but there is no periodic sweep.
- **[met]** Profile transition plus revoke-all, and the login profile check plus
  session creation, are each inside one `withLockedProfile` transaction;
  verified by a barrier-forced race test in CI.
- **[partly met]** Login rate limits are atomic and shared through PostgreSQL
  (so they hold across serverless instances), use an HMAC-pseudonymised client
  key, and return indistinguishable responses with equivalent argon2id work on
  the unknown-account path. **Not met:** automatic cleanup of stale rows.
- **[met]** Every mutation including login fails closed on missing, malformed or
  cross-site `Origin`/`Referer`, comparing only to the configured `APP_ORIGIN`
  and never to an attacker-supplied `Host`; asserted in CI.

### Persistence, concurrency, and data exposure

- **[met]** `withLockedSlot` locks the Slot row before any decision-informing
  read, loads the complete Proposal set in the same transaction, and persists
  atomically.
- **[met]** The partial unique indexes use the real quoted identifiers and enum
  values, asserted against the PostgreSQL catalog in CI; unique violations map
  to `ConflictError` without partial state.
- **[partly met]** Integration tests force both orderings of the
  submit/approve/close/reject races, duplicate submissions and the
  deactivation/login race — nine barrier-forced files, executed in CI.
  **Not met:** induced storage-failure/rollback tests.
- **[met]** The Profile lifecycle migration supports `DEACTIVATED` and
  `reviewRequestedAt`, and the full migration history applies to an empty
  database in CI. The rollback story is documented in `docs/deployment.md`.
- **[met]** The public query selects only published Events and only allowed
  columns, builds a fresh runtime DTO field by field, and an E2E test asserts
  the exact allowed key set plus the absence of every forbidden value in the
  raw JSON.

### HTTP, deployment, and operations

- **[partly met]** Route handlers derive identity solely from a verified
  session, return safe generic error bodies, and mutate only over POST.
  **Not met:** request *schema* validation and body-size limits are minimal —
  bodies are coerced with `String(...)` rather than validated against a schema.
- **[partly met]** Output rendering uses React's default text escaping and no
  unsafe HTML anywhere in `src/`. **Not met:** no CSP, `frame-ancestors`,
  referrer, permissions or transport headers are configured — there is no
  `middleware.ts` and no `headers()` block in `next.config.ts`.
- **[partly met]** Secrets are not committed and `.env.example` documents each
  one; the rate-limiter secret fails loud at first use. **Not met:** a
  placeholder `SESSION_SECRET` does not fail startup, the production DB
  account's privileges have not been reviewed, and backup protection is
  unverified.
- **[not met]** No dependency scanning, no documented update ownership, no
  logging, no alerting and no incident-response procedure exist.

> **TODO (autor):** the four "not met" items above — security headers/CSP,
> request schema and body-size validation, environment validation at startup,
> and dependency scanning plus security logging — are the honest remaining
> security scope. Decide whether to implement any of them before the defence or
> to present them explicitly as the identified next hardening milestone. Either
> choice is defensible; silently omitting them is not.

## 8. Prioritised remediation order

The first four gates of the previous revision have been met and the public
endpoint is deployed. Their outcomes:

1. ✅ **T-04/T-05 closed** — runtime allow-list mapper plus an executed HTTP
   no-leak test asserting the exact key set.
2. ✅ **T-09 closed** — re-registration verifies the account password and the
   role match atomically inside `withLockedRegistration`.
3. ✅ **T-11/T-12 closed** — verified against the real session and transaction
   adapters, including a barrier-forced login/deactivation race.
4. ✅ **T-06 closed** — proven by nine deterministic barrier-forced PostgreSQL
   integration tests plus enforced partial unique indexes.
5. ⚠️ **T-10 and T-13 closed; T-15 and T-16 remain open.** The deployment is
   already Internet-facing, so these are live residual risks rather than
   pre-deployment gates. In mitigation: the platform provides TLS, the data is
   entirely fictional demo data, and React's default escaping limits the T-15
   rendering vector. This does not make them closed.

Remaining priority order, for a system that is already exposed:

1. **T-16 — security headers and a CSP.** The single highest-value remaining
   control, and the one a security-literate tribunal is most likely to probe.
2. **T-15 — bound and normalise Profile name and Proposal message**, and add a
   request body-size limit.
3. **T-18/T-17 — privacy-safe security logging and dependency scanning**, before
   treating the MVP as operationally defensible.
4. **T-07 — complete the aggregate status matrix** as defence in depth against
   corrupt persisted data.
5. **T-21 — agree a retention and deletion schedule** before any real (non-demo)
   data is ever processed.

**Accepted, not queued for this scope:** **T-22 — the widened safeguarding bar**
(residencias, disability day/occupational centres, palliative units) is
*accepted and documented* at demo scope, not a control to fully close now.
`auditable-profile-approval` (D21–D27) built the **accountable decision** —
every admission is now attributable to a named admin, a timestamp, and a
recorded basis — but did **not** build the **verification** of that basis.
Its named follow-on is real institutional verification/accreditation
(convenio confirmation, certificate upload, out-of-band contact, background
checks) for the more vulnerable centre types, to be designed and built before
any such centre or artist onboards with real (non-demo) data. It is listed
here so it is visible, not because a mitigation is scheduled.

## Source evidence

- [`design.md`](../openspec/changes/bootstrap-vivetutiempo-platform/design.md), ADRs D1, D4, D6, D7 and D8.
- [Profile onboarding specification](../openspec/changes/bootstrap-vivetutiempo-platform/specs/profile-onboarding/spec.md).
- [Slot and Proposal coordination specification](../openspec/changes/bootstrap-vivetutiempo-platform/specs/slot-proposal-coordination/spec.md).
- [Public event browsing specification](../openspec/changes/bootstrap-vivetutiempo-platform/specs/public-event-browsing/spec.md).
- [`src/domain/`](../src/domain/), [`src/application/`](../src/application/),
  [`src/infrastructure/`](../src/infrastructure/) and [`src/app/`](../src/app/)
  reviewed source (this revision reads all four, unlike the earlier one).
- [`prisma/schema.prisma`](../prisma/schema.prisma), the migration history,
  [`prisma/seed.ts`](../prisma/seed.ts) and
  [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
- CI run [29905717933](https://github.com/lezama4/webmaster/actions/runs/29905717933)
  on `482aefd` — `test` 360/360, `e2e` 12/12.
- [`docs/deployment.md`](deployment.md) for the production runbook and rollback path.
- [Adversarial planning review](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-planning-review.md), [PR 1 review](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr1-review.md), [PR 2 plan review](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr2-plan-review.md), and [PR 2a review](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr2a-review.md).
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/) and [OWASP Top 10:2021](https://owasp.org/Top10/2021/).
