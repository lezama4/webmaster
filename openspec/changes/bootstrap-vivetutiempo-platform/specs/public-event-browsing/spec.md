# Public Event Browsing Specification

## Purpose

Governs anonymous, unauthenticated browsing of published Events — the platform's public front door.

## Requirements

### Requirement: Anonymous Public Browsing of Published Events

Anyone, without authentication, MUST be able to browse published Events. Items that are not published (open Slots, submitted or rejected Proposals) MUST NOT appear in public browsing.

#### Scenario: Anonymous visitor browses published Events

- GIVEN one or more published Events
- WHEN an anonymous visitor opens the public Events list
- THEN only published Events are shown, with no login required

#### Scenario: Non-published items never appear publicly

- GIVEN a Proposal that is `submitted` or `rejected` (not yet an Event)
- WHEN an anonymous visitor browses public Events
- THEN that item MUST NOT appear

#### Scenario: No published Events yet

- GIVEN no Events have been published
- WHEN an anonymous visitor opens the public Events list
- THEN the system MUST show an empty state, not an error

### Requirement: The Public Projection Is an Explicit Allow-List

The public, unauthenticated Events endpoint/view MUST return only an explicit allow-list projection per Event: `title`, `description`, `scheduledAt`, `durationMinutes`, and the accepted Proposal's Artist public display name. It MUST NOT expose the Slot's exact `location` (ward/room), the accepted Proposal's `message`, any email address, or any internal database identifier (Slot id, Proposal id, Profile id, Account id). This projection MUST be built as a dedicated allow-list mapping, never by returning a Slot/Proposal/Profile entity or relation directly.

#### Scenario: Public Event response omits location

- GIVEN a published Event originating from a Slot with a `location` of "Ward 3, Room 12"
- WHEN an anonymous visitor fetches that Event through the public Events list
- THEN the response MUST NOT contain the `location` field or its value in any form

#### Scenario: Public Event response omits the Proposal message

- GIVEN a published Event whose originating Proposal has a private `message` to the Hospital
- WHEN an anonymous visitor fetches that Event through the public Events list
- THEN the response MUST NOT contain that `message` field or its value

#### Scenario: Public Event response omits emails and internal identifiers

- GIVEN a published Event linked to a Hospital Profile, an Artist Profile, a Slot, and a Proposal, each with their own database id, and Accounts with email addresses
- WHEN an anonymous visitor fetches that Event through the public Events list
- THEN the response MUST NOT contain any Account email, nor any Slot id, Proposal id, Profile id, or Account id
- AND the response MUST contain the Artist's public display name (Profile name), not the Artist's email or Profile id

#### Scenario: Non-published items never leak a forbidden field either

- GIVEN a Slot that is `open` or `closed`, and a Proposal that is `submitted` or `rejected` (neither has produced a published Event)
- WHEN an anonymous visitor browses public Events
- THEN neither that Slot's nor that Proposal's data — published or not — MUST ever appear, whether as a full item or as a leaked individual field
