# Delta for Public Hospital Directory

## MODIFIED Requirements

### Requirement: Anonymous Public Listing of Active Centres

Anyone, without authentication, MUST be able to query the public directory. Only profiles with `type: CENTRE` and `status: ACTIVE` MUST appear — this covers all six `centreType` kinds through the single renamed role/profile-type value, NOT a six-way `centreType IN (...)` predicate (ADR D19: the security predicate stays a one-value check). Pending, rejected, deactivated, or non-centre (artist) profiles MUST NOT appear, under any query.
(Previously: predicate was `type: HOSPITAL`; scope was hospitals only.)

#### Scenario: Active centre of any type appears

- GIVEN a profile with `type: CENTRE`, `status: ACTIVE`, and any `centreType`
- WHEN an anonymous visitor queries the public directory
- THEN that centre appears in the results

#### Scenario: Pending centre is excluded

- GIVEN "Hospital Esperanza" with `status: PENDING`
- WHEN an anonymous visitor queries the public directory, with or without a search term matching Esperanza
- THEN Esperanza MUST NOT appear in the results

#### Scenario: Rejected or deactivated centre is excluded

- GIVEN a centre profile with `status: REJECTED` or `status: DEACTIVATED`, any `centreType`
- WHEN an anonymous visitor queries the public directory
- THEN that profile MUST NOT appear

#### Scenario: Active artist profile is excluded

- GIVEN an Artist profile with `status: ACTIVE`
- WHEN an anonymous visitor queries the public directory
- THEN that Artist profile MUST NOT appear

#### Scenario: Security predicate is a single renamed check, not a six-value list

- GIVEN the six `centreType` values now exist in the data
- WHEN the directory's query predicate is inspected
- THEN it filters on `type: "CENTRE"` (one literal) plus `status: "ACTIVE"`, and contains no `centreType IN (...)` clause

#### Scenario: A pre-existing hospital row shows centreType hospital

- GIVEN a Hospital profile that existed before this change's migration
- WHEN an anonymous visitor fetches it through the public directory after migration
- THEN it appears with `centreType: "hospital"`

### Requirement: PublicHospitalProjection Is an Exact Allow-List

The public directory response MUST expose, per centre, exactly the key set `name`, `city`, `postalCode`, `latitude`, `longitude`, `centreType` — no more, no fewer. `addressLine`, email, any account or internal database id, the internal `type` (role/profile-type) field, and every other `Profile` field MUST NOT appear, in any form. `type` remains forbidden even though `centreType` is newly admitted — they are different fields on different axes (ADR D19).
(Previously: allow-list was 5 keys — `name`, `city`, `postalCode`, `latitude`, `longitude` — and did not include `centreType`.)

#### Scenario: Response contains exactly the six allow-listed keys

- GIVEN one or more active centres returned by the public directory
- WHEN the projected object's keys are sorted and compared to `["centreType", "city", "latitude", "longitude", "name", "postalCode"]`
- THEN they MUST be deep-equal — an extra key or a missing key is a failure

#### Scenario: type (the role/profile-type field) never appears

- GIVEN one or more active centres of varying `centreType`
- WHEN the projected object's keys are inspected
- THEN `type` MUST NOT appear, only `centreType`

#### Scenario: addressLine is present in source data but never in the response

- GIVEN a centre profile with a populated `addressLine`
- WHEN an anonymous visitor fetches that centre through the public directory
- THEN the response MUST NOT contain the `addressLine` field or its value in any form

#### Scenario: Hostile adapter injecting type or event-derived fields is stripped

- GIVEN a fake port implementation that returns, per centre, `addressLine`, an email, an internal `id`, the forbidden `type` field, and event-derived fields (`Slot.location`, an event count) in addition to the six allow-listed fields
- WHEN the use case is invoked
- THEN the resulting projection for that centre contains only the six allow-listed keys, with none of the injected extra fields present

### Requirement: Seed Data Provides Multiple Active Centres of Multiple Types for Demonstration

The seed script MUST keep the existing active hospital rows (`centreType: "hospital"`) unchanged and MUST add five NEW active centres, one per non-hospital `centreType`, in distinct cities, applied idempotently (upsert keyed by a fixed id). "Hospital Esperanza" MUST remain `PENDING`.
(Previously: seed added 3–4 new active hospitals only; no non-hospital `centreType` existed.)

#### Scenario: Seed produces all six centre types, demonstrably filterable

- GIVEN the widened seed has run
- WHEN the public directory is queried with an empty search term
- THEN at least one ACTIVE centre of each of the six `centreType` values is returned, across distinct cities

#### Scenario: Seed script remains idempotent

- GIVEN the seed script has already run once after this change
- WHEN it is run again
- THEN no duplicate rows are created and the fixed ids resolve to the same rows

## ADDED Requirements

### Requirement: centreType Is a Public, Filterable Category

The directory MUST let an anonymous visitor filter results by `centreType`, in addition to the existing text search, combined by logical AND. Filtering MUST be reflected in the URL (`?type=`) and the result count MUST be announced through the existing `aria-live` region (ADR D11/D12, unchanged mechanism).

#### Scenario: A family filters by "residencia"

- GIVEN active centres of multiple `centreType` values including at least one `nursing_home`
- WHEN an anonymous visitor selects the "Residencia de mayores" filter
- THEN only centres with `centreType: "nursing_home"` remain in the results, and the URL reflects `?type=nursing_home`

#### Scenario: Type filter combines with text search

- GIVEN active centres of multiple types across multiple cities
- WHEN a visitor selects a `centreType` filter and enters a city search term
- THEN only centres matching BOTH the type and the city term appear

#### Scenario: The directory shows the type

- GIVEN an active centre returned by the directory
- WHEN it is rendered in the list or map
- THEN its `centreType` label is visibly displayed (e.g. as a tag), not merely present in the underlying data
