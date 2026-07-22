# Public Hospital Directory Specification

## Purpose

Governs anonymous, unauthenticated discovery of participating hospitals via `PublicHospitalProjection` — a second, independent public allow-list (ADR D9), separate from `PublicEventProjection` (ADR D6). Also governs the seed data that makes the directory demonstrable.

## Requirements

### Requirement: Anonymous Public Listing of Active Hospitals

Anyone, without authentication, MUST be able to query the public hospital directory. Only profiles with `type: HOSPITAL` and `status: ACTIVE` MUST appear. Pending, rejected, deactivated, or non-hospital profiles MUST NOT appear, under any query.

#### Scenario: Active hospital appears

- GIVEN a Hospital profile with `type: HOSPITAL`, `status: ACTIVE`
- WHEN an anonymous visitor queries the public hospital directory
- THEN that hospital appears in the results

#### Scenario: Pending hospital is excluded

- GIVEN "Hospital Esperanza" with `status: PENDING`
- WHEN an anonymous visitor queries the public hospital directory, with or without a search term matching Esperanza
- THEN Esperanza MUST NOT appear in the results

#### Scenario: Rejected or deactivated hospital is excluded

- GIVEN a Hospital profile with `status: REJECTED` or `status: DEACTIVATED`
- WHEN an anonymous visitor queries the public hospital directory
- THEN that profile MUST NOT appear

#### Scenario: Active non-hospital profile is excluded

- GIVEN an Artist profile with `status: ACTIVE`
- WHEN an anonymous visitor queries the public hospital directory
- THEN that Artist profile MUST NOT appear

#### Scenario: No active hospitals

- GIVEN no profile with `type: HOSPITAL` and `status: ACTIVE` exists
- WHEN an anonymous visitor queries the public hospital directory
- THEN the system MUST show an empty state, not an error

### Requirement: PublicHospitalProjection Is an Exact Allow-List

The public hospital directory response MUST expose, per hospital, exactly the key set `name`, `city`, `postalCode`, `latitude`, `longitude` — no more, no fewer. `addressLine`, email, any account or internal database id, and every other `Profile` field MUST NOT appear, in any form.

#### Scenario: Response contains exactly the allow-listed keys

- GIVEN one or more active hospitals returned by the public hospital directory
- WHEN the projected object's keys are sorted and compared to `["city", "latitude", "longitude", "name", "postalCode"]`
- THEN they MUST be deep-equal — an extra key or a missing key is a failure

#### Scenario: addressLine is present in source data but never in the response

- GIVEN a Hospital profile with a populated `addressLine`
- WHEN an anonymous visitor fetches that hospital through the public directory
- THEN the response MUST NOT contain the `addressLine` field or its value in any form

### Requirement: Use Case Rebuilds the DTO Field-by-Field

The application-layer use case MUST NOT pass through, spread, or forward the port adapter's returned object. It MUST construct a fresh `PublicHospitalProjection` literal field by field, matching the pr2a-B1 defense-in-depth pattern already used by `listPublishedEvents`.

#### Scenario: Hostile adapter cannot leak extra fields

- GIVEN a fake port implementation that returns, per hospital, `addressLine`, an email, an internal `id`, and event-derived fields (e.g. `Slot.location`, an event count, a `hasUpcomingEvents` boolean), in addition to the allow-listed fields
- WHEN the use case is invoked
- THEN the use case's output for that hospital MUST contain only the 5 allow-listed keys, with none of the injected extra fields present

### Requirement: Search by Name, City, and Postal Code

The system MUST allow filtering the directory by hospital name, city, and postal code. Matching MUST be case-insensitive, MUST match on a partial substring, and MUST be insensitive to Spanish diacritics (a query or stored value with or without accents matches the other, e.g. `"Coruna"` matches `"A Coruña"`). An empty or blank query MUST return all active hospitals. A query with no matches MUST return an empty result, not an error.

#### Scenario: Case-insensitive partial name match

- GIVEN an active hospital named "Hospital San Juan"
- WHEN an anonymous visitor searches `"san juan"`
- THEN that hospital appears in the results

#### Scenario: Partial city match

- GIVEN an active hospital in "Bilbao"
- WHEN an anonymous visitor searches by city `"bilb"`
- THEN that hospital appears in the results

#### Scenario: Postal code partial match

- GIVEN an active hospital with postal code `"28046"`
- WHEN an anonymous visitor searches by postal code `"280"`
- THEN that hospital appears in the results

#### Scenario: Accent-insensitive city match

- GIVEN an active hospital in a city stored as `"A Coruña"`
- WHEN an anonymous visitor searches `"coruna"` (no diacritic)
- THEN that hospital appears in the results

#### Scenario: Empty query returns all active hospitals

- GIVEN 3 active hospitals and 1 pending hospital
- WHEN an anonymous visitor submits an empty search query
- THEN exactly the 3 active hospitals are returned

#### Scenario: No-match query returns an empty result

- GIVEN active hospitals exist, none matching the term "Zzzznotreal"
- WHEN an anonymous visitor searches `"Zzzznotreal"`
- THEN the system returns an empty result, not an error

### Requirement: Hospitals Without Coordinates Are Listed but Not Pinned

A hospital with a missing or null `latitude` or `longitude` MUST still appear in list and search results — name, city, and postal code remain independently useful to answer "is my hospital part of this". It MUST be excluded from the map's pin rendering, since plotting a missing coordinate would require an arbitrary default (e.g. `0,0`) and would misrepresent the hospital's location. Excluding it from the map only, not from the directory, is the deliberate choice.

#### Scenario: Hospital with null coordinates is listed but not pinned

- GIVEN an active hospital with `latitude: null` and `longitude: null`
- WHEN an anonymous visitor views the directory
- THEN that hospital appears in the list/search results
- AND that hospital does NOT appear among the map's rendered pins

#### Scenario: Hospital with valid coordinates is listed and pinned

- GIVEN an active hospital with valid `latitude`/`longitude`
- WHEN an anonymous visitor views the directory
- THEN that hospital appears both in the list and as a map pin

### Requirement: Hospital Directory Contains No Event Data

The public hospital directory response MUST NOT contain any Slot-, Proposal-, or Event-derived field for any hospital — no event count, no "next activity", no "has upcoming events" boolean, no shared identifier that would let it be joined to the public Events surface. This is the hospital-to-event half of the non-correlation invariant (ADR D10); the event-to-hospital half is specified in `public-event-browsing`.

#### Scenario: Hospital with published events looks identical in shape to one without

- GIVEN one active hospital with several published Events and another active hospital with none
- WHEN an anonymous visitor fetches both through the public hospital directory
- THEN both responses have exactly the same 5 allow-listed keys, with no extra field present or absent based on event activity

#### Scenario: Hostile adapter injecting event-derived fields is stripped

- GIVEN a fake port that attaches an `eventCount` or `nextActivity` field to a hospital's data
- WHEN the use case is invoked
- THEN the resulting projection MUST NOT contain that field

### Requirement: Seed Data Provides Multiple Active Hospitals for Demonstration

The seed script MUST add 3–4 NEW active hospitals in distinct Spanish cities with plausible coordinates, applied idempotently (upsert keyed by a fixed id). "Hospital Esperanza" MUST remain `PENDING`. "Hospital San Juan" MUST remain `ACTIVE` and keep its existing fields unchanged.

#### Scenario: Seed script is idempotent

- GIVEN the seed script has already run once
- WHEN it is run again
- THEN no duplicate hospital rows are created, and the fixed ids resolve to the same rows

#### Scenario: Esperanza and San Juan are unaffected

- GIVEN the expanded seed has run
- WHEN their profiles are queried
- THEN "Hospital Esperanza" has `status: PENDING`
- AND "Hospital San Juan" has `status: ACTIVE` with its pre-existing name, city, postal code, and coordinates unchanged

#### Scenario: Seed produces a searchable, mappable dataset

- GIVEN the expanded seed has run
- WHEN the public hospital directory is queried with an empty search term
- THEN at least 4 active hospitals are returned, across at least 3 distinct cities and postal codes
