# Delta for Public Hospital Directory

## MODIFIED Requirements

### Requirement: PublicHospitalProjection Is an Exact Allow-List

The public directory response MUST continue to expose, per centre, exactly the key set `name`, `city`, `postalCode`, `latitude`, `longitude`, `centreType` — no more, no fewer. In addition to the fields already forbidden (`addressLine`, email, any internal id, `type`), the `ForbiddenPublicHospitalKey` compile-time guard MUST be extended to name the audit fields this change introduces — `reviewBasis`, `adminAccountId`/`reviewedBy`, `reviewedAt`, and a `reviews` relation key — so that an accidental future attempt to surface any of them on the public projection fails `tsc` at the interface edit, before any test runs.
(Previously: the forbidden-key union did not need to name any review/audit field, because no such field existed.)

#### Scenario: The six-key allow-list is unchanged by this change

- GIVEN one or more active centres returned by the public directory after this change ships
- WHEN the projected object's keys are sorted and compared to `["centreType", "city", "latitude", "longitude", "name", "postalCode"]`
- THEN they MUST be deep-equal — this change adds no key to the public response

#### Scenario: The forbidden-key guard now names the audit fields

- GIVEN `ForbiddenPublicHospitalKey` as edited by this change
- WHEN a future contributor attempts to add `reviewBasis`, `adminAccountId`, `reviewedBy`, `reviewedAt`, or `reviews` to `PublicHospitalProjection`
- THEN the `_NoForbiddenFields` compile-time assert fails `tsc` immediately, before any test is run

#### Scenario: A hostile adapter supplying review/audit fields is stripped by the field-by-field rebuild

- GIVEN a fake port implementation that returns, per centre, the six allow-listed fields PLUS `reviewBasis`, `adminAccountId`, and `reviewedAt`
- WHEN the `listPublicHospitals` use case is invoked
- THEN the resulting projection for that centre contains only the six allow-listed keys, with none of the injected audit fields present

#### Scenario: The existing no-leak suites still pass, unchanged in intent

- GIVEN the existing exact-key-set unit test and the e2e raw-JSON no-leak assertion, as they existed before this change
- WHEN they are re-run after this change ships
- THEN both still pass, asserting the same six keys and the continued absence of every forbidden value — this change does not weaken or narrow either suite

### Requirement: Audit Data Is Structurally Absent From Both Public Surfaces, Not Merely Filtered Out

`ProfileReview` rows (basis, admin id, timestamps) live on a table separate from `Profile` and are never joined into either public read path. `PublicEventProjection` (ADR D6) carries no centre identity at all, so there is nothing on the event side for audit data to attach to. This structural separation, not a runtime filter, is what makes leakage impossible.

#### Scenario: A ProfileReview row cannot appear in the profiles-backed directory query

- GIVEN the public directory's Prisma query (`PublicHospitalDirectoryQuery`)
- WHEN its `select` clause is inspected
- THEN it selects only columns on `profiles` and contains no join against `ProfileReview`

#### Scenario: The public Events surface still has no field an audit value could attach to

- GIVEN the public Events surface after this change ships
- WHEN the projected object's keys are inspected for any published Event
- THEN no key represents a centre identity, a review basis, an admin id, or a review timestamp — unchanged from before this change, because `PublicEventProjection` never carried centre identity to begin with
