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
